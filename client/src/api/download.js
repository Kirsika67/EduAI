import { API_BASE_URL } from '../config'

/** Laeb failid alla koos sisselogimistõendiga (tavaline link ei saaks päist kaasa anda). */
export async function downloadFile(path, fallbackName = 'fail.csv') {
  const token = localStorage.getItem('eduai_token')
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const m = disposition.match(/filename="([^"]+)"/)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? m[1] : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Faili üleslaadimine (multipart): apiCall paneks Content-Type'i JSON-iks. */
export async function uploadForm(path, formData) {
  const token = localStorage.getItem('eduai_token')
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}
