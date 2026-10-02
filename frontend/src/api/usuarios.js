import { api } from './client.js'

export const EMPTY_USUARIO = {
  nome: '',
  login: '',
  email: '',
}

export async function listarUsuarios(params = {}) {
  const result = await api('usuarios', 'listar', { params: { limit: 200, page: 1, ...params } })
  const items = [...result.items]
  for (let page = 2; page <= result.total_pages; page++) {
    const next = await api('usuarios', 'listar', { params: { ...params, limit: 200, page } })
    items.push(...next.items)
  }
  return {
    items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    total_pages: result.total_pages,
  }
}

export async function buscarUsuario(id) {
  return api('usuarios', 'buscar', { params: { id } })
}

export async function excluirUsuario(id) {
  return api('usuarios', 'excluir', { method: 'POST', body: { id } })
}

export async function ativarUsuario(id, ativo) {
  return api('usuarios', 'ativar', { params: { id, ativo } })
}

export async function mudarSenha(id, senhaAtual, novaSenha) {
  return api('usuarios', 'alterar_senha', { method: 'POST', body: { id, senha_atual: senhaAtual, nova_senha: novaSenha } })
}

export async function toggleAtivo(id) {
  return api('usuarios', 'toggleAtivo', { method: 'POST', body: { id } })
}

export async function criarUsuario(dados) {
  return api('usuarios', 'novo', { method: 'POST', body: dados })
}

export function usuarioPayload(form) {
  return {
    nome: String(form.nome ?? '').trim().substring(0, 255) || null,
    login: String(form.login ?? '').trim().substring(0, 50) || null,
    email: String(form.email ?? '').trim() || null,
  }
}
