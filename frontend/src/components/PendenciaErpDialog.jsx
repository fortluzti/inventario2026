import { useEffect, useState, useRef } from 'react'
import { api } from '../api/client.js'
import { listarUsuarios as buscarUsuarios } from '../api/usuarios.js'
import { listarOpcoes as buscarFuncionarios } from '../api/funcionarios.js'
import { listarOpcoes as buscarSetores } from '../api/setores.js'
import { salvar as salvarAnexo, listar as listarAnexos, excluir as excluirAnexo } from '../api/anexos_erp.js'
import { registrarAtendimento } from '../api/atendimentos_erp.js'
import SearchableSelect, { toSearchOptions } from './SearchableSelect.jsx'
import { abrirModalConfirmacao, mostrarToast } from '../utils/modalUtils'
import { normalizarStatus, STATUS_AGUARDANDO_SUPORTE, STATUS_INICIAL } from '../utils/erpStatus.js'

const hoje = () => new Date().toISOString().slice(0, 10)
const agora = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

/**
 * PendenciaErpDialog - Modal para visualização, edição e envio ao suporte de pendências do ERP.
 * 
 * Modos:
 *   - 'new': Criar nova pendência
 *   - 'view': Visualizar pendência existente
 *   - 'edit': Editar pendência existente
 *   - 'enviar_suporte': Enviar pendência existente ao suporte
 */
export default function PendenciaErpDialog({ 
  user, 
  pendenciaId = null, 
  id = null,
  mode = 'new', 
  onClose, 
  onSaved 
}) {
  const targetId = pendenciaId || id
  const [pendencia, setPendencia] = useState(null)
  const [anexos, setAnexos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [setores, setSetores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState({
    codigo: '',
    titulo: '',
    descricao: '',
    modulo: '',
    versao_programa: '',
    prioridade: 'Média',
    setor: '',
    abrangencia: 'Todos os setores',
    identificado_por: '',
    data_identificacao: hoje(),
    status: STATUS_INICIAL,
    usuario_id: user?.id || '',
    observacoes: ''
  })
  const [anexoSelecionado, setAnexoSelecionado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [metodoEnvio, setMetodoEnvio] = useState('E-mail')
  const [destinatario, setDestinatario] = useState('')
  const [contato, setContato] = useState('')
  const [protocolo, setProtocolo] = useState('')
  const [observacoesEnvio, setObservacoesEnvio] = useState('')
  const [anexosParaEnviar, setAnexosParaEnviar] = useState([]) // IDs dos anexos selecionados para envio
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const dialogRef = useRef(null)
  const arquivoInputRef = useRef(null)

  useEffect(() => {
    let ativo = true
    const carregarDados = async () => {
      try {
        setCarregando(true)
        setError('')
        
        // Carregar listas de referência
        const [users, funcs, setors] = await Promise.all([
          (await buscarUsuarios()).items,
          buscarFuncionarios(),
          buscarSetores()
        ])
        
        if (!ativo) return
        setUsuarios(users)
        setFuncionarios(funcs)
        setSetores(setors)
        
        // Se estiver em modo view/edit ou enviar_suporte, carregar a pendência
        if (targetId && (mode === 'view' || mode === 'edit' || mode === 'enviar_suporte')) {
          const pendenciaData = await api('pendencias_erp', 'buscar_por_id', { params: { id: targetId } })
          if (!ativo) return
          setPendencia(pendenciaData)
          
          // Preencher o formulário com os dados da pendência
          setForm({
            codigo: pendenciaData.codigo || '',
            titulo: pendenciaData.titulo || '',
            descricao: pendenciaData.descricao || '',
            modulo: pendenciaData.modulo || '',
            versao_programa: pendenciaData.versao_programa || '',
            prioridade: pendenciaData.prioridade || 'Média',
            setor: pendenciaData.setor || '',
            abrangencia: pendenciaData.abrangencia || 'Todos os setores',
            identificado_por: pendenciaData.identificado_por || '',
            data_identificacao: pendenciaData.data_identificacao 
              ? new Date(pendenciaData.data_identificacao).toISOString().slice(0, 10) 
              : hoje(),
            status: normalizarStatus(pendenciaData.status),
            usuario_id: pendenciaData.usuario_id || (user?.id || ''),
            observacoes: pendenciaData.observacoes || ''
          })
          
          // Carregar anexos
          const anexosData = await api('anexos_erp', 'listar', { 
            params: { 
              filters: { pendencia_id: targetId }, 
              page: 1, 
              limit: 100 
            } 
          })
          if (!ativo) return
          setAnexos(anexosData.items || [])
        } else if (mode === 'new' && user) {
          // Para novo registro, preencher com dados do usuário logado
          setForm({
            ...form,
            usuario_id: user?.id || '',
            identificado_por: `${user?.nome || ''} ${user?.sobrenome || ''}`.trim() || user?.usuario || '',
            data_identificacao: hoje()
          })
        }
      } catch (err) {
        if (ativo) setError(err.message)
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    
    carregarDados()
    return () => { ativo = false }
  }, [targetId, mode, user])

  useEffect(() => {
    if (pendencia && pendencia.id && mode === 'view') {
      // Em modo view, bloquear edição dos campos
      return
    }
  }, [pendencia, mode])

  function close() {
    if (!lock.current) onClose()
  }

  function onKey(e) {
    if (e.key === 'Escape') { 
      e.preventDefault(); 
      e.stopPropagation(); 
      close() 
    }
  }

  function change(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  function changeSelect(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  function changeCheckbox(e) {
    const { name, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: checked ? 'Sim' : 'Não' }))
    setError('')
  }

  function toggleAnexoSelecionado(anexoId) {
    setAnexosParaEnviar(prev => 
      prev.includes(anexoId) 
        ? prev.filter(id => id !== anexoId) 
        : [...prev, anexoId]
    )
  }

  function isAnexoSelecionado(anexoId) {
    return anexosParaEnviar.includes(anexoId)
  }

  function handleArquivoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    
    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo não pode exceder 10MB')
      return
    }
    
    setError('')
    // O upload será feito ao salvar
  }

  async function uploadAnexo(file) {
    const formData = new FormData()
    formData.append('arquivo', file)
    formData.append('pendencia_id', pendenciaId)
    formData.append('usuario_id', user?.id || '')
    
    try {
      const result = await salvarAnexo(formData)
      // Recarregar anexos após upload
      const anexosData = await api('anexos_erp', 'listar', { 
        params: { 
          filters: { pendencia_id: pendenciaId }, 
          page: 1, 
          limit: 100 
        } 
      })
      setAnexos(anexosData.items || [])
      mostrarToast('Anexo enviado com sucesso!')
    } catch (err) {
      throw new Error(`Erro ao enviar anexo: ${err.message}`)
    }
  }

  async function excluirAnexoFunc(anexoId) {
    if (!window.confirm('Excluir este anexo? Esta ação não pode ser desfeita.')) return
    
    try {
      await excluirAnexo(anexoId)
      // Recarregar anexos após exclusão
      const anexosData = await api('anexos_erp', 'listar', { 
        params: { 
          filters: { pendencia_id: pendenciaId }, 
          page: 1, 
          limit: 100 
        } 
      })
      setAnexos(anexosData.items || [])
      mostrarToast('Anexo excluído com sucesso!')
    } catch (err) {
      setError(`Erro ao excluir anexo: ${err.message}`)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (lock.current || saving) return
    
    // Validações básicas
    if (!form.titulo.trim()) {
      setError('O título é obrigatório')
      return
    }
    
    if (!form.descricao.trim()) {
      setError('A descrição é obrigatória')
      return
    }
    
    if (!form.modulo.trim()) {
      setError('O módulo é obrigatório')
      return
    }
    
    lock.current = true
    setSaving(true)
    setError('')
    
    try {
      let result
      if (mode === 'new' || mode === 'edit') {
        // Salvar/atualizar pendência
        const pendenciaData = {
          ...form,
          data_identificacao: form.data_identificacao ? new Date(form.data_identificacao).toISOString().slice(0, 19).replace('T', ' ') : undefined
        }
        
        if (mode === 'new') {
          result = await api('pendencias_erp', 'salvar', { 
            method: 'POST', 
            body: pendenciaData 
          })
          
          // Após criar a pendência, fazer upload de anexos se houver
          if (arquivoInputRef.current && arquivoInputRef.current.files[0]) {
            await uploadAnexo(arquivoInputRef.current.files[0])
          }
        } else {
          // Modo edit
          result = await api('pendencias_erp', 'salvar', { 
            method: 'POST', 
            body: { ...pendenciaData, id: targetId } 
          })
          
          // Após atualizar, fazer upload de anexos se houver
          if (arquivoInputRef.current && arquivoInputRef.current.files[0]) {
            await uploadAnexo(arquivoInputRef.current.files[0])
          }
        }
        
        if (!result) throw new Error('Resposta inválida da API')
        
        onSaved?.(
          mode === 'new' 
            ? 'Pendência criada com sucesso.' 
            : 'Pendência atualizada com sucesso.'
        )
      } else if (mode === 'enviar_suporte') {
        // Enviar pendência ao suporte
        if (anexosParaEnviar.length === 0) {
          setError('Selecione pelo menos um anexo para enviar')
          return
        }
        
        const atendimentoData = {
          pendencia_id: pendenciaId,
          usuario_id: user?.id || '',
          metodo_envio: metodoEnvio,
          destinatario: destinatario.trim(),
          contato: contato.trim(),
          protocolo: protocolo.trim(),
          observacoes: observacoesEnvio.trim(),
          anexos_ids: anexosParaEnviar.join(',')
        }
        
        await registrarAtendimento({
          ...atendimentoData,
          tipo_atendimento: 'Envio ao suporte',
          status_novo: STATUS_AGUARDANDO_SUPORTE
        })
        
        // Marcar anexos como enviados
        for (const anexoId of anexosParaEnviar) {
          await api('anexos_erp', 'salvar', { 
            method: 'POST', 
            body: { 
              id: anexoId, 
              enviado_ao_suporte: 1 
            } 
          })
        }
        
        onSaved?.('Pendência enviada ao suporte com sucesso.')
      }
      
      setMessage('')
    } catch (err) {
      setError(err.message)
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog" role="dialog" aria-modal="true" tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">
            {mode === 'new' ? 'add' : 
             mode === 'view' ? 'visibility' : 
             mode === 'edit' ? 'edit' : 
             'forward_to_inbox'}
          </span>
          <h2>
            {mode === 'new' ? 'Nova Pendência ERP' : 
             mode === 'view' ? 'Visualizar Pendência ERP' : 
             mode === 'edit' ? 'Editar Pendência ERP' : 
             'Enviar Pendência ao Suporte'}
          </h2>
          <span className="tnd-mode">{mode === 'enviar_suporte' ? 'OPERAÇÃO' : 'CADASTRO'}</span>
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>
        
        {carregando && <div className="tnd-dialog-loading">Carregando...</div>}
        
        {!carregando && (
          <>
            <form id="tnd-pendencia-form" className="tnd-form" onSubmit={submit}>
              {mode !== 'view' && (
                <>
                  <div className="tnd-form-grid">
                    <div className="tnd-field">
                      <label htmlFor="tnd-pendencia-titulo">Título *</label>
                      <input
                        id="tnd-pendencia-titulo"
                        name="titulo"
                        type="text"
                        className="tnd-input"
                        value={form.titulo}
                        onChange={change}
                        disabled={saving || mode === 'view'}
                        maxLength={255}
                      />
                    </div>
                    
                    <div className="tnd-field full">
                      <label htmlFor="tnd-pendencia-descricao">Descrição *</label>
                      <textarea
                        id="tnd-pendencia-descricao"
                        name="descricao"
                        className="tnd-input tnd-textarea"
                        rows={3}
                        value={form.descricao}
                        onChange={change}
                        disabled={saving || mode === 'view'}
                        maxLength={5000}
                      />
                    </div>
                    
                    <div className="tnd-form-row">
                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-modulo">Módulo *</label>
                        <select
                          id="tnd-pendencia-modulo"
                          name="modulo"
                          className="tnd-input"
                          value={form.modulo}
                          onChange={changeSelect}
                          disabled={saving || mode === 'view'}
                        >
                          <option value="">Selecione o módulo...</option>
                          <option value="Vendas / Faturamento">Vendas / Faturamento</option>
                          <option value="Financeiro &amp; Fiscal">Financeiro &amp; Fiscal</option>
                          <option value="Estoque &amp; Almoxarifado">Estoque &amp; Almoxarifado</option>
                          <option value="TI &amp; Infraestrutura">TI &amp; Infraestrutura</option>
                          <option value="Relatórios Corporativos">Relatórios Corporativos</option>
                          <option value="Compras &amp; Suprimentos">Compras &amp; Suprimentos</option>
                        </select>
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-prioridade">Prioridade</label>
                        <select
                          id="tnd-pendencia-prioridade"
                          name="prioridade"
                          className="tnd-input"
                          value={form.prioridade}
                          onChange={changeSelect}
                          disabled={saving || mode === 'view'}
                        >
                          <option value="Baixa">Baixa</option>
                          <option value="Média">Média</option>
                          <option value="Alta">Alta</option>
                          <option value="Crítica">Crítica</option>
                        </select>
                      </div>

                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-versao">Versão do ERP / Programa</label>
                        <input
                          id="tnd-pendencia-versao"
                          name="versao_programa"
                          type="text"
                          className="tnd-input"
                          placeholder="Ex: v2.4.1"
                          value={form.versao_programa}
                          onChange={change}
                          disabled={saving || mode === 'view'}
                          maxLength={50}
                        />
                      </div>
                    </div>
                    
                    <div className="tnd-form-row">
                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-setor">Setor</label>
                        <select
                          id="tnd-pendencia-setor"
                          name="setor"
                          className="tnd-input"
                          value={form.setor}
                          onChange={changeSelect}
                          disabled={saving || mode === 'view'}
                        >
                          <option value="">Não especificado</option>
                          <option value="TI">TI</option>
                          <option value="Financeiro">Financeiro</option>
                          <option value="Fiscal">Fiscal</option>
                          <option value="Faturamento">Faturamento</option>
                          <option value="Almoxarifado">Almoxarifado</option>
                          <option value="Vendas">Vendas</option>
                          <option value="RH / DP">RH / DP</option>
                        </select>
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-abrangencia">Abrangência</label>
                        <select
                          id="tnd-pendencia-abrangencia"
                          name="abrangencia"
                          className="tnd-input"
                          value={form.abrangencia}
                          onChange={changeSelect}
                          disabled={saving || mode === 'view'}
                        >
                          <option value="Todos os setores">Todos os setores</option>
                          <option value="Específico">Específico</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="tnd-form-row">
                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-identificado">Identificado por</label>
                        <input
                          id="tnd-pendencia-identificado"
                          name="identificado_por"
                          type="text"
                          className="tnd-input"
                          value={form.identificado_por}
                          onChange={change}
                          disabled={saving || mode === 'view'}
                          maxLength={200}
                        />
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-pendencia-data">Data de identificação</label>
                        <input
                          id="tnd-pendencia-data"
                          name="data_identificacao"
                          type="date"
                          className="tnd-input"
                          value={form.data_identificacao}
                          onChange={change}
                          disabled={saving || mode === 'view'}
                        />
                      </div>
                    </div>
                    
                    <div className="tnd-field">
                      <label htmlFor="tnd-pendencia-status">Status</label>
                      <select
                        id="tnd-pendencia-status"
                        name="status"
                        className="tnd-input"
                        value={form.status}
                        onChange={changeSelect}
                        disabled={saving || mode !== 'new'}
                      >
                        <option value={STATUS_INICIAL}>{STATUS_INICIAL}</option>
                        {form.status !== STATUS_INICIAL && <option value={form.status}>{form.status}</option>}
                      </select>
                      {mode !== 'new' && <small>Alterações de status são registradas em Responder / Atendimento.</small>}
                    </div>
                    
                    <div className="tnd-field">
                      <label htmlFor="tnd-pendencia-observacoes">Observações</label>
                      <textarea
                        id="tnd-pendencia-observacoes"
                        name="observacoes"
                        className="tnd-input tnd-textarea"
                        rows={2}
                        value={form.observacoes}
                        onChange={change}
                        disabled={saving || mode === 'view'}
                        maxLength={5000}
                      />
                    </div>
                  </div>
                  
                  {mode !== 'view' && (
                    <div className="tnd-form-full">
                      <fieldset className="tnd-fieldset">
                        <legend className="tnd-legend">Anexos</legend>
                        {anexos.length > 0 ? (
                          <div className="tnd-anexos-list">
                            {anexos.map((anexo) => (
                              <div key={anexo.id} className="tnd-anexo-item">
                                <div className="tnd-anexo-info">
                                  <span className="tnd-anexo-icon">
                                    {anexo.tipo_arquivo === 'PDF' ? 'picture_as_pdf' : 
                                     anexo.tipo_arquivo === 'PNG' || anexo.tipo_arquivo === 'JPG' || anexo.tipo_arquivo === 'JPEG' ? 'image' : 
                                     anexo.tipo_arquivo === 'TXT' ? 'description' : 
                                     'attach_file'}
                                  </span>
                                  <div>
                                    <strong>{anexo.nome_arquivo}</strong>
                                    <span className="tnd-anexo-details">
                                      {anexo.tipo_arquivo} • 
                                      {(anexo.tamanho_bytes / 1024).toFixed(1)} KB
                                    </span>
                                  </div>
                                </div>
                                <div className="tnd-anexo-actions">
                                  {mode !== 'view' && (
                                    <>
                                      <button 
                                        className="tnd-btn tnd-btn-icon" 
                                        title="Visualizar" 
                                        onClick={() => {
                                          // Implementar visualização do anexo
                                          alert('Visualização de anexo não implementada nesta versão')
                                        }}
                                      ><span className="mat">visibility</span></button>
                                      <button 
                                        className="tnd-btn tnd-btn-icon" 
                                        title="Remover" 
                                        onClick={() => excluirAnexoFunc(anexo.id)}
                                      ><span className="mat">delete</span></button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="tnd-anexos-empty">Nenhum anexo adicionado.</p>
                        )}
                        
                        {mode !== 'view' && (
                          <div className="tnd-anexo-upload">
                            <label className="tnd-anexo-upload-label">
                              <span className="mat">cloud_upload</span>
                              Selecionar arquivo para anexar
                            </label>
                            <input
                              ref={arquivoInputRef}
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.txt,.log"
                              onChange={handleArquivoChange}
                              style={{ display: 'none' }}
                            />
                            <button 
                              className="tnd-btn tnd-btn-outline" 
                              type="button" 
                              onClick={() => arquivoInputRef.current?.click()}
                              disabled={saving}
                            >
                              Selecionar Arquivo
                            </button>
                            {error && <div className="tnd-upload-error">{error}</div>}
                          </div>
                        )}
                      </fieldset>
                    </div>
                  )}
                </>
              )}
              
              {mode === 'enviar_suporte' && (
                <>
                  <fieldset className="tnd-fieldset">
                    <legend className="tnd-legend">Dados do Atendimento</legend>
                    <div className="tnd-form-grid">
                      <div className="tnd-field">
                        <label htmlFor="tnd-enviado-por">Enviado por</label>
                        <input
                          id="tnd-enviado-por"
                          name="enviado_por"
                          type="text"
                          className="tnd-input"
                          value={`${user?.nome || ''} ${user?.sobrenome || ''}`.trim() || user?.usuario || ''}
                          readOnly
                        />
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-data-hora">Data/Hora do envio</label>
                        <input
                          id="tnd-data-hora"
                          name="data_hora"
                          type="text"
                          className="tnd-input"
                          value={agora()}
                          readOnly
                        />
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-metodo-envio">Método de envio *</label>
                        <select
                          id="tnd-metodo-envio"
                          name="metodo_envio"
                          className="tnd-input"
                          value={metodoEnvio}
                          onChange={(e) => setMetodoEnvio(e.target.value)}
                          disabled={enviando}
                        >
                          <option value="E-mail">E-mail</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Portal do Suporte">Portal do Suporte</option>
                          <option value="Telefone">Telefone</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-destinatario">Destinatário / Suporte *</label>
                        <input
                          id="tnd-destinatario"
                          name="destinatario"
                          type="text"
                          className="tnd-input"
                          value={destinatario}
                          onChange={(e) => setDestinatario(e.target.value)}
                          disabled={enviando}
                          placeholder="Nome da pessoa/equipe que receberá"
                        />
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-contato">Contato</label>
                        <input
                          id="tnd-contato"
                          name="contato"
                          type="text"
                          className="tnd-input"
                          value={contato}
                          onChange={(e) => setContato(e.target.value)}
                          disabled={enviando}
                          placeholder="Telefone, WhatsApp ou e-mail"
                        />
                      </div>
                      
                      <div className="tnd-field">
                        <label htmlFor="tnd-protocolo">Protocolo / Referência</label>
                        <input
                          id="tnd-protocolo"
                          name="protocolo"
                          type="text"
                          className="tnd-input"
                          value={protocolo}
                          onChange={(e) => setProtocolo(e.target.value)}
                          disabled={enviando}
                          placeholder="Número do protocolo fornecido pelo suporte (opcional)"
                        />
                      </div>
                      
                      <div className="tnd-field full">
                        <label htmlFor="tnd-observacoes-envio">Mensagem / Observações do envio</label>
                        <textarea
                          id="tnd-observacoes-envio"
                          name="observacoes"
                          className="tnd-input tnd-textarea"
                          rows={3}
                          value={observacoesEnvio}
                          onChange={(e) => setObservacoesEnvio(e.target.value)}
                          disabled={enviando}
                          maxlength={2000}
                        />
                      </div>
                    </div>
                    
                    <div className="tnd-anexos-envio">
                      <legend className="tnd-legend">Anexos para enviar</legend>
                      {anexos.length > 0 ? (
                        <div className="tnd-anexos-envio-list">
                          {anexos.map((anexo) => (
                            <div key={anexo.id} className={`tnd-anexo-envio-item ${isAnexoSelecionado(anexo.id) ? 'selecionado' : ''}`}>
                              <div className="tnd-anexo-envio-info">
                                <span className="tnd-anexo-envio-icon">
                                  {anexo.tipo_arquivo === 'PDF' ? 'picture_as_pdf' : 
                                   anexo.tipo_arquivo === 'PNG' || anexo.tipo_arquivo === 'JPG' || anexo.tipo_arquivo === 'JPEG' ? 'image' : 
                                   anexo.tipo_arquivo === 'TXT' ? 'description' : 
                                   'attach_file'}
                                </span>
                                <div>
                                  <strong>{anexo.nome_arquivo}</strong>
                                  <span className="tnd-anexo-envio-details">
                                    {anexo.tipo_arquivo} • 
                                    {(anexo.tamanho_bytes / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                              </div>
                              <div className="tnd-anexo-envio-checkbox">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={isAnexoSelecionado(anexo.id)}
                                    onChange={() => toggleAnexoSelecionado(anexo.id)}
                                    disabled={enviando}
                                  />
                                  <span>Selecionar para envio</span>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="tnd-anexos-envio-empty">Nenhum anexo disponível para enviar.</p>
                      )}
                      
                      {anexosParaEnviar.length > 0 && (
                        <div className="tnd-anexos-envio-summary">
                          {anexosParaEnviar.length} anexo(s) selecionado(s) para envio
                        </div>
                      )}
                    </div>
                  </fieldset>
                </>
              )}
              
              <div className="tnd-form-footer">
                {error && <div className="tnd-form-error" role="alert">{error}</div>}
              </div>
            </form>
            
            <footer className="tnd-dialog-footer">
              <small>Esc · Fechar</small>
              <div className="tnd-dialog-actions">
                <button 
                  className="tnd-btn" 
                  type="button" 
                  disabled={saving || enviando} 
                  onClick={close}
                >
                  Cancelar (Esc)
                </button>
                <button
                  className={`tnd-btn tnd-btn-primary${saving || enviando ? '' : ''}`}
                  type="submit"
                  form="tnd-pendencia-form"
                  disabled={saving || enviando || 
                          (mode === 'enviar_suporte' && 
                           (!destinatario.trim() || anexosParaEnviar.length === 0))}
                >
                  {saving ? 'Salvando...' : 
                   enviando ? 'Enviando...' : 
                   mode === 'new' ? 'Criar Pendência' : 
                   mode === 'edit' ? 'Atualizar Pendência' : 
                   'Enviar ao Suporte'}
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
