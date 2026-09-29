import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { excluir } from '../api/fornecedores.js'
import FornecedorDialog from '../components/FornecedorDialog.jsx'
import SortableTh from '../components/SortableTh.jsx'
import { useTableSort } from '../hooks/useTableSort.js'
import './Fornecedores.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

/* Colunas ordenáveis: [rótulo, chave enviada em sort= (whitelist do modules.php)] */
const COLS = [
  ['Nome', 'nome'],
  ['CNPJ', 'cnpj'],
  ['Telefone', 'telefone'],
  ['Tipo', 'tipo'],
  ['Vendedor', 'nome_vendedor'],
  ['E-mail', 'email'],
  ['Status', 'status'],
]

export default function Fornecedores({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ ativo: '1' })
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
  const deleteLock = useRef(false)
  const searchRef = useRef(null)
  const lastNewRequest = useRef(newRequest)
  const { params: sortParams, sort, toggle: toggleSort, isActive } = useTableSort()

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('fornecedores', 'listar', { params: { search: query, ...filters, ...sortParams, page, limit } })
      .then((result) => {
        if (!active) return
        if (page > Math.max(1, result.total_pages)) { setPage(Math.max(1, result.total_pages)); return }
        setData(result)
      })
      .catch((e) => { if (active) { setError(e.message); setData(EMPTY) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, filters, sort, page, limit, revision, refreshKey])

  useEffect(() => {
    if (newRequest > lastNewRequest.current) { lastNewRequest.current = newRequest; setDialog({ mode: 'new' }) }
  }, [newRequest])

  useEffect(() => {
    function onKey(e) {
      if (dialog) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setDialog({ mode: 'new' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir o fornecedor "${row.nome}"? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await excluir(row.id)
      setMessage('Fornecedor excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) {
      // 409 = vínculos (equipamentos/manutenções): backend orienta a inativar.
      // Não disparar revision aqui: o effect de listagem executa setError('') e
      // apagaria a mensagem antes de o usuário lê-la (padrão de Funcionarios.jsx).
      setError(e.message)
    }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({ ativo: '1' }); setDraft({ ativo: '1' }); setPage(1)
  }

  return <section className="forn-page" aria-labelledby="forn-page-title">
    <header className="forn-page-header">
      <div>
        <div className="forn-breadcrumb">Ativos de TI / Fornecedores</div>
        <h1 id="forn-page-title"><span className="mat" aria-hidden="true">local_shipping</span>Fornecedores</h1>
        <p>Cadastro e gestão de fornecedores e prestadores de serviços.</p>
      </div>
      <button className="forn-btn forn-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Fornecedor</button>
    </header>

    <div className="forn-toolbar">
      <div className="forn-toolbar-row">
        <label className="forn-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar fornecedores" placeholder="Buscar fornecedores…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="forn-actions">
          <button className="forn-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="forn-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.ativo !== '1') && ' •'}</button>
          <button className="forn-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="forn-filters" className="forn-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Status: <select aria-label="Filtrar por status" value={draft.ativo} onChange={(e) => setDraft({ ...draft, ativo: e.target.value })}><option value="1">Ativos</option><option value="0">Inativos</option><option value="">Todos</option></select></label>
        <div className="forn-actions"><button className="forn-btn forn-btn-primary" type="submit">Aplicar</button><button className="forn-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="forn-message" role="status">{message}</div>}
    {error && <div className="forn-message error" role="alert">{error}<button className="forn-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="forn-grid" aria-busy={loading}>
      <div className="forn-table-scroll"><table className="forn-table">
        <caption className="forn-sr-only">Fornecedores cadastrados</caption>
        <thead><tr>
          {COLS.map(([label, key]) =>
            <SortableTh key={key} label={label} active={isActive(key)} dir={sort.dir} onSort={() => { toggleSort(key); setPage(1) }} />)}
          <th scope="col">Ações</th>
        </tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="forn-empty" role="status">Carregando fornecedores…</td></tr> : data.items.length === 0 ? <tr><td colSpan={8} className="forn-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum fornecedor encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="forn-name">{row.nome || '—'}</strong></td>
          <td className="forn-muted">{row.cnpj || '—'}</td>
          <td className="forn-muted">{row.telefone || '—'}</td>
          <td className="forn-muted">{row.tipo || '—'}</td>
          <td className="forn-muted">{row.nome_vendedor || '—'}</td>
          <td className="forn-muted">{row.email || '—'}</td>
          <td><span className={`forn-status ${row.ativo ? 'active' : 'inactive'}`}>{row.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td><div className="forn-actions"><button className="forn-btn forn-btn-icon" title="Visualizar" aria-label="Visualizar fornecedor" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="forn-btn forn-btn-icon" title="Editar" aria-label="Editar fornecedor" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="forn-btn forn-btn-icon danger" title="Excluir" aria-label="Excluir fornecedor" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="forn-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="forn-actions"><button className="forn-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="forn-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <FornecedorDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
  </section>
}
