import { createHash, randomBytes } from 'node:crypto'

/** RFC 4648 base64url without padding */
export function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/**
 * Authorization Code + PKCE pair per RFC 7636.
 * verifier: 64 random bytes rendered base64url (~86 chars, valid 43..128)
 * challenge: base64url(SHA256(verifier)) sent with code_challenge_method=S256
 */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(64))
  const challenge = base64url(createHash('sha256').update(verifier, 'ascii').digest())
  return { verifier, challenge }
}

export function randomState(): string {
  return base64url(randomBytes(24))
}
