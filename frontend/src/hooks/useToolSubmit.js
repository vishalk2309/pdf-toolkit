import { useState, useCallback } from 'react'
import { postForm, downloadBlob } from '../utils/api.js'

/**
 * Shared state machine for every tool page: build a FormData payload, POST it,
 * and hold the resulting file in state. The download is NOT automatic — the UI
 * shows a button that calls `download()` when the user clicks it.
 *
 * @param {string} endpoint  API endpoint, e.g. "/merge"
 * @returns {{
 *   submit: (formData: FormData, fallbackName?: string) => Promise<void>,
 *   download: () => void,
 *   status: 'idle' | 'working' | 'ready' | 'error',
 *   error: string,
 *   filename: string,
 *   reset: () => void,
 *   isWorking: boolean,
 * }}
 */
export function useToolSubmit(endpoint) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  // Holds the processed file until the user chooses to download it.
  const [result, setResult] = useState(null) // { blob, filename } | null

  const submit = useCallback(
    async (formData, fallbackName = 'result') => {
      setStatus('working')
      setError('')
      setResult(null)
      try {
        const { blob, filename } = await postForm(endpoint, formData)
        setResult({ blob, filename: filename || fallbackName })
        setStatus('ready')
      } catch (e) {
        setError(e.message || 'Something went wrong.')
        setStatus('error')
      }
    },
    [endpoint]
  )

  // Optionally override the filename (lets the user rename before saving).
  const download = useCallback(
    (overrideName) => {
      if (result) downloadBlob(result.blob, overrideName || result.filename)
    },
    [result]
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError('')
    setResult(null)
  }, [])

  return {
    submit,
    download,
    status,
    error,
    filename: result?.filename || '',
    reset,
    isWorking: status === 'working',
  }
}
