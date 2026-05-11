import { createHash } from 'crypto'

export function generateBodyHash(body: string): string {
  return createHash('sha256').update(body.trim()).digest('hex')
}
