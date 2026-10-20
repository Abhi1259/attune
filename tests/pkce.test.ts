import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { base64url, createPkcePair, randomState } from '../src/main/auth/pkce'

describe('base64url', () => {
  it('encodes without +, / or padding', () => {
    expect(base64url(Buffer.from('??'))).not.toMatch(/[+/=]/)
    expect(base64url('a'.repeat(100))).not.toMatch(/[+/=]/)
  })
})

describe('createPkcePair (RFC 7636)', () => {
  it('verifier is within the 43..128 char bounds', () => {
    const { verifier } = createPkcePair()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('challenge is base64url(SHA256(verifier))', () => {
    const { verifier, challenge } = createPkcePair()
    const expected = createHash('sha256').update(verifier, 'ascii').digest()
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(challenge).toBe(expected)
  })

  it('produces different pairs each call', () => {
    expect(createPkcePair().challenge).not.toBe(createPkcePair().challenge)
  })
})

describe('randomState', () => {
  it('is url-safe and non-empty', () => {
    const state = randomState()
    expect(state.length).toBeGreaterThan(16)
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
