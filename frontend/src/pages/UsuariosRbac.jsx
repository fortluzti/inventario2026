import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import SortableTh from '../components/SortableTh.jsx'
import { useTableSort } from '../hooks/useTableSort.js'
import './UsuariosRbac.css'
import UsuariosRbacDialog from '../components/UsuariosRbacDialog.jsx'

const EMPTY = { items: [], total: 0, total_pages: 0 }

export default function UsuariosRbac({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState(null)
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
    api('usuarios', 'listar', { params: { search: query, ...sortParams, page, limit } })
      .then((result) => {
        if (!active) return
        if (page > Math.max(1, result.total_pages)) { setPage(Math.max(1, result.total_pages)); return }
        setData(result)
      })
      .catch((e) => { if (active) { setError(e.message); setData(EMPTY) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, sort, page, limit, revision, refreshKey])

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

  function clear() {
    setSearch(''); setQuery(''); setPage(1)
  }

  return <section className="usr-page" aria-labelledby="usr-page-title">
    <header className="usr-page-header">
      <div>
        <div className="usr-breadcrumb">Ativos de TI / Usuários & Perfis (RBAC)</div>
        <h1 id="usr-page-title"><span className="mat" aria-hidden="true">admin_panel_settings</span>Usuários & Perfis</h1>
        <p>Contas de acesso e permissões do sistema.</p>
      </div>
      <button className="usr-btn usr-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Usuario</button>
    </header>

    <div className="usr-toolbar">
      <div className="usr-toolbar-row">
        <label className="usr-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar usuarios" placeholder="Buscar usuarios…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="usr-actions">
          <button className="usr-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
    </div>

    {message && <div className="usr-message" role="status">{message}</div>}
    {(error) && <div className="usr-message error" role="alert">{error}<button className="usr-btn" onClick={() => { setError(''); setRevision((v) => v + 1) }}>Tentar novamente</button></div>}

    <div className="usr-grid" aria-busy={loading}>
      <div className="usr-table-scroll"><table className="usr-table">
        <caption className="usr-sr-only">Contas de acesso cadastradas</caption>
        <thead><tr>
          {[['Login', 'login'], ['Nome', 'nome'], ['Email', 'email']].map(([label, key]) =>
            <SortableTh key={key} label={label} active={isActive(key)} dir={sort.dir} onSort={() => { toggleSort(key); setPage(1) }} />)}
          <th scope="col">Ações</th>
        </tr></thead>
        <tbody>{loading ? <tr><td colSpan={4} className="usr-empty" role="status">Carregando usuarios…</td></tr> : data.items.length === 0 ? <tr><td colSpan={4} className="usr-empty">{error ? 'Nao foi possivel carregar a listagem.' : 'Nenhum usuario encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="usr-login">{row.login || '—'}</strong></td>
          <td className="usr-muted">{row.nome || '—'}</td>
          <td className="usr-muted">{row.email || '—'}</td>
          <td><div className="usr-actions"><button className="usr-btn usr-btn-icon" title="Visualizar" aria-label="Visualizar usuario" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="usr-btn usr-btn-icon" title="Editar" aria-label="Editar usuario" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="usr-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="usr-actions"><button className="usr-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="usr-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <UsuariosRbacDialog
      {...dialog}
      onClose={() => setDialog(null)}
      onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }}
    />}
  </section>
}
