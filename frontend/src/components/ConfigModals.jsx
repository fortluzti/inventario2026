import { useEffect, useRef, useState } from 'react'
import { MODULE_SCOPES, SCOPE_LABELS } from '../api/configuracoes.js'

export function ConfirmDialog({ title, message, detail, confirmLabel = 'Continuar', cancelLabel = 'Cancelar', loading = false, onClose, onConfirm }) {
  const dialogRef = useRef(null)
  const firstBtnRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    dialogRef.current?.focus()
    return () => { prev?.focus() }
  }, [])

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Tab') {
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
        .filter((el) => !el.closest('[hidden]'))
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
  }

  return (
    <div className="cfg-overlay">
      <section
        ref={dialogRef}
        className="cfg-dialog"
        role="dialog" aria-modal="true"
        aria-labelledby="cfg-confirm-title"
        tabIndex={-1}
        onKeyDown={onKey}
      >
        <header className="cfg-dialog-header">
          <span className="cfg-dialog-icon mat" aria-hidden="true">warning</span>
          <h2 id="cfg-confirm-title">{title}</h2>
          <button className="cfg-btn cfg-btn-icon" type="button" aria-label="Fechar janela" onClick={onClose}><span className="mat">close</span></button>
        </header>
        <div className="cfg-dialog-body">
          <p style={{ marginBottom: detail ? 4 : 0 }}>{message}</p>
          {detail && <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>{detail}</small>}
        </div>
        <footer className="cfg-dialog-footer">
          <div className="cfg-actions">
            <button className="cfg-btn" type="button" disabled={loading} onClick={onClose}>{cancelLabel}</button>
            <button className="cfg-btn cfg-btn-primary" type="button" disabled={loading} onClick={onConfirm}>
              {loading ? 'Processando…' : confirmLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export function NewApiKeyDialog({ onClose, onSaved }) {
  const [identificacao, setIdentificacao] = useState('')
  const [scopes, setScopes] = useState('*')
  const [salvar, setSalvar] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    dialogRef.current?.focus()
    return () => { prev?.focus() }
  }, [])

  const scopesList = MODULE_SCOPES.filter(s => s !== 'configuracoes')

  function handleSubmit(e) {
    e.preventDefault()
    if (!identificacao.trim() || salvar) return
  }

  async function gerar() {
    if (salvar || !identificacao.trim()) return
    setSalvar(true)
    setError('')
    try {
      const result = await onSaved({ nome: identificacao.trim(), scopes })
      setIdentificacao('')
      setScopes('*')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSalvar(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); if (!salvar) onClose() }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && !salvar) {
      e.preventDefault()
      const form = e.currentTarget.querySelector('form')
      form?.requestSubmit()
    }
  }

  const isAll = scopes === '*'
  const selectedModules = isAll ? [] : scopes.split(',').filter(Boolean)

  function toggleModule(mod) {
    const current = selectedModules
    const idx = current.indexOf(mod)
    const next = idx >= 0 ? current.filter(m => m !== mod) : [...current, mod]
    setScopes(next.length === 0 ? '*' : next.join(','))
  }

  return (
    <div className="cfg-overlay">
      <section
        ref={dialogRef}
        className="cfg-dialog"
        role="dialog" aria-modal="true"
        aria-labelledby="cfg-apikey-title"
        tabIndex={-1}
        onKeyDown={onKey}
      >
        <header className="cfg-dialog-header">
          <span className="cfg-dialog-icon mat" aria-hidden="true">key</span>
          <h2 id="cfg-apikey-title">Nova API Key</h2>
          <button className="cfg-btn cfg-btn-icon" type="button" aria-label="Fechar janela" disabled={salvar} onClick={onClose}><span className="mat">close</span></button>
        </header>
        <form id="cfg-apikey-form" className="cfg-form" onSubmit={gerar} noValidate>
          {error && <div className="cfg-message error" role="alert">{error}<button type="button" className="cfg-btn" onClick={() => setError('')}>Fechar</button></div>}
          <div className="cfg-field">
            <label htmlFor="cfg-apikey-ident">Identificação *</label>
            <input
              id="cfg-apikey-ident"
              className="cfg-input"
              placeholder="Ex: Frontend web"
              value={identificacao}
              onChange={(e) => setIdentificacao(e.target.value)}
              maxLength={100}
              required
              disabled={salvar}
              autoFocus
            />
            <small className="cfg-hint">Quem utilizará esta chave (ex: app mobile, terminal de entrada)</small>
          </div>

          <div className="cfg-field" style={{ marginTop: 16 }}>
            <label className="cfg-label-block">Permissões</label>
            <div style={{ marginBottom: 8 }}>
              <label className="cfg-checkbox" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isAll}
                  onChange={(e) => setScopes(e.target.checked ? '*' : '')}
                  disabled={salvar}
                />
                <span>Todas as permissões</span>
                <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
                  Acesso total a todos os endpoints e recursos do sistema.
                </small>
              </label>
            </div>

            {!isAll && (
              <div className="cfg-permission-grid">
                {scopesList.map((mod) => (
                  <label key={mod} className="cfg-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod)}
                      onChange={() => toggleModule(mod)}
                      disabled={salvar}
                    />
                    <span>{SCOPE_LABELS[mod] || mod}</span>
                  </label>
                ))}
              </div>
            )}

            {!isAll && selectedModules.length === 0 && (
              <small style={{ display: 'block', color: 'var(--crit-fg)', marginTop: 6, fontSize: 10 }}>
                Selecione pelo menos um módulo ou habilite "Todas as permissões".
              </small>
            )}
          </div>
        </form>
        <footer className="cfg-dialog-footer">
          <div className="cfg-actions">
            <button className="cfg-btn" type="button" disabled={salvar} onClick={onClose}>Cancelar</button>
            <button
              className="cfg-btn cfg-btn-primary"
              type="submit"
              form="cfg-apikey-form"
              disabled={salvar || !identificacao.trim() || (!isAll && selectedModules.length === 0)}
            >
              {salvar ? 'Gerando…' : 'Gerar API Key'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export function GeneratedKeyDialog({ chave, onClose, onCopied }) {
  const [copiada, setCopiada] = useState(false)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    dialogRef.current?.focus()
    inputRef.current?.select()
    return () => { prev?.focus() }
  }, [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(chave)
      setCopiada(true)
      onCopied?.()
    } catch {
      inputRef.current?.select()
      document.execCommand('copy')
      setCopiada(true)
      onCopied?.()
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && copiada) onClose()
  }

  return (
    <div className="cfg-overlay">
      <section
        ref={dialogRef}
        className="cfg-dialog"
        role="dialog" aria-modal="true"
        aria-labelledby="cfg-generated-title"
        tabIndex={-1}
        onKeyDown={onKey}
      >
        <header className="cfg-dialog-header">
          <span className="cfg-dialog-icon mat" aria-hidden="true" style={{ background: 'var(--primary)' }}>check_circle</span>
          <h2 id="cfg-generated-title">API Key criada com sucesso</h2>
          <button className="cfg-btn cfg-btn-icon" type="button" aria-label="Fechar janela" onClick={onClose}><span className="mat">close</span></button>
        </header>
        <div className="cfg-dialog-body">
          <div className="cfg-message" style={{ marginBottom: 16 }}>
            <span className="mat" aria-hidden="true">info</span>
            Copie esta chave agora. Por segurança, ela não deverá ser exibida novamente dessa forma.
          </div>
          <div className="cfg-field">
            <label htmlFor="cfg-chave-input">Chave completa</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                id="cfg-chave-input"
                className="cfg-input font-mono"
                type="text"
                value={chave}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                className="cfg-btn cfg-btn-icon"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                aria-label="Mostrar/Ocultar"
                onClick={() => {}}
                title="Mostrar/Ocultar"
              >
                <span className="mat">visibility</span>
              </button>
            </div>
          </div>
          {copiada && (
            <div className="cfg-copied-indicator" role="status">
              <span className="mat" aria-hidden="true">check</span>
              Copiada
            </div>
          )}
        </div>
        <footer className="cfg-dialog-footer">
          <button className="cfg-btn cfg-btn-primary" onClick={copiada ? onClose : copiar}>
            {copiada ? 'Fechar' : 'Copiar API Key'}
          </button>
        </footer>
      </section>
    </div>
  )
}
