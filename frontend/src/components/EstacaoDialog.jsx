import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { ACESSORIOS, EMPTY_ESTACAO, ESTACAO_STATUS, estacaoPayload, listarOpcoes } from '../api/estacoes.js'

const TABS = [['Identificação', 'badge'], ['Hardware', 'memory'], ['Aquisição', 'shopping_cart'], ['Acessórios', 'devices_other'], ['Software', 'terminal']]

export default function EstacaoDialog({ mode, id, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_ESTACAO })
  const [options, setOptions] = useState({})
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [retry, setRetry] = useState(0)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const saveLock = useRef(false)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Nova Estação' : `${view ? 'Visualizar' : 'Editar'} Estação: ${form.codigo_interno_estacao}`

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    async function load() {
      try {
        const endpoints = ['empresas', 'setores', 'funcionarios', 'monitores', 'fornecedores']
        const [record, ...lists] = await Promise.all([
          id ? api('estacoes', 'buscar_por_id', { params: { id } }) : api('estacoes', 'proximo_codigo'),
          ...endpoints.map(listarOpcoes),
        ])
        if (!active) return
        setOptions(Object.fromEntries(endpoints.map((key, index) => [key, lists[index]])))
        setForm(id ? Object.fromEntries(Object.keys(EMPTY_ESTACAO).map((key) => [key, record[key] ?? ''])) : { ...EMPTY_ESTACAO, codigo_interno_estacao: record.next_codigo })
        setLoading(false)
      } catch (e) {
        if (active) { setError(e.message); setLoading(false) }
      }
    }
    load()
    return () => { active = false }
  }, [id, retry])

  function close() {
    if (saveLock.current) return
    if (!dirty || window.confirm('Descartar as alterações não salvas?')) onClose()
  }

  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { previous?.focus() }
  }, [])

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
    if (view || loading || saveLock.current || !options.setores) return
    const invalid = [...formRef.current.querySelectorAll('input, select')].find((el) => !el.checkValidity())
    if (invalid) {
      setTab(Number(invalid.closest('[data-tab]').dataset.tab))
      setError(`Verifique o campo ${invalid.labels?.[0]?.textContent || invalid.name}.`)
      setTimeout(() => { invalid.focus(); invalid.reportValidity() }, 0)
      return
    }
    saveLock.current = true
    setSaving(true)
    setError('')
    try {
      await api('estacoes', 'salvar', { method: 'POST', body: { ...estacaoPayload(form), ...(id ? { id } : {}) } })
      onSaved(mode === 'new' ? 'Estação cadastrada com sucesso.' : 'Estação atualizada com sucesso.')
    } catch (e) { setError(e.message) }
    finally { saveLock.current = false; setSaving(false) }
  }

  function field(key, label, { list, placeholder = 'Selecione...', ...props } = {}) {
    const choices = list?.map((item) => typeof item === 'string' ? { id: item, nome: item } : item)
    return <label className="est-field" key={key} htmlFor={`est-${key}`}>
      <span>{label}{props.required && <b> *</b>}</span>
      {choices ? <select id={`est-${key}`} name={key} value={form[key]} onChange={(e) => change(key, e.target.value)} {...props}>
        <option value="">{placeholder}</option>
        {form[key] && !choices.some((item) => String(item.id) === String(form[key])) && <option value={form[key]}>{form[key]} (atual)</option>}
        {choices.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
      </select> : <input id={`est-${key}`} name={key} placeholder={placeholder === 'Selecione...' ? '' : placeholder} value={form[key]} onChange={(e) => change(key, e.target.value)} maxLength={50} {...props} />}
    </label>
  }


  return <div className="est-overlay">
    <section ref={dialogRef} className="est-dialog" role="dialog" aria-modal="true" aria-labelledby="est-dialog-title" tabIndex={-1} onKeyDown={onKey}>
      <header className="est-dialog-header">
        <span className="est-dialog-icon mat" aria-hidden="true">computer</span>
        <h2 id="est-dialog-title">{title}</h2>
        <span className={`est-mode ${mode}`}>{view ? 'SOMENTE LEITURA' : mode === 'new' ? 'NOVO CADASTRO' : 'EM EDIÇÃO'}</span>
        <button className="est-btn est-icon" type="button" aria-label="Fechar janela" disabled={saving} onClick={close}><span className="mat">close</span></button>
      </header>
      <div className="est-tabs" role="tablist" aria-label="Dados da estação">
        {TABS.map(([label, icon], index) => <button key={label} id={`est-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls={`est-panel-${index}`} tabIndex={tab === index ? 0 : -1} className={tab === index ? 'active' : ''} type="button" onClick={() => setTab(index)} onKeyDown={(e) => {
          const next = e.key === 'ArrowRight' ? (index + 1) % TABS.length : e.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null
          if (next !== null) { e.preventDefault(); setTab(next); document.getElementById(`est-tab-${next}`)?.focus() }
        }}><span className="mat" aria-hidden="true">{icon}</span>{label}</button>)}
      </div>
      <form id="est-form" ref={formRef} className="est-form" onSubmit={save} noValidate>
        {loading && <p role="status">Carregando cadastro e opções…</p>}
        {error && <div className="est-message error" role="alert">{error}{!options.setores && !loading && <button type="button" className="est-btn" onClick={() => setRetry((v) => v + 1)}>Tentar novamente</button>}</div>}
        <fieldset disabled={view || loading || saving || !options.setores}>
          <div id="est-panel-0" role="tabpanel" aria-labelledby="est-tab-0" data-tab="0" hidden={tab !== 0}>
            <h3 className="est-section-title">Identificação e alocação do equipamento</h3>
            <div className="est-form-grid">
              {field('codigo_interno_estacao', 'Código interno', { required: true, readOnly: true })}
              {field('empresa_id', 'Empresa / Unidade', { list: options.empresas || [] })}
              {field('setor_id', 'Setor responsável', { required: true, list: options.setores || [] })}
              {field('funcionario_id', 'Funcionário responsável', { list: options.funcionarios || [], placeholder: 'Não atribuído' })}
              {field('ip', 'Endereço IP (IPv4)', { maxLength: 20, placeholder: '192.168.1.100', pattern: '((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])' })}
              {field('status', 'Status operacional', { required: true, list: ESTACAO_STATUS })}
            </div>
            <p className="est-note">O código é sugerido pela API. Campos marcados com * são obrigatórios.</p>
          </div>
          <div id="est-panel-1" role="tabpanel" aria-labelledby="est-tab-1" data-tab="1" hidden={tab !== 1}>
            <h3 className="est-section-title">Configuração de hardware</h3>
            <div className="est-form-grid">
              {field('processador', 'Processador', { placeholder: 'Ex.: Intel Core i5' })}
              {field('memoria', 'Memória RAM', { placeholder: 'Ex.: 16 GB DDR4' })}
              {field('hd', 'Armazenamento HD / SSD', { placeholder: 'Ex.: SSD 512 GB' })}
              {field('estado_hd', 'Estado do HD / SSD', { list: ['Novo', 'Usado', 'Ruim', 'Trocar em breve', 'Desconhecido'] })}
              {field('id_monitor', 'Monitor vinculado', { list: (options.monitores || []).map((m) => ({ id: m.id, nome: [m.codigo_interno_monitor, m.marca, m.modelo].filter(Boolean).join(' - ') })), placeholder: 'Nenhum monitor vinculado' })}
            </div>
          </div>

          <div id="est-panel-2" role="tabpanel" aria-labelledby="est-tab-2" data-tab="2" hidden={tab !== 2}>
            <h3 className="est-section-title">Dados fiscais e aquisição</h3>
            <div className="est-form-grid">
              {field('ano_compra', 'Ano de compra', { type: 'number', min: 1901, max: 2155, step: 1 })}
              {field('data_compra', 'Data da compra', { type: 'date' })}
              {field('nota_fiscal', 'Nota fiscal', { placeholder: 'NF-e / Série' })}
              {field('fornecedor_id', 'Fornecedor homologado', { list: options.fornecedores || [] })}
            </div>
          </div>
          <div id="est-panel-3" role="tabpanel" aria-labelledby="est-tab-3" data-tab="3" hidden={tab !== 3}>
            <h3 className="est-section-title">Periféricos e acessórios de mesa entregues</h3>
            <div className="est-accessories">{ACESSORIOS.map(([value, label, icon]) => <label key={value}>
              <input type="checkbox" checked={String(form.acessorios).split(',').includes(value)} onChange={(e) => {
                const selected = new Set(String(form.acessorios).split(',').filter(Boolean))
                if (e.target.checked) selected.add(value); else selected.delete(value)
                change('acessorios', [...selected].join(','))
              }} />
              <span className="mat" aria-hidden="true">{icon}</span>{label}
            </label>)}</div>
            <p className="est-note">Os acessórios ficam registrados na estação. Esta tela não gera termo de entrega ou assinatura eletrônica.</p>
          </div>
          <div id="est-panel-4" role="tabpanel" aria-labelledby="est-tab-4" data-tab="4" hidden={tab !== 4}>
            <h3 className="est-section-title">Softwares e licenças</h3>
            <div className="est-note">O vínculo de softwares por estação ainda não é disponibilizado pela API atual. Esta aba foi preservada conforme a UX, sem simular dados ou salvar vínculos inexistentes.</div>
          </div>
        </fieldset>
      </form>
      <footer className="est-dialog-footer">
        <small>Esc · Fechar{!view && ' | Ctrl+S · Salvar'}</small>
        <div className="est-actions">
          <button className="est-btn" type="button" disabled={saving} onClick={close}>{view ? 'Fechar' : 'Cancelar (Esc)'}</button>
          {!view && <button className="est-btn primary" type="submit" form="est-form" disabled={loading || saving || !options.setores}><span className="mat" aria-hidden="true">save</span>{saving ? 'Salvando…' : mode === 'new' ? 'Salvar Estação' : 'Atualizar Alterações'}</button>}
        </div>
      </footer>
    </section>
  </div>
}
