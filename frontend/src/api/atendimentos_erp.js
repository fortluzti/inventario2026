import { api } from './client.js'

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