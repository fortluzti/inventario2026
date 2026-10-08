import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { listar as listarAtendimentos, registrarAtendimento } from '../api/atendimentos_erp.js'
import {
  normalizarStatus,
  STATUS_AGUARDANDO_SUPORTE,
  STATUS_AGUARDANDO_TESTES,
  STATUS_RESOLVIDO,
  STATUS_CANCELADO,
} from '../utils/erpStatus.js'

const METODOS = ['E-mail', 'WhatsApp', 'Portal do Suporte', 'Telefone', 'Outro']

const STATUS_LABELS = {
  [STATUS_AGUARDANDO_SUPORTE]: 'Aguardando suporte',
  [STATUS_AGUARDANDO_TESTES]: 'Aguardando testes',
  [STATUS_RESOLVIDO]: 'Resolvido',
  [STATUS_CANCELADO]: 'Cancelado',
}

/**
 * Acoes validas para cada status do fluxo oficial (espelha erroTransicao no backend).
 * - Aguardando suporte: suporte responde/correcao -> testes; envio/observacao nao mudam status.
 * - Aguardando testes: somente o teste interno finaliza (aprovado) ou devolve ao suporte (reprovado).
 * - Resolvido/Cancelado: estados finais, apenas observacao.
 */
function opcoesFluxo(statusAtual) {
  const status = normalizarStatus(statusAtual)
  const comum = [{ tipo: 'Observação', status: status, label: 'Observação sem mudança de status' }]
  const porStatus = {
    [STATUS_AGUARDANDO_SUPORTE]: [
      { tipo: 'Envio ao suporte', status: STATUS_AGUARDANDO_SUPORTE, label: 'Registrar envio ao suporte (sem mudança de status)' },
      { tipo: 'Retorno do suporte', status: STATUS_AGUARDANDO_TESTES, label: 'Suporte respondeu → aguardando testes' },
      { tipo: 'Correção/atualização', status: STATUS_AGUARDANDO_TESTES, label: 'Correção/atualização concluída → aguardando testes' },
    ],
    [STATUS_AGUARDANDO_TESTES]: [
      { tipo: 'Teste', status: STATUS_RESOLVIDO, label: 'Teste aprovado → resolver pendência' },
      { tipo: 'Teste', status: STATUS_AGUARDANDO_SUPORTE, label: 'Teste reprovado → voltar ao suporte' },
    ],
    [STATUS_RESOLVIDO]: [],
    [STATUS_CANCELADO]: [],
  }
  return [...(porStatus[status] || []), ...comum]
}

function formatarUsuario(user) {
  return `${user?.nome || ''} ${user?.sobrenome || ''}`.trim() || user?.usuario || user?.login || `Usuário ${getUserId(user) || ''}`
}

function getUserId(user) {
  return user?.id || user?.id_usuario || user?.usuario_id || ''
}

export default function AtendimentoErpDialog({ mode, pendenciaId, user, onClose, onSaved }) {
  const [pendencia, setPendencia] = useState(null)
  const [atendimentos, setAtendimentos] = useState([])
  const [metodo, setMetodo] = useState('E-mail')
  const [destinatario, setDestinatario] = useState('')
  const [contato, setContato] = useState('')
  const [protocolo, setProtocolo] = useState('')
  const [versaoSistema, setVersaoSistema] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [acaoFluxo, setAcaoFluxo] = useState('')
  const [responsavelId, setResponsavelId] = useState(getUserId(user))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const usuarioBusca = !getUserId(user) && (user?.usuario || user?.login)
          ? api('usuarios', 'buscar', { params: { id: user.usuario || user.login } }).catch(() => null)
          : Promise.resolve(null)
        const [item, result, usuarioEncontrado] = await Promise.all([
          api('pendencias_erp', 'buscar_por_id', { params: { id: pendenciaId } }),
          mode === 'historico'
            ? listarAtendimentos({ pendencia_id: pendenciaId, page: 1, limit: 200 })
            : Promise.resolve(null),
          usuarioBusca,
        ])
        if (!active) return
        const opcoes = opcoesFluxo(item.status)
        setPendencia(item)
        setAcaoFluxo(opcoes[0] ? `${opcoes[0].tipo}|${opcoes[0].status}` : '')
        setVersaoSistema(item.versao_programa || '')
        setResponsavelId(getUserId(user) || getUserId(usuarioEncontrado))
        if (result) setAtendimentos((result.items || []).slice().sort((a, b) => {
          const dataA = new Date(a.data_cadastro || 0).getTime()
          const dataB = new Date(b.data_cadastro || 0).getTime()
          return dataA - dataB || Number(a.id || 0) - Number(b.id || 0)
        }))
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [mode, pendenciaId, user])

  const opcoes = useMemo(() => opcoesFluxo(pendencia?.status), [pendencia?.status])
  const selecionada = opcoes.find((item) => `${item.tipo}|${item.status}` === acaoFluxo) || opcoes[0]
  const statusAtual = normalizarStatus(pendencia?.status)

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    if (!selecionada) { setError('Selecione uma ação do fluxo.'); return }
    if (!metodo) { setError('Selecione o método da interação.'); return }
    if (!observacoes.trim()) { setError('Informe o conteúdo da interação.'); return }
    if (!responsavelId) { setError('Não foi possível vincular o usuário responsável.'); return }
    setSaving(true)
    setError('')
    try {
      await registrarAtendimento({
        pendencia_id: Number(pendenciaId),
        usuario_id: Number(responsavelId),
        metodo_envio: metodo,
        tipo_atendimento: selecionada.tipo,
        status_novo: selecionada.status,
        versao_sistema: versaoSistema.trim(),
        destinatario: destinatario.trim(),
        contato: contato.trim(),
        protocolo: protocolo.trim(),
        observacoes: observacoes.trim(),
      })
      onSaved?.('Atendimento registrado no histórico.')
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
    }
  }

  const historyMode = mode === 'historico'
  return <div className="tnd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section className="tnd-dialog erp-atendimento-dialog" role="dialog" aria-modal="true" aria-labelledby="erp-atendimento-title">
      <header className="tnd-dialog-header">
        <span className="mat tnd-dialog-icon" aria-hidden="true">{historyMode ? 'history' : 'support_agent'}</span>
        <h2 id="erp-atendimento-title">{historyMode ? 'Histórico de atendimentos' : 'Responder / Registrar atendimento'}</h2>
        <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={onClose}><span className="mat">close</span></button>
      </header>
      {loading ? <div className="tnd-dialog-loading">Carregando...</div> : <>
        <div className="erp-atendimento-context"><strong>{pendencia?.codigo}</strong> · {pendencia?.titulo}<br /><span>Status atual: {statusAtual}</span></div>
        {historyMode ? <div className="erp-atendimento-history">
          {atendimentos.length ? atendimentos.map((item) => <article className="erp-atendimento-entry" key={item.id}>
            <header>
              <strong>{item.tipo_atendimento || 'Observação'}</strong>
              <time>{item.data_cadastro ? new Date(item.data_cadastro).toLocaleString('pt-BR') : 'Data não informada'}</time>
            </header>
            <p>{item.observacoes || 'Sem conteúdo registrado.'}</p>
            <dl>
              <dt>Método</dt><dd>{item.metodo_envio || 'Não informado'}</dd>
              {item.status_anterior && <><dt>Status anterior</dt><dd>{normalizarStatus(item.status_anterior)}</dd></>}
              {item.status_novo && <><dt>Status novo</dt><dd>{normalizarStatus(item.status_novo)}</dd></>}
              {item.versao_sistema && <><dt>Versão do sistema</dt><dd>{item.versao_sistema}</dd></>}
              {item.destinatario && <><dt>Contato do suporte</dt><dd>{item.destinatario}</dd></>}
              {item.contato && <><dt>E-mail / telefone</dt><dd>{item.contato}</dd></>}
              {item.protocolo && <><dt>Protocolo</dt><dd>{item.protocolo}</dd></>}
              <dt>Responsável (ID)</dt><dd>{item.usuario_id || 'Não informado'}</dd>
            </dl>
          </article>) : <p>Nenhum atendimento registrado para esta pendência.</p>}
        </div> : <form className="tnd-form" onSubmit={submit}>
          <div className="tnd-form-grid">
            <div className="tnd-field full">
              <label htmlFor="erp-atendimento-acao">Ação do fluxo *</label>
              <select id="erp-atendimento-acao" className="tnd-input" value={acaoFluxo} onChange={(e) => setAcaoFluxo(e.target.value)}>
                {opcoes.map((item) => <option key={`${item.tipo}|${item.status}`} value={`${item.tipo}|${item.status}`}>{item.label}</option>)}
              </select>
              {selecionada && <small>{selecionada.tipo} · {STATUS_LABELS[statusAtual] || statusAtual} → {STATUS_LABELS[selecionada.status] || selecionada.status}</small>}
            </div>
            <div className="tnd-field"><label htmlFor="erp-atendimento-metodo">Método *</label><select id="erp-atendimento-metodo" className="tnd-input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="tnd-field"><label htmlFor="erp-atendimento-responsavel">Responsável</label><input id="erp-atendimento-responsavel" className="tnd-input" readOnly value={formatarUsuario(user)} /></div>
            <div className="tnd-field"><label htmlFor="erp-atendimento-destinatario">Contato do suporte</label><input id="erp-atendimento-destinatario" className="tnd-input" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} maxLength={200} /></div>
            <div className="tnd-field"><label htmlFor="erp-atendimento-contato">E-mail / telefone</label><input id="erp-atendimento-contato" className="tnd-input" value={contato} onChange={(e) => setContato(e.target.value)} maxLength={100} /></div>
            <div className="tnd-field"><label htmlFor="erp-atendimento-protocolo">Protocolo</label><input id="erp-atendimento-protocolo" className="tnd-input" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} maxLength={100} /></div>
            <div className="tnd-field"><label htmlFor="erp-atendimento-versao">Versão do sistema</label><input id="erp-atendimento-versao" className="tnd-input" value={versaoSistema} onChange={(e) => setVersaoSistema(e.target.value)} maxLength={50} /></div>
            <div className="tnd-field full"><label htmlFor="erp-atendimento-conteudo">Conteúdo da interação *</label><textarea id="erp-atendimento-conteudo" className="tnd-input tnd-textarea" rows={5} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={2000} /></div>
          </div>
          {error && <div className="tnd-form-error" role="alert">{error}</div>}
          <footer className="tnd-dialog-footer"><button className="tnd-btn" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="tnd-btn tnd-btn-primary" type="submit" disabled={saving || !selecionada || !metodo || !observacoes.trim() || !responsavelId}>{saving ? 'Registrando...' : 'Registrar atendimento'}</button></footer>
        </form>}
        {historyMode && <footer className="tnd-dialog-footer"><button className="tnd-btn" type="button" onClick={onClose}>Fechar</button></footer>}
        {historyMode && error && <div className="tnd-form-error" role="alert">{error}</div>}
      </>}
    </section>
  </div>
}
