import { useEffect, useState } from 'react'

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

/**
 * "Install app" button for the PWA.
 *
 * On Chrome/Edge/Android it captures the browser's `beforeinstallprompt` event
 * and triggers the native install dialog on click. iOS Safari doesn't support
 * that event, so there we show a short "Add to Home Screen" hint instead. The
 * button hides itself once the app is installed / already running standalone.
 */
export default function InstallButton({ className }) {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault() // stop Chrome's mini-infobar; we'll prompt on click
      setDeferred(e)
    }
    const onInstalled = () => {
      setDeferred(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || isStandalone()) return null

  const ios = isIos()
  // Show only when we can actually install (Android/desktop) or on iOS Safari.
  if (!deferred && !ios) return null

  const onClick = async () => {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
    } else if (ios) {
      setIosHint(true)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick}>
        📲 Install app
      </button>

      {iosHint && (
        <div
          onClick={() => setIosHint(false)}
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1e1b3a',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            zIndex: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            maxWidth: '90vw',
          }}
        >
          On iPhone: tap <strong>Share</strong> then{' '}
          <strong>“Add to Home Screen”</strong> &nbsp;(tap to dismiss)
        </div>
      )}
    </>
  )
}
