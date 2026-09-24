/**
 * CelularDevolucaoDialog — fluxo de Devolução de celular.
 *
 * Reproduz o form da devolução do legado (celulares_devolucoes.js).
 * Lista celulares em uso e permite registrar danos na devolução.
 * Após sucesso, gera o termo de devolução (.docx) via gerar_termo.php.
 */
import { useEffect, useState } from 'react'
import { celularesApi } from '../api/celulares.js'
import {
  CampoBuscaCelular,
  SelectCelular,
  useCarregarCelulares,
  useFiltroCelular,
  useFocoModal,
} from './CelularDialog.jsx'

export default function CelularDevolucaoDialog({ onClose, onDevolvido }) {
  const { lista: celulares, carregando, erro: erroLista } = useCarregarCelulares('uso')
  const { busca, setBusca, filtrados, chaves } = useFiltroCelular(celulares)
  const [form, setForm] = useState({ celular_id: '', data_devolucao: '', danos: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const dialogRef = useFocoModal()

  useEffect(() => {
    if (erroLista) setError(erroLista)
  }, [erroLista])

  useEffect(() => {
    if (form.celular_id && !celulares.some((c) => String(c.id) === String(form.celular_id))) {
      setForm((prev) => ({ ...prev, celular_id: '' }))
    }
  }, [celulares, form.celular_id])

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!saving) onClose() }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  function getFuncionario(celularId) {
    const c = celulares.find((c) => c.id === Number(celularId))
    return c?.usuario_atual || c?.nome_usuario || ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !form.celular_id || !form.data_devolucao) return
    setSaving(true); setError('')

    try {
      const res = await celularesApi.devolver({
        celular_id: Number(form.celular_id),
        data_devolucao: form.data_devolucao,
        danos: form.danos,
      })
      setSuccess('Celular devolvido! Gerando termo…')

      // Busca funcionário atual para o termo
      const funcId = celulares.find((c) => c.id === Number(form.celular_id))?.funcionario_id || 0
      celularesApi.gerarTermo('celular', Number(form.celular_id), funcId, 'devolucao')

      setTimeout(() => {
        setSuccess('')
        onDevolvido?.()
        onClose()
      }, 1200)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="celular-overlay" onClick={() => { if (!saving) onClose() }}>
      <section className="celular-dialog" ref={dialogRef}
        onClick={(e) => e.stopPropagation()} tabIndex={-1} onKeyDown={onKey}>
        <header className="func-dialog-header">
          <h2>↩ Devolver Celular</h2>
        </header>
        <form className="celular-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="func-message error" role="alert">{error}</div>}
            {success && <div className="func-message success" role="alert">{success}</div>}
            <div className="func-form-grid">
              <CampoBuscaCelular
                id="cel-dev-busca"
                busca={busca}
                setBusca={setBusca}
                total={filtrados.length}
                disabled={saving || carregando}
              />
              <div className="func-field full">
                <label htmlFor="cel-dev-celular">Celular (Em Uso)</label>
                <SelectCelular
                  id="cel-dev-celular"
                  name="celular_id"
                  value={form.celular_id}
                  onChange={handleChange}
                  lista={filtrados}
                  chaves={chaves}
                  placeholder={carregando ? 'Carregando celulares…' : 'Selecione um celular…'}
                  disabled={saving || carregando}
                  required
                />
              </div>

              <div className="func-field">
                <label htmlFor="cel-dev-data">Data da Devolução *</label>
                <input type="date" id="cel-dev-data" name="data_devolucao" className="func-input"
                  value={form.data_devolucao} onChange={handleChange}
                  disabled={saving} required />
              </div>

              <div className="func-field">
                <label htmlFor="cel-dev-funcionario">Funcionário Atual</label>
                <input type="text" id="cel-dev-funcionario" className="func-input"
                  readOnly value={form.celular_id ? getFuncionario(form.celular_id) : ''} />
              </div>

              <div className="func-field full">
                <label htmlFor="cel-dev-danos">Danos (opcional)</label>
                <textarea id="cel-dev-danos" name="danos" className="func-textarea"
                  value={form.danos || ''} onChange={handleChange}
                  disabled={saving} maxLength={500} rows={3}
                  placeholder="Descreva os danos encontrados na devolução…" />
              </div>
            </div>
          </div>
          <footer className="func-dialog-footer">
            <small>Esc · Cancelar</small>
            <div className="func-actions">
              <button type="button" className="func-btn" disabled={saving} onClick={onClose}>Cancelar (Esc)</button>
              <button type="submit" className="func-btn func-btn-primary" disabled={saving || !form.celular_id || !form.data_devolucao}>
                {saving ? 'Devolvendo…' : 'Confirmar Devolução'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
