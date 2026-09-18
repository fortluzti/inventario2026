import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { IMPRESSORA_STATUS, EMPTY_IMPRESSORA, impressoraPayload, listarOpcoes } from '../api/impressoras.js'

export default function ImpressoraDialog({ mode, id, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_IMPRESSORA })
  const [options, setOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [novoModelo, setNovoModelo] = useState(false)
  const [novoModeloNome, setNovoModeloNome] = useState('')
  const [novoModeloMarca, setNovoModeloMarca] = useState('')
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Nova Impressora' : view ? 'Visualizar Impressora' : 'Editar Impressora'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setDirty(false)
    async function load() {
      try {
        const endpoints = ['impressoras_modelos', 'setores', 'empresas', 'fornecedores']
        const promises = [
          id ? api('impressoras', 'buscar_por_id', { params: { id } }) : api('impressoras', 'proximo_codigo'),
          ...endpoints.map(listarOpcoes),
        ]
        const [record, ...lists] = await Promise.all(promises)
        if (!active) return
        setOptions(Object.fromEntries(endpoints.map((key, index) => [key, lists[index]])))
        if (id && record) {
          setForm({
            codigo_interno_impressora: record.codigo_interno_impressora || '',
            modelo_id: record.modelo_id ? String(record.modelo_id) : '',
            numero_serie: record.numero_serie || '',
            setor_id: record.setor_id ? String(record.setor_id) : '',
            ano_compra: record.ano_compra ? String(record.ano_compra) : '',
            status: record.status || 'Em Estoque',
            data_compra: record.data_compra ? record.data_compra.split('T')[0] : '',
            nota_fiscal: record.nota_fiscal || '',
            fornecedor_id: record.fornecedor_id ? String(record.fornecedor_id) : '',
            empresa_id: record.empresa_id ? String(record.empresa_id) : '',
            data_ultima_troca_toner: record.data_ultima_troca_toner ? record.data_ultima_troca_toner.split('T')[0] : '',
          })
          setDirty(true)
        } else if (!id) {
          setForm({ ...EMPTY_IMPRESSORA, codigo_interno_impressora: record.next_codigo || 'IMP-001' })
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
    const invalid = [...formRef.current.querySelectorAll('input:not([type="hidden"]), select')].find((el) => !el.checkValidity())
    if (invalid) {
      setError(`Verifique o campo ${invalid.labels?.[0]?.textContent || invalid.name}.`)
      setTimeout(() => { invalid.focus(); invalid.reportValidity() }, 0)
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      let modeloId = form.modelo_id
      if (novoModelo && novoModeloNome.trim()) {
        const modeloRes = await api('impressoras_modelos', 'salvar', {
          method: 'POST',
          body: { nome_modelo: novoModeloNome.trim(), marca: novoModeloMarca.trim() || null },
        })
        modeloId = modeloRes.id
      }
      await api('impressoras', 'salvar', { method: 'POST', body: { ...impressoraPayload(form), modelo_id: modeloId ? Number(modeloId) : null, ...(id ? { id } : {}) } })
      onSaved(mode === 'new' ? 'Impressora salva com sucesso.' : 'Impressora atualizada com sucesso.')
    } catch (e) { setError(e.message) }
    finally { saveLock.current = false; setSaving(false) }
  }

  return <div className="imp-overlay">
    <section ref={dialogRef} className="imp-dialog" role="dialog" aria-modal="true" aria-labelledby="imp-dialog-title" tabIndex={-1} onKeyDown={onKey}>
      <header className="imp-dialog-header">
        <span className="imp-dialog-icon mat" aria-hidden="true">print</span>
        <h2 id="imp-dialog-title">{title}</h2>
        <span className={`imp-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
        <button className="imp-btn imp-btn-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
      </header>
      <form id="imp-form" ref={formRef} className="imp-form" onSubmit={save} noValidate>
        {loading && <p role="status">Carregando cadastro e opções…</p>}
        {error && <div className="imp-message error" role="alert">{error}<button type="button" className="imp-btn" onClick={() => setError('')}>Fechar</button></div>}
        <fieldset disabled={view || loading || saving || !options.empresas}>
          <div className="imp-form-grid">
            <div className="imp-field">
              <label htmlFor="impressora-codigo">Código Interno</label>
              <input id="impressora-codigo" name="codigo_interno_impressora" value={form.codigo_interno_impressora || ''} readOnly className="imp-input imp-input-readonly" />
              <small className="imp-hint">Auto-gerado: IMP-XXX</small>
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-modelo">Modelo <b className="imp-required">*</b></label>
              <div className="imp-select-wrapper">
                <select
                  id="impressora-modelo"
                  name="modelo_id"
                  value={form.modelo_id || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__novo__') {
                      setNovoModelo(true)
                      setForm((current) => ({ ...current, modelo_id: '' }))
                    } else {
                      setNovoModelo(false)
                      change('modelo_id', val)
                    }
                  }}
                  className="imp-select"
                  required
                >
                  <option value="">Selecione um modelo</option>
                  {options.impressoras_modelos?.map((m) => <option key={m.id} value={m.id}>{m.nome_modelo}{m.marca ? ` — ${m.marca}` : ''}</option>)}
                  <option value="__novo__" style={{ fontStyle: 'italic', color: '#904d00' }}>+ Outro modelo…</option>
                </select>
              </div>
              {novoModelo && (
                <>
                  <input
                    id="impressora-novo-modelo-nome"
                    name="novo_modelo_nome"
                    value={novoModeloNome}
                    onChange={(e) => { setNovoModeloNome(e.target.value); setDirty(true) }}
                    className="imp-input"
                    placeholder="Nome do modelo (ex: HP LaserJet Pro M404dn)"
                    style={{ marginTop: 8 }}
                    required
                  />
                  <input
                    id="impressora-novo-modelo-marca"
                    name="novo_modelo_marca"
                    value={novoModeloMarca}
                    onChange={(e) => { setNovoModeloMarca(e.target.value); setDirty(true) }}
                    className="imp-input"
                    placeholder="Marca (ex: HP, Canon, Epson)"
                    style={{ marginTop: 4 }}
                  />
                </>
              )}
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-serial">Número de Série <b className="imp-required">*</b></label>
              <input id="impressora-serial" name="numero_serie" value={form.numero_serie || ''} onChange={(e) => change('numero_serie', e.target.value)} maxLength={100} required className="imp-input font-mono" placeholder="Ex: BR123456789" />
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-status">Status</label>
              <select id="impressora-status" name="status" value={form.status || 'Em Estoque'} onChange={(e) => change('status', e.target.value)} className="imp-select">
                {IMPRESSORA_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-setor">Setor</label>
              <div className="imp-select-wrapper">
                <select id="impressora-setor" name="setor_id" value={form.setor_id || ''} onChange={(e) => change('setor_id', e.target.value)} className="imp-select">
                  <option value="">Selecione um setor</option>
                  {options.setores?.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-compra">Data da Compra</label>
              <input id="impressora-compra" name="data_compra" type="date" value={form.data_compra || ''} onChange={(e) => change('data_compra', e.target.value)} className="imp-input" />
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-ano">Ano da Compra</label>
              <input id="impressora-ano" name="ano_compra" type="number" value={form.ano_compra || ''} onChange={(e) => change('ano_compra', e.target.value)} className="imp-input" placeholder="Ex: 2023" min="1900" max="2100" />
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-nf">Nota Fiscal</label>
              <input id="impressora-nf" name="nota_fiscal" value={form.nota_fiscal || ''} onChange={(e) => change('nota_fiscal', e.target.value)} maxLength={50} className="imp-input font-mono" placeholder="Ex: NF-89211" />
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-fornecedor">Fornecedor</label>
              <div className="imp-select-wrapper">
                <select id="impressora-fornecedor" name="fornecedor_id" value={form.fornecedor_id || ''} onChange={(e) => change('fornecedor_id', e.target.value)} className="imp-select">
                  <option value="">Selecione um fornecedor</option>
                  {options.fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-empresa">Empresa</label>
              <select id="impressora-empresa" name="empresa_id" value={form.empresa_id || ''} onChange={(e) => change('empresa_id', e.target.value)} className="imp-select">
                <option value="">Selecione uma empresa</option>
                {options.empresas?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div className="imp-field">
              <label htmlFor="impressora-toner">Última Troca de Toner</label>
              <input id="impressora-toner" name="data_ultima_troca_toner" type="date" value={form.data_ultima_troca_toner || ''} onChange={(e) => change('data_ultima_troca_toner', e.target.value)} className="imp-input" />
            </div>
          </div>
        </fieldset>
      </form>
      <footer className="imp-dialog-footer">
        {!view && <><small>Esc · Fechar {!loading && !saving ? '| Ctrl+S · Salvar' : ''}</small></>}
        <div className="imp-actions">
          <button className="imp-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
          {!view && <button className="imp-btn imp-btn-primary" type="submit" form="imp-form" disabled={loading || saving || (novoModelo && !novoModeloNome.trim())}>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Impressora' : 'Atualizar Alterações'}</button>}
        </div>
      </footer>
    </section>
  </div>
}
