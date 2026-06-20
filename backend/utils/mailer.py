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

RESEND_ENDPOINT = "https://api.resend.com/emails"
DEFAULT_SENDER = "PDFVish <onboarding@resend.dev>"


def _smtp_configured():
    return bool(os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASS"))


def email_configured():
    """True if any email backend (SMTP or Resend) is configured."""
    return _smtp_configured() or bool(os.environ.get("RESEND_API_KEY"))


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
    """Send one HTML email via the first configured backend. Returns True if sent."""
    if _smtp_configured():
        return _send_via_smtp(to_address, subject, html)
    if os.environ.get("RESEND_API_KEY"):
        return _send_via_resend(to_address, subject, html)
    return False


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
