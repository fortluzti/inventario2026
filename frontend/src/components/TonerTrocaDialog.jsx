import { useEffect, useMemo, useRef, useState } from 'react'
import { listarTodas } from '../api/impressoras.js'
import { listarCompativeis, registrarTroca } from '../api/toners.js'
import SearchableSelect, { toSearchOptions } from './SearchableSelect.jsx'

/**
 * TonerTrocaDialog — "Registrar Troca" em MODAL sobre a lista de Toners.
 *
 * Reproduz o fluxo do legado (js/toners.js → #registrar-troca-modal) adaptado às
 * regras atuais:
 *  - a IMPRESSORA determina os consumíveis compatíveis (relação existente
 *    `impressora_modelos_toner`, migration 006) — TONER e CILINDRO na mesma operação;
 *  - o RESPONSÁVEL é sempre o usuário logado: não há seleção de funcionário.
 */
export default function TonerTrocaDialog({ user, onClose, onSaved }) {
  const [impressoras, setImpressoras] = useState([])
  const [carregandoImp, setCarregandoImp] = useState(true)
  const [compativeis, setCompativeis] = useState([])
  const [carregandoComp, setCarregandoComp] = useState(false)
  const [form, setForm] = useState({ id_impressora: '', id_toner: '' })
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const dialogRef = useRef(null)

  useEffect(() => {
    let ativo = true
    listarTodas()
      .then((items) => { if (ativo) setImpressoras(items) })
      .catch((e) => { if (ativo) setError(`Impressoras: ${e.message}`) })
      .finally(() => { if (ativo) setCarregandoImp(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => { dialogRef.current?.focus() }, [])

  function close() { if (!lock.current) onClose() }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  }

  /* Trocar a impressora recarrega os consumíveis compatíveis com o modelo dela. */
  async function trocarImpressora(valor) {
    setForm({ id_impressora: valor, id_toner: '' })
    setCompativeis([])
    setError('')
    if (!valor) return
    setCarregandoComp(true)
    try {
      setCompativeis(await listarCompativeis(valor))
    } catch (e) {
      setError(e.message)
    } finally {
      setCarregandoComp(false)
    }
  }

  const impressoraLabel = (i) => [i.codigo_interno_impressora, i.modelo_nome, i.setor_nome].filter(Boolean).join(' · ')
  const tonerLabel = (t) => `${t.codigo} · ${t.tipo} · estoque ${t.estoque ?? 0}`
  const impOptions = useMemo(
    () => toSearchOptions(impressoras, { labelOf: impressoraLabel, extraOf: (i) => [i.modelo_nome, i.setor_nome].filter(Boolean).join(' ') }),
    [impressoras],
  )
  const tonerOptions = useMemo(
    () => toSearchOptions(compativeis, { labelOf: tonerLabel, extraOf: (t) => t.tipo }),
    [compativeis],
  )

  async function submit(e) {
    e.preventDefault()
    if (lock.current || saving) return
    if (!form.id_impressora) { setError('Selecione a impressora.'); return }
    if (!form.id_toner) { setError('Selecione o consumível utilizado.'); return }
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const res = await registrarTroca({
        id_impressora: form.id_impressora,
        id_toner: form.id_toner,
        observacoes,
        usuario: user?.usuario,
      })
      onSaved?.(`Troca de ${res?.codigo || 'consumível'} registrada. Estoque atualizado para ${res?.estoque ?? 0}.`)
    } catch (err) {
      setError(err.message)
      lock.current = false
      setSaving(false)
    }
  }

  const semCompativel = !carregandoComp && !!form.id_impressora && compativeis.length === 0

  return (
    <div className="tnd-overlay" onKeyDown={onKey}>
      <section className="tnd-dialog" role="dialog" aria-modal="true" aria-label="Registrar Troca" tabIndex={-1} ref={dialogRef}>
        <header className="tnd-dialog-header">
          <span className="mat tnd-dialog-icon" aria-hidden="true">swap_horiz</span>
          <h2>Registrar Troca</h2>
          <span className="tnd-mode">OPERAÇÃO</span>
          <button className="tnd-btn tnd-btn-icon" type="button" aria-label="Fechar" onClick={close}><span className="mat">close</span></button>
        </header>
        <form id="tnd-troca-form" className="tnd-form" onSubmit={submit}>
          <div className="tnd-form-grid">
            <div className="tnd-field full">
              <label htmlFor="tnd-troca-impressora">Impressora *</label>
              <SearchableSelect
                id="tnd-troca-impressora"
                ariaLabel="Impressora"
                options={impOptions}
                value={form.id_impressora}
                onChange={(v) => trocarImpressora(v)}
                placeholder={carregandoImp ? 'Carregando impressoras…' : 'Selecione a impressora…'}
                loading={carregandoImp}
                disabled={saving || carregandoImp}
              />
              <p className="tnd-hint">A impressora determina os consumíveis compatíveis (TONER e CILINDRO na mesma operação).</p>
            </div>

            <div className="tnd-field full">
              <label htmlFor="tnd-troca-toner">Consumível utilizado *</label>
              <SearchableSelect
                id="tnd-troca-toner"
                ariaLabel="Consumível utilizado"
                options={tonerOptions}
                value={form.id_toner}
                onChange={(v) => setForm((f) => ({ ...f, id_toner: v }))}
                placeholder={!form.id_impressora ? 'Selecione a impressora primeiro' : carregandoComp ? 'Carregando…' : 'Selecione o consumível…'}
                loading={carregandoComp}
                disabled={saving || carregandoComp || !form.id_impressora}
              />
              {semCompativel && (
                <p className="tnd-hint">
                  Nenhum consumível vinculado ao modelo desta impressora. Cadastre a compatibilidade no cadastro do consumível.
                </p>
              )}
            </div>

            <div className="tnd-field full">
              <label>Responsável pela troca</label>
              <p className="tnd-responsavel">
                <span className="mat" aria-hidden="true">badge</span>
                {user?.usuario || 'usuário logado'}
                <span className="tnd-responsavel-tag">USUÁRIO LOGADO</span>
              </p>
            </div>

            <div className="tnd-field full">
              <label htmlFor="tnd-troca-obs">Observações</label>
              <textarea
                id="tnd-troca-obs"
                className="tnd-input tnd-textarea"
                rows={3}
                maxLength={1000}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          {error && <div className="tnd-message error" role="alert">{error}</div>}
        </form>
        <footer className="tnd-dialog-footer">
          <small>Esc · Fechar</small>
          <div className="tnd-actions">
            <button className="tnd-btn" type="button" disabled={saving} onClick={close}>Cancelar (Esc)</button>
            <button
              className="tnd-btn tnd-btn-primary"
              type="submit"
              form="tnd-troca-form"
              disabled={saving || !form.id_impressora || !form.id_toner}
            >
              {saving ? 'Registrando…' : 'Registrar Troca'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
