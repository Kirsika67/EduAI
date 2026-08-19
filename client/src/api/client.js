import { API_BASE_URL } from '../config'

export async function apiCall(path, options = {}) {
  const token = localStorage.getItem('eduai_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Uhendus serveriga ebaonnestus. Kontrolli, kas backend tootab.')
    }
    throw err
  }

  /**
   * 401 tähendab alati sama asja: seanssi pole. Varem nõudis see haru, et
   * token oleks olemas — aga kui token on vahepeal kadunud (nt teine sakk
   * logis välja, sest localStorage on sakkide vahel jagatud), jäi kasutaja
   * tööle lehele arusaamatu teatega "Autentimine on vajalik" ja ilma
   * väljapääsuta. Nüüd suuname alati sisselogimisse.
   */
  if (response.status === 401 && !path.startsWith('/api/auth/login')) {
    localStorage.removeItem('eduai_token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Sessioon on aegunud. Palun logi uuesti sisse.')
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Serveri viga' }))
    throw new Error(error.message || error.error || `HTTP ${response.status}`)
  }

  return response.json()
}
