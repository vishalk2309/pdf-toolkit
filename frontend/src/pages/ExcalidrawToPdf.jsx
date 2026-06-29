import { useState } from 'react'
import DropZone from '../components/DropZone.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { exportToBlob } from '@excalidraw/excalidraw'
import { jsPDF } from 'jspdf'
import styles from './Page.module.css'

export default function ExcalidrawToPdf() {
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState('idle') // idle | working | ready | error
  const [error, setError] = useState('')
  const [doc, setDoc] = useState(null) // the built jsPDF document, ready to save

  const isWorking = status === 'working'
  const canSubmit = files.length === 1 && !isWorking

  const reset = () => {
    setFiles([])
    setStatus('idle')
    setError('')
    setDoc(null)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setStatus('working')
    setError('')
    setDoc(null)
    try {
      // 1. An .excalidraw file is plain JSON — read and parse it.
      const text = await files[0].text()
      const scene = JSON.parse(text)
      if (!Array.isArray(scene.elements) || scene.elements.length === 0) {
        throw new Error('This file has no drawing elements to convert.')
      }

      // 2. Render the scene to a PNG image (Excalidraw does the hard part).
      const blob = await exportToBlob({
        elements: scene.elements,
        appState: { ...scene.appState, exportBackground: true },
        files: scene.files || null,
        mimeType: 'image/png',
        getDimensions: (w, h) => ({ width: w, height: h, scale: 2 }),
      })

      // 3. Read the PNG as a data URL and measure it.
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.onerror = () => rej(new Error('Could not read the rendered image.'))
        r.readAsDataURL(blob)
      })
      const img = await new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => rej(new Error('Could not load the rendered image.'))
        i.src = dataUrl
      })

      // 4. Build a PDF page sized exactly to the drawing and drop the image in.
      const orientation = img.width >= img.height ? 'landscape' : 'portrait'
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [img.width, img.height],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height)

      setDoc(pdf)
      setStatus('ready')
    } catch (err) {
      setError(err?.message || 'Could not convert this file.')
      setStatus('error')
    }
  }

  const download = (finalName) => {
    if (doc) doc.save(finalName)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.icon}>🎨</div>
        <h1 className={styles.title}>Excalidraw → PDF</h1>
        <p className={styles.subtitle}>
          Upload an .excalidraw file and download it as a PDF. Conversion happens
          entirely in your browser — your drawing is never uploaded.
        </p>
      </header>

      <form className={styles.card} onSubmit={onSubmit}>
        <DropZone
          files={files}
          onChange={setFiles}
          accept=".excalidraw,application/json"
          hint="Select one .excalidraw file"
        />

        <div className={styles.actions}>
          <button type="submit" className="btn" disabled={!canSubmit}>
            {isWorking ? 'Converting…' : 'Convert to PDF'}
          </button>
          {files.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={reset}
              disabled={isWorking}
            >
              Clear
            </button>
          )}
        </div>

        <ProgressBar
          status={status}
          error={error}
          filename="drawing.pdf"
          onDownload={download}
        />
      </form>
    </div>
  )
}
