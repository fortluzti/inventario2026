import { useEffect, useRef, useState } from 'react'
import { celularesApi } from '../api/celulares.js'
import SortableTh from '../components/SortableTh.jsx'
import { useTableSort } from '../hooks/useTableSort.js'
import './CelularesConferencia.css'

/**
 * Conferência (auditoria) dos dados de celulares — SOMENTE LEITURA.
 *
 * Uma linha por associação celular × funcionário (incluindo o histórico) e também
 * celulares sem nenhuma associação. Exibe número, Gmail, e-mail corporativo,
 * funcionário, status, período de uso, tipo de associação e as inconsistências.
 *
 * Nada é alterado aqui: a correção é feita manualmente após a conferência.
 * Não usa a infraestrutura de impressão/PDF dos relatórios gerais (ReportViewer).
 */
const EMPTY = {
  items: [], total: 0, total_pages: 0, resumo: null, regras: [],
  opcoes: { status_celular: [] }, fontes: {}, limitacoes: [],
}
const FILTROS_VAZIOS = { status_funcionario: '', status_celular: '', associacao: '', situacao: '', situacao_codigo: '' }

const COLS = [
  ['Código do Celular', 'codigo'],
  ['Número', 'numero'],
  ['Gmail', 'gmail'],
  ['E-mail Corporativo', 'email_corporativo'],
  ['Funcionário', 'funcionario'],
  ['Status do Funcionário', 'status_funcionario'],
  ['Status do Celular', 'status_celular'],
  ['Associação', 'associacao'],
  ['Data de Início do Uso', 'inicio'],
  ['Data de Fim do Uso', 'fim'],
  ['Situação', 'situacao'],
]

function statusClass(status) {
  const map = { 'Em Estoque': 'estoque', 'Em Uso': 'uso', 'Danificado': 'danificado', 'Em Manutenção': 'manutencao', 'Descartado': 'descartado' }
  return map[status] || ''
}

/** 'YYYY-MM-DD HH:MM:SS' -> 'DD/MM/YYYY'. Valor ausente continua vazio (nada é inferido). */
function formatDate(valor) {
  if (!valor) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor)
}

const csvCell = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`

export default function CelularesConferencia({ refreshKey = 0 }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(FILTROS_VAZIOS)
  const [draft, setDraft] = useState(FILTROS_VAZIOS)
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const searchRef = useRef(null)
  const { params: sortParams, sort, toggle: toggleSort, isActive } = useTableSort()

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    celularesApi.conferencia({
      search: query,
      status_funcionario: filters.status_funcionario || undefined,
      status_celular: filters.status_celular || undefined,
      associacao: filters.associacao || undefined,
      situacao: filters.situacao || undefined,
      situacao_codigo: filters.situacao_codigo || undefined,
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
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function limpar() {
    setSearch(''); setQuery(''); setFilters(FILTROS_VAZIOS); setDraft(FILTROS_VAZIOS); setPage(1)
  }

  function filtrarPorCodigo(codigo) {
    const proximo = { ...FILTROS_VAZIOS, situacao_codigo: codigo }
    setDraft(proximo); setFilters(proximo); setPage(1)
  }

  const labelRegra = (codigo) => (data.regras || []).find((r) => r.codigo === codigo)?.label || codigo

  async function exportarCsv() {
    if (exporting) return
    setExporting(true); setMessage(''); setError('')
    try {
      // Mesmos filtros/ordenação da tela, sem paginação: a conferência precisa de tudo.
      const todas = await celularesApi.conferencia({
        search: query,
        status_funcionario: filters.status_funcionario || undefined,
        status_celular: filters.status_celular || undefined,
        associacao: filters.associacao || undefined,
        situacao: filters.situacao || undefined,
        situacao_codigo: filters.situacao_codigo || undefined,
        sort: sortParams.sort, dir: sortParams.dir, todos: true,
      })
      const linhas = [[
        'Código do Celular', 'Marca/Modelo', 'Número', 'Gmail', 'E-mail Corporativo',
        'Funcionário', 'Cargo do Funcionário', 'Status do Funcionário', 'Status do Celular',
        'Associação', 'Data de Início do Uso', 'Data de Fim do Uso', 'Situação', 'Observações',
        'celular_id', 'associacao_id', 'funcionario_id',
      ]]
      todas.items.forEach((r) => linhas.push([
        r.codigo, [r.marca, r.modelo].filter(Boolean).join(' '), r.numero || '', r.gmail || '',
        r.email_corporativo || '', r.funcionario || '', r.funcionario_cargo || '',
        r.funcionario_status || '', r.celular_status || '', r.associacao || '',
        formatDate(r.data_inicio), formatDate(r.data_fim),
        (r.situacoes || []).map((s) => s.label).join(' | '),
        (r.observacoes || []).map((o) => o.label).join(' | '),
        r.celular_id, r.associacao_id ?? '', r.funcionario_id ?? '',
      ]))
      const csv = linhas.map((linha) => linha.map(csvCell).join(';')).join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Conferencia_Celulares.csv'
      a.click()
      URL.revokeObjectURL(url)
      setMessage(`Exportação concluída: ${todas.items.length} registro(s) em Conferencia_Celulares.csv (filtros aplicados, sem paginação).`)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  const resumo = data.resumo
  const inconsistenciasAtivas = resumo ? Object.entries(resumo.por_inconsistencia || {}).filter(([, n]) => n > 0) : []

  return (
    <section className='func-page' aria-labelledby='conf-page-title'>
      <header className='func-page-header'>
        <div>
          <div className='func-breadcrumb'>Ativos de TI / Celulares / Conferência de Dados</div>
          <h1 id='conf-page-title'><span className='mat' aria-hidden='true'>fact_check</span>Conferência de Dados — Celulares</h1>
          <p>Auditoria dos cadastros: número, Gmail, e-mail corporativo, funcionário, histórico de uso e inconsistências.</p>
        </div>
        <div className='celulares-actions-top'>
          <button className='func-btn func-btn-primary' onClick={exportarCsv} disabled={exporting || loading}>
            <span className='mat' aria-hidden='true'>file_download</span>{exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button className='func-btn' onClick={() => setRevision((v) => v + 1)} disabled={loading}>
            <span className='mat' aria-hidden='true'>refresh</span>Atualizar
          </button>
        </div>
      </header>

      <div className='func-toolbar'>
        <div className='func-toolbar-row'>
          <label className='func-search'>
            <span className='mat' aria-hidden='true'>search</span>
            <input ref={searchRef} aria-label='Buscar na conferência' placeholder='Buscar por número, Gmail, e-mail corporativo, funcionário ou código…' value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className='func-actions'>
            <button className='func-btn' onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls='conf-filters'>
              <span className='mat' aria-hidden='true'>filter_list</span>Filtros
              {(filters.status_funcionario || filters.status_celular || filters.associacao || filters.situacao || filters.situacao_codigo) ? ' •' : ''}
            </button>
            <span className='conf-leitura' title='Esta tela não altera nenhum dado'>
              <span className='mat' aria-hidden='true'>lock</span>Somente leitura
            </span>
          </div>
        </div>
        {showFilters && (
          <form id='conf-filters' className='func-filters' onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
            <label>Status do Funcionário:
              <select aria-label='Filtrar por status do funcionário' value={draft.status_funcionario} onChange={(e) => setDraft({ ...draft, status_funcionario: e.target.value })}>
                <option value=''>Todos</option>
                <option value='ativos'>Ativos</option>
                <option value='inativos'>Inativos</option>
              </select>
            </label>
            <label>Status do Celular:
              <select aria-label='Filtrar por status do celular' value={draft.status_celular} onChange={(e) => setDraft({ ...draft, status_celular: e.target.value })}>
                <option value=''>Todos</option>
                {(data.opcoes?.status_celular || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Associação:
              <select aria-label='Filtrar por associação' value={draft.associacao} onChange={(e) => setDraft({ ...draft, associacao: e.target.value })}>
                <option value=''>Todas</option>
                <option value='atual'>Somente atual</option>
                <option value='historica'>Somente histórico</option>
                <option value='sem_associacao'>Sem associação</option>
              </select>
            </label>
            <label>Situação:
              <select aria-label='Filtrar por situação' value={draft.situacao} onChange={(e) => setDraft({ ...draft, situacao: e.target.value })}>
                <option value=''>Todas</option>
                <option value='ok'>OK</option>
                <option value='inconsistencia'>Com inconsistência</option>
              </select>
            </label>
            <label>Tipo:
              <select aria-label='Filtrar por tipo de inconsistência' value={draft.situacao_codigo} onChange={(e) => setDraft({ ...draft, situacao_codigo: e.target.value })}>
                <option value=''>Todos os tipos</option>
                {(data.regras || []).map((r) => (
                  <option key={r.codigo} value={r.codigo}>{r.tipo === 'observacao' ? `(observação) ${r.label}` : r.label}</option>
                ))}
              </select>
            </label>
            <div className='func-actions'>
              <button className='func-btn func-btn-primary' type='submit'>Aplicar</button>
              <button className='func-btn' type='button' onClick={limpar}>Limpar</button>
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

      {resumo && (
        <div className='conf-resumo' role='status' aria-label='Resumo da conferência'>
          <span className='conf-chip'>Registros: <strong>{resumo.total}</strong></span>
          <span className='conf-chip conf-chip-ok'>OK: <strong>{resumo.ok}</strong></span>
          <span className={`conf-chip ${resumo.com_inconsistencia ? 'conf-chip-erro' : ''}`}>Com inconsistência: <strong>{resumo.com_inconsistencia}</strong></span>
          {inconsistenciasAtivas.map(([codigo, n]) => (
            <button key={codigo} type='button' className='conf-chip conf-chip-erro conf-chip-btn' title={`Filtrar: ${labelRegra(codigo)}`} onClick={() => filtrarPorCodigo(codigo)}>
              {labelRegra(codigo)}: {n}
            </button>
          ))}
          {resumo.escopo && (
            <span className='conf-escopo'>
              Base: {resumo.escopo.celulares} celulares • {resumo.escopo.associacoes} associações • {resumo.escopo.funcionarios} funcionários • {resumo.escopo.termos_historico_uso} termos em historico_uso
            </span>
          )}
        </div>
      )}

      <details className='conf-ajuda'>
        <summary><span className='mat' aria-hidden='true'>info</span>Fontes de dados e limitações do modelo</summary>
        <div className='conf-ajuda-body'>
          <strong>De onde vem cada dado:</strong>
          <ul>{Object.entries(data.fontes || {}).map(([chave, texto]) => <li key={chave}><strong>{chave}</strong>: {texto}</li>)}</ul>
          <strong>Limitações (o que a conferência NÃO recupera):</strong>
          <ul>{(data.limitacoes || []).map((texto) => <li key={texto}>{texto}</li>)}</ul>
        </div>
      </details>


      <div className='func-grid' aria-busy={loading}>
        <div className='func-table-scroll'>
          <table className='func-table'>
            <caption className='func-sr-only'>Conferência dos dados de celulares por associação (celular × funcionário)</caption>
            <thead>
              <tr>
                {COLS.map(([label, key]) => (
                  <SortableTh key={key} label={label} active={isActive(key)} dir={sort.dir} onSort={() => { toggleSort(key); setPage(1) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={COLS.length} className='func-muted' role='status'>Carregando conferência…</td></tr>
              )}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={COLS.length} className='func-muted'>{error ? 'Não foi possível carregar a conferência.' : 'Nenhum registro encontrado para os filtros aplicados.'}</td></tr>
              )}
              {!loading && data.items.map((row) => (
                <tr key={`${row.celular_id}-${row.associacao_id ?? 'sem'}`}>
                  <td>
                    <span className='conf-codigo'>
                      <strong className='func-name'>{row.codigo || row.celular_id}</strong>
                      <small>{[row.marca, row.modelo].filter(Boolean).join(' ') || '—'}</small>
                    </span>
                  </td>
                  <td className='func-muted'>{row.numero || '—'}</td>
                  <td className='func-muted'>{row.gmail || '—'}</td>
                  <td className='func-muted'>{row.email_corporativo || '—'}</td>
                  <td>
                    {row.funcionario
                      ? <span className='conf-codigo'><strong className='func-name'>{row.funcionario}</strong>{row.funcionario_cargo && <small>{row.funcionario_cargo}</small>}</span>
                      : <span className='func-muted'>—</span>}
                  </td>
                  <td>
                    {row.funcionario_status
                      ? <span className={`func-status ${row.funcionario_ativo ? 'active' : 'inactive'}`}>{row.funcionario_status}</span>
                      : <span className='func-muted'>—</span>}
                  </td>
                  <td><span className={`func-status ${statusClass(row.celular_status)}`}>{row.celular_status || '—'}</span></td>
                  <td>
                    {row.associacao
                      ? <span className={`conf-assoc ${row.associacao === 'Atual' ? 'atual' : 'historica'}`}>{row.associacao}</span>
                      : <span className='func-muted'>—</span>}
                  </td>
                  <td className='func-muted'>{formatDate(row.data_inicio) || '—'}</td>
                  <td className='func-muted'>{formatDate(row.data_fim) || '—'}</td>
                  <td>
                    <div className='conf-situacao'>
                      {row.situacoes.length === 0
                        ? <span className='conf-ok'>OK</span>
                        : row.situacoes.map((s) => (
                          <span key={s.codigo} className='conf-flag'><span className='mat' aria-hidden='true'>warning</span>{s.label}</span>
                        ))}
                      {row.observacoes.length > 0 && (
                        <span className='conf-obs'>obs: {row.observacoes.map((o) => o.label).join(' • ')}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
    </section>
  )
}

