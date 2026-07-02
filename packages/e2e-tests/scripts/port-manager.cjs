/**
 * Port Manager for E2E Tests
 *
 * Handles dynamic port allocation to avoid conflicts with running dev servers.
 * Uses a different port range for test servers.
 */

const net = require('net')

// Default ports for development
// Using less common ports to avoid conflicts with other Node.js projects
const DEFAULT_PORTS = {
  api: 4000, // API server
  inspector: 5175, // Avoiding 5173 (commonly in use)
  admin: 5174, // Vite default + 1
}

// Test port range (offset by 3000 to avoid conflicts)
// This puts test servers in the 7000-8000 range which is rarely used
const TEST_PORT_OFFSET = 3000

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        resolve(false)
      }
    })

    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port)
  })
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    if (await isPortAvailable(port)) {
      return port
    }
  }
  throw new Error(`Could not find available port starting from ${startPort}`)
}

/**
 * Allocate ports for all test servers
 *
 * Strategy:
 * 1. Try test port range first (default + offset)
 * 2. If occupied, find next available ports
 * 3. Return port configuration
 */
async function allocateTestPorts() {
  console.log('🔍 Checking port availability...')

  const ports = {
    api: null,
    inspector: null,
    admin: null,
  }

  // Try to allocate API port
  const apiTestPort = DEFAULT_PORTS.api + TEST_PORT_OFFSET
  if (await isPortAvailable(apiTestPort)) {
    ports.api = apiTestPort
    console.log(`✅ API port: ${ports.api} (test range)`)
  } else {
    ports.api = await findAvailablePort(apiTestPort + 1)
    console.log(`✅ API port: ${ports.api} (dynamic)`)
  }

  // Try to allocate Inspector port
  const inspectorTestPort = DEFAULT_PORTS.inspector + TEST_PORT_OFFSET
  if (await isPortAvailable(inspectorTestPort)) {
    ports.inspector = inspectorTestPort
    console.log(`✅ Inspector port: ${ports.inspector} (test range)`)
  } else {
    ports.inspector = await findAvailablePort(inspectorTestPort + 1)
    console.log(`✅ Inspector port: ${ports.inspector} (dynamic)`)
  }

  // Admin port must never match inspector (dynamic find can otherwise return the same free port).
  const adminTestPort = DEFAULT_PORTS.admin + TEST_PORT_OFFSET
  if ((await isPortAvailable(adminTestPort)) && adminTestPort !== ports.inspector) {
    ports.admin = adminTestPort
    console.log(`✅ Admin port: ${ports.admin} (test range)`)
  } else {
    const start = Math.max(adminTestPort + 1, ports.inspector + 1)
    ports.admin = await findAvailablePort(start)
    console.log(`✅ Admin port: ${ports.admin} (dynamic)`)
  }

  return ports
}

/**
 * Check if default dev ports are in use
 */
async function checkDevServersRunning() {
  const checks = await Promise.all([
    isPortAvailable(DEFAULT_PORTS.api).then((available) => ({
      service: 'API',
      port: DEFAULT_PORTS.api,
      available,
    })),
    isPortAvailable(DEFAULT_PORTS.inspector).then((available) => ({
      service: 'Inspector',
      port: DEFAULT_PORTS.inspector,
      available,
    })),
    isPortAvailable(DEFAULT_PORTS.admin).then((available) => ({
      service: 'Admin',
      port: DEFAULT_PORTS.admin,
      available,
    })),
  ])

  const running = checks.filter((c) => !c.available)

  if (running.length > 0) {
    console.log('\n⚠️  Warning: Development servers detected:')
    running.forEach((s) => {
      console.log(`   - ${s.service} running on port ${s.port}`)
    })
    console.log('   E2E tests will use separate test ports (7000+ range) to avoid conflicts.\n')
  }

  return running
}

module.exports = {
  allocateTestPorts,
  checkDevServersRunning,
  isPortAvailable,
  DEFAULT_PORTS,
  TEST_PORT_OFFSET,
}
