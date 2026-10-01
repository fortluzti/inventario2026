// Smoke: Modelos de Impressoras — item no grupo "2. Equipamentos & TI", listagem e
// CRUD em modal + associação de consumíveis compatíveis (tabela
// `impressora_modelos_toner`, migration 006). API 100% em memória: nenhum registro
// real é alterado e o tipo (TONER/CILINDRO) vem sempre de `toner.tipo`.
export async function testImpressoraModelos({ container, act, check, setVal, dom }) {
  const originalFetch = globalThis.fetch
  const realConfirm = dom.window.confirm

  /* ---- massa mock (espelha o inventario2) ---- */
  const TONERS = [
    { id: 49, codigo: 'W1330X', tipo: 'TONER', estoque: 2 },
    { id: 56, codigo: 'W1332', tipo: 'CILINDRO', estoque: 1 },
    { id: 58, codigo: 'W1330A', tipo: 'TONER', estoque: 0 },
    { id: 59, codigo: 'W1330', tipo: 'TONER', estoque: 0 },
  ]
  let MODELOS = [
    { id: 29, nome_modelo: 'HP LASER PRINTER 408DN', marca: 'HP', descricao: null, estoque_minimo_toner: 0, estoque_minimo_cilindro: 0 },
  ]
  let ASSOC = [] // { id, modelo_id, toner_id }
  let nextModelo = 30
  let nextAssoc = 1
  const calls = []

  const ok = (data) => ({ status: 200, json: async () => ({ success: true, data }) })
  const err = (status, message) => ({ status, json: async () => ({ success: false, message }) })

  globalThis.fetch = dom.window.fetch = async (url, opts = {}) => {
    const u = new URL(String(url), 'http://localhost')
    const ep = u.searchParams.get('endpoint')
    const action = u.searchParams.get('action')
    if (!['impressoras_modelos', 'impressora_modelos_toner', 'toners'].includes(ep)) {
      return originalFetch(url, opts)
    }
    let body = null
    try { body = opts.body ? JSON.parse(opts.body) : null } catch { /* corpo inválido */ }
    calls.push({ endpoint: ep, action, method: opts.method || 'GET', body, params: u.searchParams })

    if (ep === 'toners') {
      if (action === 'listar') return ok({ items: TONERS, total: TONERS.length, page: 1, limit: 200, total_pages: 1 })
      return err(400, 'Ação não prevista para toners.')
    }

    if (ep === 'impressora_modelos_toner') {
      if (action === 'listar') {
        const mid = Number(u.searchParams.get('modelo_id') || 0)
        const items = ASSOC.filter((a) => !mid || a.modelo_id === mid).map((a) => {
          const t = TONERS.find((x) => x.id === a.toner_id)
          // tipo SEMPRE vem do cadastro (toner.tipo) — nunca do cliente
          return { ...a, toner_codigo: t.codigo, toner_tipo: t.tipo, toner_estoque: t.estoque }
        })
        return ok({ items, total: items.length, page: 1, limit: 200, total_pages: 1 })
      }
      if (action === 'salvar') {
        const modeloId = Number(body && body.modelo_id)
        const tonerId = Number(body && body.toner_id)
        if (ASSOC.some((a) => a.modelo_id === modeloId && a.toner_id === tonerId)) {
          return err(409, 'Registro duplicado: ja existe um registro com este valor unico.')
        }
        const row = { id: nextAssoc++, modelo_id: modeloId, toner_id: tonerId }
        ASSOC.push(row)
        return ok({ id: row.id })
      }
      if (action === 'excluir') {
        ASSOC = ASSOC.filter((a) => a.id !== Number(body && body.id))
        return ok(null)
      }
      return err(400, 'Ação não prevista para impressora_modelos_toner.')
    }

    // impressoras_modelos
    if (action === 'listar') {
      const search = (u.searchParams.get('search') || '').toLowerCase()
      const items = MODELOS.filter((m) => !search || `${m.nome_modelo} ${m.marca}`.toLowerCase().includes(search))
      return ok({ items, total: items.length, page: 1, limit: 20, total_pages: 1 })
    }
    if (action === 'buscar_por_id') {
      const row = MODELOS.find((m) => m.id === Number(u.searchParams.get('id')))
      return row ? ok(row) : err(404, 'Registro nao encontrado.')
    }
    if (action === 'salvar') {
      if (body && body.id) {
        const row = MODELOS.find((m) => m.id === Number(body.id))
        Object.assign(row, body)
        return ok({ id: row.id })
      }
      const row = { id: nextModelo++, ...(body || {}) }
      MODELOS.push(row)
      return ok({ id: row.id })
    }
    if (action === 'excluir') {
      const id = Number(body && body.id)
      MODELOS = MODELOS.filter((m) => m.id !== id)
      ASSOC = ASSOC.filter((a) => a.modelo_id !== id)
      return ok(null)
    }
    return err(400, `Ação inválida: ${ep}/${action}`)
  }

  /* ---- helpers locais (mesmo padrão dos demais specs) ---- */
  const flush = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
  const expect = (cond, name) => check(name, cond)
  const click = async (el) => {
    if (!el) throw new Error('Controle esperado não encontrado')
    await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  }
  const change = async (el, v) => {
    await act(async () => {
      el.value = v
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
  }
  const submit = async () => {
    const form = container.querySelector('#imo-form')
    await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })) })
    await flush()
  }
  const btn = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text))
  const chips = (grupo) => [...container.querySelectorAll(`.imo-assoc-grupo.tipo-${grupo} .imo-chip-code`)].map((el) => el.textContent)
  const assocCalls = () => calls.filter((c) => c.endpoint === 'impressora_modelos_toner')
  const linhaDoModelo = (nome) => [...container.querySelectorAll('.imo-table tbody tr')].find((tr) => tr.textContent.includes(nome))

  try {
    /* ---------- menu: grupo "2. Equipamentos & TI", logo após Impressoras ---------- */
    const itens = [...container.querySelectorAll('.module-item')].map((b) => b.textContent)
    const idxImpressoras = itens.findIndex((t) => t.includes('Impressoras') && !t.includes('Etiquetas') && !t.includes('Modelos'))
    const idxModelos = itens.findIndex((t) => t.includes('Modelos de Impressoras'))
    expect(idxModelos > -1 && idxModelos > idxImpressoras, 'menu: "Modelos de Impressoras" vem depois de "Impressoras"')
    expect(itens.filter((t) => t.includes('Modelos de Impressoras')).length === 1, 'menu: item único (não duplica o módulo "Modelos" das Etiquetas)')

    await click([...container.querySelectorAll('.module-item')].find((b) => b.textContent.includes('Modelos de Impressoras')))
    await flush()
    expect(!!container.querySelector('.imo-page'), 'menu abre a listagem de Modelos de Impressoras')
    expect(container.querySelectorAll('.imo-table th').length === 6, 'grid com 6 colunas (mínimos de toner/cilindro inclusos)')

    /* ---------- novo modelo + associações em um único salvar ---------- */
    await click(btn('Novo Modelo'))
    await flush()
    expect(!!container.querySelector('#imo-form'), 'modal "Novo Modelo de Impressora" abre')
    expect(!!container.querySelector('.imo-assoc'), 'modal traz a seção de Consumíveis Compatíveis')
    expect(!container.querySelector('#imo-form [name="tipo"]'), 'usuário NÃO classifica o tipo do consumível no modal')

    await act(async () => {
      setVal(container.querySelector('#imo-nome-modelo'), 'HP 408')
      setVal(container.querySelector('#imo-marca'), 'HP')
      setVal(container.querySelector('#imo-estoque-minimo-toner'), '4')
      setVal(container.querySelector('#imo-estoque-minimo-cilindro'), '1')
    })
    await flush()

    /* ---------- seleciona e adiciona os consumíveis ---------- */
    const selInicial = container.querySelector('#imo-assoc-select')
    expect(!!selInicial && selInicial.options.length === 5, `select de consumíveis populado (${selInicial ? selInicial.options.length : 'sem select'} opções: placeholder + 4)`)
    for (const codigo of ['W1330A', 'W1330', 'W1330X', 'W1332']) {
      const sel = container.querySelector('#imo-assoc-select')
      const idEsperado = String(TONERS.find((t) => t.codigo === codigo).id)
      const opt = [...sel.options].find((o) => o.value === idEsperado)
      expect(!!opt, `opção ${codigo} disponível no seletor`)
      if (!opt) break
      await change(sel, opt.value)
      await flush()
      await click(btn('Adicionar'))
      await flush()
    }
    expect(JSON.stringify(chips('toner')) === JSON.stringify(['W1330A', 'W1330', 'W1330X']), 'grupo TONER = W1330A, W1330, W1330X')
    expect(JSON.stringify(chips('cilindro')) === JSON.stringify(['W1332']), 'grupo CILINDRO = W1332 (tipo vem de toner.tipo)')

    await submit()
    const salvarModelo = calls.filter((c) => c.endpoint === 'impressoras_modelos' && c.action === 'salvar').at(-1)
    expect(!!salvarModelo && salvarModelo.body.estoque_minimo_toner === 4 && salvarModelo.body.estoque_minimo_cilindro === 1, 'salvar envia mínimo toner=4 e cilindro=1')
    const salvarAssoc = assocCalls().filter((c) => c.action === 'salvar')
    expect(salvarAssoc.length === 4, '4 associações gravadas no mesmo fluxo de salvar')
    expect(salvarAssoc.every((c) => c.body.modelo_id === 30), 'associações usam o id do modelo recém-criado (30)')
    expect(salvarAssoc.every((c) => !('tipo' in c.body)), 'payload da associação NÃO envia tipo')
    expect(!container.querySelector('.imo-dialog'), 'modal fecha após salvar')
    expect(container.textContent.includes('Modelo criado com sucesso'), 'confirmação de criação exibida')

    /* ---------- editar mantendo as associações ---------- */
    await click(linhaDoModelo('HP 408').querySelector('button[aria-label="Editar modelo"]'))
    await flush()
    await flush()
    expect(container.querySelector('#imo-nome-modelo')?.value === 'HP 408', 'edição carrega o modelo salvo')
    expect(JSON.stringify(chips('toner')) === JSON.stringify(['W1330A', 'W1330', 'W1330X']), 'edição mantém as associações de TONER')
    expect(JSON.stringify(chips('cilindro')) === JSON.stringify(['W1332']), 'edição mantém a associação de CILINDRO')

    /* ---------- remover uma associação e salvar ---------- */
    await click(container.querySelector('button[aria-label="Remover W1330X"]'))
    await flush()
    expect(chips('toner').length === 2, 'remover chip atualiza a lista no modal')
    await submit()
    const excluirAssoc = assocCalls().filter((c) => c.action === 'excluir').at(-1)
    expect(!!excluirAssoc && Number(excluirAssoc.body.id) > 0, 'salvar remove a associação (excluir pelo id da linha)')
    expect(container.textContent.includes('Modelo atualizado com sucesso'), 'edição confirma atualização')

    /* ---------- recarregar: persistência ---------- */
    await click(linhaDoModelo('HP 408').querySelector('button[aria-label="Editar modelo"]'))
    await flush()
    await flush()
    expect(JSON.stringify(chips('toner')) === JSON.stringify(['W1330A', 'W1330']), 'recarrega e confirma persistência (sem W1330X)')
    expect(JSON.stringify(chips('cilindro')) === JSON.stringify(['W1332']), 'recarrega e confirma persistência do CILINDRO')
    await click(btn('Cancelar (Esc)'))
    await flush()

    /* ---------- visualizar: somente leitura ---------- */
    await click(linhaDoModelo('HP 408').querySelector('button[aria-label="Visualizar modelo"]'))
    await flush()
    await flush()
    expect(container.textContent.includes('SOMENTE LEITURA'), 'visualização é somente leitura')
    expect([...container.querySelectorAll('.imo-chip-x')].every((b) => b.disabled) && !btn('Adicionar'), 'visualização não permite remover/adicionar associação')
    expect(chips('cilindro').length === 1, 'visualização mostra as associações existentes')
    await click(btn('Fechar'))
    await flush()

    /* ---------- exclusão do modelo ---------- */
    dom.window.confirm = () => true
    await click(linhaDoModelo('HP 408').querySelector('button[aria-label="Excluir modelo"]'))
    await flush()
    expect(calls.some((c) => c.endpoint === 'impressoras_modelos' && c.action === 'excluir'), 'exclusão do modelo chamada na API')
    expect(ASSOC.length === 0, 'exclusão do modelo remove as associações (ON DELETE CASCADE)')
  } finally {
    globalThis.fetch = dom.window.fetch = originalFetch
    dom.window.confirm = realConfirm
  }
}
