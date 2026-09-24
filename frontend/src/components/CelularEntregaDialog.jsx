/**
 * CelularEntregaDialog — fluxo de Entrega de celular.
 *
 * Reproduz o form da entrega do legado (celulares_entregas.js).
 * Carrega celulares em estoque + funcionários para selects.
 * Após sucesso, gera o termo de entrega (.docx) via gerar_termo.php.
 */
import { useEffect, useState } from 'react'
import { celularesApi } from '../api/celulares.js'
import {
  CampoBuscaCelular,
  SelectCelular,
  useCarregarCelulares,
  useFiltroCelular,
  useFocoModal,
} from './CelularDialog.jsx'

export default function CelularEntregaDialog({ onClose, onEntregue }) {
  const { lista: celularesEstoque, carregando: carregandoCel, erro: erroCel, setErro: setErroCel } = useCarregarCelulares('estoque')
  const { busca: buscaCelular, setBusca: setBuscaCelular, filtrados: celularesFiltrados, chaves: chavesCel } = useFiltroCelular(celularesEstoque)
  const [funcionarios, setFuncionarios] = useState([])
  const [buscaFunc, setBuscaFunc] = useState('')
  const [form, setForm] = useState({ celular_id: '', funcionario_id: '', data_entrega: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const dialogRef = useFocoModal()

  useEffect(() => {
    let ativo = true
    celularesApi.listarFuncionarios()
      .then((r) => { if (ativo) setFuncionarios(r.items || r || []) })
      .catch((e) => { if (ativo) setError(`Funcionários: ${e.message}`) })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (erroCel) setError(erroCel)
  }, [erroCel])

  const termoFunc = buscaFunc.trim().toLowerCase()
  const funcionariosFiltrados = termoFunc
    ? funcionarios.filter((f) => String(f.nome || '').toLowerCase().includes(termoFunc))
    : funcionarios

  useEffect(() => {
    if (form.celular_id && !celularesEstoque.some((c) => String(c.id) === String(form.celular_id))) {
      setForm((prev) => ({ ...prev, celular_id: '' }))
    }
  }, [celularesEstoque, form.celular_id])
  useEffect(() => {
    if (form.funcionario_id && !funcionarios.some((f) => String(f.id) === String(form.funcionario_id))) {
      setForm((prev) => ({ ...prev, funcionario_id: '' }))
    }
  }, [funcionarios, form.funcionario_id])

    function close() {
    if (!saving) onClose()
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!saving) onClose() }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !form.celular_id || !form.funcionario_id || !form.data_entrega) return
    setSaving(true); setError('')

    try {
      const res = await celularesApi.entregar({
        celular_id: Number(form.celular_id),
        funcionario_id: Number(form.funcionario_id),
        data_entrega: form.data_entrega,
      })
      setSuccess('Celular entregue! Gerando termo…')

      // Dispara geração de termo de entrega
      celularesApi.gerarTermo('celular', Number(form.celular_id), Number(form.funcionario_id), 'entrega')
      setTimeout(() => {
        setSuccess('')
        onEntregue?.()
        onClose()
      }, 1200)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="celular-overlay" onClick={() => { if (!saving) onClose() }}>
      <section className="celular-dialog" ref={dialogRef}
        onClick={(e) => e.stopPropagation()} tabIndex={-1} onKeyDown={onKey}>
        <header className="func-dialog-header">
          <h2>📦 Entregar Celular</h2>
        </header>
        <form className="celular-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="func-message error" role="alert">{error}</div>}
            {success && <div className="func-message success" role="alert">{success}</div>}
            <div className="func-form-grid">
              <CampoBuscaCelular
                id="cel-ent-busca"
                busca={buscaCelular}
                setBusca={setBuscaCelular}
                total={celularesFiltrados.length}
                disabled={saving || carregandoCel}
              />
              <div className="func-field full">
                <label htmlFor="cel-ent-celular">Celular (Em Estoque)</label>
                <SelectCelular
                  id="cel-ent-celular"
                  name="celular_id"
                  value={form.celular_id}
                  onChange={handleChange}
                  lista={celularesFiltrados}
                  chaves={chavesCel}
                  placeholder={carregandoCel ? 'Carregando celulares…' : 'Selecione um celular…'}
                  disabled={saving || carregandoCel}
                  required
                />
              </div>

              <div className="func-field full">
                <label htmlFor="cel-ent-busca-func">Buscar funcionário</label>
                <input
                  id="cel-ent-busca-func"
                  type="search"
                  className="func-input"
                  placeholder="Digite o nome do funcionário…"
                  value={buscaFunc}
                  onChange={(e) => setBuscaFunc(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="func-field full">
                <label htmlFor="cel-ent-funcionario">Funcionário</label>
                <select id="cel-ent-funcionario" name="funcionario_id" className="func-select"
                  value={form.funcionario_id} onChange={handleChange}
                  disabled={saving} required>
                  <option value="">Selecione um funcionário…</option>
                  {funcionariosFiltrados.map((f) => (
                    <option key={`func-${f.id}`} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div className="func-field">
                <label htmlFor="cel-ent-data">Data da Entrega *</label>
                <input type="date" id="cel-ent-data" name="data_entrega" className="func-input"
                  value={form.data_entrega} onChange={handleChange}
                  disabled={saving} required />
              </div>
            </div>
          </div>
          <footer className="func-dialog-footer">
            <small>Esc · Cancelar</small>
            <div className="func-actions">
              <button type="button" className="func-btn" disabled={saving} onClick={onClose}>Cancelar (Esc)</button>
              <button type="submit" className="func-btn func-btn-primary" disabled={saving || !form.celular_id || !form.funcionario_id || !form.data_entrega}>
                {saving ? 'Entregando…' : 'Confirmar Entrega'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}
