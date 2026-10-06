import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { excluir, buscarOpcoes as buscarPendenciasErp } from '../api/pendencias_erp.js'
import PendenciaErpDialog from '../components/PendenciaErpDialog.jsx'
import './PendenciasErp.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

/**
 * Pendências do ERP: Controle de problemas, atendimentos, atualizações e testes do ERP.
 * Tela principal de listagem com busca, filtros, paginação e ações.
 */
export default function PendenciasErp({ user, refreshKey = 0, newRequest = 0, onChanged }) {
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
   * 'visualizar' · 'editar' · 'enviar_suporte'. */
  const [opDialog, setOpDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
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
    api('pendencias_erp', 'listar', { params: { search: query, ...filters, page, limit } })
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
    if (deleting || !window.confirm(`Excluir a pendência "${row.codigo}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await excluir(row.id)
      setMessage('Pendência excluída com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) {
      setError(e.message)
    }
    finally { setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({}); setDraft({}); setPage(1)
  }

  return <section className="pendencias-erp-page" aria-labelledby="pendencias-erp-page-title">
    <header className="pendencias-erp-page-header">
      <div>
        <div className="pendencias-erp-breadcrumb">Suporte &amp; ERP / Pendências do ERP</div>
        <h1 id="pendencias-erp-page-title"><span className="mat" aria-hidden="true">pending_actions</span>Pendências do ERP</h1>
        <p>Controle de problemas, atendimentos, atualizações e testes do ERP.</p>
      </div>
      <div className="pendencias-erp-actions pendencias-erp-header-actions">
        <button className="pendencias-erp-btn pendencias-erp-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Nova Pendência</button>
        <button className="pendencias-erp-btn" onClick={() => { setError(''); setMessage(''); setOpDialog({ mode: 'enviar_suporte' }) }}><span className="mat" aria-hidden="true">forward_to_inbox</span>Enviar ao Suporte</button>
      </div>
    </header>

    <div className="pendencias-erp-toolbar">
      <div className="pendencias-erp-toolbar-row">
        <label className="pendencias-erp-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar pendências" placeholder="Buscar por código, título…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="pendencias-erp-actions">
          <button className="pendencias-erp-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="pendencias-erp-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.status || filters.prioridade || filters.modulo || filters.setor) ? ' •' : ''}</button>
          <button className="pendencias-erp-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="pendencias-erp-filters" className="pendencias-erp-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <div className="pendencias-erp-filters-row">
          <div className="pendencias-erp-filter-group">
            <label>Status: <select aria-label="Filtrar por status" value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="">Todos</option><option value="Pendente">Pendente</option><option value="Aguardando Suporte">Aguardando Suporte</option><option value="Em Análise">Em Análise</option><option value="Aguardando Testes">Aguardando Testes</option><option value="Testando">Testando</option><option value="Resolvido">Resolvido</option><option value="Cancelado">Cancelado</option></select></label>
          </div>
          <div className="pendencias-erp-filter-group">
            <label>Prioridade: <select aria-label="Filtrar por prioridade" value={draft.prioridade || ''} onChange={(e) => setDraft({ ...draft, prioridade: e.target.value })}><option value="">Todas</option><option value="Baixa">Baixa</option><option value="Média">Média</option><option value="Alta">Alta</option><option value="Crítica">Crítica</option></select></label>
          </div>
          <div className="pendencias-erp-filter-group">
            <label>Módulo: <select aria-label="Filtrar por módulo" value={draft.modulo || ''} onChange={(e) => setDraft({ ...draft, modulo: e.target.value })}><option value="">Todos</option><option value="Vendas / Faturamento">Vendas / Faturamento</option><option value="Financeiro &amp; Fiscal">Financeiro &amp; Fiscal</option><option value="Estoque &amp; Almoxarifado">Estoque &amp; Almoxarifado</option><option value="TI &amp; Infraestrutura">TI &amp; Infraestrutura</option><option value="Relatórios Corporativos">Relatórios Corporativos</option><option value="Compras &amp; Suprimentos">Compras &amp; Suprimentos</option></select></label>
          </div>
          <div className="pendencias-erp-filter-group">
            <label>Setor: <select aria-label="Filtrar por setor" value={draft.setor || ''} onChange={(e) => setDraft({ ...draft, setor: e.target.value })}><option value="">Todos</option><option value="TI">TI</option><option value="Financeiro">Financeiro</option><option value="Fiscal">Fiscal</option><option value="Faturamento">Faturamento</option><option value="Almoxarifado">Almoxarifado</option><option value="Vendas">Vendas</option><option value="RH / DP">RH / DP</option></select></label>
          </div>
        </div>
        <div className="pendencias-erp-actions"><button className="pendencias-erp-btn pendencias-erp-btn-primary" type="submit">Aplicar</button><button className="pendencias-erp-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="pendencias-erp-message" role="status">{message}</div>}
    {error && <div className="pendencias-erp-message error" role="alert">{error}<button className="pendencias-erp-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="pendencias-erp-grid" aria-busy={loading}>
      <div className="pendencias-erp-table-scroll"><table className="pendencias-erp-table">
        <caption className="pendencias-erp-sr-only">Pendências do ERP cadastradas</caption>
        <thead><tr>{['Código', 'Título', 'Módulo', 'Prioridade', 'Setor / Abrangência', 'Identificado por', 'Data', 'Status', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={9} className="pendencias-erp-muted" role="status">Carregando pendências…</td></tr> : data.items.length === 0 ? <tr><td colSpan={9} className="pendencias-erp-muted">{error ? 'Não foi possível carregar a listagem.' : 'Nenhuma pendência encontrada.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="pendencias-erp-name">{row.codigo || '—'}</strong></td>
          <td className="pendencias-erp-title" title={row.titulo || ''}>{row.titulo || '—'}</td>
          <td><span className="pendencias-erp-modulo">{row.modulo || '—'}</span></td>
          <td>
            <span className={`pendencias-erp-prioridade ${row.prioridade === 'Crítica' ? 'critica' : row.prioridade === 'Alta' ? 'alta' : row.prioridade === 'Média' ? 'media' : 'baixa'}`}>
              {row.prioridade || '—'}
            </span>
          </td>
          <td>
            {row.setor && row.setor !== 'Todos os setores' ? (
              <>
                <span className="pendencias-erp-setor">{row.setor}</span>
                {row.abrangencia === 'Específico' && <span className="pendencias-erp-abrangencia"> (Específico)</span>}
              </>
            ) : (
              <span className="pendencias-erp-abrangencia">Todos os setores</span>
            )}
          </td>
          <td><span className="pendencias-erp-identificado">{row.identificado_por || '—'}</span></td>
          <td className="pendencias-erp-data">{row.data_identificacao ? new Date(row.data_identificacao).toLocaleString('pt-BR') : '—'}</td>
          <td>
            <span className={`pendencias-erp-status ${row.status === 'Resolvido' ? 'resolvido' : row.status === 'Cancelado' ? 'cancelado' : row.status === 'Aguardando Suporte' ? 'aguardando-suporte' : row.status === 'Em Análise' ? 'em-analise' : row.status === 'Aguardando Testes' ? 'aguardando-testes' : row.status === 'Testando' ? 'testando' : 'pendente'}`}>
              {row.status || '—'}
            </span>
          </td>
          <td><div className="pendencias-erp-actions"><button className="pendencias-erp-btn pendencias-erp-btn-icon" title="Visualizar" aria-label="Visualizar pendência" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="pendencias-erp-btn pendencias-erp-btn-icon" title="Editar" aria-label="Editar pendência" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="pendencias-erp-btn pendencias-erp-btn-icon danger" title="Excluir" aria-label="Excluir pendência" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="pendencias-erp-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="pendencias-erp-actions"><button className="pendencias-erp-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="pendencias-erp-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <PendenciaErpDialog {...dialog} user={user} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}

    {/* Operações concentradas nesta tela em modal (mesma ideia do legado
        modules/pendencias_erp/pendencias_erp_list.php) — sem página separada de recebimento
        nem de histórico de trocas. */}
    {opDialog?.mode === 'enviar_suporte' && (
      <PendenciaErpDialog
        user={user}
        pendenciaId={opDialog.id}
        onClose={() => setOpDialog(null)}
        onSaved={(text) => { setOpDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }}
      />
    )}
  </section>
}