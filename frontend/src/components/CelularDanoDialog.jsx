/**
 * CelularDanoDialog — fluxo de Registro de Dano.
 *
 * Reproduz o form do dano do legado (celulares_danos.js).
 * Permite selecionar um celular e descrever o dano.
 * Após sucesso, gera o termo de dano (.docx) via gerar_termo.php.
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

export default function CelularDanoDialog({ onClose, onRegistrado }) {
  const { lista: celulares, carregando, erro: erroLista } = useCarregarCelulares('todos')
  const { busca, setBusca, filtrados, chaves } = useFiltroCelular(celulares)
  const [form, setForm] = useState({ celular_id: '', data_dano: '', descricao: '' })
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
    setError(''); setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !form.celular_id || !form.data_dano || !form.descricao) return
    setSaving(true); setError('')

    try {
      const res = await celularesApi.registrarDano({
        celular_id: Number(form.celular_id),
        data_dano: form.data_dano,
        descricao: form.descricao,
      })
      setSuccess('Dano registrado! Gerando termo…')

      const funcId = celulares.find((c) => c.id === Number(form.celular_id))?.funcionario_id || 0
      celularesApi.gerarTermo('celular', Number(form.celular_id), funcId, 'dano')

      setTimeout(() => {
        setSuccess('')
        onRegistrado?.()
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
          <h2>🔧 Registrar Dano</h2>
        </header>
        <form className="celular-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="func-message error" role="alert">{error}</div>}
            {success && <div className="func-message success" role="alert">{success}</div>}
            <div className="func-form-grid">
              <CampoBuscaCelular
                id="cel-dano-busca"
                busca={busca}
                setBusca={setBusca}
                total={filtrados.length}
                disabled={saving || carregando}
              />
              <div className="func-field full">
                <label htmlFor="cel-dano-celular">Celular</label>
                <SelectCelular
                  id="cel-dano-celular"
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
                <label htmlFor="cel-dano-data">Data do Dano *</label>
                <input type="date" id="cel-dano-data" name="data_dano" className="func-input"
                  value={form.data_dano} onChange={handleChange}
                  disabled={saving} required />
              </div>

              <div className="func-field full">
                <label htmlFor="cel-dano-descricao">Descrição do Dano *</label>
                <textarea id="cel-dano-descricao" name="descricao" className="func-textarea"
                  value={form.descricao} onChange={handleChange}
                  disabled={saving} maxLength={500} rows={3} required
                  placeholder="Descreva detalhadamente o dano encontrado…" />
              </div>
            </div>
          </div>
          <footer className="func-dialog-footer">
            <small>Esc · Cancelar</small>
            <div className="func-actions">
              <button type="button" className="func-btn" disabled={saving} onClick={onClose}>Cancelar (Esc)</button>
              <button type="submit" className="func-btn func-btn-primary" disabled={saving || !form.celular_id || !form.data_dano || !form.descricao}>
                {saving ? 'Registrando…' : 'Confirmar Dano'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
