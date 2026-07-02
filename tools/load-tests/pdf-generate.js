import http from 'k6/http'
import { check } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''
const INSPECTION_ID = __ENV.INSPECTION_ID || ''

export const options = {
  scenarios: {
    pdf_burst: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 10,
      maxDuration: '3m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    checks: ['rate>0.9'],
  },
}

export default function () {
  if (!AUTH_TOKEN || !INSPECTION_ID) {
    throw new Error('Set AUTH_TOKEN and INSPECTION_ID for PDF load test')
  }

  const payload = JSON.stringify({
    inspectionId: INSPECTION_ID,
    reportType: 'INSPECTION',
  })

  const res = http.post(`${BASE_URL}/api/reports/generate`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    timeout: '120s',
  })

  check(res, { 'pdf generate 201': (r) => r.status === 201 })
}
