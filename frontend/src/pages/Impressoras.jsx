import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { IMPRESSORA_STATUS, listarOpcoes } from '../api/impressoras.js'
import { carregarEmpresa } from '../api/configuracoes.js'
import ImpressoraDialog from '../components/ImpressoraDialog.jsx'
import ImpressaoReport from '../components/ImpressaoReport.jsx'
import './Impressoras.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

const STATUS_CLASS = (status) => ({
  'Em Uso': 'in-use',
  'Em Estoque': 'in-stock',
  'Em Manutenção': 'maintenance',
  'Danificado': 'damaged',
  'Descartado': 'discarded',
}[status] || 'in-stock')

export default function Impressoras({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ status: '', setor_id: '', modelo_id: '' })
  const [draft, setDraft] = useState(filters)
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [empresa, setEmpresa] = useState(null)
  const [options, setOptions] = useState({})
  const deleteLock = useRef(false)
  const searchRef = useRef(null)
  const lastNewRequest = useRef(newRequest)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('impressoras', 'listar', { params: { search: query, ...filters, page, limit } })
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
    let active = true
    async function loadOptions() {
      try {
        const [setores, modelos] = await Promise.all([
          listarOpcoes('setores'),
          listarOpcoes('impressoras_modelos'),
        ])
        if (!active) return
        setOptions({ setores, modelos })
      } catch {
        if (active) setOptions({})
      }
    }
    loadOptions()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (showReport) {
      carregarEmpresa().then(setEmpresa).catch(() => setEmpresa(null))
    }
  }, [showReport])

  useEffect(() => {
    function onKey(e) {
      if (dialog || showReport) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setDialog({ mode: 'new' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, showReport])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir a impressora ${row.codigo_interno_impressora}? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await api('impressoras', 'excluir', { method: 'POST', body: { id: row.id } })
      setMessage('Impressora excluída com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({ status: '', setor_id: '', modelo_id: '' }); setDraft({ status: '', setor_id: '', modelo_id: '' }); setPage(1)
  }

  function handlePrint() {
    setShowReport(true)
  }

  return <section className="imp-page" aria-labelledby="imp-page-title">
    <header className="imp-page-header">
      <div>
        <div className="imp-breadcrumb">Ativos de TI / Impressoras</div>
        <h1 id="imp-page-title"><span className="mat" aria-hidden="true">print</span>Impressoras</h1>
        <p>Inventário e gestão de impressoras corporativas.</p>
      </div>
      <button className="imp-btn imp-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Nova Impressora</button>
    </header>

    <div className="imp-toolbar">
      <div className="imp-toolbar-row">
        <label className="imp-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar impressoras" placeholder="Buscar impressoras…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="imp-actions">
          <button className="imp-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="imp-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros</button>
          <button className="imp-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
          <button className="imp-btn imp-btn-secondary" onClick={handlePrint} disabled={loading || !data.items.length} title="Imprimir relatório de impressoras"><span className="mat" aria-hidden="true">print</span>Imprimir Relatório</button>
        </div>
      </div>

      {showFilters && <form id="imp-filters" className="imp-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Status: <select aria-label="Filtrar por status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="">Todos os Status</option>{IMPRESSORA_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Setor: <select aria-label="Filtrar por setor" value={draft.setor_id} onChange={(e) => setDraft({ ...draft, setor_id: e.target.value })}>
          <option value="">Todos os Setores</option>
          {options.setores?.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select></label>
        <label>Modelo: <select aria-label="Filtrar por modelo" value={draft.modelo_id} onChange={(e) => setDraft({ ...draft, modelo_id: e.target.value })}>
          <option value="">Todos os Modelos</option>
          {options.modelos?.map((m) => <option key={m.id} value={m.id}>{m.nome_modelo}{m.marca ? ` — ${m.marca}` : ''}</option>)}
        </select></label>
        <div className="imp-actions"><button className="imp-btn imp-btn-primary" type="submit">Aplicar</button><button className="imp-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="imp-message" role="status">{message}</div>}
    {error && <div className="imp-message error" role="alert">{error}<button className="imp-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="imp-grid" aria-busy={loading}>
      <div className="imp-table-scroll"><table className="imp-table">
        <caption className="imp-sr-only">Impressoras cadastradas</caption>
        <thead><tr>{['Código', 'Modelo', 'Setor', 'Nº Série', 'Empresa', 'Status', 'Compra', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="imp-empty" role="status">Carregando impressoras…</td></tr> : data.items.length === 0 ? <tr><td colSpan={8} className="imp-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhuma impressora encontrada.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="imp-code">{row.codigo_interno_impressora || '—'}</strong></td>
          <td className="imp-medium">{row.modelo_nome || '—'}{row.modelo_marca ? ` (${row.modelo_marca})` : ''}</td>
          <td>{row.setor_nome || '—'}</td>
          <td className="imp-mono">{row.numero_serie || '—'}</td>
          <td>{row.empresa_nome || row.empresa_unidade || '—'}</td>
          <td><span className={`imp-status ${STATUS_CLASS(row.status)}`}>{row.status || 'Não informado'}</span></td>
          <td className="imp-mono">{row.data_compra ? new Date(row.data_compra).toLocaleDateString('pt-BR') : '—'}</td>
          <td><div className="imp-actions"><button className="imp-btn imp-btn-icon" title="Visualizar" aria-label="Visualizar impressora" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="imp-btn imp-btn-icon" title="Editar" aria-label="Editar impressora" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="imp-btn imp-btn-icon danger" title="Excluir" aria-label="Excluir impressora" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="imp-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="imp-actions"><button className="imp-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="imp-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <ImpressoraDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
    {showReport && <ImpressaoReport empresa={empresa} filters={filters} onClose={() => setShowReport(false)} />}
  </section>
}
