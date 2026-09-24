import { useEffect, useMemo, useRef, useState } from 'react'
import { celularesApi } from '../api/celulares.js'

function rotuloCelular(c) {
  const partes = [
    c.codigo_interno_celular,
    [c.marca, c.modelo].filter(Boolean).join(' '),
    c.numero ? `nº ${c.numero}` : null,
    c.imei ? `IMEI ${c.imei}` : null,
    c.usuario_atual || c.nome_usuario ? `· ${c.usuario_atual || c.nome_usuario}` : null,
  ].filter(Boolean)
  return partes.join(' — ')
}

function normalizar(texto) {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function useFiltroCelular(lista) {
  const [busca, setBusca] = useState('')
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return lista
    const digitos = termo.replace(/\D/g, '')
    return lista.filter((c) => {
      const alvo = normalizar([
        c.codigo_interno_celular, c.marca, c.modelo, c.numero,
        c.imei, c.usuario_atual, c.nome_usuario,
      ].filter(Boolean).join(' | '))
      if (alvo.includes(termo)) return true
      if (digitos.length >= 3) {
        const alvoDigitos = String([
          c.codigo_interno_celular, c.numero, c.imei,
        ].filter(Boolean).join(' | ')).replace(/\D/g, '')
        if (alvoDigitos.includes(digitos)) return true
      }
      return false
    })
  }, [lista, busca])
  // Keys únicas e estáveis: prefixo por fonte + id. (listarEmUso agora devolve
  // 1 linha por celular, mas a defesa aqui impede warnings se a API repetir ids.)
  const chaves = useMemo(() => {
    const vistos = new Map()
    return new Map(filtrados.map((c) => {
      const base = `cel-${c.id ?? 'sem-id'}`
      const n = (vistos.get(base) || 0) + 1
      vistos.set(base, n)
      return [c.id, n > 1 ? `${base}#${n}` : base]
    }))
  }, [filtrados])
  return { busca, setBusca, filtrados, chaves }
}

export function CampoBuscaCelular({ id, busca, setBusca, total, disabled }) {
  return (
    <div className="func-field full">
      <label htmlFor={id}>Buscar celular</label>
      <input
        id={id}
        type="search"
        className="func-input"
        placeholder="Digite número, código, IMEI ou nome do funcionário…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      <small className="func-hint">
        {busca.trim()
          ? `${total} resultado${total === 1 ? '' : 's'} para “${busca.trim()}”`
          : 'Liste ou refine pelos campos do aparelho/usuário.'}
      </small>
    </div>
  )
}

export function SelectCelular({ id, name, value, onChange, lista, chaves, placeholder, disabled, required }) {
  const selecionado = lista.find((c) => String(c.id) === String(value))
  return (
    <>
      <select
        id={id}
        name={name}
        className="func-select"
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      >
        <option value="">{placeholder}</option>
        {lista.map((c) => (
          <option key={chaves.get(c.id) || `cel-${c.id}`} value={c.id}>
            {rotuloCelular(c)}
          </option>
        ))}
      </select>
      {selecionado && (
        <small className="func-hint">
          Selecionado: {rotuloCelular(selecionado)}{selecionado.status ? ` · ${selecionado.status}` : ''}
        </small>
      )}
    </>
  )
}

export function useCarregarCelulares(fonte) {
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    const fontes = {
      estoque: [() => celularesApi.listarEmEstoque()],
      uso: [() => celularesApi.listarEmUso()],
      todos: [() => celularesApi.listarEmEstoque(), () => celularesApi.listarEmUso()],
    }[fonte] || [() => celularesApi.listarEmEstoque()]
    Promise.all(fontes.map((fn) => fn()))
      .then((respostas) => {
        if (!ativo) return
        const combinada = respostas.flatMap((r) => r.items || r || [])
        // Deduplica por id preservando a primeira ocorrência (estoque antes de uso).
        const vistos = new Set()
        setLista(combinada.filter((c) => {
          const id = c?.id
          if (id == null || vistos.has(id)) return false
          vistos.add(id)
          return true
        }))
      })
      .catch((e) => { if (ativo) setErro(`Celulares: ${e.message}`) })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [fonte])
  return { lista, carregando, erro, setErro }
}

export function useFocoModal() {
  const dialogRef = useRef(null)
  useEffect(() => {
    const anterior = document.activeElement
    dialogRef.current?.focus()
    return () => { anterior?.focus?.() }
  }, [])
  return dialogRef
}


const EMPTY = {
  marca: '', modelo: '', imei: '', serial: '', numero: '',
  status: 'Em Estoque', data_compra: '',
  nota_fiscal: '', fornecedor_id: '', empresa_id: '',
}

const STATUS_OPTIONS = ['Em Estoque', 'Em Uso', 'Danificado']

export default function CelularDialog({ mode = 'new', id, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveLock = useRef(false)
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const view = mode === 'view'
  const title = mode === 'new' ? 'Novo Celular' : view ? 'Visualizar Celular' : 'Editar Celular'

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setLoading(true); setError('')
      celularesApi.buscarPorId(id)
        .then((row) => {
          if (row) setForm({
            marca: row.marca || '', modelo: row.modelo || '',
            imei: row.imei || '', serial: row.serial || '',
                        numero: row.numero || '', status: row.status || 'Em Estoque',
            data_compra: row.data_compra || '',
            nota_fiscal: row.nota_fiscal || '', fornecedor_id: row.fornecedor_id || '',
            empresa_id: row.empresa_id || '',
          })
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
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
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value }))
    setDirty(true)
  }

  async function save(e) {
    e.preventDefault()
    if (view || loading || saveLock.current) return
    saveLock.current = true
    const invalid = [...formRef.current.querySelectorAll('input:not([type="hidden"]), select')].find((el) => !el.checkValidity())
    if (invalid) { invalid.focus(); invalid.reportValidity(); saveLock.current = false; return }
    setSaving(true); setError('')
    try {
      await celularesApi.salvar({ ...form, id: mode === 'edit' ? id : undefined })
      onSaved()
        } catch (e) { setError(e.message) } finally { setSaving(false); saveLock.current = false }
  }

  const codigo = form.codigo_interno_celular || (mode === 'new' ? '(auto)' : '')

  return (
    <div className="celular-overlay" onClick={close}>
      <section className="celular-dialog" ref={dialogRef}
        onClick={(e) => e.stopPropagation()} tabIndex={-1} onKeyDown={onKey}>
        <header className="func-dialog-header">
          <h2>{title}</h2>
          <span className="celular-codigo-badge">#{codigo}</span>
        </header>
        <form id="celular-form" className="celular-form" ref={formRef} onSubmit={save}>
          <input type="hidden" name="id" value={id || ''} />
          <div className="modal-body">
            {loading ? (
              <p style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af' }}>Carregando…</p>
            ) : (
              <>
                {error && <div className="func-message error" role="alert">{error}</div>}
                <div className="func-form-grid">
                  <div className="func-field"><label htmlFor="cel-marca">Marca *</label>
                    <input id="cel-marca" name="marca" className="func-input"
                      value={form.marca || ''} onChange={handleChange}
                      disabled={view} required maxLength={100} autoFocus />
                  </div>
                  <div className="func-field"><label htmlFor="cel-modelo">Modelo *</label>
                    <input id="cel-modelo" name="modelo" className="func-input"
                      value={form.modelo || ''} onChange={handleChange}
                      disabled={view} required maxLength={150} />
                  </div>
                  <div className="func-field"><label htmlFor="cel-imei">IMEI *</label>
                    <input id="cel-imei" name="imei" className="func-input"
                      value={form.imei || ''} onChange={handleChange}
                      disabled={view} required maxLength={50} placeholder="13 dígitos" />
                  </div>
                  <div className="func-field"><label htmlFor="cel-serial">Serial</label>
                    <input id="cel-serial" name="serial" className="func-input"
                      value={form.serial || ''} onChange={handleChange}
                      disabled={view} maxLength={100} />
                  </div>
                  <div className="func-field"><label htmlFor="cel-numero">Número</label>
                    <input id="cel-numero" name="numero" className="func-input"
                      value={form.numero || ''} onChange={handleChange}
                      disabled={view} maxLength={30} placeholder="Ex: (11) 99999-9999" />
                  </div>
                  <div className="func-field"><label htmlFor="cel-status">Status</label>
                    {view ? <input type="text" className="func-input" readOnly value={form.status || ''} /> : (
                      <select id="cel-status" name="status" className="func-select"
                        value={form.status || ''} onChange={handleChange}>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="func-field"><label htmlFor="cel-data_compra">Data da Compra</label>
                    <input type="date" id="cel-data_compra" name="data_compra" className="func-input"
                      value={form.data_compra || ''} onChange={handleChange} disabled={view} />
                  </div>
                  <div className="func-field"><label htmlFor="cel-nota_fiscal">Nota Fiscal</label>
                    <input id="cel-nota_fiscal" name="nota_fiscal" className="func-input"
                      value={form.nota_fiscal || ''} onChange={handleChange}
                      disabled={view} maxLength={100} />
                  </div>
                </div>
              </>
            )}
          </div>
          <footer className="func-dialog-footer">
            {!view && <small>Esc · Fechar {(!loading && !saving) ? '| Ctrl+S · Salvar' : ''}</small>}
            <div className="func-actions">
              <button type="button" className="func-btn" disabled={saving} onClick={close}>
                {view ? 'Fechar' : 'Cancelar (Esc)'}
              </button>
              {!view && (
                <button type="submit" className="func-btn func-btn-primary" form="celular-form" disabled={loading || saving}>
                  {saving ? 'Salvando…' : mode === 'new' ? 'Salvar Celular' : 'Atualizar Alterações'}
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
