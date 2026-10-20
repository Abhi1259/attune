import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  /** Unix ms when the access token expires */
  accessTokenExpiresAt: number
  scope: string
}

/**
 * Encrypted token vault backed by Electron's safeStorage:
 * DPAPI (Windows), Keychain (macOS), libsecret/kwallet (Linux).
 * Tokens are never written to disk in plaintext.
 */
export class TokenVault {
  private get file(): string {
    return path.join(app.getPath('userData'), 'attune.vault')
  }

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  load(): StoredTokens | null {
    if (!fs.existsSync(this.file)) return null
    try {
      const encrypted = Buffer.from(fs.readFileSync(this.file, 'utf-8'), 'base64')
      const json = safeStorage.decryptString(encrypted)
      return JSON.parse(json) as StoredTokens
    } catch (err) {
      // Corrupt or undecryptable (e.g. OS user changed). Treat as signed out; never delete silently? clear.
      console.warn('[vault] failed to decrypt tokens, treating as signed out:', err)
      return null
    }
  }

  save(tokens: StoredTokens): void {
    if (!this.isEncryptionAvailable()) {
      throw new Error('OS secure storage is unavailable; cannot store tokens securely.')
    }
    fs.writeFileSync(this.file, safeStorage.encryptString(JSON.stringify(tokens)).toString('base64'), 'utf-8')
  }

  clear(): void {
    try {
      fs.unlinkSync(this.file)
    } catch {
      /* not present */
    }
  }
}
