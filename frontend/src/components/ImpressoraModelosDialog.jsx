import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { impressoraModeloPayload, listarConsumiveis, listarAssociacoes, sincronizarAssociacoes } from '../api/impressoras_modelos.js'

const EMPTY = { nome_modelo: '', marca: '', descricao: '', estoque_minimo_toner: 0, estoque_minimo_cilindro: 0 }

export default function ImpressoraModelosDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  // Consumíveis compatíveis (tabela impressora_modelos_toner — migration 006)
  const [toners, setToners] = useState([])
  const [assoc, setAssoc] = useState([])
  const [pick, setPick] = useState('')
  const [assocLoading, setAssocLoading] = useState(false)
  // id do modelo já criado nesta sessão do modal (permite novo Ctrl+S após falha
  // na gravação das associações sem duplicar o cadastro)
  const [savedId, setSavedId] = useState(null)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Modelo de Impressora' : view ? 'Visualizar Modelo de Impressora' : 'Editar Modelo de Impressora'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      api('impressoras_modelos', 'buscar_por_id', { params: { id } })
        .then((row) => {
          if (row) setForm({
            nome_modelo: row.nome_modelo || '',
            marca: row.marca || '',
            descricao: row.descricao || '',
            estoque_minimo_toner: row.estoque_minimo_toner ?? 0,
            estoque_minimo_cilindro: row.estoque_minimo_cilindro ?? 0,
          })
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [mode, id])
  // Consumíveis: carrega a lista disponível (toner) e, em edição/visualização,
  // as associações já gravadas do modelo. O tipo exibido sempre vem de
  // `toner.tipo` (cadastro do consumível) — o usuário não classifica aqui.
  useEffect(() => {
    let active = true
    setAssocLoading(true)
    const gravadas = (mode === 'edit' || mode === 'view') && id
      ? listarAssociacoes(id)
      : Promise.resolve([])
    Promise.all([listarConsumiveis(), gravadas])
      .then(([disponiveis, associacoes]) => {
        if (!active) return
        setToners(disponiveis)
        setAssoc(associacoes.map((a) => ({
          id: a.id ?? null,
          modelo_id: a.modelo_id ?? null,
          toner_id: Number(a.toner_id),
          toner_codigo: a.toner_codigo,
          toner_tipo: a.toner_tipo,
        })))
      })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setAssocLoading(false) })
    return () => { active = false }
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

  // ---- Consumíveis compatíveis (seleciona/adiciona/remove) ----
  const disponiveis = toners.filter((t) => !assoc.some((a) => Number(a.toner_id) === Number(t.id)))
  const grupos = assoc.reduce((acc, a) => {
    const tipo = String(a.toner_tipo || 'TONER').toUpperCase()
    if (!acc[tipo]) acc[tipo] = []
    acc[tipo].push(a)
    return acc
  }, {})
  const tipos = ['TONER', 'CILINDRO', ...Object.keys(grupos).filter((k) => k !== 'TONER' && k !== 'CILINDRO')]

  function addToner() {
    const tonerId = Number(pick)
    if (!tonerId) return
    const t = toners.find((x) => Number(x.id) === tonerId)
    if (!t || assoc.some((a) => Number(a.toner_id) === tonerId)) return
    setAssoc((prev) => [...prev, {
      id: null,
      modelo_id: null,
      toner_id: tonerId,
      toner_codigo: t.codigo,
      toner_tipo: t.tipo,
    }])
    setPick('')
    setDirty(true)
  }

  function removeToner(tonerId) {
    setAssoc((prev) => prev.filter((a) => Number(a.toner_id) !== Number(tonerId)))
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
    if (!form.nome_modelo || form.nome_modelo.trim() === '') {
      setError('Nome do modelo é obrigatório')
      return
    }
    if (!form.marca || form.marca.trim() === '') {
      setError('Marca é obrigatória')
      return
    }
    // Validate numeric fields (they are already numbers via state, but ensure they are integers)
    const toner = Number(form.estoque_minimo_toner)
    const cilindro = Number(form.estoque_minimo_cilindro)
    if (isNaN(toner) || !Number.isInteger(toner)) {
      setError('Estoque mínimo de toner deve ser um número inteiro')
      return
    }
    if (isNaN(cilindro) || !Number.isInteger(cilindro)) {
      setError('Estoque mínimo de cilindro deve ser um número inteiro')
      return
    }
    if (toner < 0) {
      setError('Estoque mínimo de toner não pode ser negativo')
      return
    }
    if (cilindro < 0) {
      setError('Estoque mínimo de cilindro não pode ser negativo')
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    // Em "novo", o modelo é criado primeiro para que as associações de consumíveis
    // já sejam gravadas no mesmo fluxo de salvar (modelo_id é obrigatório na 006).
    const payloadId = id || savedId
    let modeloId = payloadId
    try {
      const salvo = await api('impressoras_modelos', 'salvar', {
        method: 'POST',
        body: { ...impressoraModeloPayload(form), ...(payloadId ? { id: payloadId } : {}) },
      })
      modeloId = payloadId || salvo?.id || null
      if (mode === 'new' && modeloId && !savedId) setSavedId(modeloId)
    } catch (e) {
      if (e.status === 409) {
        setError('Já existe um modelo com estes dados. Verifique se o nome e marca não estão duplicados.')
      } else {
        setError(e.message)
      }
      saveLock.current = false
      setSaving(false)
      return
    }

    try {
      if (modeloId) {
        // Diferença entre o que está gravado e o que está marcado no modal:
        // remove associações que saíram e grava as novas (idempotente).
        const atuais = await listarAssociacoes(modeloId)
        await sincronizarAssociacoes(modeloId, assoc, atuais)
      }
      onSaved(`${mode === 'new' && !savedId ? 'Modelo criado' : 'Modelo atualizado'} com sucesso.`)
    } catch (e) {
      setError(`Modelo salvo, mas não foi possível gravar os consumíveis compatíveis: ${e.message}`)
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  if (mode === 'new' || (mode === 'edit' && form.nome_modelo) || (mode === 'view' && form.nome_modelo)) {
    return <div className="imo-overlay">
      <section ref={dialogRef} className="imo-dialog" role="dialog" aria-modal="true" aria-labelledby="imo-dialog-title" tabIndex={-1} onKeyDown={onKey}>
        <header className="imo-dialog-header">
          <span className="imo-dialog-icon mat" aria-hidden="true">print</span>
          <h2 id="imo-dialog-title">{title}</h2>
          <span className={`imo-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
          <button className="imo-btn imo-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="imo-form" ref={formRef} className="imo-form" onSubmit={save} noValidate>
          {loading && <p role="status">Carregando cadastro…</p>}
          {error && <div className="imo-message error" role="alert">{error}<button type="button" className="imo-btn" onClick={() => setError('')}>Fechar</button></div>}
          <fieldset disabled={view || loading || saving}>
            <div className="imo-form-grid">
              <div className="imo-field">
                <label htmlFor="imo-nome-modelo">Nome do Modelo *</label>
                <input id="imo-nome-modelo" name="nome_modelo" className="imo-input" value={form.nome_modelo || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: HP LaserJet Pro M404dn" autoFocus required />
              </div>
              <div className="imo-field">
                <label htmlFor="imo-marca">Marca *</label>
                <input id="imo-marca" name="marca" className="imo-input" value={form.marca || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Ex: HP, Canon, Epson" required />
              </div>
              <div className="imo-field">
                <label htmlFor="imo-descricao">Descrição</label>
                <input id="imo-descricao" name="descricao" className="imo-input" value={form.descricao || ''} onChange={handleChange} disabled={mode === 'view'} placeholder="Descrição complementar do modelo..." />
              </div>
              <div className="imo-field">
                <label htmlFor="imo-estoque-minimo-toner">Estoque Mínimo de Toner *</label>
                <input id="imo-estoque-minimo-toner" name="estoque_minimo_toner" type="number" value={form.estoque_minimo_toner} onChange={handleChange} disabled={mode === 'view'} min="0" placeholder="Ex: 4" required />
              </div>
              <div className="imo-field">
                <label htmlFor="imo-estoque-minimo-cilindro">Estoque Mínimo de Cilindro *</label>
                <input id="imo-estoque-minimo-cilindro" name="estoque_minimo_cilindro" type="number" value={form.estoque_minimo_cilindro} onChange={handleChange} disabled={mode === 'view'} min="0" placeholder="Ex: 1" required />
              </div>
            </div>

            <section className="imo-assoc" aria-labelledby="imo-assoc-title">
              <header className="imo-assoc-head">
                <span className="mat" aria-hidden="true">inventory_2</span>
                <h3 id="imo-assoc-title">Consumíveis Compatíveis</h3>
                <span className="imo-assoc-count" aria-label={`${assoc.length} consumível(is) associado(s)`}>{assoc.length}</span>
              </header>
              <p className="imo-assoc-hint">O tipo (TONER/CILINDRO) vem do cadastro do consumível — não é informado aqui.</p>
              {assocLoading && <p className="imo-assoc-hint" role="status">Carregando consumíveis…</p>}
              {!assocLoading && (
                <>
                  {assoc.length === 0 && (
                    <p className="imo-assoc-empty">Nenhum consumível compatível associado a este modelo.</p>
                  )}
                  {tipos.filter((tipo) => (grupos[tipo] || []).length > 0).map((tipo) => (
                    <div key={tipo} className={`imo-assoc-grupo tipo-${tipo.toLowerCase()}`}>
                      <span className="imo-assoc-tipo">{tipo}</span>
                      <ul className="imo-assoc-chips">
                        {grupos[tipo].map((a) => (
                          <li key={a.toner_id} className="imo-chip">
                            <span className="imo-chip-code">{a.toner_codigo}</span>
                            {!view && (
                              <button type="button" className="imo-chip-x" aria-label={`Remover ${a.toner_codigo}`} onClick={() => removeToner(a.toner_id)}>
                                <span className="mat">close</span>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {!view && (
                    <div className="imo-assoc-add">
                      <label className="imo-sr-only" htmlFor="imo-assoc-select">Adicionar consumível compatível</label>
                      <select id="imo-assoc-select" className="imo-input" value={pick} onChange={(e) => setPick(e.target.value)}>
                        <option value="">Selecione um consumível…</option>
                        {disponiveis.map((t) => (
                          <option key={t.id} value={t.id}>
                            {`${t.codigo} — ${String(t.tipo || 'TONER')}${t.estoque !== null && t.estoque !== undefined ? ` (estoque ${t.estoque})` : ''}`}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="imo-btn imo-btn-primary" disabled={!pick} onClick={addToner}>
                        <span className="mat">add</span>Adicionar
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </fieldset>
          {error && <div className="imo-message error" role="alert">{error}<button type="button" className="imo-btn" onClick={() => setError('')}>Fechar</button></div>}
        </form>
        <footer className="imo-dialog-footer">
          {!view && <><small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small></>}
          <div className="imo-actions">
            <button className="imo-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="imo-btn imo-btn-primary" type="submit" form="imo-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Modelo' : 'Atualizar Alterações'}</button>}
          </div>
        </footer>
      </section>
    </div>
  }

  return null
}