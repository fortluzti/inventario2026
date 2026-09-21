import { api } from './client.js'

export const SETOR_STATUS = ['Ativo', 'Inativo']

export const EMPTY_SETOR = {
  nome: '',
  descricao: '',
  ativo: 1,
}

export async function listarOpcoes() {
  const first = await api('setores', 'listar', { params: { limit: 200, page: 1, ativo: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('setores', 'listar', { params: { limit: 200, page, ativo: 1 } })
    items.push(...next.items)
  }
  return items.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true }))
}

export async function listarTodas(params = {}) {
  const first = await api('setores', 'listar', { params: { ...params, limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('setores', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items
}

export async function buscarPorId(id) {
  return api('setores', 'buscar_por_id', { params: { id } })
}

export async function salvarSetor(form) {
  const res = await api('setores', 'salvar', { method: 'POST', body: form })
  return res.id
}

export async function excluir(id) {
  return api('setores', 'excluir', { method: 'POST', body: { id } })
}

export function setorPayload(form) {
  return {
    nome: String(form.nome ?? '').trim() || null,
    descricao: String(form.descricao ?? '').trim().substring(0, 255) || null,
    ativo: form.ativo ? 1 : 0,
  }
}