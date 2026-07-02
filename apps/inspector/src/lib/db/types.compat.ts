import type {
  ChecklistExecutionDTO,
  DeficiencyDTO,
  InspectionDTO,
  PermitListDTO,
  PhotoDTO,
} from '@codecomply/validators'
import type {
  LocalChecklist,
  LocalDeficiency,
  LocalInspection,
  LocalPermit,
  LocalPhoto,
} from './types'

type AssertExtends<A, B> = A extends B ? true : never

export type _checkInspection = AssertExtends<LocalInspection, InspectionDTO>
export type _checkDeficiency = AssertExtends<LocalDeficiency, DeficiencyDTO>
export type _checkChecklist = AssertExtends<LocalChecklist, ChecklistExecutionDTO>
export type _checkPhoto = AssertExtends<LocalPhoto, PhotoDTO>
export type _checkPermit = AssertExtends<LocalPermit, PermitListDTO>
