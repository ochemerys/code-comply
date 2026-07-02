/** postMessage payload from SW → page when Background Sync fires. */
export const BG_SYNC_MESSAGE_TYPE = 'inspector:bg-sync' as const

export type BgSyncMessage = {
  type: typeof BG_SYNC_MESSAGE_TYPE
  tag: string
}

export function isBgSyncMessage(data: unknown): data is BgSyncMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as BgSyncMessage).type === BG_SYNC_MESSAGE_TYPE &&
    typeof (data as BgSyncMessage).tag === 'string'
  )
}
