import type { AuditLog } from '@codecomply/db'
import type { AuditLogEntryDTO } from '@codecomply/validators'

export class AuditLogMapper {
  static toDTO(entry: AuditLog): AuditLogEntryDTO {
    return {
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      timestamp: entry.timestamp.toISOString(),
      metadata:
        entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
          ? (entry.metadata as Record<string, unknown>)
          : undefined,
    }
  }

  static toDTOs(entries: AuditLog[]): AuditLogEntryDTO[] {
    return entries.map((entry) => AuditLogMapper.toDTO(entry))
  }
}
