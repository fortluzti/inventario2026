import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import './Perfil.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

export default function Perfil({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [senhaDialog, setSenhaDialog] = useState(null)
  const [mudandoSenha, setMudandoSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const deleteLock = useRef(false)
  const searchRef = useRef(null)

  // Carregar dados do usuário logado
  useEffect(() => {
    if (!user || !user?.usuario) {
      setError('Usuário não identificado.')
      setLoading(false)
      return
    }

    const loadingTimer = setTimeout(() => {
      setLoading(true)
      setError('')
      api('usuarios', 'buscar_por_id', { params: { id: user.usuario } })
        .then((result) => {
          if (result && typeof result === 'object') {
            setData(result)
          } else {
            setData({
              id: user.usuario,
              nome: user.usuario,
              email: '',
              cargo: '',
              setor: '',
              rg: '',
              ativo: true
            })
          }
        })
        .catch((e) => {
          setError(e.message || 'Erro ao carregar perfil.')
          console.error('[Perfil] Erro ao buscar usuário:', e)
          // Fallback: usar dados do próprio user object
          setData({
            id: user.usuario,
            nome: user.usuario || 'Operador',
            email: user.email || '',
            cargo: user.cargo || '',
            setor: user.setor || '',
            rg: user.rg || '',
            ativo: user.ativo !== undefined ? user.ativo : true
          })
        })
        .finally(() => setLoading(false))
    }, 100)

    return () => clearTimeout(loadingTimer)
  }, [user])

  // Abrir dialog de edição
  function openEditDialog(usuarioDados) {
    setDialog({
      mode: 'edit',
      existing: { ...usuarioDados },
      onSave: async (dados) => {
        setSalvando(true)
        try {
          const result = await api('usuarios', 'salvar', {
            method: 'POST',
            body: { ...dados, id: usuarioDados.id }
          })
          if (result) {
            setMensagem('Perfil atualizado com sucesso.')
            setDialog(null)
            setData(dados)
            setTimeout(() => setMensagem(''), 3000)
          } else {
            setError('Erro ao salvar perfil.')
          }
        } catch (e) {
          setError(e.message || 'Erro ao salvar perfil.')
        } finally {
          setSalvando(false)
        }
      },
      onClose: () => setDialog(null)
    })
  }

  // Abrir dialog de alteração de senha
  function openSenhaDialog() {
    setSenhaDialog({
      mode: 'change',
      current: '',
      novo: '',
      confirmar: '',
      onSave: async (dados) => {
        setMudandoSenha(true)
        try {
          // Validar campos
          if (!dados.atual || !dados.novo || !dados.confirmar) {
            setError('Preencha todos os campos da senha.')
            setMudandoSenha(false)
            return
          }
          if (dados.novo !== dados.confirmar) {
            setError('As novas senhas não conferem.')
            setMudandoSenha(false)
            return
          }
          if (dados.novo.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.')
            setMudandoSenha(false)
            return
          }

          setSalvando(true)
          const result = await api('usuarios', 'salvar', {
            method: 'POST',
            body: { id: user.usuario, trocar_senha: true, nova_senha: dados.novo }
          })
          if (result) {
            setMensagem('Senha alterada com sucesso. Faça login novamente.')
            setSenhaDialog(null)
            setMudandoSenha(false)
            // TODO: Opcionalmente fazer logout forçado
            setTimeout(() => setMensagem(''), 3000)
          } else {
            setError('Erro ao alterar senha.')
            setMudandoSenha(false)
          }
        } catch (e) {
          setError(e.message || 'Erro ao alterar senha.')
          setMudandoSenha(false)
        } finally {
          setSalvando(false)
        }
      },
      onClose: () => {
        setSenhaDialog(null)
        setMudandoSenha(false)
      }
    })
  }

  // Função para remover conta (opcional)
  function removerConta() {
    if (deleteLock.current) return
    deleteLock.current = true
    if (!window.confirm('Tem certeza que deseja remover sua conta? Esta ação não pode ser desfeita.')) {
      deleteLock.current = false
      return
    }
    // Note: remoção de conta exigiria endpoint específico, não implementado agora
    setMensagem('Remoção de conta não disponível neste momento.')
    deleteLock.current = false
  }

  

  if (loading && !data) {
    return <section className="perfil-page" aria-busy aria-label="Carregando perfil do usuário">
      <div className="perfil-carregando">
        <span className="mat" style={{ fontSize: 24 }}>autorenew</span>
        <p>Carregando dados do usuário...</p>
      </div>
    </section>
  }

  if (!data) {
    return <section className="perfil-page" aria-label="Perfil do usuário">
      <div className="perfil-vazio">
        <span className="mat">error</span>
        <h2>Perfil não encontrado</h2>
        <p>Não foi possível carregar os dados do perfil do usuário.</p>
        <p className="error">{error}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
      </div>
    </section>
  }

  return <section className="perfil-page" aria-labelledby="perfil-page-title">
    <header className="perfil-header">
      <div className="perfil-header-top">
        <div className="perfil-breadcrumb">Ativos de TI / Perfil</div>
        <h1 id="perfil-page-title"><span className="mat" aria-hidden="true">account_circle</span>Meu Perfil</h1>
        <p className="perfil-subtitle">Usuário logado: {data.nome || user?.usuario || 'Operador'}</p>
      </div>

      {mensagem && <div className="perfil-message" role="status">{mensagem}</div>}
      {(error) && <div className="perfil-message error" role="alert">{error}</div>}
    </header>

    <main className="perfil-main">
      <div className="perfil-card">
        <div className="perfil-card-header">
          <span className="mat">person</span>
          <h2>Dados do Usuário</h2>
        </div>

        <div className="perfil-card-body">
          {/* Informações básicas */}
          <div className="perfil-grid-row">
            <div className="perfil-grid-col">
              <label className="perfil-label">Nome Completo</label>
              <input className="perfil-input" type="text" value={data.nome || ''} readOnly disabled />
            </div>
            <div className="perfil-grid-col">
              <label className="perfil-login">Login / Usuário</label>
              <input className="perfil-input" type="text" value={data.login || user?.usuario || ''} readOnly disabled />
            </div>
          </div>

          {/* E-mail */}
          {data.email !== undefined && data.email !== null && (
            <div className="perfil-grid-row">
              <div className="perfil-grid-col">
                <label className="perfil-label">E-mail</label>
                <input className="perfil-input" type="email" value={data.email || ''} readOnly disabled />
              </div>
            </div>
          )}

          {/* Cargo e Setor */}
          {data.cargo !== undefined && (
            <div className="perfil-grid-row">
              <div className="perfil-grid-col">
                <label className="perfil-label">Cargo</label>
                <input className="perfil-input" type="text" value={data.cargo || ''} readOnly disabled />
              </div>
              <div className="perfil-grid-col">
                <label className="perfil-label">Setor</label>
                <input className="perfil-input" type="text" value={data.setor || ''} readOnly disabled />
              </div>
            </div>
          )}

          {/* RG */}
          {data.rg !== undefined && (
            <div className="perfil-grid-row">
              <div className="perfil-grid-col">
                <label className="perfil-label">RG</label>
                <input className="perfil-input" type="text" value={data.rg || ''} readOnly disabled />
              </div>
            </div>
          )}

          {/* Status */}
          <div className="perfil-grid-row">
            <div className="perfil-grid-col-full">
              <label className="perfil-label">Status</label>
              <span className={`perfil-status ${data.ativo ? 'ativo' : 'inativo'}`}>
                {data.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>

        {/* Ações: Editar e Alterar Senha */}
        <div className="perfil-card-actions">
          <button className="btn-perfil btn-perfil-editar" onClick={openEditDialog}>
            <span className="mat">edit</span>
            Editar Perfil
          </button>

          <button className="btn-perfil btn-perfil-senha" onClick={openSenhaDialog}>
            <span className="mat">vpn_key</span>
            Alterar Senha
          </button>
        </div>
      </div>
    </main>

    {/* Dialog de Edição de Perfil */}
    {dialog && <DialogPerfil
      {...dialog}
      onClose={() => setDialog(null)}
    />}

    {/* Dialog de Alteração de Senha */}
    {senhaDialog && <DialogSenha
      {...senhaDialog}
      onClose={() => setSenhaDialog(null)}
    />}
  </section>
}

/* Diálogo de Edição de Perfil */
function DialogPerfil({ existing, onSave, onClose }) {
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft({ ...existing })
  }, [existing])

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const dados = {
        nome: draft.nome.trim(),
        login: draft.login.trim(),
        email: draft.email.trim(),
        cargo: draft.cargo.trim(),
        setor: draft.setor.trim(),
        rg: draft.rg.trim(),
        id: existing.id
      }

      // Remover campos vazios para evitar validação de mass-assignment
      const dadosFiltrados = Object.keys(dados).reduce((acc, key) => {
        if (draft[key] !== '') {
          acc[key] = draft[key]
        }
        return acc
      }, {})

      const result = await api('usuarios', 'salvar', {
        method: 'POST',
        body: dadosFiltrados
      })

      if (result) {
        onSave(dadosFiltrados)
        onClose()
      } else {
        setError('Erro ao salvar perfil.')
      }
    } catch (e) {
      setError(e.message || 'Erro ao salvar perfil.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="perfil-dialog-overlay">
      <div className="perfil-dialog">
        <div className="perfil-dialog-header">
          <span>Editar Perfil</span>
          <button className="perfil-dialog-close" onClick={onClose}>
            <span className="mat">close</span>
          </button>
        </div>
        <div className="perfil-dialog-body">
          <form onSubmit={(e) => { e.preventDefault(); handleSave(e) }}>
            <div className="perfil-grid-row">
              <div className="perfil-grid-col">
                <label className="perfil-label">Nome Completo</label>
                <input className="perfil-input" type="text" value={draft.nome || ''} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
              </div>
              <div className="perfil-grid-col">
                <label className="perfil-login">Login</label>
                <input className="perfil-input" type="text" value={draft.login || ''} onChange={(e) => setDraft({ ...draft, login: e.target.value })} />
              </div>
            </div>
            <div className="perfil-grid-row">
              <div className="perfil-grid-col">
                <label className="perfil-label">E-mail</label>
                <input className="perfil-input" type="email" value={draft.email || ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className="perfil-grid-col">
                <label className="perfil-label">Cargo</label>
                <input className="perfil-input" type="text" value={draft.cargo || ''} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} />
              </div>
            </div>
            <div className="perfil-grid-row">
              <div className="perfil-grid-col">
                <label className="perfil-label">Setor</label>
                <input className="perfil-input" type="text" value={draft.setor || ''} onChange={(e) => setDraft({ ...draft, setor: e.target.value })} />
              </div>
              <div className="perfil-grid-col">
                <label className="perfil-label">RG</label>
                <input className="perfil-input" type="text" value={draft.rg || ''} onChange={(e) => setDraft({ ...draft, rg: e.target.value })} />
              </div>
            </div>
          </form>
        </div>
        <div className="perfil-dialog-footer">
          <button className="perfil-dialog-btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="perfil-dialog-btn-salvar" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

/* Diálogo de Alteração de Senha */
function DialogSenha({ mode, current, novo, confirmar, onSave, onClose }) {
  const [fields, setFields] = useState({ atual: '', novo: '', confirmar: '' })
  const [dialogError, setDialogError] = useState('')

  useEffect(() => {
    setFields({ atual: current || '', novo: novo || '', confirmar: confirmar || '' })
    setDialogError('')
  }, [current, novo, confirmar])

  const handleSave = async (e) => {
    e.preventDefault()
    const { atual, novo, confirmar } = fields

    // Validar
    if (!atual || !novo || !confirmar) {
      setDialogError('Preencha todos os campos da senha.')
      return
    }
    if (novo !== confirmar) {
      setDialogError('As novas senhas não conferem.')
      return
    }
    if (novo.length < 6) {
      setDialogError('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setDialogError('')
    onSave({ atual, novo, confirmar })
  }

  return (
    <div className="perfil-dialog-overlay">
      <div className="perfil-dialog">
        <div className="perfil-dialog-header">
          <span>Alterar Senha</span>
          <button className="perfil-dialog-close" onClick={onClose}>
            <span className="mat">close</span>
          </button>
        </div>
        <div className="perfil-dialog-body">
          {dialogError && <div className="perfil-message error" role="alert">{dialogError}</div>}
          <form onSubmit={(e) => { e.preventDefault(); handleSave(e) }}>
            <div className="perfil-grid-row">
              <label className="perfil-label">Senha Atual</label>
              <input className="perfil-input" type="password" value={fields.atual} onChange={(e) => setFields({ ...fields, atual: e.target.value })} />
            </div>
            <div className="perfil-grid-row">
              <label className="perfil-label">Nova Senha</label>
              <input className="perfil-input" type="password" value={fields.novo} onChange={(e) => setFields({ ...fields, novo: e.target.value })} />
            </div>
            <div className="perfil-grid-row">
              <label className="perfil-label">Confirmar Nova Senha</label>
              <input className="perfil-input" type="password" value={fields.confirmar} onChange={(e) => setFields({ ...fields, confirmar: e.target.value })} />
            </div>
          </form>
        </div>
        <div className="perfil-dialog-footer">
          <button className="perfil-dialog-btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="perfil-dialog-btn-salvar" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  )
}