import { api } from './client.js'

/**
 * Salva um anexo de pendência do ERP
 * @param {FormData} formData - Dados do arquivo e metadados
 * @param {Object} options - { method: 'POST' | 'PUT', body: Object }
 * @returns {Promise<Object>} Resposta da API
 */
export function salvar(formData, options = {}) {
  return api('anexos_erp', 'salvar', { 
    method: options.method || 'POST', 
    body: formData 
  })
}

/**
 * Lista anexos de pendências do ERP
 * @param {Object} params - Parâmetros de consulta (page, limit, search, filters)
 * @returns {Promise<Object>} Resposta da API com paginação
 */
export function listar(params = {}) {
  return api('anexos_erp', 'listar', { params })
}

/**
 * Busca um anexo de pendência do ERP por ID
 * @param {number|string} id - ID do anexo
 * @returns {Promise<Object>} Dados do anexo
 */
export function buscarPorId(id) {
  return api('anexos_erp', 'buscar_por_id', { params: { id } })
}

/**
 * Exclui um anexo de pendência do ERP
 * @param {number|string} id - ID do anexo
 * @returns {Promise<Object>} Resposta da API
 */
export function excluir(id) {
  return api('anexos_erp', 'excluir', { 
    method: 'POST', 
    body: { id } 
  })
}

/**
 * Lista anexos de uma pendência específica (útil para o dialog)
 * @param {number|string} pendenciaId - ID da pendência
 * @param {Object} params - Parâmetros adicionais de consulta
 * @returns {Promise<Object>} Resposta da API com lista de anexos
 */
export function listarPorPendencia(pendenciaId, params = {}) {
  return api('anexos_erp', 'listar', { 
    params: { 
      ...params,
      filters: { 
        ...params.filters,
        pendencia_id: pendenciaId 
      } 
    } 
  })
}