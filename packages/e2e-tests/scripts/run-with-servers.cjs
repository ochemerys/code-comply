#!/usr/bin/env node

/**
 * E2E Test Runner with Automatic Server Management
 * 
 * This script:
 * 1. Detects if dev servers are running
 * 2. Allocates available ports for test servers
 * 3. Starts all required applications
 * 4. Runs E2E tests
 * 5. Cleans up servers after tests complete
 */

const { spawn } = require('child_process')
const path = require('path')
const { TestServerManager } = require('./test-server-manager.cjs')

async function runTests() {
  const serverManager = new TestServerManager()
  let exitCode = 0
  
  try {
    // Start all test servers
    const ports = await serverManager.start()
    
    // Run Cucumber tests with port configuration
    console.log('🧪 Running E2E tests...\n')
    
    const cucumberArgs = [
      '--config', 'cucumber.cjs',
      '--tags', 'not @wip'
    ]
    
    // Add any additional arguments passed to this script
    const additionalArgs = process.argv.slice(2)
    cucumberArgs.push(...additionalArgs)
    
    const prevNodeOpts = process.env.NODE_OPTIONS || ''
    const testProcess = spawn('npx', ['cucumber-js', ...cucumberArgs], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_OPTIONS: `${prevNodeOpts} --import tsx --no-warnings`.trim(),
        E2E_API_PORT: ports.api.toString(),
        E2E_INSPECTOR_PORT: ports.inspector.toString(),
        E2E_ADMIN_PORT: ports.admin.toString(),
        E2E_API_URL: `http://localhost:${ports.api}`,
        E2E_INSPECTOR_URL: `http://localhost:${ports.inspector}`,
        E2E_ADMIN_URL: `http://localhost:${ports.admin}`
      },
      stdio: 'inherit'
    })
    
    // Wait for tests to complete
    exitCode = await new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        resolve(code || 0)
      })
      
      testProcess.on('error', (error) => {
        console.error('❌ Error running tests:', error)
        reject(error)
      })
    })
    
    if (exitCode === 0) {
      console.log('\n✅ All E2E tests passed!\n')
    } else {
      console.log(`\n❌ E2E tests failed with exit code ${exitCode}\n`)
    }
    
  } catch (error) {
    console.error('\n❌ Error during test execution:', error)
    exitCode = 1
  } finally {
    // Always clean up servers
    await serverManager.stop()
  }
  
  process.exit(exitCode)
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, cleaning up...')
  process.exit(130)
})

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received SIGTERM, cleaning up...')
  process.exit(143)
})

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
