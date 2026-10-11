import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

// AES-256-GCM with APP_KEY (docs/05 §10): TOTP secrets and the SMTP password.
// Stored as "v1.<iv>.<tag>.<ciphertext>", each part base64url.

function key(): Buffer {
  const raw = process.env.APP_KEY?.trim()
  if (!raw) throw new Error("APP_KEY is not set (generate: openssl rand -base64 32)")
  const k = Buffer.from(raw.replace(/^base64:/, ""), "base64")
  if (k.length !== 32) throw new Error("APP_KEY must be 32 random bytes, base64-encoded")
  return k
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => p.toString("base64url")).join(".")
}

/** Throws if the value was tampered with or APP_KEY changed. */
export function decrypt(stored: string): string {
  const [version, iv, tag, data] = stored.split(".")
  if (version !== "v1" || !iv || !tag || data === undefined)
    throw new Error("Unrecognised encrypted value")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url")
