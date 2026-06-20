"""Transactional email for PDFVish.

Two backends, tried in order — both use only the standard library (no extra
dependency):

  1. SMTP (e.g. Gmail) — used when SMTP_USER and SMTP_PASS are set.
       SMTP_HOST   default "smtp.gmail.com"
       SMTP_PORT   default 465 (implicit SSL); use 587 for STARTTLS
       SMTP_USER   the full email address to log in / send from
       SMTP_PASS   an app password (Gmail: create one under Google Account ->
                   Security -> App passwords; your normal password won't work)
       MAIL_FROM   optional display sender; defaults to SMTP_USER

  2. Resend API — used when RESEND_API_KEY is set (and SMTP isn't).
       RESEND_API_KEY, MAIL_FROM

send_email() returns True on success and False if no backend is configured or
the send fails, so callers can fall back to dev behaviour (showing the code).
"""

import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
RESEND_ENDPOINT = "https://api.resend.com/emails"
DEFAULT_SENDER = "PDFVish <onboarding@resend.dev>"
# A normal User-Agent avoids Cloudflare bot checks (the default Python-urllib UA
# can trigger a 403/1010 block on API gateways).
USER_AGENT = "PDFVish/1.0"


def _smtp_configured():
    return bool(os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASS"))


def email_configured():
    """True if any email backend (Brevo, SMTP or Resend) is configured."""
    return (
        bool(os.environ.get("BREVO_API_KEY"))
        or _smtp_configured()
        or bool(os.environ.get("RESEND_API_KEY"))
    )


def _send_via_smtp(to_address, subject, html):
    """Send through an SMTP server (Gmail by default). Returns True on success."""
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]
    sender = os.environ.get("MAIL_FROM") or user

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_address
    msg.attach(MIMEText(html, "html"))

    try:
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
                server.login(user, password)
                server.sendmail(user, [to_address], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(user, password)
                server.sendmail(user, [to_address], msg.as_string())
        return True
    except (smtplib.SMTPException, OSError) as exc:
        print(f"[auth] SMTP send failed: {exc}")
        return False


def _send_via_brevo(to_address, subject, html):
    """Send through the Brevo (Sendinblue) HTTP API. Returns True on success.

    Works over HTTPS, so it isn't blocked by Render's SMTP firewall. The sender
    address (from MAIL_FROM) must be a verified sender in your Brevo account.
    """
    api_key = os.environ.get("BREVO_API_KEY")
    if not api_key:
        return False

    sender_name, sender_email = parseaddr(os.environ.get("MAIL_FROM", DEFAULT_SENDER))
    payload = json.dumps(
        {
            "sender": {"name": sender_name or "PDFVish", "email": sender_email},
            "to": [{"email": to_address}],
            "subject": subject,
            "htmlContent": html,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        BREVO_ENDPOINT,
        data=payload,
        method="POST",
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        print(f"[auth] Brevo rejected email ({exc.code}): {detail}")
        return False
    except urllib.error.URLError as exc:
        print(f"[auth] Could not reach Brevo: {exc}")
        return False


def _send_via_resend(to_address, subject, html):
    """Send through the Resend API. Returns True on success."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return False

    sender = os.environ.get("MAIL_FROM", DEFAULT_SENDER)
    payload = json.dumps(
        {"from": sender, "to": [to_address], "subject": subject, "html": html}
    ).encode("utf-8")

    req = urllib.request.Request(
        RESEND_ENDPOINT,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        print(f"[auth] Resend rejected email ({exc.code}): {detail}")
        return False
    except urllib.error.URLError as exc:
        print(f"[auth] Could not reach Resend: {exc}")
        return False


def send_email(to_address, subject, html):
    """Send one HTML email via the first configured backend. Returns True if sent.

    Order: Brevo (HTTP) -> SMTP -> Resend (HTTP). Brevo/Resend use HTTPS so they
    work on hosts like Render that block outbound SMTP ports.
    """
    if os.environ.get("BREVO_API_KEY"):
        return _send_via_brevo(to_address, subject, html)
    if _smtp_configured():
        return _send_via_smtp(to_address, subject, html)
    if os.environ.get("RESEND_API_KEY"):
        return _send_via_resend(to_address, subject, html)
    return False


def reset_email_html(name, link):
    """Build the password-reset email body containing a reset link."""
    safe_name = (name or "there").strip()
    return f"""\
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#111">Reset your password</h2>
      <p>Hi {safe_name}, we received a request to reset your PDFVish password.
         Click the button below to choose a new one:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="{link}" style="background:#4b5563;color:#fff;text-decoration:none;
           padding:12px 24px;border-radius:8px;display:inline-block">
          Reset password
        </a>
      </p>
      <p style="color:#6b7280">This link expires in 30 minutes. If you didn't
         request this, you can safely ignore this email — your password won't
         change.</p>
    </div>"""


def verification_email_html(name, code):
    """Build the verification email body for a 6-digit code."""
    safe_name = (name or "there").strip()
    return f"""\
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#111">Verify your email</h2>
      <p>Hi {safe_name}, welcome to PDFVish! Use this code to finish creating
         your account:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;
                background:#f3f4f6;padding:16px;text-align:center;border-radius:8px">
        {code}
      </p>
      <p style="color:#6b7280">This code expires in 15 minutes. If you didn't
         sign up for PDFVish, you can safely ignore this email.</p>
    </div>"""
