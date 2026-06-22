# PDFVish — One-Page Interview Cheat Sheet

## 30-second pitch
Full-stack PDF-tools web app. **React + Vite** frontend, **Flask REST API**
backend, **MySQL** (Aiven), **Dockerized**, deployed on **Render** with
auto-deploy CI. ~14 PDF tools (incl. OCR conversions). Full auth: email OTP
verification, Google OAuth, JWT, password reset, account management — all
rate-limited. Installable **PWA**. Built end-to-end including DevOps.

## Stack (rapid fire)
- **Front:** React 18, Vite, React Router, Context API, CSS Modules, PWA
- **Back:** Python/Flask, Gunicorn, SQLAlchemy, PyJWT, Flask-Limiter
- **PDF:** PyMuPDF, pdf2docx, pdfplumber, pikepdf, pyHanko, LibreOffice, OCRmyPDF/Tesseract
- **Data/infra:** MySQL (Aiven, SSL), Brevo (email), Google OAuth, Docker, Render

## Architecture in one sentence
One Docker container runs Gunicorn→Flask, which **serves both the `/api` REST
endpoints and the built React SPA** (same origin); it talks to MySQL for data,
Brevo for email, and Google for OAuth verification.

## Core flows (one line each)
- **Tool:** upload → `FormData` POST `/api/<tool>` → `utils` processes → stream Blob back → scratch files deleted → user renames + downloads.
- **Signup:** create *unverified* user + 6-digit code → Brevo email → `/verify` → JWT.
- **Login:** check password hash + `is_verified` → JWT → stored in `localStorage` → re-validated via `/auth/me`.
- **Google:** browser gets Google ID token → backend verifies vs Google JWKS → find/create user → our JWT.
- **Reset:** `/forgot` emails tokenized link → `/reset` sets new hash.

## Security bullets
JWT (HS256, 7d) · salted password hashes · per-IP rate limiting · OTP 5-attempt
lock · restricted CORS · ProxyFix · TLS everywhere · uploads deleted after
processing · secrets in env vars · no email enumeration.

## "Problems I solved" (tell these!)
1. **Render blocks SMTP** → switched Gmail SMTP to **Brevo HTTP API** (port 443).
2. **Logs hidden** (Python buffering) → `PYTHONUNBUFFERED=1` → revealed the SMTP error.
3. **Auth flash on refresh** → gated navbar on a `loading` flag.
4. **No migration tool** → idempotent startup `ALTER TABLE` migration.
5. **Scanned PDFs → empty output** → added **OCR** with graceful fallback.
6. **OAuth ID without rebuilds** → served from a runtime `/auth/config` endpoint.

## Top Q&A
- **JWT vs sessions?** Stateless, no server store, great for APIs/mobile; can't
  revoke before expiry (mitigated by short expiry).
- **Global state?** Context (AuthContext), not Redux — right size for the app.
- **SPA deep links?** Flask serves `index.html` for unknown routes.
- **Scale it?** Background queue (Celery/RQ + Redis) for conversions, S3 for
  files, load balancer, Redis rate-limiter, DB read replicas, CDN.
- **Where are files stored?** Temp dirs, deleted right after processing.
- **Schema changes?** Startup migration adds missing columns (MySQL + SQLite).

## Say this when asked "tell me about a project"
Lead with the 30-second pitch → offer to go deeper on architecture, auth, or a
problem you solved → let them steer.
