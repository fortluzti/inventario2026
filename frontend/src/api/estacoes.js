import { api } from './client.js'

export const ESTACAO_STATUS = ['Em Uso', 'Em Estoque', 'Em Manutenção', 'Danificado', 'Descartado']
export const ACESSORIOS = [
  ['Mouse', 'Mouse Óptico USB', 'mouse'],
  ['Teclado', 'Teclado ABNT2 USB', 'keyboard'],
  ['Barcode', 'Leitor Cód. Barras', 'barcode_scanner'],
  ['Webcam', 'Webcam HD 1080p', 'videocam'],
  ['Headset', 'Headset Corporativo', 'headset_mic'],
  ['Outro', 'Outro Periférico', 'more_horiz'],
]

export const EMPTY_ESTACAO = {
  codigo_interno_estacao: '', empresa_id: '', setor_id: '', funcionario_id: '',
  status: 'Em Estoque', ip: '', processador: '', memoria: '', hd: '', estado_hd: '',
  id_monitor: '', ano_compra: '', data_compra: '', nota_fiscal: '', fornecedor_id: '', acessorios: '',
}

// A API limita a 200 registros por página. Não truncar os cadastros dos selects.
export async function listarOpcoes(endpoint) {
  const params = { limit: 200, page: 1 }
  if (endpoint === 'funcionarios' || endpoint === 'fornecedores') params.ativo = 1
  const first = await api(endpoint, 'listar', { params })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api(endpoint, 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items.sort((a, b) => String(a.nome || a.codigo_interno_monitor || '').localeCompare(String(b.nome || b.codigo_interno_monitor || ''), 'pt-BR', { numeric: true }))
}

export async function listarTodas(params = {}) {
  const first = await api('estacoes', 'listar', { params: { ...params, limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('estacoes', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items
}

export function estacaoPayload(form) {
  const integers = ['empresa_id', 'setor_id', 'funcionario_id', 'id_monitor', 'ano_compra', 'fornecedor_id']
  return Object.fromEntries(Object.keys(EMPTY_ESTACAO).map((key) => {
    const value = String(form[key] ?? '').trim()
    return [key, value === '' ? null : integers.includes(key) ? Number(value) : value]
  }))
}
