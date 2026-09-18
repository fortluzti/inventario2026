// Fluxos de estações com API em memória: nenhum registro real é alterado.
export async function testEstacoes({ container, act, check, setVal, dom }) {
  const originalFetch = globalThis.fetch
  let rows = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, codigo_interno_estacao: `EST-${String(i + 1).padStart(3, '0')}`, setor_id: 1, setor_nome: 'TI', empresa_id: 1, empresa_nome: 'FortLuz', funcionario_nome: 'Ana', ip: '192.168.1.10', status: i === 0 ? 'Em Uso' : 'Em Estoque', acessorios: 'Mouse', hd: 'SSD 256 GB' }))
  const requests = []
  let failList = false, failSave = false
  globalThis.fetch = dom.window.fetch = async (url, opts) => {
    const p = new URL(String(url)).searchParams
    const ep = p.get('endpoint'), action = p.get('action')
    if (ep.startsWith('dashboard')) return originalFetch(url, opts)
    requests.push({ ep, action, params: p, body: opts.body && JSON.parse(opts.body) })
    let data
    if (ep !== 'estacoes') {
      data = { items: [{ id: 1, nome: ep === 'setores' ? 'TI' : 'Cadastro auxiliar', codigo_interno_monitor: 'MON-001', marca: 'Dell', modelo: 'P24' }], total_pages: 1 }
    } else if ((action === 'listar' && failList) || (action === 'salvar' && failSave)) {
      return { status: 500, json: async () => ({ success: false, message: 'Falha simulada da API' }) }
    } else if (action === 'listar') {
      const filtered = rows.filter((r) => (!p.get('search') || r.codigo_interno_estacao.includes(p.get('search'))) && (!p.get('status') || r.status === p.get('status')) && (!p.get('setor_id') || String(r.setor_id) === p.get('setor_id')))
      const limit = Number(p.get('limit')), page = Number(p.get('page'))
      data = { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, total_pages: Math.ceil(filtered.length / limit) }
    } else if (action === 'proximo_codigo') data = { next_codigo: 'EST-022' }
    else if (action === 'buscar_por_id') data = rows.find((r) => r.id === Number(p.get('id')))
    else if (action === 'salvar') {
      const body = JSON.parse(opts.body)
      if (body.id) rows = rows.map((r) => r.id === body.id ? { ...r, ...body } : r)
      else rows.push({ ...body, id: 22, setor_nome: 'TI' })
      data = { id: body.id || 22 }
    } else if (action === 'excluir') { rows = rows.filter((r) => r.id !== JSON.parse(opts.body).id); data = null }
    else throw new Error(`Ação não prevista: ${ep}/${action}`)
    return { status: 200, json: async () => ({ success: true, data }) }
  }
  const click = async (el) => { if (!el) throw new Error('Controle esperado não encontrado'); await act(async () => { el.click() }) }
  const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  const select = async (selector, value) => { await act(async () => { const el = container.querySelector(selector); el.value = value; el.dispatchEvent(new dom.window.Event('change', { bubbles: true })) }) }
  const submit = async () => { await act(async () => { container.querySelector('#est-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })) }) }
  const change = async (selector, value) => { await act(async () => setVal(container.querySelector(selector), value)) }
  const waitSearch = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 350)) }) }
  const writes = () => requests.filter((r) => r.action === 'salvar')
  const close = () => click(container.querySelector('[aria-label="Fechar janela"]'))
  await click([...container.querySelectorAll('.module-item')].find((b) => b.textContent.includes('Estações de Trabalho')))
  check('Estações: menu abre listagem real com oito colunas', container.querySelectorAll('.est-table th').length === 8 && container.querySelector('.est-table').textContent.includes('EST-001'))
  check('Estações: paginação limita a 20 registros', container.querySelectorAll('.est-table tbody tr').length === 20)
  await click(button('Próximo'))
  check('Estações: segunda página', container.querySelector('.est-table').textContent.includes('EST-021'))
  await click(button('Anterior'))
  await select('[aria-label="Filtrar por status"]', 'Em Uso')
  await select('[aria-label="Filtrar por setor"]', '1')
  await click(button('Aplicar'))
  check('Estações: filtros aplicados na API', container.querySelectorAll('.est-table tbody tr').length === 1 && requests.some((r) => r.params.get('status') === 'Em Uso' && r.params.get('setor_id') === '1'))
  await click(button('Limpar'))
  await change('[aria-label="Buscar estações"]', 'inexistente')
  await waitSearch()
  check('Estações: busca e estado vazio', container.textContent.includes('Nenhuma estação encontrada.'))
  await click(button('Limpar'))
  await click(container.querySelector('[aria-label="Visualizar EST-001"]'))
  check('Estações: visualizar é somente leitura', container.querySelector('#est-form fieldset').disabled && !container.querySelector('button[form="est-form"]'))
  check('Estações: cinco abas da UX', container.querySelectorAll('[role="tab"]').length === 5)
  await click(container.querySelector('#est-tab-4'))
  check('Estações: software informa limitação da API', container.querySelector('#est-panel-4').textContent.includes('ainda não é disponibilizado'))
  await close()
  await click(container.querySelector('.est-page-header button'))
  check('Estações: código automático', container.querySelector('#est-codigo_interno_estacao').value === 'EST-022')
  await click(container.querySelector('#est-tab-1'))
  await submit()
  check('Estações: obrigatório em outra aba impede gravação e abre identificação', writes().length === 0 && container.querySelector('#est-tab-0').getAttribute('aria-selected') === 'true')
  await select('#est-setor_id', '1')
  await change('#est-ip', '999.10.10.10')
  await submit()
  check('Estações: IP inválido bloqueia gravação', writes().length === 0)
  await change('#est-ip', '192.168.1.22')
  await click(container.querySelector('#est-tab-1'))
  await change('#est-hd', 'SSD 1 TB')
  await click(container.querySelector('#est-tab-3'))
  await click(container.querySelector('#est-panel-3 input'))
  failSave = true
  await submit()
  check('Estações: erro ao salvar preserva formulário', container.querySelector('#est-hd').value === 'SSD 1 TB' && container.querySelector('[role="alert"]').textContent.includes('Falha simulada'))
  failSave = false
  await act(async () => { container.querySelector('.est-dialog').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })) })
  const created = writes().at(-1).body
  check('Estações: cadastro envia campos tipados e acessórios', created.setor_id === 1 && created.hd === 'SSD 1 TB' && created.acessorios === 'Mouse' && created.empresa_id === null && !('id' in created))
  check('Estações: cadastro fecha modal e confirma sucesso', !container.querySelector('.est-dialog') && container.textContent.includes('Estação cadastrada com sucesso.'))
  await click(container.querySelector('[aria-label="Editar EST-001"]'))
  await click(container.querySelector('#est-tab-1'))
  check('Estações: edição carrega registro da API', container.querySelector('#est-hd').value === 'SSD 256 GB')
  await change('#est-hd', 'SSD 2 TB')
  await submit()
  check('Estações: edição envia ID e atualiza', writes().at(-1).body.id === 1 && writes().at(-1).body.hd === 'SSD 2 TB' && container.textContent.includes('Estação atualizada com sucesso.'))
  const originalConfirm = dom.window.confirm
  dom.window.confirm = () => false
  await click(container.querySelector('[aria-label="Excluir EST-001"]'))
  check('Estações: exclusão cancelada não chama API', !requests.some((r) => r.action === 'excluir'))
  dom.window.confirm = () => true
  await click(container.querySelector('[aria-label="Excluir EST-001"]'))
  check('Estações: exclusão confirmada atualiza listagem', requests.some((r) => r.action === 'excluir' && r.body.id === 1) && !container.querySelector('[aria-label="Editar EST-001"]'))
  dom.window.confirm = originalConfirm
  failList = true
  await click([...container.querySelectorAll('.est-toolbar button')].find((b) => b.textContent === 'Atualizar'))
  check('Estações: falha de listagem é explícita', container.querySelector('[role="alert"]').textContent.includes('Falha simulada'))
  failList = false
  await click(button('Tentar novamente'))
  check('Estações: recuperação da API', container.querySelector('.est-table').textContent.includes('EST-002'))
  await click([...container.querySelectorAll('.module-item')].find((b) => b.textContent.includes('Dashboard Geral')))
  globalThis.fetch = dom.window.fetch = originalFetch
}
