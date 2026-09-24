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

  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const lastList = () => [...calls].reverse().find((c) => c.endpoint === 'funcionarios' && c.action === 'listar');
  const headers = () => [...container.querySelectorAll('.func-table thead th')];
  const findByLabel = (label) => headers().find((th) => th.textContent.replace(/[↕↑↓\s]/g, '') === label);
  const rowsNome = () => [...container.querySelectorAll('.func-table tbody tr')].map((tr) => tr.querySelector('.func-name')?.textContent || '');


  try {
    // navega para Funcionários via menu
    const menuItem = [...container.querySelectorAll('button, a')].find((el) => el.textContent.trim() === 'Funcionários');
    if (menuItem) { await act(async () => { menuItem.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); await flush(); }

    await flush();
    check(!!container.querySelector('.func-table'), 'abre listagem de Funcionários');

    // cabeçalhos ordenáveis presentes e clicáveis
    const esperados = ['Nome', 'Cargo', 'Setor', 'RG', 'E-mail', 'Status'];
    const faltando = esperados.filter((l) => !findByLabel(l));
    check(faltando.length === 0, `cabeçalhos ordenáveis renderizados${faltando.length ? ' (faltando: ' + faltando.join(', ') + ')' : ''}`);
    const nomeTh = findByLabel('Nome');
    check(!!nomeTh && nomeTh.classList.contains('th-sort'), 'coluna Nome usa o componente ordenável');

    const clickTh = async (label) => {
      const th = findByLabel(label);
      await act(async () => { th.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush();
      return findByLabel(label);
    };

    // 1º clique: ASC
    let th = await clickTh('Nome');
    let p = lastList()?.params;
    check(!!p && p.get('sort') === 'nome' && p.get('dir') === 'asc', '1º clique em Nome → sort=nome dir=asc');
    check(th.textContent.includes('↑'), 'indicador ↑ no cabeçalho ativo');
    const asc = rowsNome();
    const ascOrdenado = [...asc].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    check(JSON.stringify(asc) === JSON.stringify(ascOrdenado), `linhas em ordem crescente (${asc.join(' | ')})`);

    // 2º clique: DESC
    th = await clickTh('Nome');
    p = lastList()?.params;
    check(!!p && p.get('sort') === 'nome' && p.get('dir') === 'desc', '2º clique em Nome → sort=nome dir=desc');
    check(th.textContent.includes('↓'), 'indicador ↓ no cabeçalho ativo');
    const desc = rowsNome();
    check(JSON.stringify(desc) === JSON.stringify([...desc].sort((a, b) => b.localeCompare(a, 'pt-BR', { sensitivity: 'base' }))), 'linhas em ordem decrescente');

    // 3º clique: volta ao padrão (sem sort)
    await clickTh('Nome');
    p = lastList()?.params;
    check(!!p && !p.get('sort') && !p.get('dir'), '3º clique → estado padrão (sem sort/dir)');

    // Setor (coluna do JOIN → sort=setor)
    await clickTh('Setor');
    p = lastList()?.params;
    check(!!p && p.get('sort') === 'setor' && p.get('dir') === 'asc', 'clique em Setor → sort=setor dir=asc');

    // Cargo
    await clickTh('Cargo');
    p = lastList()?.params;
    check(!!p && p.get('sort') === 'cargo', 'clique em Cargo → sort=cargo');

    // Status (ativo)
    await clickTh('Status');
    p = lastList()?.params;
    check(!!p && p.get('sort') === 'ativo', 'clique em Status → sort=ativo');

    // pesquisa + filtro de setor + ordenação combinados
    const search = container.querySelector('input[aria-label^="Buscar"]');
    if (search) { setVal(search, 'ana'); await flush(); }
    const setorSel = container.querySelector('select[aria-label="Filtrar por setor"]');
    if (setorSel) {
      setVal(setorSel, '2');
      const form = container.querySelector('#func-filters');
      await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
      await flush();
    }
    await clickTh('Nome');
    p = lastList()?.params;
    check(!!p && p.get('search') === 'ana' && p.get('setor_id') === '2' && p.get('sort') === 'nome', 'combinação pesquisa + filtro setor + sort nome');

    // Limpar → estado inicial padrão (sem ordenação)
    const btnLimpar = [...container.querySelectorAll('#func-filters button')].find((b) => b.textContent.trim() === 'Limpar');
    if (btnLimpar) { await act(async () => { btnLimpar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); await flush(); }
    check(!findByLabel('Nome')?.textContent.includes('↑'), 'estado inicial sem ordenação ativa');
  } finally {
    globalThis.fetch = realFetch;
  }
}
