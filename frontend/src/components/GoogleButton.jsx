import { useEffect, useRef, useState } from 'react'
import { getJson } from '../utils/api.js'

// Load Google Identity Services once and reuse the promise across mounts.
let gisPromise = null
function loadGis() {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return gisPromise
}

// Start loading Google's script as soon as this module is imported, in parallel
// with everything else — so it's usually ready by the time config arrives.
loadGis().catch(() => {})

// Fetch /auth/config only once and cache it (it never changes during a session).
let configPromise = null
function loadConfig() {
  if (!configPromise) configPromise = getJson('/auth/config').catch(() => ({}))
  return configPromise
}

/**
 * "Continue with Google" button. Self-hides when Google login isn't configured.
 * On success it calls onCredential(idToken); failures go to onError(message).
 */
export default function GoogleButton({ onCredential, onError }) {
  const divRef = useRef(null)
  const [clientId, setClientId] = useState('')
  const [configLoaded, setConfigLoaded] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    loadConfig().then((cfg) => {
      if (!active) return
      setClientId(cfg.google_client_id || '')
      setConfigLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled || !window.google || !divRef.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            if (resp?.credential) onCredential(resp.credential)
            else onError?.('Google sign-in was cancelled.')
          },
        })
        window.google.accounts.id.renderButton(divRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        })
        setReady(true)
      })
      .catch(() => onError?.('Could not load Google sign-in.'))
    return () => {
      cancelled = true
    }
  }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Config came back with no client ID -> Google login isn't configured.
  if (configLoaded && !clientId) return null

  return (
    <div style={{ minHeight: 44 }}>
      <div ref={divRef} style={{ display: 'flex', justifyContent: 'center' }} />
      {!ready && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            padding: '0.6rem 0',
          }}
        >
          Loading Google…
        </div>
      )}
    </div>
  )
}
