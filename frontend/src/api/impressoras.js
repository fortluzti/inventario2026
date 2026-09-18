import { api } from './client.js'

export const IMPRESSORA_STATUS = ['Em Uso', 'Em Estoque', 'Em Manutenção', 'Danificado', 'Descartado']

export const EMPTY_IMPRESSORA = {
  codigo_interno_impressora: '',
  modelo_id: '',
  numero_serie: '',
  setor_id: '',
  ano_compra: '',
  status: 'Em Estoque',
  data_compra: '',
  nota_fiscal: '',
  fornecedor_id: '',
  empresa_id: '',
  data_ultima_troca_toner: '',
}

export async function listarOpcoes(endpoint) {
  const first = await api(endpoint, 'listar', { params: { limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api(endpoint, 'listar', { params: { limit: 200, page } })
    items.push(...next.items)
  }
  return items.sort((a, b) => String(a.nome || a.codigo_interno_impressora || '').localeCompare(String(b.nome || b.codigo_interno_impressora || ''), 'pt-BR', { numeric: true }))
}

export async function listarTodas(params = {}) {
  const first = await api('impressoras', 'listar', { params: { ...params, limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('impressoras', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items
}

export function impressoraPayload(form) {
  return {
    modelo_id: form.modelo_id ? Number(form.modelo_id) : null,
    numero_serie: String(form.numero_serie ?? '').trim() || null,
    setor_id: form.setor_id ? Number(form.setor_id) : null,
    ano_compra: form.ano_compra ? Number(form.ano_compra) : null,
    status: String(form.status ?? '').trim() || null,
    data_compra: String(form.data_compra ?? '').trim() || null,
    nota_fiscal: String(form.nota_fiscal ?? '').trim().substring(0, 50) || null,
    fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
    empresa_id: form.empresa_id ? Number(form.empresa_id) : null,
    data_ultima_troca_toner: String(form.data_ultima_troca_toner ?? '').trim() || null,
  }
}
