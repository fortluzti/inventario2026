import { api, getApiKey } from './client.js'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090/index.php'

/**
 * Salva um atendimento de pendência do ERP (envio ao suporte)
 * @param {Object} data - Dados do atendimento
 * @param {Object} options - { method: 'POST' | 'PUT', body: Object }
 * @returns {Promise<Object>} Resposta da API
 */
export function salvar(data, options = {}) {
  return api('atendimentos_erp', 'salvar', { 
    method: options.method || 'POST', 
    body: { ...data, ...options.body } 
  })
}

export function registrarAtendimento(data) {
  return api('pendencias_erp', 'registrar_atendimento', {
    method: 'POST',
    body: data,
  })
}

/**
 * Registra o TESTE da correção no mesmo chamado (ação "Testar correção").
 * Backend: PendenciasErpHandler::registrarTeste (transação única).
 * @param {Object} data - { pendencia_id, usuario_id, resultado, oque_foi_testado, observacoes, ... }
 * @returns {Promise<Object>} { id, pendencia_id, resultado, status }
 */
export function registrarTeste(data) {
  return api('pendencias_erp', 'registrar_teste', {
    method: 'POST',
    body: data,
  })
}

/**
 * Envia uma evidência (imagem/arquivo) da pendência — multipart/form-data.
 * Usa fetch direto (mesmo padrão de configuracoes.uploadLogo), porque o helper
 * `api()` serializa o corpo como JSON e não serve para FormData.
 * Backend: PendenciasErpHandler::uploadEvidencia.
 * @param {FormData} formData - { arquivo, pendencia_id, usuario_id }
 * @returns {Promise<Object>} { id, nome_arquivo, tipo_arquivo, tamanho_bytes, ... }
 */
export async function uploadEvidencia(formData) {
  const url = new URL(BASE_URL)
  url.searchParams.set('endpoint', 'pendencias_erp')
  url.searchParams.set('action', 'upload_evidencia')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-KEY': getApiKey() },
    body: formData,
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

/**
 * Busca atendimentos de pendências do ERP
 * @param {Object} params - Parâmetros de consulta (page, limit, search, filters)
 * @returns {Promise<Object>} Resposta da API com paginação
 */
export function listar(params = {}) {
  return api('atendimentos_erp', 'listar', { params })
}

/**
 * Busca um atendimento de pendência do ERP por ID
 * @param {number|string} id - ID do atendimento
 * @returns {Promise<Object>} Dados do atendimento
 */
export function buscarPorId(id) {
  return api('atendimentos_erp', 'buscar_por_id', { params: { id } })
}

/**
 * Exclui um atendimento de pendência do ERP
 * @param {number|string} id - ID do atendimento
 * @returns {Promise<Object>} Resposta da API
 */
export function excluir(id) {
  return api('atendimentos_erp', 'excluir', { 
    method: 'POST', 
    body: { id } 
  })
}
