import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { setorPayload, buscarPorId } from '../api/setores.js'

const EMPTY = { nome: '', descricao: '', ativo: 1 }

export default function SetoresDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Setor' : view ? 'Visualizar Setor' : 'Editar Setor'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      buscarPorId(id)
        .then((row) => {
          if (row) setForm({
            nome: row.nome || '',
            descricao: row.descricao || '',
            ativo: row.ativo || 1,
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
    if (e.key === 'Tab') {
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
        .filter((el) => !el.closest('[hidden]'))
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value,
    }))
    setDirty(true)
  }

  async function save(e) {
    e.preventDefault()
    if (view || loading || saveLock.current) return
    const invalid = [...formRef.current.querySelectorAll('input:not([type="hidden"]), select')].find((el) => !el.checkValidity())
    if (invalid) {
      setError(`Verifique o campo ${invalid.labels?.[0]?.textContent || invalid.name}.`)
      setTimeout(() => { invalid.focus(); invalid.reportValidity() }, 0)
      return
    }
    if (!form.nome || form.nome.trim() === '') {
      setError('Nome é obrigatório')
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      await api('setores', 'salvar', { method: 'POST', body: setorPayload(form) })
      onSaved(`${mode === 'new' ? 'Setor criado' : 'Setor atualizado'} com sucesso.`)
    } catch (e) { setError(e.message) }
    finally { saveLock.current = false; setSaving(false) }
  }

  if (mode === 'new' || (mode === 'edit' && form.nome) || (mode === 'view' && form.nome)) {
    return <div className="set-overlay">
      <section ref={dialogRef} className="set-dialog" role="dialog" aria-modal="true" aria-labelledby="set-dialog-title" tabIndex={-1} onKeyDown={onKey}>
        <header className="set-dialog-header">
          <span className="set-dialog-icon mat" aria-hidden="true">domain</span>
          <h2 id="set-dialog-title">{title}</h2>
          <span className={`set-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
          <button className="set-btn set-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="set-form" ref={formRef} className="set-form" onSubmit={save} noValidate>
          {loading && <p role="status">Carregando cadastro…</p>}
          {error && <div className="set-message error" role="alert">{error}<button type="button" className="set-btn" onClick={() => setError('')}>Fechar</button></div>}
          <fieldset disabled={view || loading || saving}>
            <div className="set-form-grid">
              <div className="set-field">
                <label htmlFor="setor-nome">Nome do Setor *</label>
                <input id="setor-nome" name="nome" className="set-input" value={form.nome || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: TI / Sala 101" autoFocus required />
              </div>
              <div className="set-field set-full">
                <label htmlFor="setor-descricao">Descrição</label>
                <textarea id="setor-descricao" name="descricao" className="set-textarea" value={form.descricao || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Descrição complementar do setor..." rows={3} />
              </div>
              {mode === 'edit' && (
                <div className="set-field set-full">
                  <label htmlFor="setor-ativo">
                    <input id="setor-ativo" type="checkbox" name="ativo" checked={form.ativo === 1} onChange={handleChange} disabled={mode === 'view'} />
                    <span>Ativo</span>
                  </label>
                </div>
              )}
            </div>
          </fieldset>
        </form>
        <footer className="set-dialog-footer">
          {!view && <><small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small></>}
          <div className="set-actions">
            <button className="set-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="set-btn set-btn-primary" type="submit" form="set-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Setor' : 'Atualizar Alterações'}</button>}
          </div>
        </footer>
      </section>
    </div>
  }

  return null
}