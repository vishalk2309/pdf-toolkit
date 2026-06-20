import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import GoogleButton from '../components/GoogleButton.jsx'
import styles from './AccountSettings.module.css'

const COUNTRIES = [
  'Australia', 'Bangladesh', 'Brazil', 'Canada', 'China', 'France', 'Germany',
  'India', 'Indonesia', 'Ireland', 'Italy', 'Japan', 'Malaysia', 'Mexico',
  'Nepal', 'Netherlands', 'New Zealand', 'Pakistan', 'Philippines', 'Poland',
  'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain',
  'Sri Lanka', 'Sweden', 'Switzerland', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Other',
]

function timezoneList() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone')
    }
  } catch {
    /* older browser — fall back to a short list */
  }
  return [
    'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London',
    'Europe/Berlin', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Tokyo',
    'Australia/Sydney',
  ]
}

function Message({ ok, text }) {
  if (!text) return null
  return <p className={`${styles.msg} ${ok ? styles.msgOk : styles.msgErr}`}>{text}</p>
}

function CardHead({ icon, title, desc }) {
  return (
    <div className={styles.cardHead}>
      <div className={styles.cardIcon}>{icon}</div>
      <div>
        <h2 className={styles.cardTitle}>{title}</h2>
        <p className={styles.cardDesc}>{desc}</p>
      </div>
    </div>
  )
}

export default function AccountSettings() {
  const {
    user, updateProfile, changePassword, changeEmail, linkGoogle, unlinkGoogle,
    deleteAccount,
  } = useAuth()
  const navigate = useNavigate()
  const tzList = useMemo(timezoneList, [])

  const [confirmDelete, setConfirmDelete] = useState('')
  const [delState, setDelState] = useState({ busy: false, msg: '' })

  const [details, setDetails] = useState({
    name: user?.name || '',
    country: user?.country || '',
    timezone: user?.timezone || '',
  })
  const [detailsState, setDetailsState] = useState({ busy: false, msg: '', ok: false })

  const [pwd, setPwd] = useState({ current: '', next: '' })
  const [pwdState, setPwdState] = useState({ busy: false, msg: '', ok: false })

  const [emailForm, setEmailForm] = useState({ password: '', newEmail: '' })
  const [emailState, setEmailState] = useState({ busy: false, msg: '', ok: false })

  const [linkState, setLinkState] = useState({ msg: '', ok: false })

  if (!user) {
    return (
      <div className={styles.page}>
        <p>
          Please <Link to="/login">log in</Link> to manage your account.
        </p>
      </div>
    )
  }

  const saveDetails = async (e) => {
    e.preventDefault()
    setDetailsState({ busy: true, msg: '', ok: false })
    try {
      await updateProfile(details)
      setDetailsState({ busy: false, msg: 'Details saved.', ok: true })
    } catch (err) {
      setDetailsState({ busy: false, msg: err.message, ok: false })
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setPwdState({ busy: true, msg: '', ok: false })
    try {
      await changePassword(pwd.current, pwd.next)
      setPwd({ current: '', next: '' })
      setPwdState({ busy: false, msg: 'Password updated.', ok: true })
    } catch (err) {
      setPwdState({ busy: false, msg: err.message, ok: false })
    }
  }

  const saveEmail = async (e) => {
    e.preventDefault()
    setEmailState({ busy: true, msg: '', ok: false })
    try {
      const res = await changeEmail(emailForm.password, emailForm.newEmail)
      navigate('/verify-email', {
        state: { email: emailForm.newEmail, devCode: res?.dev_code },
      })
    } catch (err) {
      setEmailState({ busy: false, msg: err.message, ok: false })
    }
  }

  const onLinkGoogle = async (credential) => {
    setLinkState({ msg: '', ok: false })
    try {
      await linkGoogle(credential)
      setLinkState({ msg: 'Google account linked.', ok: true })
    } catch (err) {
      setLinkState({ msg: err.message, ok: false })
    }
  }

  const onUnlinkGoogle = async () => {
    try {
      await unlinkGoogle()
      setLinkState({ msg: 'Google account unlinked.', ok: true })
    } catch (err) {
      setLinkState({ msg: err.message, ok: false })
    }
  }

  const onDeleteAccount = async () => {
    setDelState({ busy: true, msg: '' })
    try {
      await deleteAccount()
      navigate('/', { replace: true })
    } catch (err) {
      setDelState({ busy: false, msg: err.message })
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIcon}>⚙️</div>
        <h1 className={styles.title}>Account settings</h1>
        <p className={styles.subtitle}>Manage your profile, email and security.</p>
      </header>

      {/* --- Details --- */}
      <form className={styles.card} onSubmit={saveDetails}>
        <CardHead icon="👤" title="Details" desc="Your name and regional preferences." />

        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            type="text"
            value={details.name}
            onChange={(e) => setDetails({ ...details, name: e.target.value })}
            required
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Country</label>
            <select
              className={styles.input}
              value={details.country}
              onChange={(e) => setDetails({ ...details, country: e.target.value })}
            >
              <option value="">— Select —</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Timezone</label>
            <select
              className={styles.input}
              value={details.timezone}
              onChange={(e) => setDetails({ ...details, timezone: e.target.value })}
            >
              <option value="">— Select —</option>
              {tzList.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn" disabled={detailsState.busy}>
            {detailsState.busy ? 'Saving…' : 'Save details'}
          </button>
        </div>
        <Message ok={detailsState.ok} text={detailsState.msg} />
      </form>

      {/* --- Email --- */}
      <form className={styles.card} onSubmit={saveEmail}>
        <CardHead
          icon="✉️"
          title="Email"
          desc={`Current: ${user.email}. Changing it requires verifying the new address.`}
        />

        <div className={styles.field}>
          <label className={styles.label}>New email</label>
          <input
            className={styles.input}
            type="email"
            value={emailForm.newEmail}
            onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
            placeholder="new@example.com"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Current password</label>
          <input
            className={styles.input}
            type="password"
            value={emailForm.password}
            onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
            autoComplete="current-password"
            required
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn" disabled={emailState.busy}>
            {emailState.busy ? 'Sending…' : 'Change email'}
          </button>
        </div>
        <Message ok={emailState.ok} text={emailState.msg} />
      </form>

      {/* --- Password --- */}
      <form className={styles.card} onSubmit={savePassword}>
        <CardHead
          icon="🔒"
          title="Password"
          desc="Choose a strong password to keep your account secure."
        />

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Current password</label>
            <input
              className={styles.input}
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>New password</label>
            <input
              className={styles.input}
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <p className={styles.cardDesc} style={{ marginBottom: '0.75rem' }}>
          Signed up with Google only? Use{' '}
          <Link to="/forgot-password">forgot password</Link> to set one first.
        </p>

        <div className={styles.actions}>
          <button type="submit" className="btn" disabled={pwdState.busy}>
            {pwdState.busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
        <Message ok={pwdState.ok} text={pwdState.msg} />
      </form>

      {/* --- Linked accounts --- */}
      <div className={styles.card}>
        <CardHead
          icon="🔗"
          title="Linked accounts"
          desc="Connect a social account for quick sign-in."
        />

        <div className={styles.linkedRow}>
          <div className={styles.provider}>
            <span className={styles.providerIcon}>🇬</span>
            <span className={styles.providerName}>Google</span>
            <span
              className={`${styles.badge} ${
                user.google_linked ? styles.badgeOn : styles.badgeOff
              }`}
            >
              {user.google_linked ? 'Connected' : 'Not linked'}
            </span>
          </div>
          {user.google_linked ? (
            <button type="button" className="btn btn-ghost" onClick={onUnlinkGoogle}>
              Disconnect
            </button>
          ) : (
            <GoogleButton
              onCredential={onLinkGoogle}
              onError={(m) => setLinkState({ msg: m, ok: false })}
            />
          )}
        </div>

        <div className={styles.linkedRow}>
          <div className={styles.provider}>
            <span className={styles.providerIcon}>📘</span>
            <span className={styles.providerName}>Facebook</span>
            <span className={`${styles.badge} ${styles.badgeOff}`}>Coming soon</span>
          </div>
        </div>

        <Message ok={linkState.ok} text={linkState.msg} />
      </div>

      {/* --- Danger zone --- */}
      <div className={styles.card} style={{ borderColor: 'var(--danger)' }}>
        <CardHead
          icon="⚠️"
          title="Delete account"
          desc="Permanently delete your account and data. This cannot be undone."
        />
        <div className={styles.field}>
          <label className={styles.label}>
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            className={styles.input}
            type="text"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="DELETE"
          />
        </div>
        <button
          type="button"
          className="btn"
          style={{ background: 'var(--danger)', color: '#fff' }}
          disabled={confirmDelete !== 'DELETE' || delState.busy}
          onClick={onDeleteAccount}
        >
          {delState.busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <Message ok={false} text={delState.msg} />
      </div>
    </div>
  )
}
