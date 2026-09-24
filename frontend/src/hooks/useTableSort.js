import { useCallback, useState } from 'react'

/**
 * Ordenação de tabela por cabeçalho — controle reutilizável.
 * Ciclo por clique: padrão (↕) → ASC (↑) → DESC (↓) → padrão.
 *
 * - sort:   { key, dir } — key vazio = sem ordenação ativa (ordem padrão da API);
 * - params: sort/dir prontos para a querystring ({} = não envia = ordem padrão);
 * - toggle(key): aplica o ciclo na coluna informada;
 * - isActive(key) / ariaSort(key): apoio para indicador e acessibilidade no cabeçalho.
 */
export function useTableSort() {
  const [sort, setSort] = useState({ key: '', dir: '' })

  const toggle = useCallback((key) => {
    setSort((cur) => {
      if (cur.key !== key) return { key, dir: 'asc' }
      if (cur.dir === 'asc') return { key, dir: 'desc' }
      return { key: '', dir: '' } // terceiro clique: volta ao padrão da API
    })
  }, [])

  const params = sort.key ? { sort: sort.key, dir: sort.dir } : {}
  const isActive = (key) => sort.key === key
  const ariaSort = (key) => (isActive(key) ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none')

  return { sort, params, toggle, isActive, ariaSort }
}
