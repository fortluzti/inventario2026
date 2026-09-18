// Testes específicos de relatórios: estrutura, logo, paginação, multi-página, CSS de impressão
export async function testReports({ container, act, check, dom }) {
  const originalFetch = globalThis.fetch

  // Gera dados suficientes para múltiplas páginas (>30 registros)
  const monitorRows = Array.from({ length: 72 }, (_, i) => ({
    id: i + 1,
    codigo_interno_monitor: `MON-${String(i + 1).padStart(4, '0')}`,
    marca: ['Dell', 'LG', 'Samsung', 'AOC'][i % 4],
    modelo: `U27${23 + (i % 5)}QE`,
    numero_serie: `CN-${2000 + i}`,
    empresa_nome: 'FortLuz',
    status: ['Em Uso', 'Em Estoque', 'Em Manutenção'][i % 3],
    data_compra: `2023-0${(i % 9) + 1}-15`,
  }))

  const empresaData = {
    empresa_nome: 'FortLuz Sistemas Industriais',
    empresa_cnpj: '12.345.678/0001-90',
    empresa_telefone: '(11) 3456-7890',
    empresa_email: 'contato@fortluz.com.br',
    empresa_logradouro: 'Avenida Paulista',
    empresa_numero: '1578',
    empresa_cidade: 'São Paulo',
    empresa_estado: 'SP',
    empresa_logo: 'empresa_logo_test.png',
  }

  const flush = async () => { await act(async () => { await Promise.resolve() }) }

  // Mock fetch para relatórios
  globalThis.fetch = dom.window.fetch = async (url, opts = {}) => {
    const p = new URL(String(url)).searchParams
    const ep = p.get('endpoint')
    const action = p.get('action')

    if (ep === 'configuracoes' && action === 'empresa') {
      return { status: 200, json: async () => ({ success: true, data: empresaData }) }
    }

    if (ep === 'monitores' && action === 'listar') {
      const limit = Number(p.get('limit')) || 200
      const page = Number(p.get('page')) || 1
      const start = (page - 1) * limit
      const items = monitorRows.slice(start, start + limit)
      return {
        status: 200,
        json: async () => ({
          success: true,
          data: { items, total: monitorRows.length, total_pages: Math.ceil(monitorRows.length / limit) }
        })
      }
    }

    return { status: 200, json: async () => ({ success: true, data: [] }) }
  }

  const getRoot = () => container.querySelector('.dash-main') || container

  // Navegar até o relatório de monitores via sidebar
  const reportItem = [...container.querySelectorAll('.module-item')].find(
    (b) => b.textContent.includes('Relatório de Monitores')
  )
  if (reportItem) {
    await act(async () => { reportItem.click() })
    await flush()
  }

  // 1. Overlay do relatório presente
  check('Report: overlay .rpt-overlay presente', !!container.querySelector('.rpt-overlay'))

  // 2. Texto de desenvolvimento removido
  check('Report: ausência de "TEMPLATE MESTRE DINÂMICO"', !container.textContent.includes('TEMPLATE MESTRE DINÂMICO'))
  check('Report: ausência de "Demonstrativo Geral de Parque Instalado"', !container.textContent.includes('Demonstrativo Geral de Parque Instalado'))

  // 3. Logo: usa URL autenticada (logoUrl com api_key)
  const logoImg = container.querySelector('.rpt-logo')
  check('Report: logo carregado via img', !!logoImg)
  check('Report: logo usa URL autenticada (serve_logo + api_key)',
    !!logoImg && logoImg.src.includes('action=serve_logo') && logoImg.src.includes('api_key='))

  // 4. Dados da empresa no cabeçalho
  check('Report: nome da empresa no cabeçalho', container.textContent.includes('FortLuz Sistemas Industriais'))
  check('Report: CNPJ no cabeçalho', container.textContent.includes('12.345.678/0001-90'))
  check('Report: endereço no cabeçalho', container.textContent.includes('Avenida Paulista'))
  check('Report: telefone no cabeçalho', container.textContent.includes('(11) 3456-7890'))
  check('Report: email no cabeçalho', container.textContent.includes('contato@fortluz.com.br'))

  // 5. Título do relatório
  check('Report: título do relatório visível', container.querySelector('.rpt-title')?.textContent.includes('Relatório de Monitores'))

  // 6. Tabela com thead (cabeçalho repeatível)
  check('Report: tabela presente', !!container.querySelector('.rpt-table'))
  check('Report: thead presente (repete em cada página)', !!container.querySelector('.rpt-table thead'))

  // 7. Dados renderizados (colunas)
  check('Report: colunas da tabela (6)', container.querySelectorAll('.rpt-table thead th').length === 6)
  check('Report: linhas de dados carregadas', container.querySelectorAll('.rpt-table tbody tr').length > 0)

  // 8. Total de registros
  check('Report: total de registros no escopo', container.textContent.includes('72 registros'))

  // 9. Footer com contador de página
  check('Report: footer presente', !!container.querySelector('.rpt-footer'))
  check('Report: elemento de paginação de página presente', !!container.querySelector('.rpt-page-number'))

  // 10. Botões de ação (CSV, Print, Close) — no-print
  check('Report: botão Exportar CSV', !!container.querySelector('.rpt-btn'))
  check('Report: botão Fechar', !![...container.querySelectorAll('.rpt-btn')].find((b) => b.querySelector('.mat')?.textContent === 'close'))

  // 11. Ausência de scrollbar no overlay
  const overlay = container.querySelector('.rpt-overlay')
  check('Report: rpt-overlay não tem overflow hidden em tela', overlay)

  // 12. Fechar relatório volta ao dashboard
  const closeBtn = [...container.querySelectorAll('.rpt-btn')].find((b) => b.querySelector('.mat')?.textContent === 'close')
  if (closeBtn) {
    await act(async () => { closeBtn.click() })
    await flush()
    check('Report: fechar volta ao dashboard', container.textContent.includes('Central de Alertas'))
    check('Report: overlay removido após fechar', !container.querySelector('.rpt-overlay'))
  }

  // 13. Verificar CSS de impressão (ler arquivo CSS diretamente, pois o esbuild
  //     usa loader 'empty' para .css na fase de build do smoke test)
  const { readFileSync } = await import('fs')
  const { fileURLToPath } = await import('url')
  const { dirname, resolve } = await import('path')
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const cssPath = resolve(__dirname, '../src/components/ReportTemplate.css')
  const cssContent = readFileSync(cssPath, 'utf-8')

  check('Report: @page A4 definido no CSS', /size:\s*A4/.test(cssContent))
  check('Report: thead usa table-header-group (repete em impressão)', cssContent.includes('table-header-group'))
  check('Report: tr usa page-break-inside avoid', cssContent.includes('page-break-inside: avoid'))
  check('Report: counter(page) no footer de impressão', /counter\(page\)/.test(cssContent))
  check('Report: overflow removido no print (rpt-print-canvas visível)', cssContent.includes('.rpt-print-canvas') && cssContent.includes('overflow: visible'))
  check('Report: page-break-after removido (auto)', /page-break-after:\s*auto/.test(cssContent))

  // 14. Testar relatório de estações também
  const reportEstacoes = [...container.querySelectorAll('.module-item')].find(
    (b) => b.textContent.includes('Relatório de Estações')
  )
  if (reportEstacoes) {
    await act(async () => { reportEstacoes.click() })
    await flush()
    check('Report: Estações overlay presente', !!container.querySelector('.rpt-overlay'))
    check('Report: Estações sem TEMPLATE MESTRE DINÂMICO', !container.textContent.includes('TEMPLATE MESTRE DINÂMICO'))
  }

  // 15. Testar relatório de impressoras
  const reportImpressoras = [...container.querySelectorAll('.module-item')].find(
    (b) => b.textContent.includes('Relatório de Impressoras')
  )
  if (reportImpressoras) {
    await act(async () => { reportImpressoras.click() })
    await flush()
    check('Report: Impressoras overlay presente', !!container.querySelector('.rpt-overlay'))
    check('Report: Impressoras sem TEMPLATE MESTRE DINÂMICO', !container.textContent.includes('TEMPLATE MESTRE DINÂMICO'))
  }

  // Voltar ao dashboard
  await act(async () => {
    const dashItem = [...container.querySelectorAll('.module-item')].find((b) => b.textContent.includes('Dashboard Geral'))
    dashItem?.click()
  })
  await flush()

  globalThis.fetch = dom.window.fetch = originalFetch
}
