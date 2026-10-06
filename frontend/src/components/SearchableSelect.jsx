import { useEffect, useId, useMemo, useRef, useState } from 'react'

const fold = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* PADRÃO GLOBAL de dropdown pesquisável (ativos2026): busca no topo, foco
 * automático ao abrir, filtra ao digitar, limpar restaura, selecionar fecha. */
export default function SearchableSelect({ options = [], value = '', onChange, placeholder = 'Selecione…', disabled = false, loading = false, id, ariaLabel, emptyText = 'Nenhum registro encontrado.', allOption = null }) {
  const autoId = useId()
  const btnId = id || `ss-${autoId}`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const items = useMemo(() => {
    const base = [...(allOption ? [allOption] : []), ...options]
    const q = fold(query.trim())
    if (!q) return base
    return base.filter((o) => fold([o.label, o.search].filter(Boolean).join(' ')).includes(q))
  }, [options, query, allOption])

  const selected = useMemo(() => {
    const all = [...(allOption ? [allOption] : []), ...options]
    return all.find((o) => String(o.value) === String(value)) || null
  }, [options, value, allOption])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      const t = setTimeout(() => searchRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => { setHighlight(0) }, [query])

  function choose(v) { setOpen(false); if (String(v) !== String(value)) onChange?.(v) }

  function onSearchKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, Math.max(0, items.length - 1))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[highlight]; if (it) choose(it.value) }
  }

  return (
    <div className="ss-root" ref={rootRef}>
      <button type="button" id={btnId} className="tnd-select ss-button" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel || placeholder} disabled={disabled || loading} onClick={() => setOpen((o) => !o)}>
        <span className={`ss-value${selected ? '' : ' ss-placeholder'}`}>{loading ? 'Carregando…' : (selected?.label || placeholder)}</span>
        <span className="mat ss-caret" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="ss-drop" role="listbox" aria-label={ariaLabel || placeholder}>
          <div className="ss-search">
            <span className="mat" aria-hidden="true">search</span>
            <input ref={searchRef} className="ss-search-input" placeholder="🔍 Buscar..." aria-label="Buscar..." value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} />
            {query && (<button type="button" className="ss-clear" aria-label="Limpar busca" onClick={() => setQuery('')}><span className="mat" aria-hidden="true">close</span></button>)}
          </div>
          <ul className="ss-list">
            {items.length === 0 ? (<li className="ss-empty">{emptyText}</li>) : items.map((o, idx) => (
              <li key={`${o.value}-${idx}`} role="option" aria-selected={String(o.value) === String(value)}>
                <button type="button" className={`ss-item${idx === highlight ? ' ss-highlight' : ''}${String(o.value) === String(value) ? ' ss-selected' : ''}`} onMouseEnter={() => setHighlight(idx)} onClick={() => choose(o.value)}>{o.label}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* `idOf` e nao `valueOf`: destructuring herda Object.prototype.valueOf, e o
 * default so entra quando a propriedade e `undefined` — o que causava
 * "Cannot convert undefined or null to object" em toda chamada. */
export function toSearchOptions(items, { idOf = (i) => i.id, labelOf = (i) => i.nome, extraOf = null } = {}) {
  return (items || []).map((i) => ({ value: String(idOf(i)), label: String(labelOf(i) ?? ''), search: extraOf ? String(extraOf(i) ?? '') : '' }))
}
