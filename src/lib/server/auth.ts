import "server-only"

import { randomInt } from "node:crypto"

import { hash, verify as verifyHash } from "@node-rs/argon2"
import { generateSecret, generateURI, verify as verifyTotpCode } from "otplib"
import QRCode from "qrcode"

import { decrypt } from "@/lib/server/crypto"

// docs/05 §1 and §3: Argon2id passwords, TOTP 2FA, single-use recovery codes.

export const hashPassword = (password: string) => hash(password)

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verifyHash(passwordHash, password)
  } catch {
    return false
  }
}

/** A small built-in list (docs/05 §1); length ≥ 12 is checked separately. */
const COMMON = new Set([
  "123456789012",
  "password1234",
  "passwordpassword",
  "qwertyuiop12",
  "qwertyuiopas",
  "iloveyou1234",
  "adminadmin12",
  "administrator",
  "welcome12345",
  "pakistan1234",
  "letmein12345",
  "111111111111",
  "000000000000",
  "abcdefghijkl",
  "abc123abc123",
])

/** null when acceptable, else the reason. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters."
  if (password.length > 200) return "Use at most 200 characters."
  if (COMMON.has(password.toLowerCase())) return "Choose a less common password."
  return null
}

/* TOTP --------------------------------------------------------------- */

const PERIOD = 30

export const newTotpSecret = () => generateSecret()

export function totpUri(secret: string, account: string) {
  return generateURI({ issuer: "Renewals", label: account, secret })
}

/** Locally generated SVG (no external QR service, docs/05 §3). */
export function qrSvg(uri: string) {
  return QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
}

/** "JBSW Y3DP …" for typing by hand. */
export const groupKey = (secret: string) => secret.replace(/(.{4})(?=.)/g, "$1 ")

/**
 * 30 s step, 6 digits, window ±1, and replay protection: a code whose
 * step is ≤ the last used step is rejected. Returns the matched step.
 */
export async function verifyTotp(
  secretEnc: string,
  code: string,
  lastStep: number | null,
  now: Date = new Date()
): Promise<{ ok: true; step: number } | { ok: false }> {
  if (!/^\d{6}$/.test(code)) return { ok: false }
  const secret = decrypt(secretEnc)
  const result = await verifyTotpCode({
    secret,
    token: code,
    epoch: Math.floor(now.getTime() / 1000),
    epochTolerance: PERIOD,
    ...(lastStep !== null ? { afterTimeStep: lastStep } : {}),
  })
  if (!result.valid || !("epoch" in result)) return { ok: false }
  return { ok: true, step: Math.floor(result.epoch / PERIOD) }
}

/* Recovery codes ------------------------------------------------------ */

// No 0/O/1/I/L, so codes read back unambiguously.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function part(n: number) {
  return Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
}

/** 8 codes like "K7QPM-2XHTR" (docs/05 §3). */
export const newRecoveryCodes = () => Array.from({ length: 8 }, () => `${part(5)}-${part(5)}`)

export const normaliseRecoveryCode = (code: string) =>
  code.trim().toUpperCase().replace(/\s+/g, "")

export const hashRecoveryCodes = (codes: string[]) =>
  Promise.all(codes.map((c) => hash(normaliseRecoveryCode(c))))

/** The remaining hashes after using `code`, or null if it matched none. */
export async function consumeRecoveryCode(
  hashes: unknown,
  code: string
): Promise<string[] | null> {
  if (!Array.isArray(hashes)) return null
  const clean = normaliseRecoveryCode(code)
  for (let i = 0; i < hashes.length; i++) {
    const h = hashes[i]
    if (typeof h === "string" && (await verifyHash(h, clean).catch(() => false))) {
      return hashes.filter((_, j) => j !== i) as string[]
    }
  }
  return null
}
