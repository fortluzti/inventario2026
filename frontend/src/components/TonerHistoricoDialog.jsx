import { useEffect, useRef, useState } from 'react'
import { listarTodas as listarImpressoras } from '../api/impressoras.js'
import { listarOpcoes as listarSetores } from '../api/setores.js'
import { listarConsumiveis, listarHistorico } from '../api/toners.js'

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
 * atual: impressora, setor e consumível. Exibe data, modelo/impressora, setor,
 * consumível, responsável e observações.
 */
export default function TonerHistoricoDialog({ onClose }) {
  const [impressoras, setImpressoras] = useState([])
  const [setores, setSetores] = useState([])
  const [consumiveis, setConsumiveis] = useState([])
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true)
  const [filtros, setFiltros] = useState({ impressora_id: '', setor_id: '', toner_id: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, total_pages: 1 })
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

  function aplicarFiltro(e) {
    const { name, value } = e.target
    setFiltros((prev) => ({ ...prev, [name]: value }))
    setPage(1)
  }

  function limpar() {
    setFiltros({ impressora_id: '', setor_id: '', toner_id: '' })
    setPage(1)
  }

  const impressoraLabel = (i) => [i.codigo_interno_impressora, i.modelo_nome, i.setor_nome].filter(Boolean).join(' · ')
  const temFiltro = Object.values(filtros).some((v) => v !== '')

  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog tnd-dialog-wide" role="dialog" aria-modal="true" aria-label="Histórico de Trocas" tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">history</span>
          <h2>Histórico de Trocas</h2>
          <span className="tnd-mode">{data.total} registro(s)</span>
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>

        <div className="tnd-form">
          <form className="tnd-hist-filtros" aria-label="Filtros do histórico" onSubmit={(e) => e.preventDefault()}>
            <label className="tnd-field">
              Impressora
              <select className="tnd-select" name="impressora_id" value={filtros.impressora_id} onChange={aplicarFiltro} disabled={carregandoOpcoes}>
                <option value="">Todas</option>
                {impressoras.map((i) => <option key={i.id} value={i.id}>{impressoraLabel(i)}</option>)}
              </select>
            </label>
            <label className="tnd-field">
              Setor
              <select className="tnd-select" name="setor_id" value={filtros.setor_id} onChange={aplicarFiltro} disabled={carregandoOpcoes}>
                <option value="">Todos</option>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="tnd-field">
              Consumível
              <select className="tnd-select" name="toner_id" value={filtros.toner_id} onChange={aplicarFiltro} disabled={carregandoOpcoes}>
                <option value="">Todos</option>
                {consumiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
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
