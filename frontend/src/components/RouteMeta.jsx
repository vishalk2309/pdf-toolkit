import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { tools } from '../toolsConfig.js'

const SITE = 'PDFVish'
const DEFAULT_DESC =
  'Free online PDF tools — merge, split, compress, convert and protect your PDFs securely.'

// Titles/descriptions for non-tool routes.
const STATIC_META = {
  '/': {
    title: 'PDFVish — Free Online PDF Tools',
    desc: DEFAULT_DESC,
  },
  '/about': { title: 'About', desc: 'Learn about PDFVish and our free PDF tools.' },
  '/features': { title: 'Features', desc: 'Everything PDFVish can do with your PDFs.' },
  '/faq': { title: 'FAQ', desc: 'Answers to common questions about PDFVish.' },
  '/contact': { title: 'Contact', desc: 'Get in touch with the PDFVish team.' },
  '/privacy': { title: 'Privacy Policy', desc: 'How PDFVish handles your data and files.' },
  '/terms': { title: 'Terms of Service', desc: 'The terms for using PDFVish.' },
  '/login': { title: 'Log in', desc: 'Log in to your PDFVish account.' },
  '/signup': { title: 'Sign up', desc: 'Create a free PDFVish account.' },
  '/account': { title: 'Account settings', desc: 'Manage your PDFVish account.' },
  '/verify-email': { title: 'Verify email', desc: 'Verify your PDFVish email address.' },
  '/forgot-password': { title: 'Forgot password', desc: 'Reset your PDFVish password.' },
  '/reset-password': { title: 'Reset password', desc: 'Choose a new PDFVish password.' },
}

function setMeta(name, value, attr = 'name') {
  if (!value) return
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

/** Updates document title + meta description/OG tags as the route changes. */
export default function RouteMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    let title
    let desc

    if (STATIC_META[pathname]) {
      ({ title, desc } = STATIC_META[pathname])
    } else {
      const tool = tools.find((t) => t.path === pathname)
      if (tool) {
        title = tool.title
        desc = tool.description
      }
    }

    const fullTitle =
      !title || pathname === '/' ? title || `${SITE} — Free Online PDF Tools` : `${title} — ${SITE}`
    document.title = fullTitle

    const description = desc || DEFAULT_DESC
    setMeta('description', description)
    setMeta('og:title', fullTitle, 'property')
    setMeta('og:description', description, 'property')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)
  }, [pathname])

  return null
}
