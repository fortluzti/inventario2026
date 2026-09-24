/**
 * API client: celulares
 * Reproduz todas as chamadas do legado js/celulares_api.js no front ativos2026.
 *
 * Ações genéricas (listar, buscar, proximo_codigo, salvar, excluir, dropdown)
 * são tratadas pelo módulo 'celulares' no endpoint base (Crud genérico).
 *
 * Ações customizadas (Entrega / Devolução / Dano / Histórico),
 * inspiradas no legado modules/celulares_handler.php.
 */
import { api, getApiKey } from './client.js'

export const celularesApi = {
    /** Lista paginada com search + sort + filters */
    listar(params = {}) {
        return api('celulares', 'listar', {
            params: {
                page: params.page,
                limit: params.limit,
                search: params.search,
                sort: params.sort,
                dir: params.dir,
                status: params.status,
            },
        })
    },

    /** Próximo código interno */
    proximoCodigo() {
        return api('celulares', 'proximo_codigo')
    },

    /** Busca por ID */
    buscarPorId(id) {
        return api('celulares', 'buscar_por_id', { params: { id } })
    },

    /** Salva (POST) — cria ou atualiza */
    salvar(dados) {
        return api('celulares', 'salvar', { method: 'POST', body: dados })
    },

    /** Exclui (POST) */
    excluir(id) {
        return api('celulares', 'excluir', { method: 'POST', body: { id } })
    },

    /** Dropdown (GET) */
    dropdown() {
        return api('celulares', 'dropdown')
    },

    /* ---- Ações customizadas ---- */

    listarEmEstoque() {
        return api('celulares', 'listar_celulares_em_estoque')
    },

    listarEmUso() {
        return api('celulares', 'listar_celulares_em_uso')
    },

    listarFuncionarios() {
        return api('celulares', 'listar_funcionarios')
    },

    entregar(dados) {
        return api('celulares', 'entregar_celular', { method: 'POST', body: dados })
    },

    devolver(dados) {
        return api('celulares', 'devolver_celular', { method: 'POST', body: dados })
    },

    registrarDano(dados) {
        return api('celulares', 'registrar_dano', { method: 'POST', body: dados })
    },

    listarHistorico(celularId) {
        return api('celulares', 'listar_historico_uso', { params: { celular_id: celularId } })
    },

    /**
     * Relatório de CONFERÊNCIA dos dados de celulares (somente leitura).
     * Uma linha por associação (celular × funcionário), incluindo o histórico,
     * com filtros de auditoria, ordenação e paginação no servidor.
     * `todos: true` devolve o conjunto filtrado inteiro (usado pela exportação CSV).
     */
    conferencia(params = {}) {
        return api('celulares', 'conferencia_dados', {
            params: {
                page: params.page,
                limit: params.limit,
                search: params.search,
                sort: params.sort,
                dir: params.dir,
                status_celular: params.status_celular,
                status_funcionario: params.status_funcionario,
                associacao: params.associacao,
                situacao: params.situacao,
                situacao_codigo: params.situacao_codigo,
                todos: params.todos ? 1 : undefined,
            },
        })
    },

    /**
     * Gera termo (.docx) — abre janela de download via window.open.
     * PhpWord está em vendor/ do projeto; api_key via query.
     */
    gerarTermo(tipo_ativo, ativo_id, funcionario_id, tipo_termo) {
        const url = new URL('/ativos2026/gerar_termo.php', window.location.origin)
        url.searchParams.set('tipo_ativo', tipo_ativo)
        url.searchParams.set('ativo_id', ativo_id)
        url.searchParams.set('funcionario_id', funcionario_id)
        url.searchParams.set('tipo_termo', tipo_termo)
        const key = getApiKey()
        if (key) url.searchParams.set('api_key', key)
        window.open(url.toString(), '_blank')
    },
}

export default celularesApi
