/**
 * Status oficiais do fluxo de Pendencias do ERP (espelha o backend).
 *
 * Mantido em um unico ponto para que grade, modal de pendencia e modal de
 * atendimento usem sempre os mesmos valores.
 */
export const STATUS_AGUARDANDO_SUPORTE = 'Aguardando suporte'
export const STATUS_AGUARDANDO_TESTES = 'Aguardando testes'
export const STATUS_RESOLVIDO = 'Resolvido'
export const STATUS_CANCELADO = 'Cancelado'

/** Status que uma pendencia pode ter como principal (fluxo oficial). */
export const STATUS_OFICIAIS = [
  STATUS_AGUARDANDO_SUPORTE,
  STATUS_AGUARDANDO_TESTES,
  STATUS_RESOLVIDO,
  STATUS_CANCELADO,
]

/** Status inicial de toda nova pendencia. */
export const STATUS_INICIAL = STATUS_AGUARDANDO_SUPORTE

/**
 * Status antigos -> status oficial vigente.
 * Mantidos para exibir corretamente historico/registros anteriores a migracao 016.
 */
export const LEGACY_STATUS = {
  Pendente: STATUS_AGUARDANDO_SUPORTE,
  'Enviado ao suporte': STATUS_AGUARDANDO_SUPORTE,
  'Em análise': STATUS_AGUARDANDO_SUPORTE,
  'Em Análise': STATUS_AGUARDANDO_SUPORTE,
  'Aguardando correção/atualização': STATUS_AGUARDANDO_SUPORTE,
  'Aguardando Suporte': STATUS_AGUARDANDO_SUPORTE,
  'Pronto para testes': STATUS_AGUARDANDO_TESTES,
  'Em teste': STATUS_AGUARDANDO_TESTES,
  Testando: STATUS_AGUARDANDO_TESTES,
  'Aguardando Testes': STATUS_AGUARDANDO_TESTES,
}

/** Converte qualquer valor legado para o status oficial correspondente. */
export function normalizarStatus(status) {
  return LEGACY_STATUS[status] || status || STATUS_INICIAL
}

/**
 * Ícone (Material Symbols) de cada status oficial — usado no badge da grid
 * para não depender apenas da cor (acessibilidade).
 */
export const STATUS_ICONES = {
  [STATUS_AGUARDANDO_SUPORTE]: 'support_agent',
  [STATUS_AGUARDANDO_TESTES]: 'science',
  [STATUS_RESOLVIDO]: 'check_circle',
  [STATUS_CANCELADO]: 'cancel',
}

export function iconeStatus(status) {
  return STATUS_ICONES[normalizarStatus(status)] || 'help'
}

/** Classe CSS do badge de status usado na grade. */
export function classeStatus(status) {
  const atual = normalizarStatus(status)
  if (atual === STATUS_RESOLVIDO) return 'resolvido'
  if (atual === STATUS_CANCELADO) return 'cancelado'
  if (atual === STATUS_AGUARDANDO_TESTES) return 'aguardando-testes'
  return 'aguardando-suporte'
}
