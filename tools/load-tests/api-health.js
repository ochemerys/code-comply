import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    checks: ['rate>0.99'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/health`)
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has ok': (r) => r.body && r.body.includes('ok'),
  })
  sleep(0.01)
}
