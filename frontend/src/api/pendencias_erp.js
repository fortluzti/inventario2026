import { api } from './client.js'

/**
 * Busca opções de pendências do ERP para uso em selects/autocompletes
 * @returns {Promise<Array>} Lista de pendências com id e código
 */
export function buscarOpcoes() {
  return api('pendencias_erp', 'listar_simples')
}

/**
 * Exclui uma pendência do ERP
 * @param {number|string} id - ID da pendência
 * @returns {Promise<Object>} Resposta da API
 */
export function excluir(id) {
  return api('pendencias_erp', 'excluir', { 
    method: 'POST', 
    body: { id } 
  })
}

/**
 * Salva uma pendência do ERP (create ou update)
 * @param {Object} data - Dados da pendência
 * @param {Object} options - { method: 'POST' | 'PUT', body: Object }
 * @returns {Promise<Object>} Resposta da API
 */
export function salvar(data, options = {}) {
  return api('pendencias_erp', 'salvar', { 
    method: options.method || 'POST', 
    body: { ...data, ...options.body } 
  })
}

/**
 * Busca uma pendência do ERP por ID
 * @param {number|string} id - ID da pendência
 * @returns {Promise<Object>} Dados da pendência
 */
export function buscarPorId(id) {
  return api('pendencias_erp', 'buscar_por_id', { params: { id } })
}