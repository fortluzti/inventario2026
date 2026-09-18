import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { MONITOR_STATUS, PORTAS_CONEXAO, EMPTY_MONITOR, monitorPayload, listarOpcoes } from '../api/monitores.js'

export default function MonitorDialog({ mode, id, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_MONITOR })
  const [options, setOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Monitor' : view ? 'Visualizar Monitor' : 'Editar Monitor'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setDirty(false)
    async function load() {
      try {
        const endpoints = ['empresas', 'fornecedores']
        const promises = [
          id ? api('monitores', 'buscar_por_id', { params: { id } }) : api('monitores', 'proximo_codigo'),
          ...endpoints.map(listarOpcoes),
        ]
        const [record, ...lists] = await Promise.all(promises)
        if (!active) return
        setOptions(Object.fromEntries(endpoints.map((key, index) => [key, lists[index]])))
        if (id && record) {
          const portasArray = record.portas ? record.portas.split(',') : []
          setForm({
            codigo_interno_monitor: record.codigo_interno_monitor || '',
            marca: record.marca || '',
            modelo: record.modelo || '',
            numero_serie: record.numero_serie || '',
            status: record.status || 'Em Estoque',
            data_compra: record.data_compra ? record.data_compra.split('T')[0] : '',
            nota_fiscal: record.nota_fiscal || '',
            fornecedor_id: record.fornecedor_id ? String(record.fornecedor_id) : '',
            empresa_id: record.empresa_id ? String(record.empresa_id) : '',
            portas: portasArray.join(','),
          })
          setDirty(true)
        } else if (!id) {
          setForm({ ...EMPTY_MONITOR, codigo_interno_monitor: record.next_codigo || 'MON-001' })
        }
        setLoading(false)
      } catch (e) {
        if (active) { setError(e.message); setLoading(false) }
      }
    }
    load()
    return () => { active = false }
  }, [id])

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

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  async function save(e) {
    e.preventDefault()
    if (view || loading || saveLock.current || !options.empresas) return
    const invalid = [...formRef.current.querySelectorAll('input, select')].find((el) => !el.checkValidity())
    if (invalid) {
      setError(`Verifique o campo ${invalid.labels?.[0]?.textContent || invalid.name}.`)
      setTimeout(() => { invalid.focus(); invalid.reportValidity() }, 0)
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      await api('monitores', 'salvar', { method: 'POST', body: { ...monitorPayload(form), ...(id ? { id } : {}) } })
      onSaved(mode === 'new' ? 'Monitor salvo com sucesso.' : 'Monitor atualizado com sucesso.')
    } catch (e) { setError(e.message) }
    finally { saveLock.current = false; setSaving(false) }
  }

  const portasSelecionadas = form.portas ? form.portas.split(',') : []

  return <div className="mon-overlay">
    <section ref={dialogRef} className="mon-dialog" role="dialog" aria-modal="true" aria-labelledby="mon-dialog-title" tabIndex={-1} onKeyDown={onKey}>
      <header className="mon-dialog-header">
        <span className="mon-dialog-icon mat" aria-hidden="true">desktop_windows</span>
        <h2 id="mon-dialog-title">{title}</h2>
        <span className={`mon-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
        <button className="mon-btn mon-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
      </header>
      <form id="mon-form" ref={formRef} className="mon-form" onSubmit={save} noValidate>
        {loading && <p role="status">Carregando cadastro e opções…</p>}
        {error && <div className="mon-message error" role="alert">{error}<button type="button" className="mon-btn" onClick={() => setError('')}>Fechar</button></div>}
        <fieldset disabled={view || loading || saving || !options.empresas}>
          <div className="mon-form-grid">
            <div className="mon-field">
              <label htmlFor="monitor-codigo">Código Interno</label>
              <input id="monitor-codigo" name="codigo_interno_monitor" value={form.codigo_interno_monitor || ''} readOnly className="mon-input mon-input-readonly" />
              <small className="mon-hint">Auto-gerado: MON-XXX</small>
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-marca">Marca <b className="mon-required">*</b></label>
              <input id="monitor-marca" name="marca" value={form.marca || ''} onChange={(e) => change('marca', e.target.value)} maxLength={50} required className="mon-input" placeholder="Ex: DELL, SAMSUNG, LG" />
              <small className="mon-hint">Marca oficial do monitor</small>
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-modelo">Modelo <b className="mon-required">*</b></label>
              <input id="monitor-modelo" name="modelo" value={form.modelo || ''} onChange={(e) => change('modelo', e.target.value)} maxLength={50} required className="mon-input" placeholder="Ex: UltraSharp U2723QE" />
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-serial">Número de Série <b className="mon-required">*</b></label>
              <input id="monitor-serial" name="numero_serie" value={form.numero_serie || ''} onChange={(e) => change('numero_serie', e.target.value)} maxLength={50} required className="mon-input font-mono" placeholder="Ex: CN-08HJ29-74261" />
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-status">Status</label>
              <select id="monitor-status" name="status" value={form.status || 'Em Estoque'} onChange={(e) => change('status', e.target.value)} className="mon-select">
                {MONITOR_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-compra">Data da Compra</label>
              <input id="monitor-compra" name="data_compra" type="date" value={form.data_compra || ''} onChange={(e) => change('data_compra', e.target.value)} className="mon-input" />
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-nf">Nota Fiscal</label>
              <input id="monitor-nf" name="nota_fiscal" value={form.nota_fiscal || ''} onChange={(e) => change('nota_fiscal', e.target.value)} maxLength={50} className="mon-input font-mono" placeholder="Ex: NF-89211" />
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-fornecedor">Fornecedor</label>
              <div className="mon-select-wrapper">
                <select id="monitor-fornecedor" name="fornecedor_id" value={form.fornecedor_id || ''} onChange={(e) => change('fornecedor_id', e.target.value)} className="mon-select">
                  <option value="">Selecione um fornecedor</option>
                  {options.fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="mon-field">
              <label htmlFor="monitor-empresa">Empresa</label>
              <select id="monitor-empresa" name="empresa_id" value={form.empresa_id || ''} onChange={(e) => change('empresa_id', e.target.value)} className="mon-select">
                <option value="">Selecione uma empresa</option>
                {options.empresas?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div className="mon-field mon-full">
              <label className="mon-label-block">Portas de Conexão</label>
              <div className="mon-checkboxes">
                {PORTAS_CONEXAO.map(porta => (
                  <label key={porta} className="mon-checkbox-label">
                    <input type="checkbox" value={porta} checked={portasSelecionadas.includes(porta)} onChange={(e) => {
                      const newPorts = e.target.checked
                        ? [...portasSelecionadas, porta].join(',')
                        : portasSelecionadas.filter(p => p !== porta).join(',')
                      change('portas', newPorts)
                    }} />
                    <span>{porta}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </fieldset>
      </form>
      <footer className="mon-dialog-footer">
        {!view && <><small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small></>}
        <div className="mon-actions">
          <button className="mon-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
          {!view && <button className="mon-btn mon-btn-primary" type="submit" form="mon-form" disabled={loading || saving}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Monitor' : 'Atualizar Alterações'}</button>}
        </div>
      </footer>
    </section>
  </div>
}