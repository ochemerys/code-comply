# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy package files
COPY packages/validators/package.json ./packages/validators/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/validators ./packages/validators
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Generate Prisma client
RUN cd packages/db && pnpm db:generate

# Build packages and API
RUN pnpm build --filter=@codecomply/validators
RUN pnpm build --filter=@codecomply/db
RUN pnpm build --filter=@codecomply/api

# Production stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/validators/dist ./packages/validators/dist
COPY --from=builder /app/packages/validators/package.json ./packages/validators/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/node_modules/.prisma ./packages/db/node_modules/.prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Set working directory to API
WORKDIR /app/apps/api

# Copy node_modules to API directory
COPY --from=builder /app/node_modules ./node_modules

# Expose port (configurable via environment variable)
EXPOSE 3000

# Start the API
CMD ["node", "dist/index.js"]
