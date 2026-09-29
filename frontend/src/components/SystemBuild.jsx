import { useSistemaVersao } from '../hooks/useSistemaVersao.js'

/**
 * Texto unico de build do sistema ("Build 2026.1.0-web").
 *
 * Sempre montado a partir da API (`sistema/versao` -> tabela `sistema_info`),
 * nunca de constante no codigo. Sem dado disponivel exibe "—".
 * Pode receber `versao` ja carregada por um componente pai; caso contrario
 * busca pelo hook (o cache em `api/sistema.js` evita consultas repetidas).
 */
export default function SystemBuild({ versao, prefixo = 'Build' }) {
  const { versao: daApi } = useSistemaVersao()
  const dados = versao !== undefined ? versao : daApi
  const texto = dados?.build || ''

  return <>{prefixo} {texto || '—'}</>
}
