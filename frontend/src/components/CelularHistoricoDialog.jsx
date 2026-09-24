/**
 * CelularHistoricoDialog — visualização de histórico de uso.
 *
 * Reproduz a grid de histórico do legado (celulares.js → listarHistoricoUso).
 * Eventos: Uso (entrega/devolução), Dano, Manutenção.
 */
import { useEffect, useRef, useState } from 'react'
import { celularesApi } from '../api/celulares.js'

export default function CelularHistoricoDialog({ celular, onClose }) {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => {
    let active = true
    celularesApi.listarHistorico(celular.id)
      .then((r) => { if (active) setHistorico(r.items || r) })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [celular.id])

  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { previous?.focus() }
  }, [])

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
  }

  return (
    <div className="celular-overlay" onClick={onClose}>
      <section className="celular-dialog" ref={dialogRef}
        onClick={(e) => e.stopPropagation()} tabIndex={-1} onKeyDown={onKey}>
        <header className="func-dialog-header">
          <h2>📜 Histórico de Uso — #{celular.codigo_interno_celular || celular.id}</h2>
          <span className="celular-codigo-badge">{celular.marca} {celular.modelo}</span>
        </header>

        <div className="modal-body">
          {loading ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af' }}>Carregando histórico…</p>
          ) : error ? (
            <div className="func-message error" role="alert">{error}</div>
          ) : historico.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af' }}>Nenhum registro de histórico encontrado.</p>
          ) : (
            <ul className="historico-timeline">
              {historico.map((ev, i) => (
                <li key={i}>
                  <span className={`historico-evento-badge ${ev.tipo_evento}`}>
                    {ev.tipo_evento}
                  </span>
                  <strong>{ev.data_evento || ev.data_fim_evento}</strong>
                  {' — '}
                  {ev.pessoa_relacionada || 'N/A'}
                  {' — '}
                  <em>{ev.status_evento || ''}</em>
                  {ev.detalhes && <span> · {ev.detalhes}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="func-dialog-footer">
          <div className="func-actions">
            <button type="button" className="func-btn func-btn-primary" onClick={onClose}>Fechar</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
