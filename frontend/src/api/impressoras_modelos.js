import { api } from './client.js'

export const EMPTY_IMPRESSORA_MODELO = {
  nome_modelo: '',
  marca: '',
  descricao: '',
  estoque_minimo_toner: 0,
  estoque_minimo_cilindro: 0,
}

export async function buscarPorId(id) {
  return api('impressoras_modelos', 'buscar_por_id', { params: { id } })
}

export function impressoraModeloPayload(form) {
  return {
    nome_modelo: String(form.nome_modelo ?? '').trim() || null,
    marca: String(form.marca ?? '').trim() || null,
    descricao: String(form.descricao ?? '').trim().substring(0, 255) || null,
    estoque_minimo_toner: form.estoque_minimo_toner ? Number(form.estoque_minimo_toner) : 0,
    estoque_minimo_cilindro: form.estoque_minimo_cilindro ? Number(form.estoque_minimo_cilindro) : 0,
  }
}

/* ---------------------------------------------------------------------------
 * Consumíveis compatíveis — tabela `impressora_modelos_toner` (migration 006)
 *
 * O tipo (TONER/CILINDRO) NUNCA é enviado pelo cliente: a API devolve
 * `toner_tipo` lido de `toner.tipo` (cadastro do consumível) via JOIN.
 * ------------------------------------------------------------------------- */

/** Todos os consumíveis cadastrados (módulo `toners`, tabela `toner`). */
export async function listarConsumiveis() {
  const data = await api('toners', 'listar', { params: { limit: 200 } })
  return data.items || []
}

/** Associações já gravadas de um modelo, com codigo/tipo do consumível. */
export async function listarAssociacoes(modeloId) {
  const data = await api('impressora_modelos_toner', 'listar', {
    params: { modelo_id: modeloId, limit: 200 },
  })
  return data.items || []
}

/** Grava uma associação modelo x consumível (duplicidade responde 409). */
export function associarConsumivel(modeloId, tonerId) {
  return api('impressora_modelos_toner', 'salvar', {
    method: 'POST',
    body: { modelo_id: Number(modeloId), toner_id: Number(tonerId) },
  })
}

/** Remove uma associação pelo id da linha em `impressora_modelos_toner`. */
export function removerAssociacao(associacaoId) {
  return api('impressora_modelos_toner', 'excluir', {
    method: 'POST',
    body: { id: Number(associacaoId) },
  })
}

/**
 * Sincroniza o banco com a seleção atual do modal (diferença entre o que está
 * gravado e o que o usuário marcou): remove os que saíram e grava os novos.
 * Idempotente — pode ser repetido em caso de falha de rede/meio caminho.
 *
 * @param {number} modeloId   modelo dono das associações
 * @param {Array}  selecionados  [{ toner_id }] escolhidos no modal
 * @param {Array}  atuais     associações devolvidas pela API para o modelo
 * @returns {Promise<{adicionadas:number, removidas:number}>}
 */
export async function sincronizarAssociacoes(modeloId, selecionados, atuais) {
  const desejados = new Set(selecionados.map((a) => Number(a.toner_id)))
  const gravados = new Map(atuais.map((a) => [Number(a.toner_id), Number(a.id)]))

  let removidas = 0
  for (const a of atuais) {
    if (!desejados.has(Number(a.toner_id))) {
      await removerAssociacao(a.id)
      removidas += 1
    }
  }

  let adicionadas = 0
  for (const s of selecionados) {
    if (!gravados.has(Number(s.toner_id))) {
      await associarConsumivel(modeloId, s.toner_id)
      adicionadas += 1
    }
  }

  return { adicionadas, removidas }
}