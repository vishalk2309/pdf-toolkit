import { useEffect, useState } from 'react'
import ToolCard from '../components/ToolCard.jsx'
import { tools, CATEGORIES } from '../toolsConfig.js'
import styles from './Home.module.css'

// Hero heading typed out character by character. The trailing part is the
// gradient-accented phrase, so we track how far typing has reached into it.
const PREFIX = 'Every PDF tool you need — '
const HIGHLIGHT = 'in one place'
const FULL = PREFIX + HIGHLIGHT
const TYPE_SPEED_MS = 55

export default function Home() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Respect users who prefer reduced motion — show the heading instantly.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCount(FULL.length)
      return
    }
    if (count >= FULL.length) return
    const id = setTimeout(() => setCount((c) => c + 1), TYPE_SPEED_MS)
    return () => clearTimeout(id)
  }, [count])

  const prefixShown = FULL.slice(0, Math.min(count, PREFIX.length))
  const highlightShown = count > PREFIX.length ? FULL.slice(PREFIX.length, count) : ''

  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.title} aria-label={FULL}>
          <span aria-hidden="true">{prefixShown}</span>
          <span className={styles.accent} aria-hidden="true">
            {highlightShown}
          </span>
          <span className={styles.cursor} aria-hidden="true" />
        </h1>
        <p className={styles.tagline}>
          Convert, organize, edit and secure your PDFs online — completely free.
          Files are encrypted in transit and deleted automatically after
          processing. No account required.
        </p>
      </section>

      {CATEGORIES.map((category) => {
        const items = tools.filter((t) => t.category === category)
        if (!items.length) return null
        return (
          <section key={category} className={styles.group}>
            <h2 className={styles.groupTitle}>{category}</h2>
            <div className={styles.grid}>
              {items.map((t) => (
                <ToolCard
                  key={t.path}
                  to={t.path}
                  icon={t.icon}
                  title={t.title}
                  description={t.description}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
