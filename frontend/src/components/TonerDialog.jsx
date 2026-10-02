import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import {
  EMPTY_TONER, TONER_TIPOS, tonerPayload, buscarPorId,
  buscarModelos, listarModelosDoToner, sincronizarModelos,
} from '../api/toners.js'

export default function TonerDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_TONER)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  // Modelos de impressora compatíveis — relação existente `impressora_modelos_toner`
  // (migration 006). TONER e CILINDRO usam exatamente o mesmo mecanismo.
  const [modelos, setModelos] = useState([]) // [{ id, modelo_id, modelo_nome, modelo_marca }]
  const [modeloQuery, setModeloQuery] = useState('')
  const [modeloResults, setModeloResults] = useState([])
  const [modeloLoading, setModeloLoading] = useState(false)
  // id do consumível já gravado nesta sessão do modal (permite novo Ctrl+S após
  // falha na gravação das associações sem duplicar o cadastro)
  const [savedId, setSavedId] = useState(null)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Consumível' : view ? 'Visualizar Consumível' : 'Editar Consumível'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true)
      setError('')
      buscarPorId(id)
        .then((row) => {
          if (row) setForm({
            codigo: row.codigo || '',
            tipo: row.tipo || 'TONER',
            estoque: row.estoque ?? 0,
            estoque_minimo: row.estoque_minimo ?? 0,
            autonomia: row.autonomia ?? '',
            valor: row.valor ?? '',
            data_compra: row.data_compra || '',
            nota_fiscal: row.nota_fiscal || '',
            fornecedor_id: row.fornecedor_id ?? '',
            empresa_id: row.empresa_id ?? '',
          })
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [mode, id])

  // Associações já gravadas do consumível (edição/visualização).
  useEffect(() => {
    let active = true
    if ((mode === 'edit' || mode === 'view') && id) {
      listarModelosDoToner(id)
        .then((items) => {
          if (!active) return
          setModelos(items.map((a) => ({
            id: a.id ?? null,
            modelo_id: Number(a.modelo_id),
            modelo_nome: a.modelo_nome || '',
            modelo_marca: a.modelo_marca || '',
          })))
        })
        .catch((e) => { if (active) setError(e.message) })
    }
    return () => { active = false }
  }, [mode, id])

  // Autocomplete de modelos reais cadastrados (evita texto livre).
  useEffect(() => {
    if (view) return undefined
    const q = modeloQuery.trim()
    if (!q) { setModeloResults([]); return undefined }
    let active = true
    setModeloLoading(true)
    const timer = setTimeout(() => {
      buscarModelos(q)
        .then((items) => { if (active) setModeloResults(items) })
        .catch(() => { if (active) setModeloResults([]) })
        .finally(() => { if (active) setModeloLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [modeloQuery, view])

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
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setDirty(true)
  }

  // ---- Modelos de impressora compatíveis (adiciona/remove) ----
  const modeloLabel = (m) => [m.modelo_marca, m.modelo_nome].filter(Boolean).join(' ') || `Modelo #${m.modelo_id}`
  const modeloDisponiveis = modeloResults.filter((m) => !modelos.some((x) => Number(x.modelo_id) === Number(m.id)))

  function addModelo(m) {
    if (!m || modelos.some((x) => Number(x.modelo_id) === Number(m.id))) return
    setModelos((prev) => [...prev, {
      id: null,
      modelo_id: Number(m.id),
      modelo_nome: m.nome_modelo || '',
      modelo_marca: m.marca || '',
    }])
    setModeloQuery('')
    setModeloResults([])
    setDirty(true)
  }

  function removeModelo(modeloId) {
    setModelos((prev) => prev.filter((m) => Number(m.modelo_id) !== Number(modeloId)))
    setDirty(true)
  }

  async function save(e) {
    e.preventDefault()
    if (view || loading || saveLock.current) return
    if (!String(form.codigo || '').trim()) { setError('Código é obrigatório'); return }
    if (!TONER_TIPOS.includes(form.tipo)) { setError('Tipo é obrigatório (TONER ou CILINDRO)'); return }
    saveLock.current = true
    setSaving(true)
    setError('')
    // Em "novo", o consumível é criado primeiro para que as associações de modelos
    // (modelo_id é obrigatório na relação 006) sejam gravadas no mesmo fluxo.
    const payloadId = id || savedId
    let tonerId = payloadId
    try {
      const payload = tonerPayload(form)
      if (mode === 'edit' || savedId) payload.id = payloadId
      const res = await api('toners', 'salvar', { method: 'POST', body: payload })
      tonerId = payloadId || res?.id || null
      if (mode === 'new' && tonerId && !savedId) setSavedId(tonerId)
    } catch (err) {
      setError(err.message)
      saveLock.current = false
      setSaving(false)
      return
    }
    try {
      if (tonerId) {
        const atuais = await listarModelosDoToner(tonerId)
        await sincronizarModelos(tonerId, modelos, atuais)
      }
      onSaved?.(mode === 'new' && !savedId ? 'Consumível criado com sucesso.' : 'Consumível atualizado com sucesso.', tonerId)
    } catch (err) {
      setError(`Consumível salvo, mas não foi possível gravar os modelos compatíveis: ${err.message}`)
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  const fId = (s) => `tnd-${s}`

  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">inventory_2</span>
          <h2>{title}</h2>
          {mode === 'new' && <span className="tnd-mode">NOVO</span>}
          {mode === 'edit' && <span className="tnd-mode edit">EM EDIÇÃO</span>}
          {view && <span className="tnd-mode view">SOMENTE LEITURA</span>}
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="tnd-form" className="tnd-form" ref={formRef} onSubmit={save}>
          <fieldset disabled={view} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="tnd-form-grid">
              <div className="tnd-field">
                <label htmlFor={fId('codigo')}>Código *</label>
                <input id={fId('codigo')} name="codigo" className="tnd-input" value={form.codigo || ''} onChange={handleChange} placeholder="Ex: W1330A" maxLength={100} required autoFocus />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('tipo')}>Tipo *</label>
                <select id={fId('tipo')} name="tipo" className="tnd-select" value={form.tipo || ''} onChange={handleChange} required>
                  <option value="">Selecione…</option>
                  {TONER_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('estoque')}>Estoque</label>
                <input id={fId('estoque')} name="estoque" type="number" min="0" step="1" className="tnd-input" value={form.estoque ?? ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('estoque_minimo')}>Estoque mínimo</label>
                <input id={fId('estoque_minimo')} name="estoque_minimo" type="number" min="0" step="1" className="tnd-input" value={form.estoque_minimo ?? ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('autonomia')}>Autonomia (páginas)</label>
                <input id={fId('autonomia')} name="autonomia" type="number" min="0" step="1" className="tnd-input" value={form.autonomia ?? ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('valor')}>Valor (R$)</label>
                <input id={fId('valor')} name="valor" type="number" min="0" step="0.01" className="tnd-input" value={form.valor ?? ''} onChange={handleChange} placeholder="0,00" title="Valor unitário — somente cadastro, sem uso financeiro nesta etapa" />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('data_compra')}>Data da compra</label>
                <input id={fId('data_compra')} name="data_compra" type="date" className="tnd-input" value={form.data_compra || ''} onChange={handleChange} />
              </div>
              <div className="tnd-field">
                <label htmlFor={fId('nota_fiscal')}>Nota fiscal</label>
                <input id={fId('nota_fiscal')} name="nota_fiscal" className="tnd-input" value={form.nota_fiscal || ''} onChange={handleChange} placeholder="Ex: 000.123.456" maxLength={100} />
              </div>
              {!view && <p className="tnd-hint full">O valor é apenas cadastro p/ futuro histórico financeiro — não entra em solicitação/pedido nem em cálculo de estoque.</p>}
            </div>

            <section className="tnd-compat" aria-labelledby="tnd-compat-title">
              <header className="tnd-compat-head">
                <span className="mat" aria-hidden="true">print</span>
                <h3 id="tnd-compat-title">Modelos de impressora compatíveis</h3>
                <span className="tnd-compat-count" aria-label={`${modelos.length} modelo(s) compatível(is)`}>{modelos.length}</span>
              </header>
              <p className="tnd-compat-hint">O tipo (TONER/CILINDRO) vem do cadastro acima — não é definido no modelo.</p>
              {modelos.length === 0 ? (
                <p className="tnd-compat-empty">Nenhum modelo de impressora associado a este consumível.</p>
              ) : (
                <ul className="tnd-compat-chips">
                  {modelos.map((m) => (
                    <li key={m.modelo_id} className="tnd-compat-chip">
                      <span className="tnd-compat-chip-txt">{modeloLabel(m)}</span>
                      {!view && (
                        <button type="button" className="tnd-compat-x" aria-label={`Remover ${modeloLabel(m)}`} onClick={() => removeModelo(m.modelo_id)}>
                          <span className="mat">close</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!view && (
                <div className="tnd-compat-add">
                  <label className="tnd-sr-only" htmlFor="tnd-dialog-modelo-busca">Adicionar modelo de impressora compatível</label>
                  <input
                    id="tnd-dialog-modelo-busca"
                    className="tnd-input"
                    value={modeloQuery}
                    onChange={(e) => setModeloQuery(e.target.value)}
                    placeholder="Pesquisar modelo (ex: HP 408)…"
                    autoComplete="off"
                  />
                  {modeloQuery.trim() !== '' && (
                    <div className="tnd-compat-sug" role="listbox" aria-label="Modelos encontrados">
                      {modeloLoading && <p className="tnd-compat-hint" role="status">Buscando…</p>}
                      {!modeloLoading && modeloDisponiveis.length === 0 && <p className="tnd-compat-hint">Nenhum modelo novo encontrado.</p>}
                      {modeloDisponiveis.map((m) => (
                        <button key={m.id} type="button" className="tnd-compat-opcao" role="option" onClick={() => addModelo(m)}>
                          <span className="mat" aria-hidden="true">add</span>{[m.marca, m.nome_modelo].filter(Boolean).join(' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </fieldset>
          {error && <div className="tnd-message error" role="alert">{error}<button type="button" className="tnd-btn" onClick={() => setError('')}>Fechar</button></div>}
        </form>
        <footer className="tnd-dialog-footer">
          {!view && <small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small>}
          <div className="tnd-actions">
            <button className="tnd-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
            {!view && <button className="tnd-btn tnd-btn-primary" type="submit" form="tnd-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Consumível' : 'Atualizar Alterações'}</button>}
          </div>
        </footer>
      </section>
    </div>
  )
}

