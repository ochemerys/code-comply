import type { User } from '@codecomply/db'
import { prisma } from '@codecomply/db'
import type { LoginDTO } from '@codecomply/validators'
import * as bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import * as crypto from 'crypto'

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export class AuthService {
  /**
   * Authenticate user and create session
   */
  async login(credentials: LoginDTO): Promise<TokenPair> {
    console.log('Login attempt for:', credentials.email)
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    })

    console.log('User found:', !!user)
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
    console.log('Password valid:', isValid)
    if (!isValid) {
      throw new Error('Invalid credentials')
    }

    // Clean up old sessions to prevent conflicts
    await prisma.session.deleteMany({
      where: { userId: user.id },
    })

    // Generate tokens
    const tokenPair = await this.generateTokenPair(user)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return tokenPair
  }

  /**
   * Create a session after OIDC SSO (user already authenticated by IdP).
   */
  async createSessionForEmail(email: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive')
    }

    await prisma.session.deleteMany({
      where: { userId: user.id },
    })

    const tokenPair = await this.generateTokenPair(user)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return tokenPair
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string; sessionId: string }

    // Find session
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token')
    }

    // Delete old session
    await prisma.session.delete({
      where: { id: session.id },
    })

    // Generate new token pair
    return this.generateTokenPair(session.user)
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sessionId: string }
      await prisma.session.delete({
        where: { id: decoded.sessionId },
      })
    } catch (error) {
      // Ignore errors (e.g., token already expired)
      // This prevents crashes if a client tries to log out with an invalid token
    }
  }

  /**
   * Validate access token and return user
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId: string }

      // Find session by its ID
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true },
      })

      // Verify the session is valid and belongs to the user in the token
      if (!session || session.userId !== decoded.userId || session.expiresAt < new Date()) {
        return null
      }

      return session.user
    } catch (error) {
      // Token is invalid or expired
      return null
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokenPair(user: User): Promise<TokenPair> {
    const sessionId = crypto.randomUUID()

    // @ts-expect-error - JWT types are complex, but this works at runtime
    const accessToken = jwt.sign({ userId: user.id, role: user.role, sessionId }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    })

    // @ts-expect-error - JWT types are complex, but this works at runtime
    const refreshToken = jwt.sign({ userId: user.id, sessionId }, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    })

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    // Store session
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: accessToken, // For reference, not for lookup
        refreshToken,
        expiresAt,
      },
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    }
  }
}

export const authService = new AuthService()
