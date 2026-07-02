import { z } from 'zod'
import { SubmitVoCDTOSchema } from '@codecomply/validators'

/** Parsed VoC form output — matches SubmitVoCDTO. */
export const VoCFormPayloadSchema = SubmitVoCDTOSchema

export type VoCFormPayload = z.output<typeof VoCFormPayloadSchema>
