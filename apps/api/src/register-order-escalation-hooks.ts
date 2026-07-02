import { deficiencyNotificationHooks } from './services/deficiency.service.js'
import { orderEscalationService } from './services/order-escalation.service.js'

const previousOnStopWork = deficiencyNotificationHooks.onStopWorkOrderIssued

deficiencyNotificationHooks.onStopWorkOrderIssued = async (payload) => {
  await orderEscalationService.onStopWorkIssued({
    deficiencyId: payload.deficiencyId,
    inspectionId: payload.inspectionId,
  })
  await previousOnStopWork(payload)
}
