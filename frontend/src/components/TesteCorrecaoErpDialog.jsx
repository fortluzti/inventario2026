import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { registrarTeste, uploadEvidencia } from '../api/atendimentos_erp.js'
import { normalizarStatus, STATUS_AGUARDANDO_TESTES } from '../utils/erpStatus.js'

function getUserId(user) {
  return user?.id || user?.id_usuario || user?.usuario_id || ''
}

function formatarUsuario(user) {
  return `${user?.nome || ''} ${user?.sobrenome || ''}`.trim() || user?.usuario || user?.login || `Usuário ${getUserId(user) || ''}`
}

function formatarTamanho(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

/**
 * TesteCorrecaoErpDialog - Modal da ação "Testar correção".
 *
 * Registra o teste NO MESMO chamado (nunca cria outro chamado):
 *  - Aprovado  -> Aguardando testes => Resolvido;
 *  - Reprovado -> Aguardando testes => Aguardando suporte, exibindo
 *                 automaticamente a seção obrigatória
 *                 "Problema encontrado na validação" (novo erro pode ser
 *                 diferente do problema original).
 */
export default function TesteCorrecaoErpDialog({ pendenciaId, user, onClose, onSaved }) {
  const [pendencia, setPendencia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState('')
  const [oqueFoiTestado, setOqueFoiTestado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [evidencias, setEvidencias] = useState([])
  const [enviandoEvidencia, setEnviandoEvidencia] = useState(false)
  const [descricaoDetalhada, setDescricaoDetalhada] = useState('')
  const [telaModulo, setTelaModulo] = useState('')
  const [comportamentoEsperado, setComportamentoEsperado] = useState('')
  const [comportamentoEncontrado, setComportamentoEncontrado] = useState('')
  const [responsavelId, setResponsavelId] = useState(getUserId(user))

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('pendencias_erp', 'buscar_por_id', { params: { id: pendenciaId } })
      .then((item) => { if (active) { setPendencia(item); setResponsavelId((v) => v || getUserId(user)) } })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [pendenciaId, user])

  const statusAtual = normalizarStatus(pendencia?.status)
  const statusValido = statusAtual === STATUS_AGUARDANDO_TESTES
  const reprovado = resultado === 'Reprovado'

  // Seção "Problema encontrado na validação" é obrigatória quando reprovado.
  const secaoIncompleta = reprovado && (
    !oqueFoiTestado.trim() || !observacoes.trim() || !descricaoDetalhada.trim()
    || !telaModulo.trim() || !comportamentoEsperado.trim() || !comportamentoEncontrado.trim()
  )
  const podeSalvar = !saving && !enviandoEvidencia && statusValido && resultado !== ''
    && !!oqueFoiTestado.trim() && !!responsavelId
    && (!reprovado || !!observacoes.trim())
    && !secaoIncompleta

  async function onSelecionarArquivos(e) {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (!arquivos.length) return
    setEnviandoEvidencia(true)
    setError('')
    try {
      for (const arquivo of arquivos) {
        if (arquivo.size > 10 * 1024 * 1024) {
          throw new Error(`"${arquivo.name}" excede o limite de 10 MB.`)
        }
        const formData = new FormData()
        formData.append('arquivo', arquivo)
        formData.append('pendencia_id', String(pendenciaId))
        formData.append('usuario_id', String(responsavelId || ''))
        const data = await uploadEvidencia(formData)
        setEvidencias((prev) => [...prev, {
          id: data.id,
          nome_arquivo: data.nome_arquivo,
          tamanho_bytes: data.tamanho_bytes,
        }])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviandoEvidencia(false)
    }
  }

  function removerEvidencia(id) {
    setEvidencias((prev) => prev.filter((item) => item.id !== id))
  }

  async function submit(e) {
    e.preventDefault()
    if (!podeSalvar) return
    if (!oqueFoiTestado.trim()) { setError('Descreva o que foi testado.'); return }
    if (reprovado && !observacoes.trim()) { setError('Registre as observações do teste reprovado.'); return }
    if (secaoIncompleta) { setError('Preencha a seção "Problema encontrado na validação".'); return }
    setSaving(true)
    setError('')
    try {
      await registrarTeste({
        pendencia_id: Number(pendenciaId),
        usuario_id: Number(responsavelId),
        resultado,
        oque_foi_testado: oqueFoiTestado.trim(),
        observacoes: observacoes.trim(),
        anexos_ids: evidencias.map((item) => item.id).join(','),
        versao_sistema: pendencia?.versao_programa || '',
        ...(reprovado ? {
          descricao_detalhada: descricaoDetalhada.trim(),
          tela_modulo: telaModulo.trim(),
          comportamento_esperado: comportamentoEsperado.trim(),
          comportamento_encontrado: comportamentoEncontrado.trim(),
        } : {}),
      })
      onSaved?.(reprovado
        ? 'Teste reprovado registrado. Chamado devolvido ao suporte.'
        : 'Teste aprovado. Chamado resolvido.')
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="tnd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section className="tnd-dialog erp-teste-dialog" role="dialog" aria-modal="true" aria-labelledby="erp-teste-title">
      <header className="tnd-dialog-header">
        <span className="mat tnd-dialog-icon" aria-hidden="true">science</span>
        <h2 id="erp-teste-title">Testar correção</h2>
        <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={onClose}><span className="mat">close</span></button>
      </header>

      {loading ? <div className="tnd-dialog-loading">Carregando...</div> : <>
        <div className="erp-atendimento-context">
          <strong>{pendencia?.codigo}</strong> · {pendencia?.titulo}<br />
          <span>Status atual: {statusAtual}</span>
          {pendencia?.versao_programa && <span> · Versão: {pendencia.versao_programa}</span>}
        </div>

        {!statusValido && <div className="tnd-form-error erp-teste-blocked" role="alert">
          O teste só pode ser registrado quando o chamado está em <strong>Aguardando testes</strong>.
        </div>}

        <form className="tnd-form" onSubmit={submit}>
          <div className="tnd-form-grid">
            <fieldset className="tnd-field full erp-teste-resultado">
              <legend>Resultado do teste *</legend>
              <label className={`erp-teste-opcao ${resultado === 'Aprovado' ? 'ativo aprovado' : ''}`}>
                <input type="radio" name="resultado_teste" value="Aprovado"
                  checked={resultado === 'Aprovado'}
                  onChange={() => setResultado('Aprovado')}
                  disabled={saving || !statusValido} />
                <span className="mat" aria-hidden="true">check_circle</span> Aprovado
              </label>
              <label className={`erp-teste-opcao ${resultado === 'Reprovado' ? 'ativo reprovado' : ''}`}>
                <input type="radio" name="resultado_teste" value="Reprovado"
                  checked={resultado === 'Reprovado'}
                  onChange={() => setResultado('Reprovado')}
                  disabled={saving || !statusValido} />
                <span className="mat" aria-hidden="true">cancel</span> Reprovado
              </label>
              <small>{resultado === 'Aprovado'
                ? 'Ao concluir, o chamado passa para Resolvido.'
                : resultado === 'Reprovado'
                  ? 'O chamado volta para Aguardando suporte (mesmo chamado, nova rodada de correção).'
                  : 'Selecione se o teste foi aprovado ou reprovado.'}</small>
            </fieldset>

            <div className="tnd-field full">
              <label htmlFor="erp-teste-oque">O que foi testado *</label>
              <textarea id="erp-teste-oque" className="tnd-input tnd-textarea" rows={3}
                value={oqueFoiTestado} onChange={(e) => setOqueFoiTestado(e.target.value)}
                maxLength={60000} placeholder="Fluxo, rotina ou tela validada nesta rodada"
                disabled={saving || !statusValido} />
            </div>

            <div className="tnd-field full">
              <label htmlFor="erp-teste-observacoes">Observações{reprovado ? ' *' : ''}</label>
              <textarea id="erp-teste-observacoes" className="tnd-input tnd-textarea" rows={3}
                value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                maxLength={2000} disabled={saving || !statusValido} />
            </div>

            <div className="tnd-field full erp-teste-evidencias">
              <label htmlFor="erp-teste-arquivos">Anexos / evidências {reprovado && <span className="erp-teste-opcional">(quando disponível)</span>}</label>
              <input id="erp-teste-arquivos" type="file" multiple
                accept="image/*,application/pdf,.txt,.csv"
                onChange={onSelecionarArquivos}
                disabled={saving || enviandoEvidencia || !statusValido} />
              {enviandoEvidencia && <small>Enviando evidência…</small>}
              {evidencias.length > 0 && <ul className="erp-teste-evidencias-lista">
                {evidencias.map((item) => <li key={item.id}>
                  <span className="mat" aria-hidden="true">attach_file</span>
                  <span className="erp-teste-evidencia-nome" title={item.nome_arquivo}>{item.nome_arquivo}</span>
                  <span className="erp-teste-evidencia-tamanho">{formatarTamanho(item.tamanho_bytes)}</span>
                  <button type="button" className="tnd-btn tnd-btn-icon" title="Remover evidência"
                    aria-label={`Remover evidência ${item.nome_arquivo}`}
                    onClick={() => removerEvidencia(item.id)} disabled={saving}>
                    <span className="mat">close</span>
                  </button>
                </li>)}
              </ul>}
            </div>

            {reprovado && <fieldset className="tnd-field full erp-teste-problema" disabled={saving}>
              <legend><span className="mat" aria-hidden="true">report</span> Problema encontrado na validação *</legend>
              <p className="erp-teste-problema-nota">
                O erro pode ser diferente do problema original. Descreva o novo problema —
                ele fará parte do histórico deste mesmo chamado.
              </p>
              <div className="tnd-form-grid">
                <div className="tnd-field full">
                  <label htmlFor="erp-teste-descricao">Descrição detalhada do que deu errado *</label>
                  <textarea id="erp-teste-descricao" className="tnd-input tnd-textarea" rows={3}
                    value={descricaoDetalhada} onChange={(e) => setDescricaoDetalhada(e.target.value)}
                    maxLength={60000} />
                </div>
                <div className="tnd-field full">
                  <label htmlFor="erp-teste-tela">Tela / módulo onde ocorreu o problema *</label>
                  <input id="erp-teste-tela" className="tnd-input" value={telaModulo}
                    onChange={(e) => setTelaModulo(e.target.value)} maxLength={150}
                    placeholder="Ex.: Faturamento › Emissão de nota fiscal" />
                </div>
                <div className="tnd-field">
                  <label htmlFor="erp-teste-esperado">Comportamento esperado *</label>
                  <textarea id="erp-teste-esperado" className="tnd-input tnd-textarea" rows={3}
                    value={comportamentoEsperado} onChange={(e) => setComportamentoEsperado(e.target.value)}
                    maxLength={60000} />
                </div>
                <div className="tnd-field">
                  <label htmlFor="erp-teste-encontrado">Comportamento encontrado *</label>
                  <textarea id="erp-teste-encontrado" className="tnd-input tnd-textarea" rows={3}
                    value={comportamentoEncontrado} onChange={(e) => setComportamentoEncontrado(e.target.value)}
                    maxLength={60000} />
                </div>
              </div>
            </fieldset>}
          </div>

          {error && <div className="tnd-form-error" role="alert">{error}</div>}

          <footer className="tnd-dialog-footer">
            <small>Esc · Fechar</small>
            <div className="tnd-dialog-actions">
              <button className="tnd-btn" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="tnd-btn tnd-btn-primary" type="submit" disabled={!podeSalvar}>
                {saving ? 'Registrando…' : 'Registrar teste'}
              </button>
            </div>
          </footer>
        </form>
      </>}
    </section>
  </div>
}
