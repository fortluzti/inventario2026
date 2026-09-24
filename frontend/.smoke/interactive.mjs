import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

globalThis.window = dom.window
globalThis.document = dom.window.document
for (const k of ['navigator', 'HTMLElement', 'Node', 'MouseEvent', 'KeyboardEvent', 'Event', 'getComputedStyle']) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')
const { App } = await import('./app.mjs')

const KPIS = { total_estacoes: 32, total_monitores: 26, total_impressoras: 13, total_nobreaks: 1, total_celulares: 47, total_funcionarios: 47, toners_estoque: 36, manutencoes_abertas: 1 }
const ALERTAS = [
  { tipo: 'toner_baixo', mensagem: "Toner '1060' com estoque baixo (1/1)." },
  { tipo: 'toner_baixo', mensagem: "Toner 'TN-1000' com estoque baixo (0/0)." },
  { tipo: 'manutencao', mensagem: '1 equipamento(s) em manutencao.' },
]
const ATIV = [
  { id: 2, status: 'Pendente', aprovacao_status: 'Pendente', problema_relatado: 'FOLHA ENROSCANDO', data_inicio: '2025-09-26', data_cadastro: '2025-09-26 16:36:29' },
]

dom.window.fetch = async (url) => {
  const ep = new URL(String(url)).searchParams.get('endpoint')
  const data = ep === 'dashboard_kpis' ? KPIS : ep === 'dashboard_alertas' ? ALERTAS : ATIV
  return { status: 200, json: async () => ({ success: true, data }) }
}
globalThis.fetch = dom.window.fetch

const container = document.getElementById('root')
const root = createRoot(container)

/* react-dom/test-utils act é síncrono; await flushes do useEffect/fetch */
const flush = async () => { await act(async () => { await Promise.resolve() }) }

let fail = 0
const check = (name, cond) => { if (!cond) fail++; console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}`) }

/* ---------- 1. Login é a tela principal quando não há sessão ---------- */
await act(async () => { root.render(React.createElement(App)) })
await flush()
let txt = container.textContent
check('Tela de Login é a principal (sem sessão)', txt.includes('Entrar no Sistema'))
check('Dashboard NÃO aparece antes do login', !txt.includes('Módulos do Sistema'))

/* ---------- 2. Login entra no Dashboard ---------- */
const inputs = container.querySelectorAll('input')
const setVal = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(el, v)
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}
act(() => {
  setVal(inputs[0], 'admin.ti')
  setVal(inputs[1], 'senha123')
})
await flush()
const btnEntrar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Entrar no Sistema'))
check('Botão Entrar encontrado', !!btnEntrar)
const form = container.querySelector('form')
await act(async () => {
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
})
await flush()
await flush()

txt = container.textContent
check('Login → Dashboard', txt.includes('Módulos do Sistema'))
check('Usuário na AppBar', txt.includes('admin.ti'))
check('KPIs da API renderizados', txt.includes('119'))
check('Alerta de toner renderizado', txt.includes('Toner 1060'))
check('Atividade da API renderizada', txt.includes('FOLHA ENROSCANDO'))
check('Latência medida', /Latência: \d+ms/.test(txt))

/* ---------- 2b. Fidelidade estrutural ao protótipo ux/dashboard_geral_de_ativos ---------- */
const q = (sel) => container.querySelectorAll(sel).length
check('AppBar com título do ERP', !!container.querySelector('.appbar-title'))
check('Sub-toolbar (Atualizar/Novo Ativo/Busca Global/Exportar)', q('.subbar .mini') === 4)
check('Sidebar de Módulos do Sistema', !!container.querySelector('.modules'))
check('7 grupos de módulos (colapsáveis)', q('.modules-group') === 7)
check('30 itens de módulo (Dashboard + reports incluídos)', q('.module-item') === 30)
check('Item ativo = Dashboard Geral', container.querySelector('.module-item.active')?.textContent.includes('Dashboard Geral'))
check('QuickBar "Ações Rápidas"', !!container.querySelector('.quickbar .lbl'))
check('5 StatCards', q('.stat-card') === 5)
check('Central de Alertas', container.textContent.includes('Central de Alertas'))
check('Cards de alerta = alertas da API (3)', q('.alert-card') === ALERTAS.length)
check('Distribuição por Categoria (7 cols)', !!container.querySelector('.panel.col-7'))
check('Status Operacional donut (5 cols)', !!container.querySelector('.panel.col-5'))
check('Donut: fundo + 2 segmentos do anel', q('.donut svg path') === 3)
check('Legenda do donut com 3 itens', q('.legend .row') === 3)
check('5 barras de categoria', q('.metric-row') === 5)
check('DataGrid de atividades', q('.data-table thead th') === 6)
check('Paginador do DataGrid', !!container.querySelector('.pagination'))
check('Atalhos do Módulo (5 links)', q('.shortcuts a') === 5)
check('Barra de status docked', container.textContent.includes('API REST v2.4'))
check('Checksum calculado', /Checksum: [0-9a-f]{4}-[0-9a-f]{4}/.test(container.textContent))
check('Rodapé CAPS/NUM', container.textContent.includes('CAPS') && container.textContent.includes('NUM'))

/* navegação pela sidebar */
const itemToners = [...container.querySelectorAll('.module-item')].find((b) => b.textContent.includes('Toners em Estoque'))
await act(async () => { itemToners.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
await flush()
check('Sidebar troca de módulo (placeholder)', container.textContent.includes('ainda não implementado'))
const btnVoltar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Voltar ao Dashboard Geral'))
check('Botão "Voltar ao Dashboard Geral" existe', !!btnVoltar)
await act(async () => { btnVoltar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
await flush()
check('Volta ao Dashboard Geral', container.textContent.includes('Central de Alertas'))

/* Fluxos específicos de estações (mock da API, sem escrita no banco real). */
const { testEstacoes } = await import('./estacoes.mjs')
await testEstacoes({ container, act, check, setVal, dom })

/* Fluxos de funcionários: ordenação por cabeçalho, filtros e paginação (mock em memória). */
const { testFuncionarios } = await import('./funcionarios.mjs')
await testFuncionarios({ container, act, check, setVal, dom })

/* Testes específicos de relatórios (multi-página, logo, CSS de impressão). */
const { testReports } = await import('./report.mjs')
await testReports({ container, act, check, dom })

/* ---------- 3. Menu de usuário > Sair do sistema ---------- */
const menuBtn = container.querySelector('button[title="Menu do Usuário"]')
check('Botão "Menu do Usuário" existe', !!menuBtn)
act(() => { menuBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
txt = container.textContent
check('Menu do usuário abre com "Sair do sistema"', txt.includes('Sair do sistema'))

const sair = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Sair do sistema'))
check('Item "Sair do sistema" é clicável', !!sair)
await act(async () => { sair.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
await flush()
txt = container.textContent
check('Deslogou e voltou para a tela de Login', txt.includes('Entrar no Sistema') && !txt.includes('Módulos do Sistema'))

console.log(`\nHTML final: ${container.innerHTML.length} bytes | falhas: ${fail}`)
process.exit(fail === 0 ? 0 : 1)
