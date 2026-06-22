# PDFVish — Project Guide (Architecture, Flows & Interview Prep)

A complete reference for understanding, explaining, and defending this project in
interviews. Live at `https://pdfvish.onrender.com`.

---

## 1. One-line pitch

> **PDFVish is a full-stack web app offering free online PDF tools** (merge, split,
> compress, convert to/from Office & images, edit, annotate, protect, sign) with
> user accounts (email verification, Google login, password reset), built with a
> **React (Vite) frontend** and a **Python Flask REST API**, backed by **MySQL**,
> containerized with **Docker**, and deployed on **Render**. It's also an
> installable **PWA**.

If you only memorize one paragraph, memorize that.

---

## 2. Tech stack

**Frontend**
- React 18 + Vite (build tool / dev server)
- React Router (client-side routing, SPA)
- Context API (global auth state) + custom hooks
- CSS Modules (scoped styling), CSS variables for theming
- Google Identity Services (Google sign-in)
- PWA: web app manifest + service worker

**Backend**
- Python + Flask (REST API + serves the built React app)
- Gunicorn (production WSGI server)
- Flask-SQLAlchemy (ORM) + PyMySQL (MySQL driver)
- PyJWT (JWT auth), Werkzeug (password hashing)
- Flask-Limiter (rate limiting), Flask-CORS, ProxyFix
- PDF/processing: PyMuPDF (fitz), pypdf, pikepdf, pdf2docx, pdfplumber,
  openpyxl, python-pptx, img2pdf, ocrmypdf (+Tesseract), pyHanko (signing),
  LibreOffice headless (Office→PDF)
- Email: Brevo HTTP API (primary) / SMTP, via the standard library

**Data & infra**
- MySQL (Aiven managed, SSL) — SQLite fallback for local dev
- Docker (multi-stage build), Render (hosting, auto-deploy from GitHub)

---

## 3. High-level architecture

```
                       ┌──────────────────────────────────────┐
   Browser / PWA  ───▶ │  Render (single Docker container)     │
   (React SPA)         │                                       │
        │              │  Gunicorn ─▶ Flask app (app.py)       │
        │  HTTPS       │     ├─ /api/*  REST endpoints          │
        └─────────────▶│     │    ├─ PDF tools (utils/*.py)     │
                       │     │    ├─ /api/auth/* (auth.py)      │
                       │     │    └─ /api/contact               │
                       │     └─ /  serves built React (static)  │
                       └───────────┬───────────────┬───────────┘
                                   │               │
                          ┌────────▼──────┐  ┌─────▼──────┐
                          │ Aiven MySQL    │  │ Brevo API  │
                          │ (users)        │  │ (emails)   │
                          └────────────────┘  └────────────┘
                                   ▲
                          ┌────────┴──────┐
                          │ Google OAuth  │ (verifies ID tokens)
                          └───────────────┘
```

**Key point to explain:** the **same Flask app serves both the API and the
static React build** — one container, one origin (so no CORS issues in
production). In dev, Vite runs the React app on `:3000` and proxies `/api` to
Flask on `:5000`.

---

## 4. Project structure

```
pdf-toolkit/
├── Dockerfile                # Multi-stage: build React, then Python runtime
├── render.yaml               # Render "blueprint" (infra-as-code)
├── .dockerignore / .gitignore
│
├── backend/
│   ├── app.py                # Flask app: routes, DB init, config, static host
│   ├── auth.py               # Auth blueprint: signup/login/verify/reset/google…
│   ├── models.py             # SQLAlchemy User model
│   ├── requirements.txt      # Python dependencies
│   ├── db-setup.sql          # One-time local MySQL setup (optional)
│   ├── .env.example          # Documents all environment variables
│   └── utils/
│       ├── merge.py          # Merge PDFs (pypdf)
│       ├── split.py          # Split into page ranges
│       ├── compress.py       # Compress (pikepdf / ghostscript)
│       ├── convert.py        # PDF↔Word/PPT/Excel/JPG, OCR helpers
│       ├── edit.py           # Rotate/delete/reorder, watermark, annotate
│       ├── protect.py        # Encrypt / decrypt (passwords)
│       ├── sign.py           # Certificate signature (pyHanko)
│       └── mailer.py         # Email via Brevo/SMTP + HTML templates
│
└── frontend/
    ├── index.html            # HTML shell + meta/OG/PWA tags
    ├── vite.config.js        # Build → ../backend/static; dev proxy to :5000
    ├── public/               # manifest, service worker, icons, robots, sitemap
    └── src/
        ├── main.jsx          # React entry; registers service worker
        ├── App.jsx           # Routes (React Router)
        ├── toolsConfig.js    # Single source of truth for all tools
        ├── index.css         # Global styles + theme CSS variables
        ├── context/
        │   └── AuthContext.jsx   # Global auth state + all auth API calls
        ├── hooks/
        │   └── useToolSubmit.js  # Shared upload→process→download state machine
        ├── utils/
        │   └── api.js            # fetch wrappers (postForm, postJson, getJson…)
        ├── components/           # Navbar, Footer, DropZone, ProgressBar,
        │                         # ConversionTool, GoogleButton, RouteMeta…
        └── pages/                # Home, tool pages, auth pages, legal, account…
```

**Talking point:** `toolsConfig.js` is a *config-driven design* — every tool is
declared once; routing, the home catalog, and the nav menu are all generated
from it. Adding a simple conversion tool = adding one config object.

---

## 5. Backend deep dive

### `app.py` (the core)
- Creates the Flask app, configures DB URI (MySQL or SQLite via `DB_ENGINE`).
- `ProxyFix` so the real client IP / HTTPS scheme are seen behind Render's proxy.
- Restricted **CORS** to known origins.
- Initializes the DB, runs a small **auto-migration** (`_ensure_user_columns`)
  that `ALTER TABLE`s in new columns on startup (since `create_all()` never
  alters existing tables).
- Defines all PDF-tool endpoints. Each: create a scratch dir → save uploads →
  call the matching `utils` function → stream the result back → **delete scratch
  dirs after the response is sent** (`call_on_close`). Files are never kept.
- Serves the React build for any non-API route (SPA fallback).

### `auth.py` (auth blueprint, `/api/auth/*`)
- **JWT** issued on login/signup-verify (`_make_token`, HS256, 7-day expiry).
- `token_required` decorator validates the `Authorization: Bearer` header.
- Endpoints: `signup`, `verify`, `resend`, `login`, `forgot`, `reset`,
  `google`, `config`, `profile`, `change-password`, `change-email`,
  `link-google`, `unlink-google`, `account` (DELETE), `me`.
- **Email verification:** signup creates an *unverified* user + a 6-digit code
  (15-min expiry) emailed via Brevo; login is blocked until verified; the code
  locks after 5 wrong attempts.
- **Google login:** verifies the Google ID token against Google's public keys
  (PyJWT `PyJWKClient`), then finds-or-creates the user.
- **Rate limiting** (Flask-Limiter) on every sensitive endpoint.

### `models.py`
Single `User` table: `id, name, email, password_hash, created_at, is_verified,
verification_code, verification_expires, verification_attempts, plan, country,
timezone, google_linked`. Passwords stored only as salted hashes.

### `utils/` — how each tool works (one-liners)
- **merge** → `pypdf` appends pages. **split** → extract page ranges to a ZIP.
- **compress** → re-save optimized (pikepdf/ghostscript).
- **convert** → PyMuPDF renders pages to images (PDF→JPG/PPT), `pdf2docx`
  (PDF→Word), `pdfplumber`+`openpyxl` (PDF→Excel); **LibreOffice headless** for
  Office→PDF; `img2pdf` for JPG→PDF. **OCR**: if a PDF has no text layer it's run
  through `ocrmypdf`/Tesseract first so scans convert to real text.
- **protect** → AES encryption / decryption with a password.
- **sign** → certificate-based digital signature (pyHanko).
- **mailer** → tries Brevo HTTP API → SMTP → dev fallback; builds HTML emails.

---

## 6. Frontend deep dive

- **`main.jsx`** mounts React inside `BrowserRouter` + `AuthProvider`, and
  registers the service worker.
- **`App.jsx`** declares all routes. Config-driven conversion tools share one
  `ConversionTool` component; richer tools have their own pages.
- **`AuthContext.jsx`** holds `user/token/loading` and exposes every auth action
  (login, signup, verifyEmail, loginWithGoogle, updateProfile, changePassword,
  changeEmail, link/unlinkGoogle, deleteAccount, logout…). Token persists in
  `localStorage`; on load it re-validates via `/auth/me`.
- **`useToolSubmit.js`** — a reusable state machine: `idle → working → ready/
  error`, holds the result Blob, and exposes `download(name)` (supports rename).
- **`api.js`** — thin `fetch` wrappers; on error it throws an `Error` carrying
  the server's `{error}` and status (so UI can react to flags like
  `needs_verification`).
- **`ConversionTool.jsx` + `DropZone` + `ProgressBar`** — the generic
  upload→process→download UI used by most tools (with optional fields like JPG
  DPI, and rename-before-download).
- **`RouteMeta.jsx`** — sets per-page `<title>` + meta tags for SEO.
- **PWA** — `manifest.webmanifest` + `sw.js` (network-first navigations,
  stale-while-revalidate assets, never intercepts API/uploads).

---

## 7. Key end-to-end flows (great to whiteboard)

### A. Using a PDF tool (e.g. Merge)
1. User drops files → `DropZone` updates state.
2. Submit → `useToolSubmit` builds `FormData`, POSTs to `/api/merge`.
3. Flask saves uploads to a scratch dir → `merge_pdfs()` (pypdf) → returns file.
4. Response streams back as a Blob; scratch dirs deleted after send.
5. UI shows "ready" → user can **rename** → `download()` saves it.

### B. Signup + email verification
1. POST `/auth/signup` → creates **unverified** user + 6-digit code → Brevo email.
2. Frontend routes to `/verify-email`.
3. POST `/auth/verify` with the code → on success, JWT issued + user logged in.
4. Login is blocked for unverified accounts (returns `needs_verification`).

### C. Login
POST `/auth/login` → verify password hash → check `is_verified` → return JWT +
user. Frontend stores token in `localStorage`; `/auth/me` re-validates on reload.

### D. Google sign-in
Browser gets a Google **ID token** (JWT) → POST `/auth/google` → backend verifies
it against Google's public keys → find-or-create user → issue our JWT.

### E. Password reset
`/auth/forgot` → emails a tokenized reset link → `/auth/reset` validates the
short-lived token and sets a new password hash.

### F. Account settings / delete
`/auth/profile|change-email|change-password|link-google` update the account;
`DELETE /auth/account` permanently removes it (self-serve, matches privacy policy).

---

## 8. Security measures (have these ready)
- Passwords: **salted hashes** (Werkzeug pbkdf2/scrypt), never plaintext.
- **JWT** stateless auth (HS256, signed with `SECRET_KEY`, 7-day expiry).
- **Rate limiting** per IP on auth endpoints (brute-force protection).
- **OTP attempt-lock** (code invalidated after 5 wrong tries).
- **Restricted CORS**, **ProxyFix** for correct client IP.
- **TLS everywhere** (HTTPS via Render; SSL to MySQL).
- Uploaded files **deleted immediately** after processing.
- Secrets in **environment variables** (never committed; `.env` gitignored).
- Email enumeration avoided (generic messages on forgot-password).

---

## 9. Deployment

- **Dockerfile (multi-stage):** stage 1 builds the React app with Node; stage 2
  is a Python image that installs system deps (**LibreOffice, Tesseract,
  Ghostscript, fonts**) + Python deps, copies the built frontend, and runs
  **Gunicorn**.
- **render.yaml** is a "blueprint" — infrastructure as code; Render builds the
  Docker image and runs it. `autoDeploy: true` → every push to `main` redeploys.
- **Config via env vars** on Render: DB (`DB_ENGINE`, `MYSQL_*`), `SECRET_KEY`,
  email (`BREVO_API_KEY`, `MAIL_FROM`), `GOOGLE_CLIENT_ID`, `APP_BASE_URL`, etc.
- DB is **Aiven MySQL** (managed, SSL); SQLite is the zero-setup local fallback.

---

## 10. Notable problems solved (best interview stories)

1. **Render blocks outbound SMTP.** Gmail SMTP failed with "Network is
   unreachable". Diagnosed it as the platform blocking SMTP ports, and switched
   to **Brevo's HTTP API** (port 443) — emails now send reliably.
2. **Logs weren't showing.** Python buffered `print()` under Gunicorn; set
   `PYTHONUNBUFFERED=1` so errors stream to Render in real time — which then
   revealed the SMTP issue above.
3. **Auth "flash" on refresh.** The navbar briefly showed Login/Signup before
   `/auth/me` resolved. Fixed by gating UI on a `loading` flag.
4. **Schema migrations.** `create_all()` doesn't alter existing tables, so I
   wrote a small idempotent startup migration that adds missing columns (works on
   both MySQL and SQLite).
5. **Conversion fidelity.** Scanned PDFs produced empty Word/Excel output;
   added **OCR (Tesseract)** with graceful fallback so scans convert to real text.
6. **OAuth client ID without rebuilds.** Served the Google client ID from a
   runtime `/auth/config` endpoint so it's configurable via env, not baked in.

---

## 11. Interview Q&A

### Project / system design
- **Q: Walk me through the architecture.** → Use section 3. Emphasize single
  container serving API + SPA, MySQL, Brevo, Google OAuth.
- **Q: Why Flask?** → Lightweight, perfect for a REST API; rich Python PDF
  ecosystem (PyMuPDF, pdf2docx, pyHanko) made Python the natural choice.
- **Q: How would you scale it?** → Move heavy conversions to a **background
  queue** (Celery/RQ + Redis) and worker pool; horizontal scaling behind a load
  balancer; object storage (S3) for files; Redis-backed rate limiter; CDN for
  static assets; read replicas for the DB.
- **Q: Where are uploaded files stored?** → Temp scratch dirs, deleted right
  after the response — privacy by design; not a storage service.

### React / frontend
- **Q: How is global state managed?** → React **Context** (`AuthContext`) — no
  Redux needed for this scope. Token in `localStorage`, re-validated on load.
- **Q: How do you avoid prop-drilling / repetition?** → `useToolSubmit` hook +
  config-driven tools (`toolsConfig.js`) + a shared `ConversionTool` component.
- **Q: How does client-side routing work?** → React Router; Flask serves
  `index.html` for unknown routes so deep links work (SPA fallback).
- **Q: How did you handle the login UI flicker?** → `loading` flag gating.

### Auth / security
- **Q: How does authentication work?** → Stateless **JWT**: issued on
  login/verify, sent as a Bearer header, validated by a decorator; password
  hashes via Werkzeug.
- **Q: JWT vs sessions?** → JWT is stateless (no server session store), great for
  APIs and a future mobile app; trade-off is you can't easily revoke a token
  before expiry (mitigated by short-ish expiry).
- **Q: How is Google login verified?** → The browser gets a Google **ID token**;
  the backend verifies its signature against Google's public JWKS and checks the
  audience — never trusting the client blindly.
- **Q: How do you prevent brute force?** → Per-IP rate limiting + OTP
  attempt-lock + generic error messages (no email enumeration).
- **Q: How are secrets managed?** → Environment variables; `.env` is gitignored;
  `SECRET_KEY` set on the host.

### Backend / data
- **Q: ORM?** → Flask-SQLAlchemy; one `User` model; MySQL in prod, SQLite local.
- **Q: How do schema changes work without a migration tool?** → Idempotent
  startup migration (`ALTER TABLE … ADD COLUMN`) guarded by an inspector.
- **Q: How do you connect to a cloud DB securely?** → PyMySQL over **TLS**, with
  `pool_pre_ping` to recover dropped idle connections.

### DevOps / deployment
- **Q: Explain your Docker setup.** → Multi-stage build (Node → Python); system
  packages for LibreOffice/Tesseract; Gunicorn entrypoint.
- **Q: CI/CD?** → Render auto-deploys on push to `main` (GitOps via
  `render.yaml`).
- **Q: How are emails sent in production?** → Brevo HTTP API (chosen after
  Render blocked SMTP); domain verification for deliverability.

### PWA
- **Q: How did you make it installable?** → Web app manifest + a service worker
  (over HTTPS); conservative SW that never intercepts API/uploads.

---

## 12. Future improvements (shows maturity)
- Background job queue for heavy conversions (Celery/RQ + Redis)
- Object storage (S3) + the deferred "your files for 2 hours" feature
- Payments (Stripe/Razorpay) to re-enable the Pro plan
- Automated tests (pytest + React Testing Library) and CI checks
- Error monitoring (Sentry), analytics, CAPTCHA on signup
- Facebook login; per-tool SEO landing pages

---

## 13. 30-second summary to open an interview

> "PDFVish is a full-stack PDF-tools web app — React + Vite on the front end, a
> Flask REST API on the back, MySQL for data, Dockerized and deployed on Render
> with CI on every push. It does ~14 PDF operations including OCR-backed
> conversions, and has a full auth system: email verification with one-time
> codes, Google OAuth, JWT sessions, password reset, and account management —
> all rate-limited and hardened. It's also an installable PWA. I built the whole
> thing end to end, including the DevOps."
```
