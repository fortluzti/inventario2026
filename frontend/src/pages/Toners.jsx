import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { excluir, buscarModelos } from '../api/toners.js'
import TonerDialog from '../components/TonerDialog.jsx'
import TonerTrocaDialog from '../components/TonerTrocaDialog.jsx'
import TonerRecebimentoDialog from '../components/TonerRecebimentoDialog.jsx'
import TonerHistoricoDialog from '../components/TonerHistoricoDialog.jsx'
import './Toners.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

/* Valor unitário (R$) — apenas cadastro, formatado pt-BR. */
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Consumíveis (toners/cilindros): CRUD do estoque de insumos.
 * O campo `valor` (migration 007) é apenas cadastral — não entra no cálculo de
 * estoque mínimo e não vai para solicitação/pedido de compra.
 */
export default function Toners({ user, refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [draft, setDraft] = useState(filters)
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState(null)
  /* Operações da tela — TODAS em modal (nenhuma navega para página separada):
   * 'troca' · 'recebimento' · 'historico'. */
  const [opDialog, setOpDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
  // Filtro "Modelo da impressora": autocomplete por modelos reais cadastrados
  // (evita texto livre) — usa o endpoint existente `impressoras_modelos`.
  const [modeloQuery, setModeloQuery] = useState('')
  const [modeloResults, setModeloResults] = useState([])
  const [modeloOpen, setModeloOpen] = useState(false)
  const [modeloLabel, setModeloLabel] = useState('')
  const deleteLock = useRef(false)
  const searchRef = useRef(null)
  const lastNewRequest = useRef(newRequest)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Autocomplete do filtro "Modelo da impressora" (busca modelos reais cadastrados).
  useEffect(() => {
    if (!modeloOpen) return undefined
    let active = true
    const q = modeloQuery.trim()
    const timer = setTimeout(() => {
      buscarModelos(q)
        .then((items) => { if (active) setModeloResults(items) })
        .catch(() => { if (active) setModeloResults([]) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [modeloQuery, modeloOpen])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('toners', 'listar', { params: { search: query, ...filters, page, limit } })
      .then((result) => {
        if (!active) return
        if (page > Math.max(1, result.total_pages)) { setPage(Math.max(1, result.total_pages)); return }
        setData(result)
      })
      .catch((e) => { if (active) { setError(e.message); setData(EMPTY) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, filters, page, limit, revision, refreshKey])

  useEffect(() => {
    if (newRequest > lastNewRequest.current) { lastNewRequest.current = newRequest; setDialog({ mode: 'new' }) }
  }, [newRequest])

  useEffect(() => {
    function onKey(e) {
      if (dialog || opDialog) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setDialog({ mode: 'new' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, opDialog])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir o consumível "${row.codigo}"? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await excluir(row.id)
      setMessage('Consumível excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) {
      setError(e.message)
    }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function selectModelo(m) {
    const label = [m.marca, m.nome_modelo].filter(Boolean).join(' ')
    // Aplica imediatamente o filtro por modelo (combina com busca, tipo e paginação).
    setModeloLabel(label)
    setModeloQuery(label)
    setModeloOpen(false)
    setModeloResults([])
    setDraft((d) => ({ ...d, modelo_id: m.id }))
    setFilters((f) => ({ ...f, modelo_id: m.id }))
    setPage(1)
  }

  function clearModelo() {
    setModeloLabel('')
    setModeloQuery('')
    setModeloOpen(false)
    setModeloResults([])
    setDraft((d) => { const { modelo_id, ...rest } = d; return rest })
    setFilters((f) => { const { modelo_id, ...rest } = f; return rest })
    setPage(1)
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({}); setDraft({}); setPage(1)
    setModeloLabel(''); setModeloQuery(''); setModeloOpen(false); setModeloResults([])
  }

  return <section className="tnd-page" aria-labelledby="tnd-page-title">
    <header className="tnd-page-header">
      <div>
        <div className="tnd-breadcrumb">Estoque &amp; Insumos / Consumíveis</div>
        <h1 id="tnd-page-title"><span className="mat" aria-hidden="true">inventory_2</span>Toners em Estoque</h1>
        <p>Cadastro de consumíveis (toners e cilindros) e seus valores unitários.</p>
      </div>
      <div className="tnd-actions tnd-header-actions">
        <button className="tnd-btn tnd-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Consumível</button>
        <button className="tnd-btn" onClick={() => { setError(''); setMessage(''); setOpDialog({ mode: 'troca' }) }}><span className="mat" aria-hidden="true">swap_horiz</span>Registrar Troca</button>
        <button className="tnd-btn" onClick={() => { setError(''); setMessage(''); setOpDialog({ mode: 'recebimento' }) }}><span className="mat" aria-hidden="true">move_to_inbox</span>Recebimento de Toners</button>
        <button className="tnd-btn" onClick={() => { setError(''); setMessage(''); setOpDialog({ mode: 'historico' }) }}><span className="mat" aria-hidden="true">history</span>Ver Histórico de Trocas</button>
      </div>
    </header>

    <div className="tnd-toolbar">
      <div className="tnd-toolbar-row">
        <label className="tnd-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar consumíveis" placeholder="Buscar por código…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="tnd-actions">
          <button className="tnd-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="tnd-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.tipo || filters.modelo_id) ? ' •' : ''}</button>
          <button className="tnd-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="tnd-filters" className="tnd-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Tipo: <select aria-label="Filtrar por tipo" value={draft.tipo || ''} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}><option value="">Todos</option><option value="TONER">TONER</option><option value="CILINDRO">CILINDRO</option></select></label>
        <label className="tnd-field-modelo">Modelo da impressora:
          <span className="tnd-modelo-autocomplete">
            <input id="tnd-modelo-busca" className="tnd-input" aria-label="Buscar modelo da impressora" placeholder="Pesquisar modelo (ex: HP 408)…" value={modeloQuery} onChange={(e) => { setModeloQuery(e.target.value); setModeloOpen(true) }} onFocus={() => setModeloOpen(true)} autoComplete="off" />
            {modeloOpen && modeloQuery.trim() !== '' && (
              <div className="tnd-modelo-sug" role="listbox" aria-label="Modelos encontrados">
                {modeloResults.length === 0 && <p className="tnd-hint">Nenhum modelo encontrado.</p>}
                {modeloResults.map((m) => (
                  <button key={m.id} type="button" className="tnd-modelo-opcao" role="option" onClick={() => selectModelo(m)}>{[m.marca, m.nome_modelo].filter(Boolean).join(' ')}</button>
                ))}
              </div>
            )}
          </span>
        </label>
        {filters.modelo_id && <span className="tnd-modelo-chip" title="Filtro por modelo aplicado"><span className="mat" aria-hidden="true">print</span>{modeloLabel || `Modelo #${filters.modelo_id}`}<button type="button" className="tnd-modelo-chip-x" aria-label="Remover filtro de modelo" onClick={clearModelo}><span className="mat">close</span></button></span>}
        <div className="tnd-actions"><button className="tnd-btn tnd-btn-primary" type="submit">Aplicar</button><button className="tnd-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="tnd-message" role="status">{message}</div>}
    {error && <div className="tnd-message error" role="alert">{error}<button className="tnd-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="tnd-grid" aria-busy={loading}>
      <div className="tnd-table-scroll"><table className="tnd-table">
        <caption className="tnd-sr-only">Consumíveis cadastrados</caption>
        <thead><tr>{['Código', 'Tipo', 'Estoque', 'Mín.', 'Autonomia', 'Valor (R$)', 'Modelos compatíveis', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="tnd-muted" role="status">Carregando consumíveis…</td></tr> : data.items.length === 0 ? <tr><td colSpan={8} className="tnd-muted">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum consumível encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="tnd-name">{row.codigo || '—'}</strong></td>
          <td><span className={`tnd-tipo ${row.tipo === 'CILINDRO' ? 'cilindro' : 'toner'}`}>{row.tipo || '—'}</span></td>
          <td className="tnd-number">{row.estoque ?? 0}</td>
          <td className="tnd-number">{row.estoque_minimo ?? 0}</td>
          <td className="tnd-muted">{row.autonomia || '—'}</td>
          <td className="tnd-number tnd-valor">{`R$ ${brl(row.valor)}`}</td>
          <td className="tnd-modelos" title={row.modelos_compat || ''}>{row.modelos_compat || '—'}</td>
          <td><div className="tnd-actions"><button className="tnd-btn tnd-btn-icon" title="Visualizar" aria-label="Visualizar consumível" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="tnd-btn tnd-btn-icon" title="Editar" aria-label="Editar consumível" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="tnd-btn tnd-btn-icon danger" title="Excluir" aria-label="Excluir consumível" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="tnd-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="tnd-actions"><button className="tnd-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="tnd-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <TonerDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}

    {/* Operações concentradas nesta tela em modal (mesma ideia do legado
        modules/toners/toners_list.php) — sem página separada de recebimento
        nem de histórico de trocas. */}
    {opDialog?.mode === 'troca' && (
      <TonerTrocaDialog
        user={user}
        onClose={() => setOpDialog(null)}
        onSaved={(text) => { setOpDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }}
      />
    )}
    {opDialog?.mode === 'recebimento' && (
      <TonerRecebimentoDialog
        user={user}
        onClose={() => setOpDialog(null)}
        onSaved={(text) => { setOpDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }}
      />
    )}
    {opDialog?.mode === 'historico' && <TonerHistoricoDialog onClose={() => setOpDialog(null)} />}
  </section>
}
