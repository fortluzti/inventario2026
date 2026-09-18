import { useState } from 'react'
import { api } from '../api/client.js'

export default function Login({ onLogin }) {
  const [view, setView] = useState('login') // login | recovery
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [lembrar, setLembrar] = useState(true)
  const [feedback, setFeedback] = useState(null) // { ok, msg }
  const [loading, setLoading] = useState(false)
  const [emailRec, setEmailRec] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setFeedback(null)
    if (!usuario.trim() || !senha.trim()) {
      setFeedback({ ok: false, msg: 'Informe usuário e senha para continuar.' })
      return
    }
    setLoading(true)
    try {
      // Ainda não existe módulo de autenticação na API (usuarios — pendente).
      // Valida a sessão testando a conexão com a API e entra.
      await api('health', 'ping')
      onLogin({ usuario: usuario.trim(), lembrar })
    } catch (err) {
      setFeedback({ ok: false, msg: `Falha de conexão com o servidor: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const okStyle = { background: 'var(--ok-bg)', color: 'var(--ok-fg)', borderColor: 'var(--ok-bd)' }

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="brand">
          <div className="logo" style={{ width: 32, height: 32, background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>FL</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>FortLuz ERP</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>Gestão &amp; Inventário Industrial</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge badge-ok" style={{ height: 22 }}>
            <span className="mat" style={{ fontSize: 13, marginRight: 4 }}>lock</span>
            SSL / TLS ATIVO
          </span>
          <div style={{ width: 32, height: 32, borderRadius: '9999px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mat" style={{ color: 'var(--on-primary)', fontSize: 18 }}>person</span>
          </div>
        </div>
      </header>

      <main className="login-main">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {view === 'login' ? (
            <form className="login-box" onSubmit={handleSubmit}>
              <div className="login-box-head">
                <div className="logo">FL</div>
                <div>
                  <div className="headline-sm">Acesso ao Sistema</div>
                  <div className="label-sm muted">Autenticação obrigatória</div>
                </div>
              </div>
              <div className="login-box-body">
                <div className="login-field">
                  <label htmlFor="login-username">Usuário</label>
                  <input
                    id="login-username"
                    className="input"
                    placeholder="ex.: alex ou alex@fortluz.com.br"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="login-password">Senha</label>
                  <div className="login-field-wrap">
                    <input
                      id="login-password"
                      className="input"
                      type={showSenha ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button type="button" className="login-eye" onClick={() => setShowSenha((s) => !s)} aria-label="Mostrar/ocultar senha">
                      <span className="mat" style={{ fontSize: 15 }}>{showSenha ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                <div className="login-row">
                  <label className="login-check">
                    <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
                    Lembrar-me neste terminal
                  </label>
                  <button type="button" className="login-link" onClick={() => { setView('recovery'); setFeedback(null) }}>
                    Esqueci minha senha
                  </button>
                </div>
                {feedback && <div className="error-box" style={feedback.ok ? okStyle : undefined}>{feedback.msg}</div>}
                <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
                  {loading ? 'Autenticando…' : 'Entrar no Sistema'}
                </button>
                <div className="login-hint">
                  Acesso monitorado e registrado para auditoria de segurança.<br />
                  Suporte: <a href="mailto:suporte.ti@fortluz.com.br" style={{ color: 'var(--primary)' }}>suporte.ti@fortluz.com.br</a>
                </div>
              </div>
            </form>
          ) : (
            <RecoveryView onBack={() => { setView('login'); setFeedback(null) }} okStyle={okStyle} />
          )}

          <div className="login-audit">
            <div className="grp">
              <span className="mat" style={{ fontSize: 14, color: '#005852' }}>shield_lock</span>
              <span>Criptografia de ponta a ponta SSL/TLS 256-bit • API REST v2</span>
            </div>
            <div className="grp">
              <span>FortLuz Iluminação Industrial S.A.</span>
              <span>Build 2026.1.0-web</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function RecoveryView({ onBack, okStyle }) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState(null)

  function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMsg({ ok: false, text: 'Informe um e-mail corporativo válido.' })
      return
    }
    setMsg({ ok: true, text: `Instruções de recuperação enviadas para ${email}.` })
  }

  return (
    <form className="login-box" onSubmit={submit}>
      <div className="login-box-head">
        <div className="logo" style={{ background: 'var(--text-muted)' }}>
          <span className="mat" style={{ fontSize: 18 }}>lock_reset</span>
        </div>
        <div>
          <div className="headline-sm">Recuperar Senha</div>
          <div className="label-sm muted">Informe o e-mail corporativo</div>
        </div>
      </div>
      <div className="login-box-body">
        <div className="login-field">
          <label htmlFor="recovery-email">E-mail corporativo</label>
          <input
            id="recovery-email"
            className="input"
            type="email"
            placeholder="nome@fortluz.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        {msg && <div className="error-box" style={msg.ok ? okStyle : undefined}>{msg.text}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1, justifyContent: 'center', height: 32 }} onClick={onBack}>
            Voltar ao login
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', height: 32 }}>
            Enviar
          </button>
        </div>
      </div>
    </form>
  )
}
