import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { funcionarioPayload, buscarPorId } from '../api/funcionarios.js'

const EMPTY = { nome: '', cargo: '', setor_id: '', rg: '', email: '', gmail: '', ativo: 1 }

export default function FuncionarioDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [setores, setSetores] = useState([])
  const [setorError, setSetorError] = useState('')
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Funcionário' : view ? 'Visualizar Funcionário' : 'Editar Funcionário'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      buscarPorId(id)
        .then((row) => {
          if (row) setForm({
            nome: row.nome || '',
            cargo: row.cargo || '',
            setor_id: row.setor_id || '',
            rg: row.rg || '',
            email: row.email || '',
            gmail: row.gmail || '',
            ativo: row.ativo ? 1 : 0,
          })
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [mode, id])

  useEffect(() => {
    let active = true
    setSetorError('')
    api('setores', 'listar', { params: { limit: 200, page: 1, ativo: 1 } })
      .then((result) => { if (active) setSetores(result.items) })
      .catch((e) => { if (active) setSetorError(`Não foi possível carregar os setores: ${e.message}`) })
    return () => { active = false }
  }, [])

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
    if (view || loading || saveLock.current || setores.length === 0) return
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
      await api('funcionarios', 'salvar', { method: 'POST', body: { ...funcionarioPayload(form), ...(id ? { id } : {}) } })
      onSaved(`${mode === 'new' ? 'Funcionário criado' : 'Funcionário atualizado'} com sucesso.`)
    } catch (e) {
      // Improve error message for duplicate name (HTTP 409)
      if (e.status === 409) {
        setError('Já existe um funcionário com este nome. Por favor, escolha um nome diferente.')
      } else {
        setError(e.message)
      }
    }
    finally { saveLock.current = false; setSaving(false) }
  }

  if (mode === 'new' || (mode === 'edit' && form.nome) || (mode === 'view' && form.nome)) {
    return <div className="func-overlay">
      <section ref={dialogRef} className="func-dialog" role="dialog" aria-modal="true" aria-labelledby="func-dialog-title" tabIndex={-1} onKeyDown={onKey}>
        <header className="func-dialog-header">
          <span className="func-dialog-icon mat" aria-hidden="true">badge</span>
          <h2 id="func-dialog-title">{title}</h2>
          <span className={`func-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
          <button className="func-btn func-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="func-form" ref={formRef} className="func-form" onSubmit={save} noValidate>
          {loading && <p role="status">Carregando cadastro…</p>}
          {error && <div className="func-message error" role="alert">{error}<button type="button" className="func-btn" onClick={() => setError('')}>Fechar</button></div>}
          <fieldset disabled={view || loading || saving || !!setorError}>
            <div className="func-form-grid">
              <div className="func-field">
                <label htmlFor="func-nome">Nome *</label>
                <input id="func-nome" name="nome" className="func-input" value={form.nome || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: João da Silva" required autoFocus />
              </div>
              <div className="func-field">
                <label htmlFor="func-cargo">Cargo</label>
                <input id="func-cargo" name="cargo" className="func-input" value={form.cargo || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: Desenvolvedor" />
              </div>
              <div className="func-field">
                <label htmlFor="func-setor_id">Setor</label>
                <select id="func-setor_id" name="setor_id" className="func-select" value={form.setor_id || ''} onChange={handleChange} disabled={mode === 'view'}>
                  <option value="">Não atribuído</option>
                  {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="func-field">
                <label htmlFor="func-rg">RG</label>
                <input id="func-rg" name="rg" className="func-input" value={form.rg || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: 12.345.678-9" maxLength={30} />
              </div>
              <div className="func-field">
                <label htmlFor="func-email">E-mail</label>
                <input id="func-email" name="email" type="email" className="func-input" value={form.email || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: joao@fortluz.com.br" maxLength={150} />
              </div>
              <div className="func-field">
                <label htmlFor="func-gmail">Gmail</label>
                <input id="func-gmail" name="gmail" type="email" className="func-input" value={form.gmail || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: joao@gmail.com" maxLength={150} />
            </div>
            {mode === 'edit' && (
              <div className="func-field full">
                <label htmlFor="func-ativo">
                  <input id="func-ativo" type="checkbox" name="ativo" checked={form.ativo === 1} onChange={handleChange} />
                  <span>Ativo</span>
                </label>
              </div>
            )}
            {mode === 'view' && (
              <div className="func-field full">
                <label>Status</label>
                <span className={`func-status ${form.ativo ? 'active' : 'inactive'}`}>{form.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
            )}
            </div>
          </fieldset>
          {setorError && <div className="func-message error" role="alert">{setorError}<button type="button" className="func-btn" onClick={() => setSetorError('')}>Tentar novamente</button></div>}
        </form>
        <footer className="func-dialog-footer">
          {!view && <><small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small></>}
          <div className="func-actions">
            <button className="func-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="func-btn func-btn-primary" type="submit" form="func-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Funcionário' : 'Atualizar Alterações'}</button>}
          </div>
        </footer>
      </section>
    </div>
  }

  return null
}
