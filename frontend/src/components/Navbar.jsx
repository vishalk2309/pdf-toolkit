import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { CATEGORIES, tools } from '../toolsConfig.js'
import { useAuth } from '../context/AuthContext.jsx'
import InstallButton from './InstallButton.jsx'
import styles from './Navbar.module.css'

// Tools surfaced directly in the navbar for quick access.
const QUICK_LINKS = [
  { to: '/merge', label: 'Merge PDF' },
  { to: '/split', label: 'Split PDF' },
  { to: '/compress', label: 'Compress PDF' },
]

// Conversion tools shown in the "Convert PDF" dropdown.
const CONVERT_CATEGORIES = ['Convert from PDF', 'Convert to PDF']

export default function Navbar() {
  // Tracks which dropdown is open ('convert' | 'all' | null).
  const [openMenu, setOpenMenu] = useState(null)
  // Mobile hamburger panel open/closed.
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapseRef = useRef(null)
  const location = useLocation()
  const { isAuthenticated, user, logout, loading } = useAuth()

  // Close dropdowns + mobile panel whenever the route changes.
  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
  }, [location.pathname])

  // Close dropdowns on outside click or Escape.
  useEffect(() => {
    if (!openMenu) return
    function onClick(e) {
      if (collapseRef.current && !collapseRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  const toggle = (menu) => setOpenMenu((cur) => (cur === menu ? null : menu))

  // First letters of the user's name (max two) for the avatar.
  const initials = (name) =>
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?'

  const navLinkClass = ({ isActive }) =>
    isActive ? `${styles.link} ${styles.active}` : styles.link

  const renderMenu = (categories, wide) => (
    <div
      className={`${styles.menu} ${wide ? styles.menuWide : ''}`}
      role="menu"
    >
      {categories.map((category) => (
        <div key={category} className={styles.menuGroup}>
          <p className={styles.menuGroupTitle}>{category}</p>
          {tools
            .filter((t) => t.category === category)
            .map((t) => (
              <NavLink
                key={t.path}
                to={t.path}
                className={styles.menuItem}
                role="menuitem"
              >
                <span className={styles.menuIcon}>{t.icon}</span>
                <span>{t.title}</span>
              </NavLink>
            ))}
        </div>
      ))}
    </div>
  )

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <span className={styles.logoMark}>PV</span>
          PDF<span className={styles.accent}>Vish</span>
        </Link>

        <div className={styles.barRight}>
          {/* Install button on the always-visible bar (mobile only). */}
          <span className={styles.installMobile}>
            <InstallButton className={styles.install} />
          </span>
          <button
            type="button"
            className={styles.burger}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        <div
          className={`${styles.collapse} ${mobileOpen ? styles.collapseOpen : ''}`}
          ref={collapseRef}
        >
          <nav className={styles.links}>
            {QUICK_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={navLinkClass}>
                {l.label}
              </NavLink>
            ))}

            {/* Convert PDF dropdown */}
            <div className={styles.dropdown}>
              <button
                type="button"
                className={`${styles.link} ${styles.dropdownToggle}`}
                onClick={() => toggle('convert')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'convert'}
              >
                Convert PDF
                <span
                  className={`${styles.caret} ${
                    openMenu === 'convert' ? styles.caretOpen : ''
                  }`}
                >
                  ▾
                </span>
              </button>
              {openMenu === 'convert' && renderMenu(CONVERT_CATEGORIES, false)}
            </div>

            {/* All PDF Tools dropdown */}
            <div className={styles.dropdown}>
              <button
                type="button"
                className={`${styles.link} ${styles.dropdownToggle}`}
                onClick={() => toggle('all')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'all'}
              >
                All PDF Tools
                <span
                  className={`${styles.caret} ${
                    openMenu === 'all' ? styles.caretOpen : ''
                  }`}
                >
                  ▾
                </span>
              </button>
              {openMenu === 'all' && renderMenu(CATEGORIES, true)}
            </div>
          </nav>

          <div className={styles.auth}>
            <span className={styles.installDesktop}>
              <InstallButton className={styles.install} />
            </span>
            {/* While the stored token is being validated, show neither state —
                otherwise a logged-in user sees a flash of Login/Signup on every
                page refresh until /auth/me resolves. */}
            {loading ? null : isAuthenticated ? (
              <div className={styles.dropdown}>
                <button
                  type="button"
                  className={styles.avatar}
                  onClick={() => toggle('user')}
                  aria-haspopup="true"
                  aria-expanded={openMenu === 'user'}
                  title={user?.name}
                >
                  {initials(user?.name)}
                </button>
                {openMenu === 'user' && (
                  <div className={styles.userMenu} role="menu">
                    <div className={styles.userMenuHeader}>
                      <span className={styles.userMenuName}>{user?.name}</span>
                      <span className={styles.userMenuEmail}>{user?.email}</span>
                    </div>
                    <NavLink to="/account" className={styles.userMenuItem} role="menuitem">
                      <span className={styles.menuIcon}>⚙️</span> Account settings
                    </NavLink>
                    <NavLink to="/signatures" className={styles.userMenuItem} role="menuitem">
                      <span className={styles.menuIcon}>🖊️</span> Signatures
                    </NavLink>
                    <NavLink to="/files" className={styles.userMenuItem} role="menuitem">
                      <span className={styles.menuIcon}>📁</span> Your files
                    </NavLink>
                    <button type="button" className={styles.userMenuItem} onClick={logout}>
                      <span className={styles.menuIcon}>🚪</span> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className={styles.login}>
                  Log in
                </Link>
                <Link to="/signup" className={styles.signup}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
