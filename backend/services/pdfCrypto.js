/**
 * backend/utils/pdfCrypto.js
 * ─────────────────────────────────────────────────────────────────────────
 * Implements the PDF "Standard Security Handler", Revision 3 (128-bit RC4)
 * as defined by ISO 32000-1 / the historical PDF Reference §7.6 (Algorithms
 * 3.1 through 3.6). This is the actual password-protection mechanism baked
 * into the PDF format itself — the same mechanism Adobe Acrobat, qpdf, and
 * every standards-compliant PDF reader understand natively.
 *
 * WHY THIS FILE EXISTS: pdf-lib (deliberately) does not implement PDF
 * encryption at all — it can load/manipulate decrypted documents, but has
 * no API for producing or removing password protection. Protect/Unlock PDF
 * therefore need this hand-rolled (but spec-exact) implementation. This
 * module only does the CRYPTOGRAPHY — deriving keys, computing/validating
 * the O and U dictionary values, and the per-object RC4 key. Applying that
 * cryptography to an actual PDF's object graph (encrypting every string and
 * stream when protecting, decrypting them when unlocking) is handled in
 * services/pdfService.js, which is the only consumer of this module.
 *
 * RC4 is implemented from scratch (a textbook ~20-line stream cipher)
 * rather than via Node's `crypto.createCipheriv('rc4', ...)` because recent
 * OpenSSL builds disable RC4 in the default provider, which would make
 * this feature silently break depending on the exact Node/OpenSSL build it
 * runs on. A from-scratch implementation has no such platform dependency.
 *
 * Every function below was round-trip verified during development
 * (encrypt → derive O/U → authenticate with the correct password → confirm
 * the recovered key matches; confirm wrong passwords are rejected; confirm
 * the owner-password-recovery path independently derives the same key as
 * the user-password path) using both matching and DIFFERENT user/owner
 * passwords.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const crypto = require('crypto')

// The fixed 32-byte padding string defined by the PDF spec (Algorithm 3.2,
// step a). Every password is padded/truncated to exactly 32 bytes using
// this exact constant before any hashing happens.
const PAD = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

// 128-bit key, Standard Security Handler Revision 3 — the most broadly
// compatible "real" (non-trivial 40-bit) variant, supported by every PDF
// reader released in the last two decades.
const KEY_LENGTH_BYTES = 16
const SECURITY_REVISION = 3
const SECURITY_HANDLER_V = 2

// "Allow everything once a valid password is supplied" permission flags.
// Bits 1-2 are reserved and must be 0; every other bit set to 1 grants the
// corresponding permission. This tool's "Protect PDF" feature is about
// requiring a password to OPEN the file, not about restricting what an
// authenticated viewer can subsequently do with it.
const FULL_PERMISSIONS = -4 // 0xFFFFFFFC as a signed 32-bit integer

/**
 * Pads/truncates a password to exactly 32 bytes per Algorithm 3.2(a).
 * Passwords are treated as raw Latin-1 byte sequences, matching the PDF
 * spec's definition of a password as a byte string (not a Unicode string —
 * that's a different, newer mechanism (Revision 5/6) this module does not
 * implement).
 */
function padPassword(password) {
  const pwBytes = Buffer.from(String(password || ''), 'latin1').subarray(0, 32)
  const result = Buffer.alloc(32)
  pwBytes.copy(result, 0)
  PAD.copy(result, pwBytes.length, 0, 32 - pwBytes.length)
  return result
}

/**
 * RC4 stream cipher. Symmetric: calling this twice with the same key
 * recovers the original input, which is how RC4-based decryption works
 * throughout this module (encrypt == decrypt, only the key differs).
 */
function rc4(keyBytes, data) {
  const S = new Uint8Array(256)
  for (let i = 0; i < 256; i++) S[i] = i

  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + keyBytes[i % keyBytes.length]) & 0xff
    const tmp = S[i]
    S[i] = S[j]
    S[j] = tmp
  }

  const out = Buffer.alloc(data.length)
  let i = 0
  j = 0
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff
    j = (j + S[i]) & 0xff
    const tmp = S[i]
    S[i] = S[j]
    S[j] = tmp
    out[k] = data[k] ^ S[(S[i] + S[j]) & 0xff]
  }
  return out
}

/** XORs every byte of `key` with a single byte value — used by the 19 extra encryption rounds in Algorithms 3.3 and 3.5 (Revision ≥ 3). */
function xorKeyWithByte(key, byteValue) {
  const out = Buffer.alloc(key.length)
  for (let i = 0; i < key.length; i++) out[i] = key[i] ^ byteValue
  return out
}

/**
 * Algorithm 3.3, steps (a)-(b): derives the RC4 key used to compute/reverse
 * the O dictionary entry from the (padded) owner password alone — an MD5
 * hash, then 50 additional rounds for Revision ≥ 3.
 */
function deriveOwnerRC4Key(paddedOwnerOrUserPassword) {
  let digest = crypto.createHash('md5').update(paddedOwnerOrUserPassword).digest()
  for (let i = 0; i < 50; i++) {
    digest = crypto.createHash('md5').update(digest.subarray(0, KEY_LENGTH_BYTES)).digest()
  }
  return digest.subarray(0, KEY_LENGTH_BYTES)
}

/**
 * Algorithm 3.3: computes the O (owner) dictionary value by RC4-encrypting
 * the padded user password with a key derived from the padded owner
 * password, then (Revision ≥ 3) running 19 further encryption passes with
 * the key XORed against the round number.
 */
function computeOwnerValue(paddedOwnerPassword, paddedUserPassword) {
  const rc4Key = deriveOwnerRC4Key(paddedOwnerPassword)
  let encrypted = rc4(rc4Key, paddedUserPassword)
  for (let round = 1; round <= 19; round++) {
    encrypted = rc4(xorKeyWithByte(rc4Key, round), encrypted)
  }
  return encrypted // 32 bytes → this is the O entry
}

/**
 * The inverse of computeOwnerValue: given an attempted owner password and
 * the document's stored O value, recovers the original padded USER
 * password it was derived from. If the attempted owner password is wrong,
 * this still produces 32 bytes — they simply won't form a padded password
 * that authenticates successfully downstream, which is how a wrong owner
 * password attempt is ultimately rejected.
 */
function recoverUserPasswordFromOwner(paddedOwnerPasswordAttempt, storedO) {
  const rc4Key = deriveOwnerRC4Key(paddedOwnerPasswordAttempt)
  let data = Buffer.from(storedO.subarray(0, 32))
  for (let round = 19; round >= 1; round--) {
    data = rc4(xorKeyWithByte(rc4Key, round), data)
  }
  data = rc4(rc4Key, data)
  return data
}

/**
 * Algorithm 3.2: derives the document's file encryption key from a
 * (padded) password, the stored O value, the P permissions integer, and
 * the first element of the document's /ID. This is THE key used to
 * encrypt/decrypt all of the document's actual content (via per-object
 * keys derived from it — see computeObjectKey below).
 */
function computeEncryptionKey(paddedPassword, ownerValueO, permissionsP, idBytes) {
  const hash = crypto.createHash('md5')
  hash.update(paddedPassword)
  hash.update(ownerValueO.subarray(0, 32))

  const permissionsBuffer = Buffer.alloc(4)
  permissionsBuffer.writeInt32LE(permissionsP, 0)
  hash.update(permissionsBuffer)

  hash.update(idBytes)

  // (We never set EncryptMetadata = false, so the spec's extra
  // 0xFFFFFFFF block for that case is intentionally omitted.)

  let digest = hash.digest()

  // Revision ≥ 3: 50 additional rounds, each re-hashing only the first
  // n bytes (the target key length) of the previous round's digest.
  for (let i = 0; i < 50; i++) {
    digest = crypto.createHash('md5').update(digest.subarray(0, KEY_LENGTH_BYTES)).digest()
  }

  return digest.subarray(0, KEY_LENGTH_BYTES)
}

/**
 * Algorithm 3.5 (Revision ≥ 3 variant of computing U): MD5-hashes the
 * padding string concatenated with the file ID, RC4-encrypts that digest
 * with the file encryption key, then runs 19 further passes with the key
 * XORed against the round number, finally padding the 16-byte result to
 * 32 bytes for storage (only the first 16 bytes are ever compared).
 */
function computeUserValue(encryptionKey, idBytes) {
  const digest = crypto.createHash('md5').update(Buffer.concat([PAD, idBytes])).digest()

  let encrypted = rc4(encryptionKey, digest)
  for (let round = 1; round <= 19; round++) {
    encrypted = rc4(xorKeyWithByte(encryptionKey, round), encrypted)
  }

  const result = Buffer.alloc(32)
  encrypted.copy(result, 0)
  PAD.copy(result, 16, 0, 16) // trailing 16 bytes are arbitrary per spec; reusing PAD is as good as anything
  return result
}

/** Algorithm 3.6: compares only the first 16 (significant) bytes of U, per spec, for Revision ≥ 3. */
function checkUserValue(encryptionKey, idBytes, storedU) {
  const computed = computeUserValue(encryptionKey, idBytes)
  return computed.subarray(0, 16).equals(Buffer.from(storedU).subarray(0, 16))
}

/**
 * Attempts to authenticate `passwordAttempt` against a document's stored
 * O/U/P/ID values, trying it first as the USER password, then as the
 * OWNER password (by recovering the user password it protects and
 * retrying). Returns the file encryption key on success — which is
 * everything needed to decrypt every string and stream in the document.
 *
 * @returns {{ isValid: boolean, isOwner: boolean, encryptionKey: Buffer|null }}
 */
function authenticate(passwordAttempt, { O, U, P, idBytes }) {
  const paddedAttempt = padPassword(passwordAttempt)

  const keyAsUser = computeEncryptionKey(paddedAttempt, O, P, idBytes)
  if (checkUserValue(keyAsUser, idBytes, U)) {
    return { isValid: true, isOwner: false, encryptionKey: keyAsUser }
  }

  const recoveredPaddedUserPassword = recoverUserPasswordFromOwner(paddedAttempt, O)
  const keyAsOwner = computeEncryptionKey(recoveredPaddedUserPassword, O, P, idBytes)
  if (checkUserValue(keyAsOwner, idBytes, U)) {
    return { isValid: true, isOwner: true, encryptionKey: keyAsOwner }
  }

  return { isValid: false, isOwner: false, encryptionKey: null }
}

/**
 * Algorithm 3.1: derives the per-object RC4 key used to encrypt/decrypt
 * one specific indirect object's strings and stream data, from the
 * document-wide file encryption key plus that object's number and
 * generation number (every indirect object in a PDF is encrypted with a
 * DIFFERENT key, even though they all derive from the same file key).
 */
function computeObjectKey(fileEncryptionKey, objectNumber, generationNumber) {
  const extra = Buffer.alloc(5)
  extra.writeUIntLE(objectNumber & 0xffffff, 0, 3)
  extra.writeUIntLE(generationNumber & 0xffff, 3, 2)

  const digest = crypto
    .createHash('md5')
    .update(Buffer.concat([fileEncryptionKey, extra]))
    .digest()

  const keyLength = Math.min(fileEncryptionKey.length + 5, 16)
  return digest.subarray(0, keyLength)
}

module.exports = {
  PAD,
  KEY_LENGTH_BYTES,
  SECURITY_REVISION,
  SECURITY_HANDLER_V,
  FULL_PERMISSIONS,
  padPassword,
  rc4,
  computeOwnerValue,
  recoverUserPasswordFromOwner,
  computeEncryptionKey,
  computeUserValue,
  checkUserValue,
  authenticate,
  computeObjectKey,
}
