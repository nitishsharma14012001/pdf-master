# PDF Master — Security Architecture

This document describes every security control in the backend, the layer it sits at, and what threat it mitigates.

---

## Security layers (request lifecycle order)

```
Client Request
      │
      ▼
 ┌─────────────────────────────────────────────────────────┐
 │  1. Helmet  (security response headers)                 │
 │  2. CORS    (origin allowlist)                          │
 │  3. Morgan  (HTTP request logging)                      │
 │  4. Rate Limiters  (global · auth · tools)              │
 │  5. Body Parser  (1 MB JSON cap)                        │
 │  6. Upload Middleware                                   │
 │       a. MIME whitelist  (sync, before disk write)      │
 │       b. Extension/MIME consistency  (sync)             │
 │       c. 100 MB hard size cap  (multer)                 │
 │       d. Sanitised filenames + UUID job isolation       │
 │       e. Magic-byte verification  (async, post-write)   │
 │       f. Plan-based size enforcement  (post-auth)       │
 │  7. Route handlers  (auth · tools · admin · contact)   │
 │  8. Global error handler  (no stack traces in prod)     │
 └─────────────────────────────────────────────────────────┘
      │
      ▼
   Response
```

---

## 1 — Helmet (security headers)

| Header | Value | Mitigates |
|--------|-------|-----------|
| `Content-Security-Policy` | `default-src 'self'`, no inline scripts/styles | XSS, clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | SSL stripping |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing attacks |
| `X-Frame-Options` | `DENY` (via `frameAncestors 'none'`) | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Feature abuse |
| `Cross-Origin-Resource-Policy` | `cross-origin` | Allows CDN file delivery |
| `Cross-Origin-Opener-Policy` | `same-origin` | Spectre/side-channel |

---

## 2 — CORS

- Origins pulled from `ALLOWED_ORIGINS` env var (comma-separated, no wildcards).
- Credentials allowed (`Authorization` header support).
- Exposes only `Content-Disposition` header to browsers (needed for download filenames).
- Preflight responses cached for 24 hours.
- Unknown origins are logged as warnings and rejected with `403`.

---

## 3 — HTTP Request Logging (Morgan)

- **Development** — coloured compact `dev` format to stdout.
- **Production** — Apache `combined` format streamed through Winston so logs land in the rotating file transports.
- Health check (`/health`) is excluded from production logs to reduce noise.

---

## 4 — Rate Limiting

| Limiter | Scope | Window | Max requests |
|---------|-------|--------|--------------|
| Global | All routes | 15 min | 500 |
| Auth | `/api/auth/login` & `/api/auth/register` | 15 min | 20 |
| Tools | `/api/tools/*` | 1 min | 15 |

All limiters use `express-rate-limit` with `standardHeaders: true` (RFC-compliant `RateLimit-*` headers) and log hits at the `warn` level.

---

## 5 — Body Parser

- JSON body cap: **1 MB**.  File uploads go through multer only — the body parser never sees binary data.

---

## 6 — Upload Middleware

### 6a — MIME Whitelist

Only the following MIME types are accepted:

```
application/pdf
image/jpeg, image/png, image/webp, image/gif, image/bmp, image/tiff
application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation
text/plain
```

Checked **synchronously** in the multer `fileFilter` before any bytes reach disk.

### 6b — Extension/MIME Consistency

The file extension (e.g. `.pdf`) must match a set of expected extensions for the declared MIME type. A `.exe` renamed to `.pdf` is rejected at this layer.

### 6c — 100 MB Hard Size Cap

Configured as `limits.fileSize` on the multer instance. No file larger than 100 MB (configurable via `MAX_FILE_SIZE` env var) is ever buffered or written to disk.

### 6d — Filename Sanitisation + Job Isolation

- Each request is assigned a UUID v4 directory under `UPLOAD_DIR`.
- Filenames are sanitised: only `[a-zA-Z0-9_\-. ]` are kept; `..` sequences are collapsed; leading dots/underscores are stripped; stems are truncated to 100 characters; a base-36 timestamp suffix is appended.
- **Path traversal is impossible** — the resolved file path is asserted to sit inside `UPLOAD_DIR` before any file operation.

### 6e — Magic-Byte Verification

After multer writes the file to disk, the first 12 bytes are read and compared against known file signatures:

| Signature | Detected type |
|-----------|--------------|
| `%PDF` (25 50 44 46) | `application/pdf` |
| `\x89PNG` (89 50 4E 47) | `image/png` |
| `FF D8 FF` | `image/jpeg` |
| `GIF87a` / `GIF89a` | `image/gif` |
| `BM` (42 4D) | `image/bmp` |
| `II*\x00` / `MM\x00*` | `image/tiff` |
| `RIFF....WEBP` | `image/webp` |
| `PK\x03\x04` | ZIP-based Office (docx/xlsx/pptx) |
| `\xD0\xCF\x11\xE0` | OLE2 Office (doc/xls/ppt) |

Files whose magic bytes contradict the declared MIME are deleted and the request is rejected with **HTTP 415**.

### 6f — Plan-Based Size Enforcement

After auth middleware populates `req.user`, per-plan caps are checked:

| Plan | Limit |
|------|-------|
| Free | 25 MB |
| Pro / Business | 100 MB |

---

## 7 — Authentication & Authorisation

- JWT verification in every protected route (`authenticate` middleware).
- Admin endpoints require `role === 'admin'` (`requireAdmin` middleware).
- `optionalAuth` middleware attaches the user if a valid token is present, but never blocks anonymous requests — used for upload endpoints that have both free and paid tiers.
- Token payload never contains passwords or sensitive data.

---

## 8 — Error Handling

- **Operational errors** (`AppError.isOperational === true`) — the safe, user-facing message and HTTP status are forwarded directly. No stack trace.
- **Unexpected errors** — logged in full (message + stack + request context), but the client only receives `"Internal server error"` in production.
- Multer errors are caught by `handleUploadError` and normalised to JSON before reaching the global handler.

---

## Environment Variables

All security-sensitive values are externally configured via `.env` (see `.env.example`). Defaults are safe for local development but **must** be changed in production:

| Variable | Required in prod | Description |
|----------|-----------------|-------------|
| `JWT_SECRET` | ✅ | Use `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated domains, no wildcards |
| `NODE_ENV` | ✅ | Set to `production` |
| `MAX_FILE_SIZE` | — | Default 100 MB hard cap |
