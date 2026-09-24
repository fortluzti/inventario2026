import { useEffect, useRef, useState } from 'react'
import { celularesApi } from '../api/celulares.js'
import CelularDialog from '../components/CelularDialog.jsx'
import CelularEntregaDialog from '../components/CelularEntregaDialog.jsx'
import CelularDevolucaoDialog from '../components/CelularDevolucaoDialog.jsx'
import CelularDanoDialog from '../components/CelularDanoDialog.jsx'
import CelularHistoricoDialog from '../components/CelularHistoricoDialog.jsx'
import SortableTh from '../components/SortableTh.jsx'
import { useTableSort } from '../hooks/useTableSort.js'
import './Celulares.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

function statusClass(status) {
  const map = { 'Em Estoque': 'estoque', 'Em Uso': 'uso', 'Danificado': 'danificado', 'Em Manutenção': 'manutencao', 'Descartado': 'descartado' }
  return map[status] || ''
}

const COLS = [
  ['Código', 'codigo'],
  ['Marca', 'marca'],
  ['Nome do Usuário', 'nome_usuario'],
  ['Número', 'numero'],
  ['Status', 'status'],
  ['E-mail', 'email_usuario'],
]

export default function Celulares({ refreshKey = 0, newRequest = 0, onChanged, onOpenConferencia }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ status: '' })
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
    celularesApi.listar({
      search: query,
      status: filters.status || undefined,
      sort: sortParams.sort, dir: sortParams.dir, page, limit,
    })
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
    if (newRequest > lastNewRequest.current) {
      lastNewRequest.current = newRequest
      setDialog({ mode: 'new' })
    }
  }, [newRequest])

  useEffect(() => {
    function onKey(e) {
      if (dialog) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setDialog({ mode: 'new' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir o celular "${row.codigo_interno_celular}"? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await celularesApi.excluir(row.id)
      setMessage('Celular excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch('')
    setQuery('')
    setFilters({ status: '' })
    setDraft({ status: '' })
    setPage(1)
  }

  return (
    <section className='func-page' aria-labelledby='cel-page-title'>
      <header className='func-page-header'>
        <div>
          <div className='func-breadcrumb'>Ativos de TI / Celulares</div>
          <h1 id='cel-page-title'><span className='mat' aria-hidden='true'>cellphone</span>Celulares</h1>
          <p>Gerenciamento de celulares corporativos, entregas, devoluções e registros de dano.</p>
        </div>
        <div className='celulares-actions-top'>
          <button className='func-btn func-btn-primary' onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className='mat' aria-hidden='true'>add</span>Novo</button>
          <button className='func-btn' onClick={() => setDialog({ type: 'entrega' })}><span className='mat' aria-hidden='true'>inventory</span>Entrega</button>
          <button className='func-btn' onClick={() => setDialog({ type: 'devolucao' })}><span className='mat' aria-hidden='true'>reply</span>Devolução</button>
          <button className='func-btn' onClick={() => setDialog({ type: 'dano' })}><span className='mat' aria-hidden='true'>warning</span>Dano</button>
          {onOpenConferencia && (
            <button className='func-btn' title='Auditoria dos dados de celulares (somente leitura)' onClick={onOpenConferencia}><span className='mat' aria-hidden='true'>fact_check</span>Conferência de dados</button>
          )}
        </div>
      </header>

      <div className='func-toolbar'>
        <div className='func-toolbar-row'>
          <label className='func-search'>
            <span className='mat' aria-hidden='true'>search</span>
            <input ref={searchRef} aria-label='Buscar celulares' placeholder='Buscar celulares...' value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className='func-actions'>
            <button className='func-btn' onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls='cel-filters'><span className='mat' aria-hidden='true'>filter_list</span>Filtros{filters.status ? ' •' : ''}</button>
            <button className='func-btn' onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
          </div>
        </div>
        {showFilters && (
          <form id='cel-filters' className='func-filters' onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
            <label>Status:
              <select aria-label='Filtrar por status' value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value=''>Todos</option>
                <option value='Em Estoque'>Em Estoque</option>
                <option value='Em Uso'>Em Uso</option>
                <option value='Danificado'>Danificado</option>
              </select>
            </label>
            <div className='func-actions'>
              <button className='func-btn func-btn-primary' type='submit'>Aplicar</button>
              <button className='func-btn' type='button' onClick={clear}>Limpar</button>
            </div>
          </form>
        )}
      </div>

      {message && <div className='func-message' role='status'>{message}</div>}
      {error && (
        <div className='func-message error' role='alert'>
          {error}
          <button className='func-btn' onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button>
        </div>
      )}

      <div className='func-grid' aria-busy={loading}>
        <div className='func-table-scroll'>
          <table className='func-table'>
            <caption className='func-sr-only'>Celulares cadastrados</caption>
            <thead>
              <tr>
                {COLS.map(([label, key]) =>
                  <SortableTh key={key} label={label} active={isActive(key)} dir={sort.dir} onSort={() => { toggleSort(key); setPage(1) }} />
                )}
                <th scope='col'>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS.length + 1} className='func-muted' role='status'>Carregando celulares…</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={COLS.length + 1} className='func-muted'>{error ? 'Não foi possível carregar a listagem.' : 'Nenhum celular encontrado.'}</td></tr>
              ) : (
                data.items.map((row) => (
                  <tr key={row.id}>
                    <td><strong className='func-name'>{row.codigo_interno_celular || row.id}</strong></td>
                    <td className='func-muted'>{row.marca || '—'}</td>
                    <td className='func-muted'>{row.nome_usuario || '—'}</td>
                    <td className='func-muted'>{row.numero || '—'}</td>
                    <td><span className={`func-status ${statusClass(row.status)}`}>{row.status || '—'}</span></td>
                    <td className='func-muted'>{row.email_usuario || '—'}</td>
                    <td>
                      <div className='func-actions'>
                        <button className='func-btn func-btn-icon' title='Visualizar' aria-label='Visualizar celular' onClick={() => setDialog({ mode: 'view', id: row.id })}><span className='mat'>visibility</span></button>
                        <button className='func-btn func-btn-icon' title='Editar' aria-label='Editar celular' onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className='mat'>edit</span></button>
                        <button className='func-btn func-btn-icon' title='Histórico' aria-label='Histórico de uso' onClick={() => setDialog({ type: 'historico', celular: row })}><span className='mat'>history</span></button>
                        <button className='func-btn func-btn-icon danger' title='Excluir' aria-label='Excluir celular' disabled={deleting === row.id} onClick={() => remove(row)}><span className='mat'>delete</span></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className='func-pagination'>
          <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
          <label>Por página:
            <select aria-label='Registros por página' value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>
              {[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <div className='func-actions'>
            <button className='func-btn' disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button>
            <span>{page} / {Math.max(1, data.total_pages)}</span>
            <button className='func-btn' disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button>
          </div>
        </footer>
      </div>

      {dialog && dialog.mode && (
        <CelularDialog
          mode={dialog.mode}
          id={dialog.id}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setMessage('Celular salvo com sucesso.'); setRevision((v) => v + 1); onChanged?.() }}
        />
      )}
      {dialog && dialog.type === 'entrega' && (
        <CelularEntregaDialog
          onClose={() => setDialog(null)}
          onEntregue={() => { setMessage('Celular entregue com sucesso.'); setDialog(null); setRevision((v) => v + 1); onChanged?.() }}
        />
      )}
      {dialog && dialog.type === 'devolucao' && (
        <CelularDevolucaoDialog
          onClose={() => setDialog(null)}
          onDevolvido={() => { setMessage('Celular devolvido com sucesso.'); setDialog(null); setRevision((v) => v + 1); onChanged?.() }}
        />
      )}
      {dialog && dialog.type === 'dano' && (
        <CelularDanoDialog
          onClose={() => setDialog(null)}
          onRegistrado={() => { setMessage('Dano registrado com sucesso.'); setDialog(null); setRevision((v) => v + 1); onChanged?.() }}
        />
      )}
      {dialog && dialog.type === 'historico' && (
        <CelularHistoricoDialog celular={dialog.celular} onClose={() => setDialog(null)} />
      )}
    </section>
  )
}



