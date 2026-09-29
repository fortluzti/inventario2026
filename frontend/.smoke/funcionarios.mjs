// Smoke: listagem de Funcionários — ordenação pelas colunas (cabeçalho clicável).
// Mock em memória espelhando o Crud::listar do backend:
//  - sort global (whitelist sortable) ANTES do slice (paginação no servidor);
//  - nulls/vazios primeiro em ASC; desempate id DESC; padrão ORDER BY id DESC.
export async function testFuncionarios({ container, act, check, setVal, dom }) {
  // ---- dados mock (compartilhados entre mock e asserções) ----
  const DB = [
    { id: 5, nome: 'Carlos Souza', cargo: 'Eletricista', setor_id: 2, setor_nome: 'DOCA', rg: '222333444', email: 'carlos@fortluz.com.br', ativo: 1 },
    { id: 4, nome: 'Ana Pereira', cargo: 'Analista', setor_id: 1, setor_nome: 'TI', rg: '111222333', email: 'ana@fortluz.com.br', ativo: 1 },
    { id: 3, nome: 'Bruno Lima', cargo: null, setor_id: null, setor_nome: null, rg: '555666777', email: null, ativo: 0 },
    { id: 2, nome: 'Ana Paula', cargo: 'Supervisora', setor_id: 1, setor_nome: 'TI', rg: '999888777', email: 'anapaula@fortluz.com.br', ativo: 1 },
    { id: 1, nome: 'Ana Paula', cargo: 'Operadora', setor_id: 2, setor_nome: 'DOCA', rg: '444555666', email: 'ana.paula@fortluz.com.br', ativo: 1 },
  ];

  const SORTABLE = { nome: 'nome', cargo: 'cargo', setor: 'setor_nome', rg: 'rg', email: 'email', ativo: 'ativo' };

  function applyList(p) {
    const limit = Math.min(200, Math.max(1, Number(p.get('limit') || 20)));
    const page = Math.max(1, Number(p.get('page') || 1));
    let rows = DB.slice();
    const search = (p.get('search') || '').trim().toLowerCase();
    if (search) rows = rows.filter((r) => [r.nome, r.cargo, r.setor_nome].some((v) => String(v || '').toLowerCase().includes(search)));
    if (p.get('setor_id')) rows = rows.filter((r) => String(r.setor_id || '') === p.get('setor_id'));
    if (p.get('ativo') !== null && p.get('ativo') !== undefined && p.get('ativo') !== '') rows = rows.filter((r) => String(r.ativo) === p.get('ativo'));
    const sort = p.get('sort');
    const dir = (p.get('dir') || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    if (sort && SORTABLE[sort]) {
      const key = SORTABLE[sort];
      rows.sort((a, b) => {
        const av = a[key]; const bv = b[key];
        const an = av === null || av === undefined || av === '';
        const bn = bv === null || bv === undefined || bv === '';
        if (an && bn) return b.id - a.id;
        if (an) return -1; // nulls primeiro em ASC (MySQL)
        if (bn) return 1;
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base', numeric: true });
        return cmp !== 0 ? cmp * dir : b.id - a.id;
      });
    } else {
      rows.sort((a, b) => b.id - a.id);
    }
    const total = rows.length;
    const items = rows.slice((page - 1) * limit, (page - 1) * limit + limit);
    return { items, total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
  }

  // ---- mock de fetch ----
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url), 'http://localhost');
    const endpoint = u.searchParams.get('endpoint');
    const action = u.searchParams.get('action');
    calls.push({ endpoint, action, params: u.searchParams });
    let data = null;
    if (endpoint === 'funcionarios' && action === 'listar') data = applyList(u.searchParams);
    else if (endpoint === 'setores' && action === 'listar') data = { items: [{ id: 1, nome: 'TI', ativo: 1 }, { id: 2, nome: 'DOCA', ativo: 1 }], total: 2, page: 1, limit: 200, total_pages: 1 };
    else data = { items: [], total: 0, page: 1, limit: 20, total_pages: 0 };
    return {
      ok: true, status: 200,
      json: async () => ({ success: true, data }),
      text: async () => JSON.stringify({ success: true, data }),
    };
  };

  const flush = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  const lastList = () => [...calls].reverse().find((c) => c.endpoint === 'funcionarios' && c.action === 'listar');
  const headers = () => [...container.querySelectorAll('.func-table thead th')];
  // o th ordenável (SortableTh) tem <span class="th-sort-label"> + ícone Material no textContent
  const findByLabel = (label) => headers().find((th) => (th.querySelector('.th-sort-label')?.textContent || th.textContent).replace(/[↕↑↓\s]/g, '').trim() === label);
  const iconOf = (label) => findByLabel(label)?.querySelector('.mat')?.textContent || '';
  // setVal do harness usa o setter de HTMLInputElement: selects precisam do caminho nativo
  const setSelect = (el, v) => { el.value = v; el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const rowsNome = () => [...container.querySelectorAll('.func-table tbody tr')].map((tr) => tr.querySelector('.func-name')?.textContent || '');


  try {
    // navega para Funcionários via menu
    const menuItem = [...container.querySelectorAll('.module-item, button, a')].find((el) => el.textContent.includes('Funcionários'));
    if (menuItem) { await act(async () => { menuItem.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); await flush(); }

    await flush();
    check('abre listagem de Funcionários', !!container.querySelector('.func-table'));

    // cabeçalhos ordenáveis presentes e clicáveis
    const esperados = ['Nome', 'Cargo', 'Setor', 'RG', 'E-mail', 'Status'];
    const faltando = esperados.filter((l) => !findByLabel(l));
    check(`cabeçalhos ordenáveis renderizados${faltando.length ? ' (faltando: ' + faltando.join(', ') + ')' : ''}`, faltando.length === 0);
    const nomeTh = findByLabel('Nome');
    check('coluna Nome usa o componente ordenável', !!nomeTh?.querySelector('.th-sort'));

    const clickTh = async (label) => {
      // o handler de clique fica no <button class="th-sort"> dentro do <th>
      const btn = findByLabel(label)?.querySelector('.th-sort');
      if (!btn) throw new Error(`cabeçalho ordenável não encontrado: ${label}`);
      await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush();
      return findByLabel(label);
    };

    // 1º clique: ASC
    await clickTh('Nome');
    let p = lastList()?.params;
    check('1º clique em Nome → sort=nome dir=asc', !!p && p.get('sort') === 'nome' && p.get('dir') === 'asc');
    check('indicador arrow_upward no cabeçalho ativo', iconOf('Nome') === 'arrow_upward');
    const asc = rowsNome();
    const ascOrdenado = [...asc].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    check(`linhas em ordem crescente (${asc.join(' | ')})`, JSON.stringify(asc) === JSON.stringify(ascOrdenado));

    // 2º clique: DESC
    await clickTh('Nome');
    p = lastList()?.params;
    check('2º clique em Nome → sort=nome dir=desc', !!p && p.get('sort') === 'nome' && p.get('dir') === 'desc');
    check('indicador arrow_downward no cabeçalho ativo', iconOf('Nome') === 'arrow_downward');
    const desc = rowsNome();
    check('linhas em ordem decrescente', JSON.stringify(desc) === JSON.stringify([...desc].sort((a, b) => b.localeCompare(a, 'pt-BR', { sensitivity: 'base' }))));

    // 3º clique: volta ao padrão (sem sort)
    await clickTh('Nome');
    p = lastList()?.params;
    check('3º clique → estado padrão (sem sort/dir)', !!p && !p.get('sort') && !p.get('dir'));

    // Setor (coluna do JOIN → sort=setor)
    await clickTh('Setor');
    p = lastList()?.params;
    check('clique em Setor → sort=setor dir=asc', !!p && p.get('sort') === 'setor' && p.get('dir') === 'asc');

    // Cargo
    await clickTh('Cargo');
    p = lastList()?.params;
    check('clique em Cargo → sort=cargo', !!p && p.get('sort') === 'cargo');

    // Status (coluna 'ativo' na tabela, chave 'status' na whitelist sortable)
    await clickTh('Status');
    p = lastList()?.params;
    check('clique em Status → sort=status (ativo)', !!p && p.get('sort') === 'status');

    // pesquisa + filtro de setor + ordenação combinados
    // (o painel de filtros inicia ABERTO: o módulo usa showFilters = true)
    const search = container.querySelector('input[aria-label^="Buscar"]');
    setVal(search, 'ana');
    await flush(350);
    const btnFiltros = [...container.querySelectorAll('.func-actions button')].find((b) => b.textContent.includes('Filtros'));
    check('botão Filtros disponível na toolbar', !!btnFiltros);
    check('painel de filtros inicia montado', !!container.querySelector('#func-filters'));
    // toggle: 1º clique recolhe, 2º clique reabre
    await act(async () => { btnFiltros.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    await flush();
    check('botão Filtros recolhe o painel', btnFiltros.getAttribute('aria-expanded') === 'false' && !container.querySelector('#func-filters'));
    await act(async () => { btnFiltros.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
    await flush();
    const form = container.querySelector('#func-filters');
    check('botão Filtros reabre o painel', btnFiltros.getAttribute('aria-expanded') === 'true' && !!form);
    const setorSel = container.querySelector('select[aria-label="Filtrar por setor"]');
    check('select de setor disponível no painel', !!setorSel);
    if (setorSel) setSelect(setorSel, '2');
    if (form) await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
    await clickTh('Nome');
    p = lastList()?.params;
    check('combinação pesquisa + filtro setor + sort nome', !!p && p.get('search') === 'ana' && p.get('setor_id') === '2' && p.get('sort') === 'nome');
    check('filtro combinado restringe as linhas (Ana + DOCA)', JSON.stringify(rowsNome()) === JSON.stringify(['Ana Paula']));

    // Limpar → busca/filtros voltam ao padrão (a ordenação escolhida é preservada,
    // mesma convenção de Fornecedores: clear() não reseta o useTableSort)
    const btnLimpar = [...container.querySelectorAll('#func-filters button')].find((b) => b.textContent.trim() === 'Limpar');
    check('botão Limpar disponível no painel', !!btnLimpar);
    if (btnLimpar) await act(async () => { btnLimpar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(350);
    p = lastList()?.params;
    check('Limpar restaura busca e filtros padrão', !!p && !p.get('search') && !p.get('setor_id') && p.get('ativo') === '1');
    check('Limpar preserva a ordenação ativa (sort=nome asc)', !!p && p.get('sort') === 'nome' && p.get('dir') === 'asc' && iconOf('Nome') === 'arrow_upward');
  } finally {
    globalThis.fetch = realFetch;
  }
}
