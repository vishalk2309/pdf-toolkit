import { useEffect, useState } from 'react'
import styles from './ProgressBar.module.css'

/**
 * Progress / result indicator for an in-flight tool request.
 * When `status === 'ready'`, shows an editable filename + a Download button.
 * The user can rename the file before saving; the original extension is kept.
 *
 * @param {'idle'|'working'|'ready'|'error'} status
 * @param {string} [error]
 * @param {string} [filename]      name of the ready-to-download file
 * @param {(name: string) => void} [onDownload]
 */
export default function ProgressBar({ status, error, filename, onDownload }) {
  // Split the suggested filename into an editable base name and a fixed
  // extension, so renaming can't accidentally break the file type.
  const dot = filename ? filename.lastIndexOf('.') : -1
  const ext = dot > 0 ? filename.slice(dot) : ''

  const [name, setName] = useState('')
  useEffect(() => {
    if (status === 'ready' && filename) {
      setName(dot > 0 ? filename.slice(0, dot) : filename)
    }
  }, [status, filename, dot])

  if (status === 'idle') return null

  const finalName = (name.trim() || 'download') + ext

  return (
    <div className={styles.wrap}>
      {status === 'working' && (
        <>
          <div className={styles.track}>
            <div className={styles.bar} />
          </div>
          <p className={styles.label}>Processing…</p>
        </>
      )}

      {status === 'ready' && (
        <div className={styles.ready}>
          <p className={`${styles.label} ${styles.done}`}>
            ✅ Your file is ready
          </p>

          <label className={styles.renameLabel}>
            File name
            <span className={styles.renameRow}>
              <input
                type="text"
                className={styles.renameInput}
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, ''))}
                placeholder="filename"
                aria-label="File name"
              />
              {ext && <span className={styles.ext}>{ext}</span>}
            </span>
          </label>

          <button
            type="button"
            className="btn"
            onClick={() => onDownload(finalName)}
          >
            ⬇️ Download
          </button>
        </div>
      )}

      {status === 'error' && (
        <p className={`${styles.label} ${styles.error}`}>⚠️ {error}</p>
      )}
    </div>
  )
}
