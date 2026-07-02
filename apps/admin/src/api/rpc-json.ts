import { readApiErrorMessage } from '@/api/typed-response'

export async function parseRpcJson<T>(res: Response, statusFallback: string): Promise<T> {
  if (!res.ok) {
    throw new Error((await readApiErrorMessage(res)) || statusFallback)
  }
  return res.json() as Promise<T>
}
