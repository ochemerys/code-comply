/**
 * E2E Test Server Manager
 * 
 * Starts all required applications for E2E testing with dynamic port allocation
 * to avoid conflicts with running development servers.
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const waitOn = require('wait-on')
const { allocateTestPorts, checkDevServersRunning } = require('./port-manager.cjs')

class TestServerManager {
  constructor() {
    this.processes = []
    this.ports = null
    this.envFile = path.join(__dirname, '../.env.test')
  }

  /**
   * Initialize and start all test servers
   */
  async start() {
    console.log('🚀 Starting E2E Test Servers...\n')
    
    // Check for running dev servers
    await checkDevServersRunning()
    
    // Allocate available ports
    this.ports = await allocateTestPorts()
    
    // Setup database
    await this.setupDatabase()
    
    // Create .env.test file with port configuration
    this.createTestEnvFile()
    
    // Start all servers
    await this.startAPI()
    await this.startInspector()
    await this.startAdmin()
    
    // Wait for all servers to be ready
    await this.waitForServers()
    
    console.log('\n✅ All test servers are ready!\n')
    console.log('📋 Test Server URLs:')
    console.log(`   API:       http://localhost:${this.ports.api}`)
    console.log(`   Inspector: http://localhost:${this.ports.inspector}`)
    console.log(`   Admin:     http://localhost:${this.ports.admin}`)
    console.log('')
    
    return this.ports
  }

  /**
   * Setup test database
   */
  async setupDatabase() {
    console.log('🗄️  Setting up test database...')
    
    const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
    
    if (!databaseUrl) {
      console.error('❌ E2E_DATABASE_URL or DATABASE_URL must be set')
      throw new Error('Database URL not configured')
    }
    
    // Check if it's a test database (safety check)
    if (!databaseUrl.includes('_test') && !databaseUrl.includes('test-') && process.env.NODE_ENV !== 'test') {
      console.error('��� Database URL does not appear to be a test database!')
      console.error('   Expected "_test" or "test-" in database name')
      console.error('   Or NODE_ENV=test to be set')
      throw new Error('Refusing to use non-test database for E2E tests')
    }
    
    console.log(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`)
    console.log('✅ Database configured')
  }

  /**
   * Create .env.test file with port configuration
   */
  createTestEnvFile() {
    const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
    
    const envContent = `# E2E Test Environment Configuration
# Auto-generated - DO NOT EDIT MANUALLY

# Server Ports
E2E_API_PORT=${this.ports.api}
E2E_INSPECTOR_PORT=${this.ports.inspector}
E2E_ADMIN_PORT=${this.ports.admin}

# API URLs for frontend apps
VITE_API_URL=http://localhost:${this.ports.api}

# Database Configuration
E2E_DATABASE_URL=${databaseUrl}
DATABASE_URL=${databaseUrl}
`
    
    fs.writeFileSync(this.envFile, envContent)
    console.log(`📝 Created test environment file: ${this.envFile}\n`)
  }

  /**
   * Start API server
   */
  async startAPI() {
    console.log(`🔧 Starting API server on port ${this.ports.api}...`)
    
    const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
    
    const apiProcess = spawn('pnpm', ['--filter', '@codecomply/api', 'dev'], {
      cwd: path.resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        PORT: this.ports.api.toString(),
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        RATE_LIMIT_LOGIN_MAX: process.env.RATE_LIMIT_LOGIN_MAX || '1000',
        RATE_LIMIT_API_MAX: process.env.RATE_LIMIT_API_MAX || '10000',
        RATE_LIMIT_UPLOAD_MAX: process.env.RATE_LIMIT_UPLOAD_MAX || '1000',
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    // Log output for debugging
    apiProcess.stdout.on('data', (data) => {
      if (process.env.DEBUG) {
        console.log(`[API] ${data.toString().trim()}`)
      }
    })
    
    apiProcess.stderr.on('data', (data) => {
      if (process.env.DEBUG) {
        console.error(`[API ERROR] ${data.toString().trim()}`)
      }
    })
    
    apiProcess.on('error', (error) => {
      console.error(`❌ API server error:`, error)
    })
    
    this.processes.push({ name: 'API', process: apiProcess })
  }

  /**
   * Start Inspector PWA
   */
  async startInspector() {
    console.log(`🔧 Starting Inspector PWA on port ${this.ports.inspector}...`)
    
    const inspectorProcess = spawn('pnpm', ['--filter', '@codecomply/inspector', 'dev'], {
      cwd: path.resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        PORT: this.ports.inspector.toString(),
        VITE_API_URL: `http://localhost:${this.ports.api}`,
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    inspectorProcess.stdout.on('data', (data) => {
      if (process.env.DEBUG) {
        console.log(`[Inspector] ${data.toString().trim()}`)
      }
    })
    
    inspectorProcess.stderr.on('data', (data) => {
      if (process.env.DEBUG) {
        console.error(`[Inspector ERROR] ${data.toString().trim()}`)
      }
    })
    
    inspectorProcess.on('error', (error) => {
      console.error(`❌ Inspector server error:`, error)
    })
    
    this.processes.push({ name: 'Inspector', process: inspectorProcess })
  }

  /**
   * Start Admin Portal
   */
  async startAdmin() {
    console.log(`🔧 Starting Admin Portal on port ${this.ports.admin}...`)
    
    const adminProcess = spawn('pnpm', ['--filter', '@codecomply/admin', 'dev'], {
      cwd: path.resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        PORT: this.ports.admin.toString(),
        VITE_API_URL: `http://localhost:${this.ports.api}`,
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    adminProcess.stdout.on('data', (data) => {
      if (process.env.DEBUG) {
        console.log(`[Admin] ${data.toString().trim()}`)
      }
    })
    
    adminProcess.stderr.on('data', (data) => {
      if (process.env.DEBUG) {
        console.error(`[Admin ERROR] ${data.toString().trim()}`)
      }
    })
    
    adminProcess.on('error', (error) => {
      console.error(`❌ Admin server error:`, error)
    })
    
    this.processes.push({ name: 'Admin', process: adminProcess })
  }

  /**
   * Wait for all servers to be ready
   */
  async waitForServers() {
    console.log('\n⏳ Waiting for servers to be ready...')
    
    const resources = [
      `http://localhost:${this.ports.api}/health`,
      `http://localhost:${this.ports.inspector}`,
      `http://localhost:${this.ports.admin}`
    ]
    
    try {
      await waitOn({
        resources,
        timeout: 120000, // 2 minutes
        interval: 1000,
        window: 1000,
        verbose: !!process.env.DEBUG
      })
    } catch (error) {
      console.error('\n❌ Timeout waiting for servers to start')
      console.error('   Tried to connect to:')
      resources.forEach(url => console.error(`   - ${url}`))
      throw error
    }
  }

  /**
   * Stop all test servers
   */
  async stop() {
    console.log('\n🛑 Stopping test servers...')
    
    for (const { name, process } of this.processes) {
      try {
        console.log(`   Stopping ${name}...`)
        process.kill('SIGTERM')
        
        // Give it 5 seconds to gracefully shutdown
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Force kill if still running
        if (!process.killed) {
          process.kill('SIGKILL')
        }
      } catch (error) {
        console.error(`   Error stopping ${name}:`, error.message)
      }
    }
    
    // Clean up .env.test file
    if (fs.existsSync(this.envFile)) {
      fs.unlinkSync(this.envFile)
      console.log(`   Cleaned up ${this.envFile}`)
    }
    
    console.log('✅ All servers stopped\n')
  }

  /**
   * Get current port configuration
   */
  getPorts() {
    return this.ports
  }
}

module.exports = { TestServerManager }
