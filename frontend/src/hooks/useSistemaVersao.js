import { useEffect, useState } from 'react'
import { carregarVersaoSistema, versaoEmCache } from '../api/sistema.js'

/**
 * Versao/build instalados — sempre da API (`sistema/versao`).
 *
 * O cache fica em `api/sistema.js`, portanto varios componentes (rodape do
 * login, barra de status) compartilham uma unica consulta por sessao.
 */
export function useSistemaVersao() {
  const inicial = versaoEmCache()
  const [versao, setVersao] = useState(inicial)
  const [carregando, setCarregando] = useState(!inicial)

  useEffect(() => {
    let ativo = true
    carregarVersaoSistema()
      .then((dados) => {
        if (ativo) setVersao(dados)
      })
      .catch(() => {
        if (ativo) setVersao(null)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return { versao, carregando }
}
