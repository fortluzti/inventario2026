import { useEffect, useMemo, useRef, useState } from 'react'
import { listarTodas as listarImpressoras } from '../api/impressoras.js'
import { listarOpcoes as listarSetores } from '../api/setores.js'
import { listarConsumiveis, listarHistorico } from '../api/toners.js'
import SearchableSelect, { toSearchOptions } from './SearchableSelect.jsx'

const fmtData = (iso) => {
  if (!iso) return '—'
  const d = new Date(String(iso).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * TonerHistoricoDialog — "Ver Histórico de Trocas" em MODAL sobre a tela de
 * Toners (o legado abria a página modules/toners/historico_trocas.php).
 *
 * Reutiliza a consulta existente de histórico (mesma tabela
 * `historico_troca_toner`) e preserva os filtros suportados pela estrutura
 * atual: impressora, setor e consumível — todos no padrão global pesquisável
 * (SearchableSelect). Exibe data, modelo/impressora, setor, consumível,
 * responsável e observações, além das contagens: `total_geral` (sem filtros)
 * e `total` (registros encontrados com os filtros atuais).
 */
export default function TonerHistoricoDialog({ onClose }) {
  const [impressoras, setImpressoras] = useState([])
  const [setores, setSetores] = useState([])
  const [consumiveis, setConsumiveis] = useState([])
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true)
  const [filtros, setFiltros] = useState({ impressora_id: '', setor_id: '', toner_id: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, total_pages: 1 })
  const [totalGeral, setTotalGeral] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarImpressoras(), listarSetores(), listarConsumiveis()])
      .then(([imp, set, ton]) => {
        if (!ativo) return
        setImpressoras(imp)
        setSetores(set)
        setConsumiveis(ton)
      })
      .catch((e) => { if (ativo) setError(`Filtros: ${e.message}`) })
      .finally(() => { if (ativo) setCarregandoOpcoes(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setError('')
    listarHistorico({ ...filtros, page, limit: 50 })
      .then((res) => {
        if (!ativo) return
        setData({
          items: res.items || [],
          total: res.total || 0,
          total_pages: Math.max(1, res.total_pages || 1),
        })
        // total_geral = total existente ANTES dos filtros (mesmo com paginação).
        setTotalGeral(res.total_geral ?? res.total ?? 0)
      })
      .catch((e) => {
        if (!ativo) return
        setError(e.message)
        setData({ items: [], total: 0, total_pages: 1 })
      })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [filtros, page])

  useEffect(() => { dialogRef.current?.focus() }, [])

  function close() { onClose() }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  }

  function aplicarFiltro(name, value) {
    setFiltros((prev) => ({ ...prev, [name]: value }))
    setPage(1)
  }

  function limpar() {
    setFiltros({ impressora_id: '', setor_id: '', toner_id: '' })
    setPage(1)
  }

  const impressoraLabel = (i) => [i.codigo_interno_impressora, i.modelo_nome, i.setor_nome].filter(Boolean).join(' · ')
  const impOptions = useMemo(
    () => toSearchOptions(impressoras, {
      labelOf: impressoraLabel,
      extraOf: (i) => [i.modelo_nome, i.setor_nome].filter(Boolean).join(' '),
    }),
    [impressoras]
  )
  const setorOptions = useMemo(() => toSearchOptions(setores), [setores])
  const tonerOptions = useMemo(
    () => toSearchOptions(consumiveis, { labelOf: (c) => c.nome || c.codigo, extraOf: (c) => [c.codigo, c.tipo].filter(Boolean).join(' ') }),
    [consumiveis]
  )
  const temFiltro = Object.values(filtros).some((v) => v !== '')
  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog tnd-dialog-wide" role="dialog" aria-modal="true" aria-label="Histórico de Trocas" tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">history</span>
          <div className="tnd-hist-titulo">
            <h2>Histórico de Trocas</h2>
            <p className="tnd-hist-contagens">
              <span className="tnd-hist-total">Total de registros: <strong>{totalGeral === null ? '…' : totalGeral}</strong></span>
              <span className="tnd-hist-encontrados" aria-live="polite">Registros encontrados: <strong>{loading ? '…' : data.total}</strong></span>
            </p>
          </div>
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>

        <div className="tnd-form">
          <form className="tnd-hist-filtros" aria-label="Filtros do histórico" onSubmit={(e) => e.preventDefault()}>
            <label className="tnd-field">
              Impressora
              <SearchableSelect
                id="tnd-hist-impressora"
                ariaLabel="Filtrar por impressora"
                options={impOptions}
                value={filtros.impressora_id}
                onChange={(v) => aplicarFiltro('impressora_id', v)}
                allOption={{ value: '', label: 'Todas' }}
                disabled={carregandoOpcoes}
                placeholder="Todas"
              />
            </label>
            <label className="tnd-field">
              Setor
              <SearchableSelect
                id="tnd-hist-setor"
                ariaLabel="Filtrar por setor"
                options={setorOptions}
                value={filtros.setor_id}
                onChange={(v) => aplicarFiltro('setor_id', v)}
                allOption={{ value: '', label: 'Todos' }}
                disabled={carregandoOpcoes}
                placeholder="Todos"
              />
            </label>
            <label className="tnd-field">
              Consumível
              <SearchableSelect
                id="tnd-hist-toner"
                ariaLabel="Filtrar por consumível"
                options={tonerOptions}
                value={filtros.toner_id}
                onChange={(v) => aplicarFiltro('toner_id', v)}
                allOption={{ value: '', label: 'Todos' }}
                disabled={carregandoOpcoes}
                placeholder="Todos"
              />
            </label>
            <div className="tnd-actions">
              <button className="tnd-btn" type="button" onClick={limpar} disabled={!temFiltro}>Limpar filtros</button>
            </div>
          </form>

          {error && <div className="tnd-message error" role="alert">{error}</div>}

          <div className="tnd-table-scroll tnd-hist-scroll">
            <table className="tnd-table">
              <caption className="tnd-sr-only">Histórico de trocas de consumíveis</caption>
              <thead>
                <tr>
                  {['Data', 'Modelo / Impressora', 'Setor', 'Consumível', 'Responsável', 'Observações'].map((label) => (
                    <th key={label} scope="col">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="tnd-muted" role="status">Carregando histórico…</td></tr>
                ) : data.items.length === 0 ? (
                  <tr><td colSpan={6} className="tnd-muted">{error ? 'Não foi possível carregar o histórico.' : 'Nenhum registro encontrado.'}</td></tr>
                ) : data.items.map((h) => (
                  <tr key={h.id}>
                    <td className="tnd-nowrap">{fmtData(h.data_cadastro)}</td>
                    <td>
                      <strong className="tnd-name">{h.modelo_nome || '—'}</strong>
                      <div className="tnd-muted">{h.impressora_codigo || '—'}</div>
                    </td>
                    <td>{h.setor_nome || '—'}</td>
                    <td>
                      <strong className="tnd-name">{h.toner_codigo || '—'}</strong>
                      {h.toner_tipo && <span className={`tnd-tipo ${h.toner_tipo === 'CILINDRO' ? 'cilindro' : 'toner'}`}>{h.toner_tipo}</span>}
                    </td>
                    <td>{h.responsavel || h.usuario_cadastro || '—'}</td>
                    <td className="tnd-muted">{h.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="tnd-dialog-footer">
          <small>{data.total ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, data.total)} de ${data.total}` : '0 registros'}</small>
          <div className="tnd-actions">
            <button className="tnd-btn" type="button" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button>
            <span>{page} / {data.total_pages}</span>
            <button className="tnd-btn" type="button" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button>
            <button className="tnd-btn tnd-btn-primary" type="button" onClick={close}>Fechar (Esc)</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
