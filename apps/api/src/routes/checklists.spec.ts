import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import checklistsRoutes from './checklists'
import { checklistService } from '../services/checklist.service'
import { ChecklistMapper } from '../mappers/checklist.mapper'

vi.mock('../services/checklist.service')
vi.mock('../mappers/checklist.mapper')

const createTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('userId', 'user-123')
    await next()
  })
  testApp.route('/', checklistsRoutes)
  return testApp
}

describe('Checklists Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /templates', () => {
    it('returns template DTOs', async () => {
      const templates = [{ id: 't1', name: 'T', discipline: 'Building' }] as any
      const dtos = [{ id: 't1', name: 'T', discipline: 'Building', items: [] }] as any

      vi.mocked(checklistService.listTemplates).mockResolvedValue(templates)
      vi.mocked(ChecklistMapper.toTemplateDTOs).mockReturnValue(dtos)

      const app = createTestApp()
      const res = await app.request('/templates')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(dtos)
      expect(checklistService.listTemplates).toHaveBeenCalledWith(undefined)
    })

    it('passes discipline query', async () => {
      vi.mocked(checklistService.listTemplates).mockResolvedValue([] as any)
      vi.mocked(ChecklistMapper.toTemplateDTOs).mockReturnValue([])

      const app = createTestApp()
      await app.request('/templates?discipline=Electrical')
      expect(checklistService.listTemplates).toHaveBeenCalledWith('Electrical')
    })

    it('returns 500 when listing fails unexpectedly', async () => {
      vi.mocked(checklistService.listTemplates).mockRejectedValue(new Error('database unavailable'))

      const app = createTestApp()
      const res = await app.request('/templates')
      expect(res.status).toBe(500)
    })
  })

  describe('GET /templates/:id', () => {
    it('returns a single template', async () => {
      const tpl = { id: 't1', items: [] } as any
      const dto = { id: 't1', items: [] } as any
      vi.mocked(checklistService.getTemplate).mockResolvedValue(tpl)
      vi.mocked(ChecklistMapper.toTemplateDTO).mockReturnValue(dto)

      const app = createTestApp()
      const res = await app.request('/templates/t1')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(dto)
    })

    it('returns 404 when template missing', async () => {
      vi.mocked(checklistService.getTemplate).mockRejectedValue(
        new Error('Checklist template not found'),
      )

      const app = createTestApp()
      const res = await app.request('/templates/x')
      expect(res.status).toBe(404)
    })

    it('returns 500 on unexpected getTemplate error', async () => {
      vi.mocked(checklistService.getTemplate).mockRejectedValue(new Error('timeout'))

      const app = createTestApp()
      const res = await app.request('/templates/t1')
      expect(res.status).toBe(500)
    })
  })

  describe('GET /executions/:id', () => {
    it('returns execution DTO', async () => {
      const withTpl = {
        id: 'ex1',
        inspectionId: 'in1',
        templateId: 't1',
        template: { id: 't1' },
      } as any
      const dto = { id: 'ex1', progress: 0, responses: [], templateId: 't1' } as any

      vi.mocked(checklistService.getExecutionForUser).mockResolvedValue(withTpl)
      vi.mocked(ChecklistMapper.toExecutionDTO).mockReturnValue(dto)

      const app = createTestApp()
      const res = await app.request('/executions/ex1')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(dto)
      expect(checklistService.getExecutionForUser).toHaveBeenCalledWith('ex1', 'user-123')
    })

    it('returns 403 when unauthorized', async () => {
      vi.mocked(checklistService.getExecutionForUser).mockRejectedValue(
        new Error('Unauthorized access to inspection'),
      )

      const app = createTestApp()
      const res = await app.request('/executions/ex1')
      expect(res.status).toBe(403)
    })

    it('returns 404 when execution or inspection missing', async () => {
      vi.mocked(checklistService.getExecutionForUser).mockRejectedValue(
        new Error('Checklist execution not found'),
      )

      const app = createTestApp()
      const res = await app.request('/executions/missing')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /executions', () => {
    it('creates execution and returns DTO', async () => {
      const created = { id: 'ex1', inspectionId: 'in1', templateId: 't1' } as any
      const withTpl = { ...created, template: { id: 't1' } } as any
      const dto = { id: 'ex1', progress: 0, responses: [] } as any

      vi.mocked(checklistService.startExecution).mockResolvedValue(created)
      vi.mocked(checklistService.getExecutionWithTemplate).mockResolvedValue(withTpl)
      vi.mocked(ChecklistMapper.toExecutionDTO).mockReturnValue(dto)

      const app = createTestApp()
      const res = await app.request('/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: 'in1', templateId: 't1' }),
      })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual(dto)
    })

    it('returns 404 when inspection or template missing', async () => {
      vi.mocked(checklistService.startExecution).mockRejectedValue(
        new Error('Inspection not found'),
      )

      const app = createTestApp()
      const res = await app.request('/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: 'in1', templateId: 't1' }),
      })
      expect(res.status).toBe(404)
    })

    it('returns 500 when start execution fails unexpectedly', async () => {
      vi.mocked(checklistService.startExecution).mockRejectedValue(new Error('deadlock'))

      const app = createTestApp()
      const res = await app.request('/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: 'in1', templateId: 't1' }),
      })
      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /executions/:id/responses', () => {
    it('updates response and returns execution DTO', async () => {
      const withTpl = { id: 'ex1', template: { id: 't1' } } as any
      const dto = { id: 'ex1', progress: 50, responses: [] } as any

      vi.mocked(checklistService.updateResponse).mockResolvedValue(undefined as any)
      vi.mocked(checklistService.getExecutionWithTemplate).mockResolvedValue(withTpl)
      vi.mocked(ChecklistMapper.toExecutionDTO).mockReturnValue(dto)

      const app = createTestApp()
      const res = await app.request('/executions/ex1/responses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'i1',
          result: 'PASS',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(dto)
      expect(checklistService.updateResponse).toHaveBeenCalledWith(
        'ex1',
        'i1',
        expect.objectContaining({ result: 'PASS' }),
      )
    })

    it('returns 400 for business validation errors', async () => {
      vi.mocked(checklistService.updateResponse).mockRejectedValue(
        new Error('codeReference is required when result is FAIL'),
      )

      const app = createTestApp()
      const res = await app.request('/executions/ex1/responses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'i1',
          result: 'FAIL',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 500 on unexpected update error', async () => {
      vi.mocked(checklistService.updateResponse).mockRejectedValue(new Error('deadlock'))

      const app = createTestApp()
      const res = await app.request('/executions/ex1/responses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'i1',
          result: 'PASS',
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
      })
      expect(res.status).toBe(500)
    })
  })
})
