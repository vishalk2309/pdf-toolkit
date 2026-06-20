// Thin wrapper around fetch for the PDFVish API.
// Every endpoint takes multipart/form-data and returns a file (Blob) on success
// or a JSON { error } body on failure.

const API_BASE = '/api'

/**
 * POST a FormData payload to an endpoint and return the response as a Blob.
 * Throws an Error (with the server's message when available) on failure.
 *
 * @param {string} endpoint  e.g. "/merge"
 * @param {FormData} formData
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function postForm(endpoint, formData) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* response wasn't JSON; keep the generic message */
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const filename = filenameFromDisposition(
    res.headers.get('Content-Disposition')
  )
  return { blob, filename }
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function filenameFromDisposition(disposition) {
  if (!disposition) return ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return match ? decodeURIComponent(match[1]) : ''
}

// --------------------------------------------------------------------------- //
// JSON helpers (used by auth — these send/receive JSON rather than files)
// --------------------------------------------------------------------------- //

/** POST a JSON body and return the parsed JSON. Throws Error on failure. */
export async function postJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data // exposes flags like needs_verification to callers
    throw err
  }
  return data
}

/** DELETE an endpoint with an optional Bearer token; returns parsed JSON. */
export async function deleteJson(endpoint, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/** GET JSON from an endpoint with an optional Bearer token. */
export async function getJson(endpoint, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${endpoint}`, { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
