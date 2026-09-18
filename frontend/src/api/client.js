const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090/index.php'
const API_KEY = (import.meta.env.VITE_API_KEY || '').trim()

/**
 * Chave de API configurada no .env.local (VITE_API_KEY).
 * Gere com: php apiphp/scripts/gerar_api_key.php criar "Frontend Web" "*"
 */
export function getApiKey() {
  return API_KEY
}

export function hasApiKey() {
  return API_KEY.length > 0
}


/**
 * Chama a API apiphp.
 * @param {string} endpoint ex.: 'impressoras'
 * @param {string} action   ex.: 'listar'
 * @param {object} opts     { method, params, body }
 */
export async function api(endpoint, action, { method = 'GET', params = {}, body = {} } = {}) {
  const url = new URL(BASE_URL)
  url.searchParams.set('endpoint', endpoint)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-KEY': getApiKey(),
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  })

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(`Resposta inválida da API (HTTP ${res.status})`)
  }

  if (!json.success) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `Erro HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = json.data
    throw err
  }
  return json.data
}
