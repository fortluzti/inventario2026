import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { EMPTY_FORNECEDOR, FORNECEDOR_TIPOS, fornecedorPayload, buscarPorId } from '../api/fornecedores.js'

export default function FornecedorDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORNECEDOR)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Fornecedor' : view ? 'Visualizar Fornecedor' : 'Editar Fornecedor'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      buscarPorId(id)
        .then((row) => {
          if (row) setForm({
            nome: row.nome || '',
            cnpj: row.cnpj || '',
            telefone: row.telefone || '',
            endereco: row.endereco || '',
            tipo: row.tipo || '',
            nome_vendedor: row.nome_vendedor || '',
            email: row.email || '',
            ativo: row.ativo ? 1 : 0,
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
    if (!FORNECEDOR_TIPOS.includes(form.tipo)) {
      setError('Tipo é obrigatório')
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      await api('fornecedores', 'salvar', { method: 'POST', body: { ...fornecedorPayload(form), ...(id ? { id } : {}) } })
      onSaved(`${mode === 'new' ? 'Fornecedor criado' : 'Fornecedor atualizado'} com sucesso.`)
    } catch (e) {
      // 409 = CNPJ único duplicado (unique_cnpj) ou vínculo de exclusão.
      if (e.status === 409) {
        setError('Já existe um fornecedor com este CNPJ. Por favor, verifique o informado.')
      } else {
        setError(e.message)
      }
    }
    finally { saveLock.current = false; setSaving(false) }
  }

  if (mode === 'new' || (mode === 'edit' && form.nome) || (mode === 'view' && form.nome)) {
    return <div className="forn-overlay">
      <section ref={dialogRef} className="forn-dialog" role="dialog" aria-modal="true" aria-labelledby="forn-dialog-title" tabIndex={-1} onKeyDown={onKey}>
        <header className="forn-dialog-header">
          <span className="forn-dialog-icon mat" aria-hidden="true">local_shipping</span>
          <h2 id="forn-dialog-title">{title}</h2>
          <span className={`forn-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
          <button className="forn-btn forn-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="forn-form" ref={formRef} className="forn-form" onSubmit={save} noValidate>
          {loading && <p role="status">Carregando cadastro…</p>}
          {error && <div className="forn-message error" role="alert">{error}<button type="button" className="forn-btn" onClick={() => setError('')}>Fechar</button></div>}
          <fieldset disabled={view || loading || saving}>
            <div className="forn-form-grid">
              <div className="forn-field">
                <label htmlFor="forn-nome">Nome *</label>
                <input id="forn-nome" name="nome" className="forn-input" value={form.nome || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: KaBuM!" maxLength={100} required autoFocus />
              </div>
              <div className="forn-field">
                <label htmlFor="forn-cnpj">CNPJ</label>
                <input id="forn-cnpj" name="cnpj" className="forn-input" value={form.cnpj || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: 11.478.152/0004-63" maxLength={20} />
              </div>
              <div className="forn-field">
                <label htmlFor="forn-tipo">Tipo *</label>
                <select id="forn-tipo" name="tipo" className="forn-select" value={form.tipo || ''} onChange={handleChange} disabled={mode === 'view'} required>
                  <option value="">Selecione…</option>
                  {FORNECEDOR_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="forn-field">
                <label htmlFor="forn-telefone">Telefone</label>
                <input id="forn-telefone" name="telefone" className="forn-input" value={form.telefone || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: 19 2111-4444" maxLength={20} />
              </div>
              <div className="forn-field">
                <label htmlFor="forn-nome_vendedor">Vendedor</label>
                <input id="forn-nome_vendedor" name="nome_vendedor" className="forn-input" value={form.nome_vendedor || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: João da Silva" maxLength={100} />
              </div>
              <div className="forn-field">
                <label htmlFor="forn-email">E-mail</label>
                <input id="forn-email" name="email" type="email" className="forn-input" value={form.email || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: vendas@fornecedor.com.br" maxLength={100} />
              </div>
              <div className="forn-field full">
                <label htmlFor="forn-endereco">Endereço</label>
                <input id="forn-endereco" name="endereco" className="forn-input" value={form.endereco || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: Rua Principal, 100 — São Paulo/SP" maxLength={200} />
              </div>
              {mode === 'edit' && (
                <div className="forn-field full">
                  <label htmlFor="forn-ativo">
                    <input id="forn-ativo" type="checkbox" name="ativo" checked={form.ativo === 1} onChange={handleChange} />
                    <span>Ativo</span>
                  </label>
                </div>
              )}
              {mode === 'view' && (
                <div className="forn-field full">
                  <label>Status</label>
                  <span className={`forn-status ${form.ativo ? 'active' : 'inactive'}`}>{form.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
              )}
            </div>
          </fieldset>
        </form>
        <footer className="forn-dialog-footer">
          {!view && <small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small>}
          <div className="forn-actions">
            <button className="forn-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="forn-btn forn-btn-primary" type="submit" form="forn-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Fornecedor' : 'Atualizar Alterações'}</button>}
          </div>
        </footer>
      </section>
    </div>
  }

  return null
}
