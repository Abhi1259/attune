import http from 'node:http'
import { URL } from 'node:url'

export type AuthCode = { code: string; state: string }
export type AuthError = { error: string; errorDescription: string }

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const HTML = (title: string, message: string, ok: boolean) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; display: grid; place-items: center; height: 100vh; margin: 0; background: #faf9f7; color: #1a1917;">
  <div style="text-align: center;">
    <p style="font-size: 22px; margin: 0 0 8px; font-weight: 600;">${title}</p>
    <p style="margin: 0; color: #6f6a63;">${message}</p>
    <p style="margin: 24px 0 0; color: #a8a29a; font-size: 12px;">${ok ? 'You can close this window and return to Attune.' : 'Return to Attune and try again.'}</p>
  </div>
</body></html>`

/**
 * Minimal loopback HTTP server implementing RFC 8252 §7.3.
 * Listens on the fixed registered port and accepts exactly one authorization callback.
 */
export class LoopbackAuthServer {
  private server: http.Server | null = null
  private timeout: NodeJS.Timeout | null = null

  /** Resolves with the authorization code or rejects. Loop is torn down either way. */
  start(port: number, expectedState: string): Promise<AuthCode> {
    return new Promise<AuthCode>((resolve, reject) => {
      let settled = false
      const finishOk = (result: AuthCode) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      const finishErr = (err: Error) => {
        if (settled) return
        settled = true
        reject(err)
      }

      this.server = http.createServer((req, res) => {
        const parsed = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
        if (parsed.pathname !== '/callback') {
          res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
          res.end(HTML('Attune', 'Unknown page.', false))
          return
        }
        const error = parsed.searchParams.get('error')
        const code = parsed.searchParams.get('code')
        const state = parsed.searchParams.get('state') ?? ''

        if (error) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(HTML('Sign-in not completed', parsed.searchParams.get('error_description') ?? error, false))
          finishErr(new Error(error === 'access_denied' ? 'Authorization was denied.' : error))
          this.close()
          return
        }
        if (!code) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(HTML('Sign-in not completed', 'Missing authorization code.', false))
          finishErr(new Error('Missing authorization code in callback'))
          this.close()
          return
        }
        if (state !== expectedState || !expectedState) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(HTML('Sign-in not completed', 'Invalid state parameter. Please try again.', false))
          finishErr(new Error('OAuth state mismatch (possible CSRF)'))
          this.close()
          return
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(HTML('Signed in', 'Authorization complete.', true))
        finishOk({ code, state })
        this.close()
      })

      this.server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          finishErr(new Error(`Port ${port} is already in use. Another Attune instance or app is holding it. Close the other program and retry.`))
        } else {
          finishErr(err)
        }
      })

      this.server.listen(port, '127.0.0.1', () => {
        this.timeout = setTimeout(() => {
          finishErr(new Error('Timed out waiting for the browser sign-in (5 minutes).'))
          this.close()
        }, LOGIN_TIMEOUT_MS)
      })
    })
  }

  close(): void {
    if (this.timeout) clearTimeout(this.timeout)
    if (this.server) {
      this.server.close()
      this.server.closeAllConnections?.()
      this.server = null
    }
  }
}
