import './SortableTh.css'

/**
 * Cabeçalho de coluna ordenável — o próprio <th> é o controle (sem botão à parte).
 * Indicador Material: swap_vert (neutro), arrow_upward (ASC), arrow_downward (DESC).
 * Reutilizável em qualquer tabela; a ordenação em si acontece no backend
 * (parâmetros sort/dir enviados pelo hook useTableSort).
 */
export default function SortableTh({ label, active = false, dir = 'asc', onSort }) {
  const icon = !active ? 'swap_vert' : dir === 'asc' ? 'arrow_upward' : 'arrow_downward'
  const aria = !active ? 'none' : dir === 'asc' ? 'ascending' : 'descending'
  const hint = dir === 'asc' ? 'crescente' : 'decrescente'
  return (
    <th scope="col" aria-sort={aria} className={`th-sortable${active ? ' is-sorted' : ''}`}>
      <button
        type="button"
        className="th-sort"
        onClick={onSort}
        title={active ? `Ordenado por ${label} (${hint}) — clique para inverter` : `Ordenar por ${label}`}
        aria-label={active ? `Ordenar por ${label} (${hint})` : `Ordenar por ${label}`}
      >
        <span className="th-sort-label">{label}</span>
        <span className="mat" aria-hidden="true">{icon}</span>
      </button>
    </th>
  )
}
