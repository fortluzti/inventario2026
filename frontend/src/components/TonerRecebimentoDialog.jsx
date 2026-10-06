import { useEffect, useMemo, useRef, useState } from 'react'
import { listarOpcoes as listarFuncionarios } from '../api/funcionarios.js'
import { listarOpcoes as listarFornecedores } from '../api/fornecedores.js'
import { listarConsumiveis, receberMultiplos } from '../api/toners.js'
import SearchableSelect, { toSearchOptions } from './SearchableSelect.jsx'

const hoje = () => new Date().toISOString().slice(0, 10)

/**
 * TonerRecebimentoDialog — "Recebimento de Toners" em MODAL sobre a lista.
 *
 * Reproduz o recebimento MÚLTIPLO do legado (#recebimento-multiplo-modal):
 * funcionário recebedor + data/observação + VÁRIOS consumíveis com quantidade.
 * Ao confirmar, a API soma o estoque e grava `recebimentos_toner` — nesta tela
 * não existe página separada de recebimentos.
 */
export default function TonerRecebimentoDialog({ user, onClose, onSaved }) {
  const [funcionarios, setFuncionarios] = useState([])
  const [consumiveis, setConsumiveis] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState({ funcionario_recebedor_id: '', fornecedor_id: '', data_recebimento: hoje(), observacoes: '' })
  const [itens, setItens] = useState([]) // [{ toner_id, codigo, quantidade }]
  const [novoTonerId, setNovoTonerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const dialogRef = useRef(null)

  useEffect(() => {
    let ativo = true
    Promise.all([listarFuncionarios(), listarConsumiveis(), listarFornecedores()])
      .then(([funcs, cons, forns]) => {
        if (!ativo) return
        setFuncionarios(funcs)
        setConsumiveis(cons)
        setFornecedores(forns)
      })
      .catch((e) => { if (ativo) setError(e.message) })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => { dialogRef.current?.focus() }, [])

  function close() { if (!lock.current) onClose() }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  }

  function change(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  /* Consumíveis já no lote ficam fora do select de adição. */
  const disponiveis = consumiveis.filter((c) => !itens.some((i) => Number(i.toner_id) === Number(c.id)))

  function adicionar() {
    const id = Number(novoTonerId)
    if (!id) return
    const c = consumiveis.find((x) => Number(x.id) === id)
    if (!c) return
    setItens((prev) => [...prev, { toner_id: id, codigo: c.nome || `#${id}`, quantidade: 1 }])
    setNovoTonerId('')
    setError('')
  }

  function alterarQuantidade(tonerId, qtd) {
    setItens((prev) => prev.map((i) => (Number(i.toner_id) === Number(tonerId) ? { ...i, quantidade: qtd } : i)))
  }

  function remover(tonerId) {
    setItens((prev) => prev.filter((i) => Number(i.toner_id) !== Number(tonerId)))
  }

  const validos = itens.filter((i) => Number(i.quantidade) > 0)

  const funcOptions = useMemo(() => toSearchOptions(funcionarios, { labelOf: (f) => f.nome, extraOf: (f) => f.cargo }), [funcionarios])
  const fornOptions = useMemo(
    () => toSearchOptions(fornecedores, { labelOf: (f) => f.nome, extraOf: (f) => [f.cnpj, f.nome_vendedor].filter(Boolean).join(' ') }),
    [fornecedores],
  )
  const tonerAddOptions = useMemo(
    () => toSearchOptions(disponiveis, { labelOf: (c) => c.nome, extraOf: (c) => [c.codigo, c.tipo].filter(Boolean).join(' ') }),
    [disponiveis],
  )

  function pick(name) {
    return (v) => { setForm((prev) => ({ ...prev, [name]: v })); setError('') }
  }

  async function submit(e) {
    e.preventDefault()
    if (lock.current || saving) return
    if (!form.funcionario_recebedor_id) { setError('Selecione o funcionário recebedor.'); return }
    if (validos.length === 0) { setError('Adicione ao menos um consumível com quantidade.'); return }
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const res = await receberMultiplos({
        funcionario_recebedor_id: form.funcionario_recebedor_id,
        fornecedor_id: form.fornecedor_id,
        data_recebimento: form.data_recebimento,
        observacoes: form.observacoes,
        toners: validos.map((i) => ({ toner_id: i.toner_id, quantidade: i.quantidade })),
        usuario: user?.usuario,
      })
      const total = validos.reduce((s, i) => s + Number(i.quantidade || 0), 0)
      onSaved?.(
        `Recebimento registrado: ${validos.length} consumível(is) · ${total} unidade(s) para ${res?.funcionario_recebedor || 'recebedor'}. Estoque atualizado.`
      )
    } catch (err) {
      setError(err.message)
      lock.current = false
      setSaving(false)
    }
  }

  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog" role="dialog" aria-modal="true" aria-label="Recebimento de Toners" tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">move_to_inbox</span>
          <h2>Recebimento de Toners</h2>
          <span className="tnd-mode">OPERAÇÃO</span>
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="tnd-receb-form" className="tnd-form" onSubmit={submit}>
          <div className="tnd-form-grid">
            <div className="tnd-field">
              <label htmlFor="tnd-receb-func">Funcionário recebedor *</label>
              <SearchableSelect
                id="tnd-receb-func"
                ariaLabel="Funcionário recebedor"
                options={funcOptions}
                value={form.funcionario_recebedor_id}
                onChange={pick('funcionario_recebedor_id')}
                placeholder={carregando ? 'Carregando…' : 'Selecione o funcionário…'}
                loading={carregando}
                disabled={saving}
              />
            </div>

            <div className="tnd-field">
              <label htmlFor="tnd-receb-fornecedor">Fornecedor (opcional)</label>
              <SearchableSelect
                id="tnd-receb-fornecedor"
                ariaLabel="Fornecedor do recebimento"
                options={fornOptions}
                value={form.fornecedor_id}
                onChange={pick('fornecedor_id')}
                placeholder="Sem fornecedor…"
                loading={carregando}
                disabled={saving}
                emptyText="Nenhum fornecedor ativo encontrado."
              />
            </div>

            <div className="tnd-field">
              <label htmlFor="tnd-receb-data">Data do recebimento</label>
              <input
                id="tnd-receb-data"
                name="data_recebimento"
                type="date"
                className="tnd-input"
                value={form.data_recebimento}
                onChange={change}
                disabled={saving}
              />
            </div>

            <div className="tnd-field full">
              <label htmlFor="tnd-receb-obs">Observação</label>
              <textarea
                id="tnd-receb-obs"
                name="observacoes"
                className="tnd-input tnd-textarea"
                rows={2}
                maxLength={1000}
                value={form.observacoes}
                onChange={change}
                disabled={saving}
              />
            </div>
          </div>

          <section className="tnd-receb" aria-labelledby="tnd-receb-title">
            <header className="tnd-receb-head">
              <span className="mat" aria-hidden="true">inventory_2</span>
              <h3 id="tnd-receb-title">Consumíveis recebidos</h3>
              <span className="tnd-compat-count" aria-label={`${itens.length} item(ns)`}>{itens.length}</span>
            </header>

            <div className="tnd-receb-add">
              <label className="tnd-sr-only" htmlFor="tnd-receb-toner">Adicionar consumível</label>
              <SearchableSelect
                id="tnd-receb-toner"
                ariaLabel="Adicionar consumível"
                options={tonerAddOptions}
                value={novoTonerId}
                onChange={setNovoTonerId}
                placeholder={carregando ? 'Carregando…' : 'Selecione o consumível…'}
                loading={carregando}
                disabled={saving || carregando}
              />
              <button className="tnd-btn" type="button" onClick={adicionar} disabled={saving || !novoTonerId}>
                <span className="mat" aria-hidden="true">add</span>Adicionar
              </button>
            </div>

            {itens.length === 0 ? (
              <p className="tnd-receb-empty">Nenhum consumível no lote. Adicione ao menos um.</p>
            ) : (
              <ul className="tnd-receb-itens">
                {itens.map((i) => (
                  <li key={i.toner_id} className="tnd-receb-item">
                    <span className="tnd-receb-codigo">{i.codigo}</span>
                    <label className="tnd-receb-qtd">
                      Qtd.
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="tnd-input"
                        value={i.quantidade}
                        disabled={saving}
                        onChange={(e) => alterarQuantidade(i.toner_id, Number(e.target.value))}
                        aria-label={`Quantidade de ${i.codigo}`}
                      />
                    </label>
                    <button
                      className="tnd-btn tnd-btn-icon danger"
                      type="button"
                      title="Remover"
                      aria-label={`Remover ${i.codigo}`}
                      disabled={saving}
                      onClick={() => remover(i.toner_id)}
                    >
                      <span className="mat">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && <div className="tnd-message error" role="alert">{error}</div>}
        </form>
        <footer className="tnd-dialog-footer">
          <small>Esc · Fechar</small>
          <div className="tnd-actions">
            <button className="tnd-btn" type="button" disabled={saving} onClick={close}>Cancelar (Esc)</button>
            <button
              className="tnd-btn tnd-btn-primary"
              type="submit"
              form="tnd-receb-form"
              disabled={saving || !form.funcionario_recebedor_id || validos.length === 0}
            >
              {saving ? 'Registrando…' : 'Confirmar Recebimento'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
