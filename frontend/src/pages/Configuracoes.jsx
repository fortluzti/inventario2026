import { useEffect, useRef, useState } from 'react'
import {
  EMPTY_EMPRESA, MODULE_SCOPES, SCOPE_LABELS,
  carregarEmpresa, salvarEmpresa, uploadLogo, logoUrl, hasLogo, getLogoUrl,
  listarApiKeys, criarApiKey, revogarApiKey, downloadBackup,
  gerarBackup, verificarBanco, adaptarBanco,
  carregarLicenca, salvarSerial,
  formatarCNPJ,
} from '../api/configuracoes.js'
import { useCep, formatarCEP as formatarCEPInput } from '../hooks/useCep.js'
import { ConfirmDialog, NewApiKeyDialog, GeneratedKeyDialog } from '../components/ConfigModals.jsx'
import './Configuracoes.css'

const TABS = [
  { id: 'empresa',    label: 'Dados da Empresa',        icon: 'business' },
  { id: 'manutencao', label: 'Manutenção do Sistema',   icon: 'build' },
  { id: 'integracoes', label: 'Integrações e Licença',  icon: 'key'},
]

const BK = { IDLE: 'idle', LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' }

function fmtScopes(scopes) {
  if (!scopes || scopes === '*') return 'Todas as permissões'
  return scopes.split(',').map((s) => SCOPE_LABELS[s] || s).join(', ')
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—'
  const dt = new Date(String(dateStr).replace(' ', 'T'))
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i]
}

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useState('empresa')

  /* ---- Dados da Empresa ---- */
  const [empresa, setEmpresa]   = useState({ ...EMPTY_EMPRESA })
  const [origEmpresa, setOrigEmpresa] = useState({ ...EMPTY_EMPRESA })
  const [empresaLoading, setEmpresaLoading] = useState(true)
  const [empresaError, setEmpresaError] = useState('')
  const [salvando, setSalvando] = useState(false)
  const saveLock = useRef(false)
  const [saveMsg, setSaveMsg] = useState(null)

  /* ---- API Keys ---- */
  const [apiKeys, setApiKeys] = useState([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [apiKeysError, setApiKeysError] = useState('')
  const [keysRevision, setKeysRevision] = useState(0)
  const [keyVisibility, setKeyVisibility] = useState({})
  const [revogandoId, setRevogandoId] = useState(null)

  /* ---- Modais ---- */
  const [newKeyOpen, setNewKeyOpen] = useState(false)
  const [generatedKey, setGeneratedKey] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)

  /* ---- Manutenção ---- */
  const [backupState, setBackupState] = useState({ ...BK, data: null, error: '' })
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyData, setVerifyData] = useState(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [adaptOpen, setAdaptOpen] = useState(false)
  const [adaptData, setAdaptData] = useState(null)
  const [adaptLoading, setAdaptLoading] = useState(false)
  const [adaptError, setAdaptError] = useState('')

  /* ---- Licença ---- */
  const [licenca, setLicenca] = useState({ serial: '', status: 'nao_validada', mensagem: '' })
  const [licencaLoading, setLicencaLoading] = useState(true)
  const [serialSalvando, setSerialSalvando] = useState(false)
  const [serialMsg, setSerialMsg] = useState(null)
  const serialLock = useRef(false)

  /* ---- Logo ---- */
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const fileInputRef = useRef(null)

  /* ---- Carregamento inicial ---- */
  useEffect(() => {
    loadEmpresa()
    loadLicenca()
  }, [])

  useEffect(() => {
    loadApiKeys()
  }, [keysRevision])

   const empresaDirty = JSON.stringify(empresa) !== JSON.stringify(origEmpresa)

  const { fetchCep: buscarCep, loading: cepLoading, error: cepError } = useCep((addr) => {
    setEmpresa((prev) => ({
      ...prev,
      empresa_logradouro: addr.logradouro,
      empresa_bairro: addr.bairro,
      empresa_cidade: addr.cidade,
      empresa_estado: addr.estado,
    }))
  })

  /* ---- Keyboard: Ctrl+S salva empresa ---- */
  useEffect(() => {
    function onKey(e) {
      if (document.querySelector('.cfg-dialog')) return
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 's' && activeTab === 'empresa' && empresaDirty && !salvando) {
          e.preventDefault()
          salvarEmpresaHandler()
        }
        if (e.key.toLowerCase() === 'n' && activeTab === 'integracoes') {
          e.preventDefault()
          setNewKeyOpen(true)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, empresaDirty, salvando])

  /* ===================== Carregar/Salvar Empresa ===================== */

  async function loadEmpresa() {
    setEmpresaLoading(true)
    setEmpresaError('')
    try {
      const cfg = await carregarEmpresa()
      setEmpresa(cfg)
      setOrigEmpresa(cfg)
      if (cfg.empresa_logo) setLogoPreview(logoUrl(cfg.empresa_logo))
    } catch (e) {
      setEmpresaError(e.message)
    } finally {
      setEmpresaLoading(false)
    }
  }

  async function salvarEmpresaHandler() {
    if (saveLock.current || salvando) return
    saveLock.current = true
    setSalvando(true)
    setSaveMsg(null)
    try {
      await salvarEmpresa(empresa)
      setOrigEmpresa({ ...empresa })
      setSaveMsg({ type: 'success', text: 'Configurações salvas com sucesso.' })
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.message })
    } finally {
      setSalvando(false)
      saveLock.current = false
    }
  }

  function cancelarEmpresa() {
    setEmpresa({ ...origEmpresa })
    setSaveMsg(null)
    if (origEmpresa.empresa_logo) {
      setLogoPreview(logoUrl(origEmpresa.empresa_logo))
    } else {
      setLogoPreview('')
    }
    setLogoError('')
  }

  /* ===================== API Keys ===================== */

  async function loadApiKeys() {
    setApiKeysLoading(true)
    setApiKeysError('')
    try {
      const items = await listarApiKeys()
      setApiKeys(items)
    } catch (e) {
      setApiKeysError(e.message)
    } finally {
      setApiKeysLoading(false)
    }
  }

  async function handleCriarApiKey(dados) {
    const result = await criarApiKey(dados)
    setGeneratedKey(result)
    setKeysRevision((v) => v + 1)
    return result
  }

  function handleRevogar(id) {
    const key = apiKeys.find((k) => k.id === id)
    setConfirmDialog({
      title: 'Revogar API Key?',
      message: `A chave "${key?.nome}" será revogada e deixará de funcionar imediatamente.`,
      detail: 'Esta ação não pode ser desfeita. A chave permanecerá no histórico por motivos de auditoria.',
      confirmLabel: 'Revogar Chave',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        setRevogandoId(id)
        setConfirmDialog(null)
        try {
          await revogarApiKey(id)
          setKeysRevision((v) => v + 1)
        } catch (e) {
          setConfirmDialog({
            title: 'Erro',
            message: e.message,
            confirmLabel: 'OK',
            cancelLabel: null,
            onConfirm: () => setConfirmDialog(null),
            onCancel: () => setConfirmDialog(null),
          })
        } finally {
          setRevogandoId(null)
        }
      },
    })
  }

  function toggleKeyVisibility(id) {
    setKeyVisibility((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function copiarKey(id) {
    const key = apiKeys.find((k) => k.id === id)
    const visivel = keyVisibility[id]
    const text = visivel && key?.key_masked ? key.key_masked : '••••••••••••••••'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback silencioso
    }
  }

  /* ===================== Manutenção do Banco ===================== */

  async function handleBackup() {
    setBackupState({ ...BK, status: 'loading', data: null, error: '' })
    try {
      const result = await gerarBackup()
      setBackupState({ status: 'success', data: result, error: '' })
    } catch (e) {
      setBackupState({ status: 'error', data: null, error: e.message })
    }
  }

  async function handleVerificar() {
    setVerifyOpen(true)
    setVerifyLoading(true)
    setVerifyError('')
    try {
      const result = await verificarBanco()
      setVerifyData(result)
    } catch (e) {
      setVerifyError(e.message)
    } finally {
      setVerifyLoading(false)
    }
  }

  async function handleAdaptar() {
    setConfirmDialog({
      title: 'Deseja realmente adaptar a estrutura do banco?',
      message: 'Esta operação criará tabelas e colunas ausentes para alinhar o banco com a estrutura esperada pelo sistema.',
      detail: 'A alteração é executada via DDL (CREATE TABLE / ALTER TABLE). Recomenda-se um backup antes de prosseguir.',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null)
        setAdaptOpen(true)
        setAdaptLoading(true)
        setAdaptError('')
        try {
          const result = await adaptarBanco()
          setAdaptData(result)
        } catch (e) {
          setAdaptError(e.message)
        } finally {
          setAdaptLoading(false)
        }
      },
    })
  }

  /* ===================== Licença ===================== */

  async function loadLicenca() {
    setLicencaLoading(true)
    try {
      const data = await carregarLicenca()
      setLicenca(data)
    } catch (e) {
      setLicenca({ serial: '', status: 'nao_validada', mensagem: `Erro ao carregar: ${e.message}` })
    } finally {
      setLicencaLoading(false)
    }
  }

  async function salvarSerialHandler() {
    if (serialLock.current || serialSalvando) return
    serialLock.current = true
    setSerialSalvando(true)
    setSerialMsg(null)
    try {
      await salvarSerial({ serial: licenca.serial })
      setSerialMsg({ type: 'success', text: 'Serial salvo com sucesso.' })
    } catch (e) {
      setSerialMsg({ type: 'error', text: e.message })
    } finally {
      setSerialSalvando(false)
      serialLock.current = false
    }
  }

  /* ===================== Logo ===================== */

  function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setLogoError('Formato invalido. Use PNG, JPG, GIF, SVG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Arquivo muito grande. Limite: 5 MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setLogoPreview(objectUrl)
    setLogoUploading(true)
    uploadLogo(file)
      .then((result) => {
        setEmpresa((prev) => ({ ...prev, empresa_logo: result.file }))
        URL.revokeObjectURL(objectUrl)
        setLogoPreview(logoUrl(result.file))
      })
      .catch((e) => {
        setLogoError(e.message)
      })
      .finally(() => setLogoUploading(false))
  }

  function removerLogo() {
    setEmpresa((prev) => ({ ...prev, empresa_logo: '' }))
    setLogoPreview('')
    setLogoError('')
  }

  /* ===================== Render ===================== */

  /* ---- Tab 1: Dados da Empresa ---- */
  function renderEmpresa() {
    if (empresaLoading) {
      return <div className="cfg-message" role="status">Carregando configurações…</div>
    }
    if (empresaError) {
      return (
        <div className="cfg-message error" role="alert">
          {empresaError}
          <button className="cfg-btn" onClick={loadEmpresa}>Tentar novamente</button>
        </div>
      )
    }

    const f = empresa
    return (
      <form id="cfg-form-empresa" className="cfg-form" onSubmit={(e) => { e.preventDefault(); salvarEmpresaHandler() }} noValidate>
        <section className="cfg-section">
          <h2 className="cfg-section-title">Dados da Empresa</h2>
          <p className="cfg-section-subtitle">Informações utilizadas pelo sistema, relatórios e documentos.</p>

          <div className="cfg-form-grid">
            <div className="cfg-field full">
              <label htmlFor="cfg-nome">Nome da Empresa <b className="cfg-required">*</b></label>
              <input
                id="cfg-nome"
                className="cfg-input"
                placeholder="Nome completo da empresa"
                value={f.empresa_nome || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_nome: e.target.value })}
                maxLength={150}
                required
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-cnpj">CNPJ</label>
              <input
                id="cfg-cnpj"
                className="cfg-input"
                placeholder="00.000.000/0001-00"
                value={f.empresa_cnpj || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_cnpj: formatarCNPJ(e.target.value) })}
                maxLength={18}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-telefone">Telefone / Contato</label>
              <input
                id="cfg-telefone"
                className="cfg-input"
                placeholder="(11) 3000-0000"
                value={f.empresa_telefone || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_telefone: e.target.value })}
                maxLength={30}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-email">E-mail</label>
              <input
                id="cfg-email"
                className="cfg-input"
                type="email"
                placeholder="contato@empresa.com.br"
                value={f.empresa_email || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_email: e.target.value })}
                maxLength={150}
              />
            </div>
          </div>
        </section>

        <section className="cfg-section">
          <h2 className="cfg-section-title">Endereço</h2>

          <div className="cfg-form-grid">
            <div className="cfg-field">
              <label htmlFor="cfg-cep">CEP</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="cfg-cep"
                  className="cfg-input"
                  placeholder="00000-000"
                  value={f.empresa_cep || ''}
                  onChange={(e) => {
                    const formatted = formatarCEPInput(e.target.value)
                    setEmpresa({ ...f, empresa_cep: formatted })
                    if (formatted.replace(/\D/g, '').length === 8) {
                      buscarCep(formatted)
                    }
                  }}
                  maxLength={9}
                  style={{ paddingRight: cepLoading || cepError ? 28 : undefined }}
                />
                {(cepLoading || cepError) && (
                  <span
                    className="mat"
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 14,
                      color: cepError ? '#ba1a1a' : '#0055a4',
                    }}
                    aria-label={cepLoading ? 'Carregando' : 'Erro'}
                  >
                    {cepLoading ? 'sync' : 'error'}
                  </span>
                )}
              </div>
              {cepError && <div className="cfg-hint error">{cepError}</div>}
            </div>

            <div className="cfg-field full">
              <label htmlFor="cfg-logradouro">Logradouro</label>
              <input
                id="cfg-logradouro"
                className="cfg-input"
                placeholder="Rua, Avenida, etc."
                value={f.empresa_logradouro || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_logradouro: e.target.value })}
                maxLength={200}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-numero">Número</label>
              <input
                id="cfg-numero"
                className="cfg-input"
                placeholder="123"
                value={f.empresa_numero || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_numero: e.target.value })}
                maxLength={20}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-complemento">Complemento</label>
              <input
                id="cfg-complemento"
                className="cfg-input"
                placeholder="Apto, Sala, etc."
                value={f.empresa_complemento || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_complemento: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-bairro">Bairro</label>
              <input
                id="cfg-bairro"
                className="cfg-input"
                placeholder="Bairro"
                value={f.empresa_bairro || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_bairro: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-cidade">Cidade</label>
              <input
                id="cfg-cidade"
                className="cfg-input"
                placeholder="Cidade"
                value={f.empresa_cidade || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_cidade: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="cfg-field">
              <label htmlFor="cfg-estado">Estado</label>
              <input
                id="cfg-estado"
                className="cfg-input"
                placeholder="SP"
                value={f.empresa_estado || ''}
                onChange={(e) => setEmpresa({ ...f, empresa_estado: e.target.value.toUpperCase() })}
                maxLength={2}
              />
            </div>
          </div>
        </section>

        <section className="cfg-section">
          <h2 className="cfg-section-title">Logotipo da Empresa</h2>

          <div className="cfg-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleLogoSelect({ target: { files: e.dataTransfer.files } }) }}>
            {logoPreview ? (
              <div className="cfg-logo-preview">
                <img src={logoPreview} alt="Preview do logotipo" className="cfg-logo-img" />
                <div className="cfg-logo-overlay">
                  <button
                    type="button"
                    className="cfg-btn cfg-btn-icon"
                    title="Selecionar outro arquivo"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="mat" aria-hidden="true">edit</span>
                  </button>
                  <button
                    type="button"
                    className="cfg-btn cfg-btn-icon danger"
                    title="Remover logotipo"
                    onClick={removerLogo}
                  >
                    <span className="mat" aria-hidden="true">delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="mat" style={{ fontSize: 32, color: 'var(--text-muted)' }}>image</span>
                <div>
                  <button
                    type="button"
                    className="cfg-btn cfg-btn-primary"
                    disabled={logoUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="mat" aria-hidden="true">upload</span>
                    {logoUploading ? 'Enviando…' : 'Selecionar arquivo'}
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              style={{ display: 'none' }}
              onChange={handleLogoSelect}
            />
          </div>
          {logoError && <div className="cfg-hint error">{logoError}</div>}
          <small className="cfg-hint">O logotipo será utilizado em documentos e relatórios gerados pelo sistema. Formatos aceitos: PNG, JPG, GIF, SVG, WebP (máx. 5 MB).</small>
        </section>

        <div className="cfg-form-actions">
          {saveMsg && (
            <span className={`cfg-save-status ${saveMsg.type === 'success' ? 'ok' : 'error'}`}>
              <span className="mat" aria-hidden="true">{saveMsg.type === 'success' ? 'check_circle' : 'error'}</span>
              {saveMsg.text}
            </span>
          )}
          <div className="cfg-actions">
            <button
              type="button"
              className="cfg-btn"
              disabled={!empresaDirty || salvando}
              onClick={cancelarEmpresa}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="cfg-btn cfg-btn-primary"
              disabled={!empresaDirty || salvando || !f.empresa_nome.trim()}
            >
              {salvando ? 'Salvando…' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </form>
    )
  }

  /* ---- Tab 2: Manutenção do Sistema ---- */
  function renderManutencao() {
    return (
      <div className="cfg-maintenance">
        <div className="cfg-sub-title">
          <h2>Manutenção do Sistema</h2>
          <p>Ferramentas administrativas para manutenção e segurança do banco de dados.</p>
        </div>

        {/* Card 1: Backup */}
        <section className="cfg-card">
          <div className="cfg-card-header">
            <span className="cfg-card-icon mat" aria-hidden="true">save</span>
            <div>
              <h3>Backup do Banco de Dados</h3>
              <p>Gere uma cópia completa do banco de dados para recuperação ou segurança.</p>
            </div>
          </div>
          <div className="cfg-card-body">
            {backupState.status === 'idle' && (
              <button className="cfg-btn cfg-btn-primary" type="button" onClick={handleBackup}>
                <span className="mat" aria-hidden="true">save</span>
                Gerar Backup
              </button>
            )}
            {backupState.status === 'loading' && (
              <button className="cfg-btn cfg-btn-primary" type="button" disabled>
                <span className="mat" aria-hidden="true" style={{ animation: 'cfg-spin 1s linear infinite' }}>sync</span>
                Gerando backup…
              </button>
            )}
            {backupState.status === 'success' && backupState.data && (
              <div className="cfg-backup-result">
                <div className="cfg-message">
                  <span className="mat" aria-hidden="true">check_circle</span>
                  Backup gerado com sucesso.
                </div>
                <div className="cfg-backup-info">
                  <div><strong>Arquivo:</strong> <span className="mono">{backupState.data.file}</span></div>
                  <div><strong>Tamanho:</strong> {fmtBytes(backupState.data.size)}</div>
                  <div><strong>SHA-256:</strong> <span className="mono" style={{ fontSize: 10 }}>{backupState.data.sha256}</span></div>
                  <div><strong>Data:</strong> {fmtDateTime(backupState.data.created_at)}</div>
                </div>
                <div className="cfg-actions">
                  <button
                    className="cfg-btn cfg-btn-primary"
                    type="button"
                    onClick={() => downloadBackup(backupState.data.file)}
                  >
                    <span className="mat" aria-hidden="true">download</span>
                    Baixar Backup
                  </button>
                  <button className="cfg-btn" type="button" onClick={handleBackup}>
                    <span className="mat" aria-hidden="true">refresh</span>
                    Novo Backup
                  </button>
                </div>
              </div>
            )}
            {backupState.status === 'error' && (
              <div className="cfg-message error" role="alert">
                <span className="mat" aria-hidden="true">error</span>
                {backupState.error}
                <button className="cfg-btn" onClick={handleBackup}>Tentar novamente</button>
              </div>
            )}
          </div>
        </section>

        {/* Card 2: Verificar Banco */}
        <section className="cfg-card">
          <div className="cfg-card-header">
            <span className="cfg-card-icon mat" aria-hidden="true">search</span>
            <div>
              <h3>Verificar Estrutura do Banco</h3>
              <p>Verifique se a estrutura atual do banco está compatível com a estrutura esperada pelo sistema.</p>
            </div>
          </div>
          <div className="cfg-card-body">
            {verifyLoading && (
              <button className="cfg-btn" type="button" disabled>
                <span className="mat" aria-hidden="true" style={{ animation: 'cfg-spin 1s linear infinite' }}>sync</span>
                Verificando banco…
              </button>
            )}
            {!verifyLoading && !verifyData && (
              <button className="cfg-btn" type="button" onClick={handleVerificar}>
                <span className="mat" aria-hidden="true">search</span>
                Verificar Banco
              </button>
            )}
            {verifyError && (
              <div className="cfg-message error" role="alert">
                <span className="mat" aria-hidden="true">error</span>
                {verifyError}
              </div>
            )}
            {verifyData && (
              <div className="cfg-verify-result">
                {verifyData.status_geral === 'ok' ? (
                  <div className="cfg-message">
                    <span className="mat" aria-hidden="true">check_circle</span>
                    Estrutura compatível. Nenhuma inconsistência encontrada.
                  </div>
                ) : verifyData.status_geral === 'critical' ? (
                  <div className="cfg-message error" role="alert">
                    <span className="mat" aria-hidden="true">error</span>
                    Estrutura com problemas críticos. Corrija antes de continuar.
                  </div>
                ) : (
                  <div className="cfg-message" style={{ background: 'var(--warn-bg)', color: 'var(--warn-fg)', border: '1px solid var(--warn-bd)' }}>
                    <span className="mat" aria-hidden="true">warning</span>
                    Estrutura com itens que precisam de atenção.
                  </div>
                )}

                <div className="cfg-verify-summary">
                  <div className="cfg-verify-row"><span>Status geral</span><strong style={{ color: verifyData.status_geral === 'ok' ? '#005852' : verifyData.status_geral === 'critical' ? '#ba1a1a' : '#b45309' }}>
                    {verifyData.status_geral === 'ok' ? 'OK' : verifyData.status_geral === 'critical' ? 'CRÍTICO' : 'ATENÇÃO'}
                  </strong></div>
                  <div className="cfg-verify-row"><span>Tabelas verificadas</span><strong>{verifyData.tabelas_verificadas}</strong></div>
                  <div className="cfg-verify-row"><span>Tabelas OK</span><strong>{verifyData.tabelas_ok}</strong></div>
                  {verifyData.tabelas_faltando.length > 0 && (
                    <div className="cfg-verify-row"><span>Tabelas ausentes</span><strong style={{ color: '#ba1a1b' }}>{verifyData.tabelas_faltando.join(', ')}</strong></div>
                  )}
                  {Object.keys(verifyData.colunas_faltando || {}).length > 0 && (
                    <div className="cfg-verify-row">
                      <span>Colunas ausentes</span>
                      <strong style={{ color: '#b45309' }}>
                        {Object.entries(verifyData.colunas_faltando).map(([t, cols]) => `${t} (${cols.join(', ')})`).join('; ')}
                      </strong>
                    </div>
                  )}
                </div>

                {verifyData.status_geral !== 'ok' && (
                  <button className="cfg-btn cfg-btn-primary" type="button" onClick={handleAdaptar}>
                    <span className="mat" aria-hidden="true">construction</span>
                    Adaptar Banco Agora
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Card 3: Adaptar Banco */}
        <section className="cfg-card">
          <div className="cfg-card-header">
            <span className="cfg-card-icon mat" aria-hidden="true">construction</span>
            <div>
              <h3>Adaptar Estrutura do Banco</h3>
              <p>Crie tabelas ou ajuste colunas ausentes conforme a estrutura esperada pelo sistema.</p>
            </div>
          </div>
          <div className="cfg-card-body">
            {adaptLoading && (
              <button className="cfg-btn cfg-btn-primary" type="button" disabled>
                <span className="mat" aria-hidden="true" style={{ animation: 'cfg-spin 1s linear infinite' }}>sync</span>
                Adaptando estrutura…
              </button>
            )}
            {!adaptLoading && !adaptData && (
              <button className="cfg-btn cfg-btn-primary" type="button" onClick={handleAdaptar}>
                <span className="mat" aria-hidden="true">construction</span>
                Adaptar Banco
              </button>
            )}
            {adaptError && (
              <div className="cfg-message error" role="alert">
                <span className="mat" aria-hidden="true">error</span>
                {adaptError}
              </div>
            )}
            {adaptData && (
              <div className="cfg-adapt-result">
                <div className="cfg-message">
                  <span className="mat" aria-hidden="true">check_circle</span>
                  Adaptação concluída. {adaptData.total} alteração(ões) aplicadas.
                </div>
                <div style={{ marginTop: 8 }}>
                  <table className="cfg-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr><th>Tabela</th><th>Ação</th><th>Coluna</th></tr>
                    </thead>
                    <tbody>
                      {adaptData.alteracoes.map((a, i) => (
                        <tr key={i}>
                          <td>{a.table}</td>
                          <td>{a.action === 'created' ? 'Criada' : a.action === 'added' ? 'Adicionada' : a.action === 'missing_migration' ? 'Pendente' : a.action}</td>
                          <td>{a.column || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  /* ---- Tab 3: Integrações e Licença ---- */
  function renderIntegracoes() {
    return (
      <div className="cfg-integrations">
        <div className="cfg-sub-title">
          <h2>Integrações e Licença</h2>
          <p>Gerencie credenciais de integração e prepare o sistema para o futuro mecanismo de licenciamento.</p>
        </div>

        {/* API Keys */}
        <section className="cfg-section">
          <div className="cfg-section-head">
            <h2 className="cfg-section-title">API Keys</h2>
            <span className="badge badge-dev" style={{ marginTop: -4 }}>EM DESENVOLVIMENTO</span>
          </div>
          <p className="cfg-section-subtitle">Chaves utilizadas para autenticar aplicações e dispositivos externos que acessam a API do sistema.</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <button
              className="cfg-btn cfg-btn-primary"
              type="button"
              onClick={() => setNewKeyOpen(true)}
            >
              <span className="mat" aria-hidden="true">add</span>
              Nova API Key
            </button>
          </div>

          {apiKeysLoading && (
            <div className="cfg-message" role="status">
              <span className="mat" aria-hidden="true">sync</span>
              Carregando chaves de API…
            </div>
          )}
          {apiKeysError && (
            <div className="cfg-message error" role="alert">
              <span className="mat" aria-hidden="true">error</span>
              {apiKeysError}
              <button className="cfg-btn" onClick={() => setKeysRevision((v) => v + 1)}>Tentar novamente</button>
            </div>
          )}
          {!apiKeysLoading && !apiKeysError && apiKeys.length === 0 && (
            <div className="cfg-empty">
              <span className="mat" style={{ fontSize: 32, color: 'var(--text-muted)' }}>key</span>
              <p>Nenhuma API Key cadastrada.</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Clique em "Nova API Key" para criar a primeira chave.</p>
            </div>
          )}
          {!apiKeysLoading && apiKeys.length > 0 && (
            <div className="cfg-table-wrap">
              <table className="cfg-table">
                <caption className="cfg-sr-only">Lista de API Keys cadastradas</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 192 }}>Identificação</th>
                    <th scope="col" style={{ width: 240 }}>API Key</th>
                    <th scope="col" style={{ width: 200 }}>Permissões</th>
                    <th scope="col" style={{ width: 96 }}>Status</th>
                    <th scope="col" style={{ width: 132 }}>Criada em</th>
                    <th scope="col" style={{ width: 96 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => {
                    const visivel = !!keyVisibility[k.id]
                    const displayKey = visivel && k.key_masked ? k.key_masked : '•'.repeat(20)
                    const isAtiva = k.ativo === 1 || k.ativo === '1' || k.ativo === true
                    return (
                      <tr key={k.id}>
                        <td><strong>{k.nome || '—'}</strong></td>
                        <td className="mono">{displayKey}</td>
                        <td>{fmtScopes(k.scopes)}</td>
                        <td>
                          <span className={`badge ${isAtiva ? 'badge-ok' : 'badge-crit'}`}>
                            {isAtiva ? 'Ativa' : 'Revogada'}
                          </span>
                        </td>
                        <td style={{ fontSize: 10 }}>{fmtDateTime(k.criado_em)}</td>
                        <td>
                          <div className="cfg-actions">
                            <button
                              className="cfg-btn cfg-btn-icon"
                              type="button"
                              title={visivel ? 'Ocultar chave' : 'Mostrar chave'}
                              aria-label={visivel ? 'Ocultar chave' : 'Mostrar chave'}
                              disabled={k.ativo !== 1 && k.ativo !== '1' && k.ativo !== true}
                              onClick={() => toggleKeyVisibility(k.id)}
                            >
                              <span className="mat" aria-hidden="true">{visivel ? 'visibility_off' : 'visibility'}</span>
                            </button>
                            <button
                              className="cfg-btn cfg-btn-icon"
                              type="button"
                              title="Copiar"
                              aria-label="Copiar API Key"
                              disabled={k.ativo !== 1 && k.ativo !== '1' && k.ativo !== true}
                              onClick={() => copiarKey(k.id)}
                            >
                              <span className="mat" aria-hidden="true">copy</span>
                            </button>
                            <button
                              className="cfg-btn cfg-btn-icon danger"
                              type="button"
                              title="Revogar"
                              aria-label="Revogar API Key"
                              disabled={revogandoId === k.id || (k.ativo !== 1 && k.ativo !== '1' && k.ativo !== true)}
                              onClick={() => handleRevogar(k.id)}
                            >
                              {revogandoId === k.id ? (
                                <span className="mat" style={{ animation: 'cfg-spin 1s linear infinite' }}>sync</span>
                              ) : (
                                <span className="mat" aria-hidden="true">delete</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Licença */}
        <section className="cfg-section">
          <div className="cfg-section-head">
            <h2 className="cfg-section-title">Licença do Sistema</h2>
            <span className="badge badge-dev">EM DESENVOLVIMENTO</span>
          </div>
          <p className="cfg-section-subtitle">
            O sistema futuramente utilizará licenças para controlar o uso e habilitar recursos conforme o plano contratado.
          </p>

          {licencaLoading ? (
            <div className="cfg-message" role="status">
              <span className="mat" aria-hidden="true">sync</span>
              Carregando licença…
            </div>
          ) : (
            <>
              <div className="cfg-field" style={{ maxWidth: 480, marginBottom: 8 }}>
                <label htmlFor="cfg-serial">Serial de Uso do Sistema</label>
                <input
                  id="cfg-serial"
                  className="cfg-input"
                  placeholder="Informe o serial de uso do sistema"
                  value={licenca.serial || ''}
                  onChange={(e) => setLicenca({ ...licenca, serial: e.target.value.toUpperCase() })}
                  maxLength={200}
                  disabled={serialSalvando}
                />
                {serialMsg && (
                  <span className={`cfg-save-status ${serialMsg.type === 'success' ? 'ok' : 'error'}`}>
                    <span className="mat" aria-hidden="true">{serialMsg.type === 'success' ? 'check_circle' : 'error'}</span>
                    {serialMsg.text}
                  </span>
                )}
              </div>
              <div className="cfg-field" style={{ marginBottom: 8 }}>
                <label>Status da Licença</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span className="badge badge-dev" style={{ padding: '2px 8px', fontSize: 9 }}>
                    Não validada
                  </span>
                  <small className="cfg-hint">Esta tela estará preparada para futuramente apresentar: válida, expirada, inválida ou em análise.</small>
                </div>
              </div>
              <div className="cfg-actions">
                <button
                  type="button"
                  className="cfg-btn cfg-btn-primary"
                  disabled={serialSalvando || !licenca.serial.trim()}
                  onClick={salvarSerialHandler}
                >
                  {serialSalvando ? 'Salvando…' : 'Salvar Serial'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  return (
    <section className="cfg-page" aria-labelledby="cfg-page-title">
       <header className="cfg-page-header">
         <div className="cfg-page-title-row">
           {hasLogo(empresa) && (
             <img
               src={getLogoUrl(empresa)}
               alt={empresa.empresa_nome ? `${empresa.empresa_nome} logo` : 'Logo da empresa'}
               className="cfg-page-logo"
               onError={(e) => { e.currentTarget.style.display = 'none' }}
             />
           )}
           <div>
             <nav className="cfg-breadcrumb" aria-label="Filtragem atual">
               <span>Administração</span>
               <span>/</span>
               <span>Configurações do Sistema</span>
             </nav>
             <h1 id="cfg-page-title">
               <span className="mat" aria-hidden="true">settings</span>
               Configurações do Sistema
             </h1>
             <p className="cfg-subtitle">Configure informações gerais, execute manutenção e administre integrações.</p>
           </div>
         </div>
       </header>

      <nav className="cfg-tabs" role="tablist" aria-label="Seções">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`cfg-tab-${tab.id}`}
            className={`cfg-tab ${activeTab === tab.id ? 'active' : ''}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`cfg-panel-${tab.id}`}
            onClick={() => { setActiveTab(tab.id); setSaveMsg(null); setSerialMsg(null) }}
          >
            <span className="mat" aria-hidden="true">{tab.icon}</span>
            {tab.label}
            {tab.id === 'integracoes' && (
              <span className="badge badge-dev" style={{ height: 16, fontSize: 8, padding: '0 4px' }}>EM DEV</span>
            )}
          </button>
        ))}
      </nav>

      <div
        id="cfg-panel-empresa" role="tabpanel" aria-labelledby="cfg-tab-empresa"
        className="cfg-tabpanel"
        hidden={activeTab !== 'empresa'}
      >
        {activeTab === 'empresa' && renderEmpresa()}
      </div>

      <div
        id="cfg-panel-manutencao" role="tabpanel" aria-labelledby="cfg-tab-manutencao"
        className="cfg-tabpanel"
        hidden={activeTab !== 'manutencao'}
      >
        {activeTab === 'manutencao' && renderManutencao()}
      </div>

      <div
        id="cfg-panel-integracoes" role="tabpanel" aria-labelledby="cfg-tab-integracoes"
        className="cfg-tabpanel"
        hidden={activeTab !== 'integracoes'}
      >
        {activeTab === 'integracoes' && renderIntegracoes()}
      </div>

        {/* Modais */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          detail={confirmDialog.detail}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          loading={!!confirmDialog.loading}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}

      {newKeyOpen && (
        <NewApiKeyDialog
          onClose={() => setNewKeyOpen(false)}
          onSaved={(dados) => handleCriarApiKey(dados)}
        />
      )}

      {generatedKey && (
        <GeneratedKeyDialog
          chave={generatedKey.key}
          onClose={() => setGeneratedKey(null)}
        />
      )}
    </section>
  )
}
