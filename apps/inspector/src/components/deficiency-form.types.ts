import { z } from 'zod'
import { CreateDeficiencyDTOSchema } from '@codecomply/validators'

export const DeficiencyFormPayloadSchema = CreateDeficiencyDTOSchema.omit({ clientId: true })

/** Parsed form output (defaults applied) — matches CreateDeficiencyDTO minus clientId. */
export type DeficiencyFormPayload = z.output<typeof DeficiencyFormPayloadSchema>
