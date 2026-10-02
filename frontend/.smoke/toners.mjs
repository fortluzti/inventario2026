// Smoke: Toners — CRUD com `valor` (preparação p/ histórico financeiro).
export async function testToners({ container, act, check, setVal, dom }) {
  const DB = [
    { id: 1, codigo: 'W1330A', tipo: 'TONER', estoque: 4, estoque_minimo: 1, autonomia: 1000, valor: '189.90', data_compra: '', nota_fiscal: '' },
    { id: 2, codigo: 'W1332', tipo: 'CILINDRO', estoque: 2, estoque_minimo: 1, autonomia: 20000, valor: '249.00', data_compra: '', nota_fiscal: '' },
  ];
  let nextId = 10;
  const calls = [];
  const lastCall = (a) => [...calls].reverse().find((c) => c.action === a);
  const realFetch = globalThis.fetch;
  let confirmResult = true;
  const flush = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const ok = (cond, label) => check(`toners: ${label}`, !!cond);
  const rowNomes = () => [...container.querySelectorAll('.tnd-table tbody tr td:first-child')].map((td) => td.textContent.trim());

  function applyList(p) {
    const limit = Math.min(200, Math.max(1, Number(p.get('limit') || 20)));
    const page = Math.max(1, Number(p.get('page') || 1));
    let rows = DB.slice();
    const search = (p.get('search') || '').trim().toLowerCase();
    if (search) rows = rows.filter((r) => String(r.codigo || '').toLowerCase().includes(search));
    const tipo = p.get('tipo');
    if (tipo) rows = rows.filter((r) => r.tipo === tipo);
    rows.sort((a, b) => b.id - a.id);
    const total = rows.length;
    return { items: rows.slice((page - 1) * limit, (page - 1) * limit + limit), total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
  }

  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(String(url), 'http://x');
    const endpoint = u.searchParams.get('endpoint');
    const action = u.searchParams.get('action');
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (endpoint === 'toners') calls.push({ action, params: Object.fromEntries(u.searchParams.entries()), body });
    if (endpoint !== 'toners') return realFetch(url, opts);
    if (action === 'listar') return Response.json({ success: true, data: applyList(u.searchParams) });
    if (action === 'buscar_por_id') {
      const row = DB.find((r) => r.id === Number(u.searchParams.get('id')));
      if (!row) return Response.json({ success: false, message: 'Registro não encontrado.' }, { status: 404 });
      return Response.json({ success: true, data: row });
    }
    if (action === 'salvar') {
      if (!body?.codigo || !['TONER', 'CILINDRO'].includes(body?.tipo)) {
        return Response.json({ success: false, message: 'Erros de validação.', errors: { codigo: ['obrigatório'] } }, { status: 422 });
      }
      if (body.id) {
        const ix = DB.findIndex((r) => r.id === Number(body.id));
        DB[ix] = { ...DB[ix], ...body, id: Number(body.id) };
        return Response.json({ success: true, data: { id: Number(body.id) }, message: 'Registro atualizado com sucesso.' });
      }
      const row = { ...body, id: nextId++ };
      DB.push(row);
      return Response.json({ success: true, data: { id: row.id }, message: 'Registro criado com sucesso.' }, { status: 201 });
    }
    if (action === 'excluir') {
      const ix = DB.findIndex((r) => r.id === Number(body?.id));
      if (ix < 0) return Response.json({ success: false, message: 'Registro não encontrado para exclusão.' }, { status: 404 });
      DB.splice(ix, 1);
      return Response.json({ success: true, data: null, message: 'Registro excluído com sucesso.' });
    }
    return realFetch(url, opts);
  };
  dom.window.confirm = () => confirmResult;

  async function submitForm(sel) {
    const form = container.querySelector(sel);
    await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
  }

  /* setVal só vale p/ <input>; `<select>` precisa do setter de HTMLSelectElement. */
  async function setSelect(el, value) {
    await act(async () => { el.value = value; el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  }

  try {
    /* Abre o módulo pela sidebar (a página consome a API já mockada acima). */
    const itemMenu = [...container.querySelectorAll('.module-item')].find((b) => b.textContent.includes('Toners em Estoque'));
    await act(async () => { itemMenu.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(600);
    ok(!!container.querySelector('.tnd-page'), 'sidebar abre a listagem de Toners');
    ok(container.querySelectorAll('.tnd-table th').length === 7, 'grid com 7 colunas (inclui Valor R$)');
    ok(rowNomes().length === 2, `listagem inicial com 2 registros (${rowNomes().join(',')})`);
    ok(container.textContent.includes('189,90'), 'coluna Valor exibe o valor formatado');

    const busca = container.querySelector('input[aria-label^="Buscar"]');
    setVal(busca, 'W1332');
    await flush(350);
    ok(JSON.stringify(rowNomes()) === JSON.stringify(['W1332']), 'busca filtra por código');
    setVal(busca, '');
    await flush(350);

    const tipoSel = container.querySelector('select[aria-label^="Filtrar"]');
    await setSelect(tipoSel, 'CILINDRO');
    container.querySelector('#tnd-filters').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush(350);
    ok(JSON.stringify(rowNomes()) === JSON.stringify(['W1332']), 'filtro TONER/CILINDRO preservado');
    container.querySelector('#tnd-filters button[type="button"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await flush(350);

    const btnNovo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Novo'));
    await act(async () => { btnNovo.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    setVal(container.querySelector('#tnd-codigo'), 'W1330X');
    await setSelect(container.querySelector('#tnd-tipo'), 'TONER');
    setVal(container.querySelector('#tnd-valor'), '199.9');
    await submitForm('#tnd-form');
    const salvar = lastCall('salvar');
    ok(salvar?.body?.codigo === 'W1330X' && Number(salvar.body.valor) === 199.9, 'criação envia codigo+tipo+valor');
    ok(container.textContent.includes('criado com sucesso'), 'confirmação de criação exibida');

    const btnEditar = [...container.querySelectorAll('button[aria-label="Editar consumível"]')][0];
    await act(async () => { btnEditar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!!lastCall('buscar_por_id'), 'editar carrega via buscar_por_id');
    ok(container.querySelector('#tnd-valor')?.value === '199.9', 'valor carregado na edição (persistência)');
    setVal(container.querySelector('#tnd-valor'), '210.50');
    await submitForm('#tnd-form');
    ok(Number(lastCall('salvar')?.body?.valor) === 210.5, 'edição atualiza o valor');
    ok(container.textContent.includes('atualizado com sucesso'), 'confirmação de atualização exibida');

    const btnView = [...container.querySelectorAll('button[aria-label="Visualizar consumível"]')][0];
    await act(async () => { btnView.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(container.textContent.includes('SOMENTE LEITURA'), 'modal Visualizar é SOMENTE LEITURA');
    const btnFechar = [...container.querySelectorAll('.tnd-dialog button')].find((b) => b.textContent.includes('Fechar'));
    await act(async () => { btnFechar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!container.querySelector('.tnd-overlay'), 'modal de visualização fecha');

    confirmResult = false;
    const btnExcluir = () => [...container.querySelectorAll('button[aria-label="Excluir consumível"]')][0];
    await act(async () => { btnExcluir().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!lastCall('excluir'), 'exclusão cancelada não chama a API');
    confirmResult = true;
    await act(async () => { btnExcluir().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!!lastCall('excluir'), 'exclusão confirmada chama a API');
  } finally {
    globalThis.fetch = realFetch;
  }
}

