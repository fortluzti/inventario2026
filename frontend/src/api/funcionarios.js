import { api } from './client.js'

export const EMPTY_FUNCIONARIO = {
  nome: '',
  cargo: '',
  setor_id: '',
  rg: '',
  email: '',
  gmail: '',
  ativo: 1,
}

export async function listarOpcoes() {
  const first = await api('funcionarios', 'listar', { params: { limit: 200, page: 1, ativo: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('funcionarios', 'listar', { params: { limit: 200, page, ativo: 1 } })
    items.push(...next.items)
  }
  return items.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true }))
}

export async function listarTodas(params = {}) {
  const first = await api('funcionarios', 'listar', { params: { ...params, limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('funcionarios', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items
}

export async function buscarPorId(id) {
  return api('funcionarios', 'buscar_por_id', { params: { id } })
}

export async function excluir(id) {
  return api('funcionarios', 'excluir', { method: 'POST', body: { id } })
}

export function funcionarioPayload(form) {
  return {
    nome: String(form.nome ?? '').trim().substring(0, 150) || null,
    cargo: String(form.cargo ?? '').trim().substring(0, 100) || null,
    setor_id: form.setor_id ? Number(form.setor_id) : null,
    rg: String(form.rg ?? '').trim().substring(0, 30) || null,
    email: String(form.email ?? '').trim() || null,
    gmail: String(form.gmail ?? '').trim() || null,
    ativo: form.ativo ? 1 : 0,
  }
}
