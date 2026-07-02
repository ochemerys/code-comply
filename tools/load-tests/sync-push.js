import http from 'k6/http'
import { check } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''
const INSPECTION_ID = __ENV.INSPECTION_ID || ''

export const options = {
  scenarios: {
    concurrent_sync: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<5000'],
  },
}

export default function () {
  if (!AUTH_TOKEN || !INSPECTION_ID) {
    throw new Error('Set AUTH_TOKEN and INSPECTION_ID for sync load test')
  }

  const payload = JSON.stringify({
    mutations: [
      {
        clientId: `k6-${__VU}-${__ITER}-${Date.now()}`,
        entity: 'deficiency',
        operation: 'create',
        payload: {
          inspectionId: INSPECTION_ID,
          description: `k6 load ${__VU}`,
          severity: 'MINOR',
          location: 'Load zone',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  })

  const res = http.post(`${BASE_URL}/api/sync/push`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  })

  check(res, { 'sync push 200': (r) => r.status === 200 })
}
