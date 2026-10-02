import { api } from './client.js'

export const TONER_TIPOS = ['TONER', 'CILINDRO']

export const EMPTY_TONER = {
  codigo: '',
  tipo: 'TONER',
  estoque: 0,
  estoque_minimo: 0,
  autonomia: '',
  /* Valor unitário (migration 007) — cadastro p/ futuro histórico financeiro.
   * NÃO participa de estoque mínimo/TONER-CILINDRO e NÃO vai p/ solicitação. */
  valor: '',
  data_compra: '',
  nota_fiscal: '',
  fornecedor_id: '',
  empresa_id: '',
}

export async function buscarPorId(id) {
  return api('toners', 'buscar_por_id', { params: { id } })
}

export async function excluir(id) {
  return api('toners', 'excluir', { method: 'POST', body: { id } })
}

/* ---------------------------------------------------------------------------
 * Modelos de impressora compatíveis — reusa a relação EXISTENTE
 * `impressora_modelos_toner` (migration 006) e o cadastro `impressoras_modelos`.
 * Mesma regra p/ TONER e CILINDRO: a classificação continua vindo de `toner.tipo`.
 * Nenhuma tabela/endpoint paralelo é criado.
 * ------------------------------------------------------------------------- */

/** Autocomplete de modelos reais cadastrados (busca por nome/marca). */
export async function buscarModelos(search = '') {
  const data = await api('impressoras_modelos', 'listar', {
    params: { search: String(search || '').trim(), limit: 20 },
  })
  return data.items || []
}

/** Associações já gravadas de um consumível (com nome/marca do modelo). */
export async function listarModelosDoToner(tonerId) {
  const data = await api('impressora_modelos_toner', 'listar', {
    params: { toner_id: tonerId, limit: 200 },
  })
  return data.items || []
}

/** Grava uma associação consumível x modelo (duplicidade responde 409). */
export function associarModelo(tonerId, modeloId) {
  return api('impressora_modelos_toner', 'salvar', {
    method: 'POST',
    body: { toner_id: Number(tonerId), modelo_id: Number(modeloId) },
  })
}

/** Remove uma associação pelo id da linha em `impressora_modelos_toner`. */
export function removerAssociacaoModelo(associacaoId) {
  return api('impressora_modelos_toner', 'excluir', {
    method: 'POST',
    body: { id: Number(associacaoId) },
  })
}

/**
 * Sincroniza o banco com a seleção do modal (diferença entre o gravado e o
 * marcado): remove os que saíram e grava os novos. Idempotente — pode repetir
 * em caso de falha de rede no meio do fluxo.
 *
 * @param {number} tonerId     consumível dono das associações
 * @param {Array}  selecionados [{ modelo_id }] escolhidos no modal
 * @param {Array}  atuais      associações devolvidas pela API para o consumível
 * @returns {Promise<{adicionadas:number, removidas:number}>}
 */
export async function sincronizarModelos(tonerId, selecionados, atuais) {
  const desejados = new Set(selecionados.map((m) => Number(m.modelo_id)))
  const gravados = new Map(atuais.map((m) => [Number(m.modelo_id), Number(m.id)]))

  let removidas = 0
  for (const a of atuais) {
    if (!desejados.has(Number(a.modelo_id))) {
      await removerAssociacaoModelo(a.id)
      removidas += 1
    }
  }

  let adicionadas = 0
  for (const s of selecionados) {
    if (!gravados.has(Number(s.modelo_id))) {
      await associarModelo(tonerId, s.modelo_id)
      adicionadas += 1
    }
  }

  return { adicionadas, removidas }
}

function toIntOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * Valor unitário (migration 007): `DECIMAL(10,2) NOT NULL DEFAULT 0.00`.
 * Campo vazio vira 0 — o motor genérico (Crud::salvar) só ignora `null` no
 * INSERT; no UPDATE um `null` violaria o NOT NULL (erro 1048). Assim,
 * "0,00" significa "não informado". Não participa de estoque nem de
 * solicitação/pedido de compra.
 */
function toValor(v) {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/**
 * Payload fiel à tabela `toner`. `valor` é decimal(10,2) NOT NULL (>= 0).
 */
export function tonerPayload(form) {
  return {
    codigo: String(form.codigo ?? '').trim().substring(0, 100) || null,
    tipo: TONER_TIPOS.includes(form.tipo) ? form.tipo : null,
    estoque: toIntOrNull(form.estoque),
    estoque_minimo: toIntOrNull(form.estoque_minimo),
    autonomia: toIntOrNull(form.autonomia),
    valor: toValor(form.valor),
    data_compra: String(form.data_compra ?? '').trim() || null,
    nota_fiscal: String(form.nota_fiscal ?? '').trim().substring(0, 100) || null,
    fornecedor_id: toIntOrNull(form.fornecedor_id),
    empresa_id: toIntOrNull(form.empresa_id),
  }
}
