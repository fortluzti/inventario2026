import { api } from './client.js'

export const MONITOR_STATUS = ['Em Uso', 'Em Estoque', 'Em Manutenção', 'Danificado', 'Descartado']

export const PORTAS_CONEXAO = ['HDMI', 'VGA', 'DisplayPort', 'DVI', 'USB-C', 'Outro']

export const EMPTY_MONITOR = {
  codigo_interno_monitor: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  status: 'Em Estoque',
  data_compra: '',
  nota_fiscal: '',
  fornecedor_id: '',
  empresa_id: '',
  portas: '',
}

export async function listarOpcoes(endpoint) {
  const first = await api(endpoint, 'listar', { params: { limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api(endpoint, 'listar', { params: { limit: 200, page } })
    items.push(...next.items)
  }
  return items.sort((a, b) => String(a.nome || a.codigo_interno_monitor || '').localeCompare(String(b.nome || b.codigo_interno_monitor || ''), 'pt-BR', { numeric: true }))
}

export async function listarTodas(params = {}) {
  const first = await api('monitores', 'listar', { params: { ...params, limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('monitores', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items
}

export function monitorPayload(form) {
  return {
    marca: String(form.marca ?? '').trim() || null,
    modelo: String(form.modelo ?? '').trim() || null,
    numero_serie: String(form.numero_serie ?? '').trim() || null,
    status: String(form.status ?? '').trim() || null,
    data_compra: String(form.data_compra ?? '').trim() || null,
    nota_fiscal: String(form.nota_fiscal ?? '').trim().substring(0, 50) || null,
    fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
    empresa_id: form.empresa_id ? Number(form.empresa_id) : null,
    portas: String(form.portas ?? '').trim() || null,
  }
}