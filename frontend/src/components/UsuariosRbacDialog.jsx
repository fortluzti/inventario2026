import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { usuarioPayload } from '../api/usuarios.js'

const EMPTY = { nome: '', login: '', email: '' }

export default function UsuariosRbacDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Usuario' : view ? 'Visualizar Usuario' : 'Editar Usuario'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      api('usuarios', 'buscar', { params: { id } })
        .then((row) => {
          if (row) setForm({
            nome: row.nome || '',
            login: row.login || '',
            email: row.email || '',
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
    const invalid = [...formRef.current.querySelectorAll('input:not([type="hidden"])')].find((el) => !el.checkValidity())
    if (invalid) {
      setError(`Verifique o campo ${invalid.labels?.[0]?.textContent || invalid.name}.`)
      setTimeout(() => { invalid.focus(); invalid.reportValidity() }, 0)
      return
    }
    if (!form.nome || form.nome.trim() === '') {
      setError('Nome é obrigatório')
      return
    }
    if (!form.login || form.login.trim() === '') {
      setError('Login é obrigatório')
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      const payload = {
        nome: form.nome.trim(),
        login: form.login.trim(),
        email: form.email.trim() || null,
      }

      if (mode === 'new') {
        payload.senha = '123456'
        await api('usuarios', 'novo', { method: 'POST', body: payload })
      } else {
        payload.id = id
        await api('usuarios', 'salvar', { method: 'POST', body: payload })
      }

      onSaved(`${mode === 'new' ? 'Usuario criado' : 'Usuario atualizado'} com sucesso.`)
    } catch (e) {
      if (e.status === 409) {
        setError('Já existe um usuário com este login.')
      } else {
        setError(e.message)
      }
    }
    finally { saveLock.current = false; setSaving(false) }
  }

  if (mode === 'new' || (mode === 'edit' && form.nome) || (mode === 'view' && form.nome)) {
    return <div className="usr-overlay">
      <section ref={dialogRef} className="usr-dialog" role="dialog" aria-modal="true" aria-labelledby="usr-dialog-title" tabIndex={-1} onKeyDown={onKey}>
        <header className="usr-dialog-header">
          <span className="usr-dialog-icon mat" aria-hidden="true">badge</span>
          <h2 id="usr-dialog-title">{title}</h2>
          <span className={`usr-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
          <button className="usr-btn usr-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="usr-form" ref={formRef} className="usr-form" onSubmit={save} noValidate>
          {loading && <p role="status">Carregando cadastro…</p>}
          {error && <div className="usr-message error" role="alert">{error}<button type="button" className="usr-btn" onClick={() => setError('')}>Fechar</button></div>}
          <fieldset disabled={view || loading || saving}>
            <div className="usr-form-grid">
              <div className="usr-field">
                <label htmlFor="usr-nome">Nome *</label>
                <input id="usr-nome" name="nome" className="usr-input" type="text" value={form.nome || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Nome completo" required autoFocus />
              </div>
              <div className="usr-field">
                <label htmlFor="usr-login">Login *</label>
                <input id="usr-login" name="login" className="usr-input" type="text" value={form.login || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Login unico" required />
              </div>
              <div className="usr-field full">
                <label htmlFor="usr-email">E-mail</label>
                <input id="usr-email" name="email" className="usr-input" type="email" value={form.email || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="email@empresa.com.br" />
              </div>
              {mode === 'new' && (
                <div className="usr-field full">
                  <label htmlFor="usr-senha">Senha *</label>
                  <input id="usr-senha" name="senha" className="usr-input" type="password" value="123456" disabled placeholder="Senha padrao (minimo 6 caracteres)" />
                </div>
              )}
            </div>
          </fieldset>
          {error && <div className="usr-message error" role="alert">{error}<button type="button" className="usr-btn" onClick={() => setError('')}>Fechar</button></div>}
        </form>
        <footer className="usr-dialog-footer">
          {!view && <><small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small></>}
          <div className="usr-actions">
            <button className="usr-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="usr-btn usr-btn-primary" type="submit" form="usr-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Usuario' : 'Atualizar Alteracoes'}</button>}
          </div>
        </footer>
      </section>
    </div>
  }

  return null
}
