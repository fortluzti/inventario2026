import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { EMPTY_TONER, TONER_TIPOS, tonerPayload, buscarPorId } from '../api/toners.js'

export default function TonerDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_TONER)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Consumível' : view ? 'Visualizar Consumível' : 'Editar Consumível'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      buscarPorId(id)
        .then((row) => {
          if (row) setForm({
            codigo: row.codigo || '',
            tipo: row.tipo || 'TONER',
            estoque: row.estoque ?? 0,
            estoque_minimo: row.estoque_minimo ?? 0,
            autonomia: row.autonomia ?? '',
            valor: row.valor ?? '',
            data_compra: row.data_compra || '',
            nota_fiscal: row.nota_fiscal || '',
            fornecedor_id: row.fornecedor_id ?? '',
            empresa_id: row.empresa_id ?? '',
          })
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [mode, id])

  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { previous?.focus() }
  }, [])

  function close() {
    if (saveLock.current) return
    if (mode === 'view') onClose()
    else if (!dirty || window.confirm('Descartar as alterações não salvas?')) onClose()
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (!view && !loading && !saving) formRef.current?.requestSubmit()
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setDirty(true)
  }

  async function save(e) {
    e.preventDefault()
    if (view || loading || saveLock.current) return
    if (!String(form.codigo || '').trim()) { setError('Código é obrigatório'); return }
    if (!TONER_TIPOS.includes(form.tipo)) { setError('Tipo é obrigatório (TONER ou CILINDRO)'); return }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      const payload = tonerPayload(form)
      if (mode === 'edit') payload.id = id
      const res = await api('toners', 'salvar', { method: 'POST', body: payload })
      onSaved?.(mode === 'new' ? 'Consumível criado com sucesso.' : 'Consumível atualizado com sucesso.', res.id)
    } catch (err) {
      setError(err.message)
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  const fId = (s) => `tnd-${s}`

  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">inventory_2</span>
          <h2>{title}</h2>
          {mode === 'new' && <span className="tnd-mode">NOVO</span>}
          {mode === 'edit' && <span className="tnd-mode edit">EM EDIÇÃO</span>}
          {view && <span className="tnd-mode view">SOMENTE LEITURA</span>}
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="tnd-form" className="tnd-form" ref={formRef} onSubmit={save}>
          <fieldset disabled={view} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="tnd-form-grid">
              <div className="tnd-field">
                <label htmlFor={fId('codigo')}>Código *</label>
                <input id={fId('codigo')} name="codigo" className="tnd-input" value={form.codigo || ''} onChange={handleChange} placeholder="Ex: W1330A" maxLength={100} required autoFocus />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('tipo')}>Tipo *</label>
                <select id={fId('tipo')} name="tipo" className="tnd-select" value={form.tipo || ''} onChange={handleChange} required>
                  <option value="">Selecione…</option>
                  {TONER_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('estoque')}>Estoque</label>
                <input id={fId('estoque')} name="estoque" type="number" min="0" step="1" className="tnd-input" value={form.estoque ?? ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('estoque_minimo')}>Estoque mínimo</label>
                <input id={fId('estoque_minimo')} name="estoque_minimo" type="number" min="0" step="1" className="tnd-input" value={form.estoque_minimo ?? ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('autonomia')}>Autonomia (páginas)</label>
                <input id={fId('autonomia')} name="autonomia" type="number" min="0" step="1" className="tnd-input" value={form.autonomia ?? ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('valor')}>Valor (R$)</label>
                <input id={fId('valor')} name="valor" type="number" min="0" step="0.01" className="tnd-input" value={form.valor ?? ''} onChange={handleChange} placeholder="0,00" title="Valor unitário — somente cadastro, sem uso financeiro nesta etapa" />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('data_compra')}>Data da compra</label>
                <input id={fId('data_compra')} name="data_compra" type="date" className="tnd-input" value={form.data_compra || ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('nota_fiscal')}>Nota fiscal</label>
                <input id={fId('nota_fiscal')} name="nota_fiscal" className="tnd-input" value={form.nota_fiscal || ''} onChange={handleChange} placeholder="Ex: 000.123.456" maxLength={100} />
              </div>
              {!view && <p className="tnd-hint full">O valor é apenas cadastro p/ futuro histórico financeiro — não entra em solicitação/pedido nem em cálculo de estoque.</p>}
            </div>
          </fieldset>
          {error && <div className="tnd-message error" role="alert">{error}<button type="button" className="tnd-btn" onClick={() => setError('')}>Fechar</button></div>}
        </form>
        <footer className="tnd-dialog-footer">
          {!view && <small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small>}
          <div className="tnd-actions">
            <button className="tnd-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="tnd-btn tnd-btn-primary" type="submit" form="tnd-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Consumível' : 'Atualizar Alterações'}</button>}
          </div>
        </footer>
      </section>
    </div>
  )
}

