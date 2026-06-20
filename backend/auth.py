"""Authentication blueprint for PDFVish.

Endpoints (all under /api/auth):
    POST /signup  -> create an account, returns { token, user }
    POST /login   -> authenticate, returns { token, user }
    GET  /me      -> current user (requires Bearer token)

Passwords are stored only as salted hashes (werkzeug pbkdf2/scrypt). Sessions
are stateless JWTs signed with the app SECRET_KEY — a good fit for the planned
mobile app, since the token can be stored on-device and sent as a header.
"""

import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import Blueprint, current_app, g, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash, generate_password_hash

from models import User, db
from utils.mailer import (
    email_configured,
    reset_email_html,
    send_email,
    verification_email_html,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Rate limiter — keyed by client IP. Initialised against the app in app.py.
# Storage is in-memory by default (fine for a single small instance).
limiter = Limiter(key_func=get_remote_address, default_limits=[])

MAX_VERIFY_ATTEMPTS = 5  # wrong code guesses before the code is invalidated

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_TTL = timedelta(days=7)
RESET_TTL = timedelta(minutes=30)
VERIFY_TTL = timedelta(minutes=15)


def _set_verification_code(user):
    """Generate a fresh 6-digit code on the user and return it."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    user.verification_code = code
    user.verification_expires = datetime.utcnow() + VERIFY_TTL
    user.verification_attempts = 0
    return code


def _send_verification(user, code):
    """Email the code via Resend. Returns True if the email was sent."""
    return send_email(
        user.email,
        "Your PDFVish verification code",
        verification_email_html(user.name, code),
    )


def _make_token(user):
    payload = {
        "sub": str(user.id),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + TOKEN_TTL,
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def _make_reset_token(user):
    """Short-lived, single-purpose token for password resets."""
    payload = {
        "sub": str(user.id),
        "purpose": "reset",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + RESET_TTL,
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def token_required(fn):
    """Decorator: require a valid Bearer token; sets g.current_user."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify(error="Authentication required."), 401

        token = header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            return jsonify(error="Session expired. Please log in again."), 401
        except jwt.InvalidTokenError:
            return jsonify(error="Invalid authentication token."), 401

        user = db.session.get(User, int(payload["sub"]))
        if not user:
            return jsonify(error="Account no longer exists."), 401

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


@auth_bp.route("/signup", methods=["POST"])
@limiter.limit("5 per minute")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify(error="Name is required."), 400
    if not EMAIL_RE.match(email):
        return jsonify(error="Please enter a valid email address."), 400
    if len(password) < 8:
        return jsonify(error="Password must be at least 8 characters."), 400

    existing = User.query.filter_by(email=email).first()
    if existing and existing.is_verified:
        return jsonify(error="An account with this email already exists."), 409

    # Reuse an unverified record if they're signing up again with the same email.
    user = existing or User(email=email)
    user.name = name
    user.password_hash = generate_password_hash(password)
    user.is_verified = False
    code = _set_verification_code(user)

    if not existing:
        db.session.add(user)
    db.session.commit()

    sent = _send_verification(user, code)
    if not sent and not current_app.config.get("AUTH_DEV_MODE"):
        return jsonify(
            error="Could not send the verification email. Please try again later."
        ), 502

    # No token yet — the account isn't usable until the email is verified.
    resp = {
        "message": "We've sent a 6-digit verification code to your email.",
        "email": email,
        "needs_verification": True,
    }
    # DEV ONLY: surface the code when email delivery isn't configured, so the
    # flow can be tested without a Resend key.
    if not sent and current_app.config.get("AUTH_DEV_MODE"):
        resp["dev_code"] = code
    return jsonify(resp), 201


@auth_bp.route("/verify", methods=["POST"])
@limiter.limit("15 per minute")
def verify_email():
    """Confirm a 6-digit code and, on success, log the user in (returns token)."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify(error="No account found for that email."), 404
    if user.is_verified:
        return jsonify(token=_make_token(user), user=user.to_dict())
    if not user.verification_code or not user.verification_expires:
        return jsonify(error="No pending verification. Please sign up again."), 400
    if datetime.utcnow() > user.verification_expires:
        return jsonify(error="This code has expired. Request a new one."), 400
    if user.verification_attempts >= MAX_VERIFY_ATTEMPTS:
        # Too many wrong guesses — invalidate the code so it must be re-sent.
        user.verification_code = None
        user.verification_expires = None
        db.session.commit()
        return jsonify(
            error="Too many incorrect attempts. Please request a new code."
        ), 429
    if not secrets.compare_digest(code, user.verification_code):
        user.verification_attempts += 1
        db.session.commit()
        return jsonify(error="Incorrect code. Please check and try again."), 400

    user.is_verified = True
    user.verification_code = None
    user.verification_expires = None
    user.verification_attempts = 0
    db.session.commit()

    return jsonify(token=_make_token(user), user=user.to_dict())


@auth_bp.route("/resend", methods=["POST"])
@limiter.limit("3 per minute")
def resend_code():
    """Resend a verification code. Generic response to avoid email enumeration."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    resp = {"message": "If that account needs verification, a new code has been sent."}

    user = User.query.filter_by(email=email).first()
    if user and not user.is_verified:
        code = _set_verification_code(user)
        db.session.commit()
        sent = _send_verification(user, code)
        if not sent and current_app.config.get("AUTH_DEV_MODE"):
            resp["dev_code"] = code

    return jsonify(resp)


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        # Same message for both cases — don't reveal which emails exist.
        return jsonify(error="Invalid email or password."), 401

    if not user.is_verified:
        return jsonify(
            error="Please verify your email before logging in.",
            needs_verification=True,
            email=user.email,
        ), 403

    return jsonify(token=_make_token(user), user=user.to_dict())


@auth_bp.route("/forgot", methods=["POST"])
@limiter.limit("5 per minute")
def forgot_password():
    """Begin a password reset.

    Always returns the same generic message so the endpoint can't be used to
    discover which emails are registered. The reset link is emailed in
    production; until email is configured (AUTH_DEV_MODE), it is logged to the
    server console and returned in the response so it can be tested locally.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    resp = {
        "message": "If an account exists for that email, a reset link has been sent."
    }

    user = User.query.filter_by(email=email).first()
    if user:
        token = _make_reset_token(user)
        # Absolute URL so the link works from an email. Prefer APP_BASE_URL
        # (e.g. https://pdfvish.onrender.com); fall back to the request host.
        base = (os.environ.get("APP_BASE_URL") or request.host_url).rstrip("/")
        reset_link = f"{base}/reset-password?token={token}"

        sent = send_email(
            user.email,
            "Reset your PDFVish password",
            reset_email_html(user.name, reset_link),
        )
        if not sent:
            print(f"[auth] Password reset link for {email}: {reset_link}")
        # DEV ONLY: surface the link when email delivery isn't configured.
        if not sent and current_app.config.get("AUTH_DEV_MODE"):
            resp["dev_reset_link"] = reset_link

    return jsonify(resp)


@auth_bp.route("/reset", methods=["POST"])
@limiter.limit("5 per minute")
def reset_password():
    """Complete a password reset with a valid reset token + new password."""
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    password = data.get("password") or ""

    if len(password) < 8:
        return jsonify(error="Password must be at least 8 characters."), 400

    try:
        payload = jwt.decode(
            token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        return jsonify(error="This reset link has expired. Please request a new one."), 400
    except jwt.InvalidTokenError:
        return jsonify(error="Invalid or malformed reset link."), 400

    if payload.get("purpose") != "reset":
        return jsonify(error="Invalid reset link."), 400

    user = db.session.get(User, int(payload["sub"]))
    if not user:
        return jsonify(error="Account no longer exists."), 400

    user.password_hash = generate_password_hash(password)
    db.session.commit()
    return jsonify(message="Your password has been reset. You can now log in.")


@auth_bp.route("/me", methods=["GET"])
@token_required
def me():
    return jsonify(user=g.current_user.to_dict())


# Plans a user is allowed to select right now. Pro/Enterprise are "coming soon"
# until online payments exist, so only "free" is selectable.
SELECTABLE_PLANS = {"free"}


@auth_bp.route("/plan", methods=["POST"])
@token_required
def choose_plan():
    """Set the current user's plan (only 'free' is selectable for now)."""
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "").strip().lower()

    if plan not in SELECTABLE_PLANS:
        return jsonify(error="That plan isn't available yet."), 400

    g.current_user.plan = plan
    db.session.commit()
    return jsonify(user=g.current_user.to_dict())


# --------------------------------------------------------------------------- #
# Social login (Google)
# --------------------------------------------------------------------------- #
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
_google_jwks = None  # lazily-created PyJWKClient (caches Google's public keys)


def _find_or_create_oauth_user(email, name):
    """Find a user by email or create one for a social login (no password)."""
    email = (email or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if user:
        if not user.is_verified:  # provider already verified the email
            user.is_verified = True
            db.session.commit()
        return user

    user = User(
        name=(name or email.split("@")[0]).strip(),
        email=email,
        # Social accounts have no usable password; store a random hash so the
        # column stays populated. They can use "forgot password" to set one.
        password_hash=generate_password_hash(secrets.token_urlsafe(32)),
        is_verified=True,
    )
    db.session.add(user)
    db.session.commit()
    return user


def _verify_google_token(credential):
    """Verify a Google ID token and return its claims (raises ValueError)."""
    global _google_jwks
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise ValueError("Google login isn't configured on the server.")

    if _google_jwks is None:
        _google_jwks = jwt.PyJWKClient(GOOGLE_CERTS_URL)

    signing_key = _google_jwks.get_signing_key_from_jwt(credential)
    claims = jwt.decode(
        credential,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
    )
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise ValueError("Invalid token issuer.")
    if not claims.get("email"):
        raise ValueError("This Google account has no email address.")
    if not claims.get("email_verified", False):
        raise ValueError("This Google email isn't verified.")
    return claims


@auth_bp.route("/config", methods=["GET"])
def auth_config():
    """Public config the frontend needs to render social-login buttons."""
    return jsonify(google_client_id=os.environ.get("GOOGLE_CLIENT_ID", ""))


@auth_bp.route("/google", methods=["POST"])
@limiter.limit("20 per minute")
def google_login():
    """Log in / sign up with a Google ID token from the browser."""
    data = request.get_json(silent=True) or {}
    credential = (data.get("credential") or "").strip()
    if not credential:
        return jsonify(error="Missing Google credential."), 400

    try:
        claims = _verify_google_token(credential)
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except jwt.InvalidTokenError:
        return jsonify(error="Could not verify Google sign-in. Please try again."), 401

    user = _find_or_create_oauth_user(claims.get("email"), claims.get("name"))
    return jsonify(token=_make_token(user), user=user.to_dict())


# --------------------------------------------------------------------------- #
# Account settings (all require a valid token)
# --------------------------------------------------------------------------- #
@auth_bp.route("/profile", methods=["POST"])
@token_required
def update_profile():
    """Update name / country / timezone."""
    data = request.get_json(silent=True) or {}
    user = g.current_user

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="Name is required."), 400
    user.name = name
    if "country" in data:
        user.country = (data.get("country") or "").strip() or None
    if "timezone" in data:
        user.timezone = (data.get("timezone") or "").strip() or None

    db.session.commit()
    return jsonify(user=user.to_dict())


@auth_bp.route("/change-password", methods=["POST"])
@token_required
@limiter.limit("10 per minute")
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new = data.get("new_password") or ""
    user = g.current_user

    if not check_password_hash(user.password_hash, current):
        return jsonify(error="Your current password is incorrect."), 400
    if len(new) < 8:
        return jsonify(error="New password must be at least 8 characters."), 400

    user.password_hash = generate_password_hash(new)
    db.session.commit()
    return jsonify(message="Your password has been updated.")


@auth_bp.route("/change-email", methods=["POST"])
@token_required
@limiter.limit("10 per minute")
def change_email():
    """Change email; the new address must be re-verified with a code."""
    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""
    new_email = (data.get("new_email") or "").strip().lower()
    user = g.current_user

    if not check_password_hash(user.password_hash, password):
        return jsonify(error="Your password is incorrect."), 400
    if not EMAIL_RE.match(new_email):
        return jsonify(error="Please enter a valid email address."), 400
    if new_email == user.email:
        return jsonify(error="That's already your email address."), 400
    if User.query.filter_by(email=new_email).first():
        return jsonify(error="That email is already in use."), 409

    user.email = new_email
    user.is_verified = False
    code = _set_verification_code(user)
    db.session.commit()

    sent = _send_verification(user, code)
    resp = {
        "message": "We've sent a verification code to your new email.",
        "email": new_email,
        "needs_verification": True,
    }
    if not sent and current_app.config.get("AUTH_DEV_MODE"):
        resp["dev_code"] = code
    return jsonify(resp)


@auth_bp.route("/link-google", methods=["POST"])
@token_required
def link_google():
    """Link a Google account (its email must match the logged-in account)."""
    data = request.get_json(silent=True) or {}
    credential = (data.get("credential") or "").strip()
    if not credential:
        return jsonify(error="Missing Google credential."), 400
    try:
        claims = _verify_google_token(credential)
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except jwt.InvalidTokenError:
        return jsonify(error="Could not verify Google sign-in."), 401

    if (claims.get("email") or "").strip().lower() != g.current_user.email.lower():
        return jsonify(
            error="That Google account's email doesn't match your account email."
        ), 400

    g.current_user.google_linked = True
    db.session.commit()
    return jsonify(user=g.current_user.to_dict())


@auth_bp.route("/unlink-google", methods=["POST"])
@token_required
def unlink_google():
    g.current_user.google_linked = False
    db.session.commit()
    return jsonify(user=g.current_user.to_dict())


@auth_bp.route("/account", methods=["DELETE"])
@token_required
@limiter.limit("5 per minute")
def delete_account():
    """Permanently delete the logged-in user's account."""
    db.session.delete(g.current_user)
    db.session.commit()
    return jsonify(message="Your account has been deleted.")
