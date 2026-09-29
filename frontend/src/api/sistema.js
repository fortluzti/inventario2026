import { api } from './client.js'

/**
 * Versao do sistema — fonte unica do frontend.
 *
 * Os dados vem da API (`endpoint=sistema&action=versao`), que le a tabela
 * `sistema_info` do banco (migration 004_sistema_info.sql):
 *   { app_versao: '2026.1.0', app_build: 'web', db_versao: '004', db_nome: 'inventario2' }
 * Nenhuma versao/build fica hardcoded em componente.
 */

let cache = null
let carregado = false
let inflight = null

/** Monta "2026.1.0-web" a partir de `app_versao` + `app_build` (nunca inventa valor). */
export function formatarBuild(versao) {
  const app = versao?.app_versao
  if (!app) return ''
  return versao.app_build ? `${app}-${versao.app_build}` : String(app)
}

/** Ultimo valor carregado (sincrono) — usado como estado inicial dos hooks. */
export function versaoEmCache() {
  return cache
}

/**
 * Consulta a versao instalada (cache em memoria por sessao do navegador).
 * Payload inesperado/erro nao viram versao: o retorno e `null` e a UI mostra "—".
 */
export async function carregarVersaoSistema({ forcar = false } = {}) {
  if (carregado && !forcar) return cache
  if (inflight) return inflight

  inflight = api('sistema', 'versao')
    .then((dados) => {
      const bruto = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {}
      if (!bruto.app_versao) return null
      return {
        app_versao: String(bruto.app_versao),
        app_build: bruto.app_build ? String(bruto.app_build) : '',
        db_versao: bruto.db_versao ? String(bruto.db_versao) : '',
        db_nome: bruto.db_nome ? String(bruto.db_nome) : '',
        atualizado_em: bruto.atualizado_em || '',
        build: bruto.build ? String(bruto.build) : formatarBuild(bruto),
      }
    })
    .then((versao) => {
      cache = versao
      carregado = true
      return versao
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
