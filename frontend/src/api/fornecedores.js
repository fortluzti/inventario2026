import { api } from './client.js'

/* Valores reais da coluna SET `fornecedores.tipo` (inventario2). */
export const FORNECEDOR_TIPOS = ['Fornecedor de Produtos', 'Prestador de Serviços']

export const EMPTY_FORNECEDOR = {
  nome: '',
  cnpj: '',
  telefone: '',
  endereco: '',
  tipo: '',
  nome_vendedor: '',
  email: '',
  ativo: 1,
}

export async function listarOpcoes() {
  const first = await api('fornecedores', 'listar', { params: { limit: 200, page: 1, ativo: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('fornecedores', 'listar', { params: { limit: 200, page, ativo: 1 } })
    items.push(...next.items)
  }
  return items.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true }))
}

export async function listarTodas(params = {}) {
  const first = await api('fornecedores', 'listar', { params: { ...params, limit: 200, page: 1 } })
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await api('fornecedores', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return items
}

export async function buscarPorId(id) {
  return api('fornecedores', 'buscar_por_id', { params: { id } })
}

export async function salvarFornecedor(form) {
  const res = await api('fornecedores', 'salvar', { method: 'POST', body: form })
  return res.id
}

export async function excluir(id) {
  return api('fornecedores', 'excluir', { method: 'POST', body: { id } })
}

/**
 * Payload fiel aos campos reais da tabela `fornecedores`.
 * Limits da coluna: nome 100, cnpj 20, telefone 20, endereco 200 (schema 255),
 * nome_vendedor 100, email 100. `tipo` só aceita os valores do SET; `ativo` 1/0.
 */
export function fornecedorPayload(form) {
  return {
    nome: String(form.nome ?? '').trim().substring(0, 100) || null,
    cnpj: String(form.cnpj ?? '').trim().substring(0, 20) || null,
    telefone: String(form.telefone ?? '').trim().substring(0, 20) || null,
    endereco: String(form.endereco ?? '').trim().substring(0, 200) || null,
    tipo: FORNECEDOR_TIPOS.includes(form.tipo) ? form.tipo : null,
    nome_vendedor: String(form.nome_vendedor ?? '').trim().substring(0, 100) || null,
    email: String(form.email ?? '').trim().substring(0, 100) || null,
    ativo: form.ativo ? 1 : 0,
  }
}
