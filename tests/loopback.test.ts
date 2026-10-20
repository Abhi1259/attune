import { afterAll, describe, expect, it } from 'vitest'
import { get } from 'node:http'
import { LoopbackAuthServer } from '../src/main/auth/loopback'

describe('LoopbackAuthServer', () => {
  let server: LoopbackAuthServer | null = null

  afterAll(() => {
    server?.close()
  })

  it('accepts a matching callback and resolves the code', async () => {
    server = new LoopbackAuthServer()
    const port = 52331
    const pending = server.start(port, 'state-123')

    // wait for the server to open, then deliver a valid callback
    await new Promise<void>((resolve, reject) => {
      const tick = (attempts: number) => {
        if (attempts > 50) return reject(new Error('server never opened'))
        const req = get(`http://127.0.0.1:${port}/callback?code=abc&state=state-123`, (res) => {
          void res
          resolve()
        })
        req.on('error', () => setTimeout(() => void tick(attempts + 1), 50))
      }
      void tick(0)
    })

    await expect(pending).resolves.toEqual({ code: 'abc', state: 'state-123' })
  })

  it('rejects on state mismatch (CSRF guard)', async () => {
    server = new LoopbackAuthServer()
    const port = 52331
    const pending = server.start(port, 'expected-state')
    const swallow = pending.catch(() => undefined) // rejection expected; keeps unhandled-rejection detector quiet

    await new Promise<void>((resolve) => {
      const req = get(`http://127.0.0.1:${port}/callback?code=zz&state=evil`, () => resolve())
      req.on('error', () => setTimeout(resolve, 100))
    })

    await expect(pending).rejects.toThrow(/state/i)
    await swallow
  })
})
