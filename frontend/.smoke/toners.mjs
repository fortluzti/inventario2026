// Smoke: Toners — CRUD com `valor` (preparação p/ histórico financeiro) e
// "Modelos de impressora compatíveis" via a relação existente
// `impressora_modelos_toner` (migration 006). API 100% em memória.
export async function testToners({ container, act, check, setVal, dom }) {
  const DB = [
    { id: 1, codigo: 'W1330A', tipo: 'TONER', estoque: 4, estoque_minimo: 1, autonomia: 1000, valor: '189.90', data_compra: '', nota_fiscal: '' },
    { id: 2, codigo: 'W1332', tipo: 'CILINDRO', estoque: 2, estoque_minimo: 1, autonomia: 20000, valor: '249.00', data_compra: '', nota_fiscal: '' },
  ];
  let nextId = 10;
  const MODELOS = [
    { id: 29, nome_modelo: '408DN', marca: 'HP' },   // label "HP 408DN"
    { id: 31, nome_modelo: 'M404dn', marca: 'HP' },  // label "HP M404dn"
  ];
  // Relação consumível x modelo (id da linha em impressora_modelos_toner).
  // W1330A é compatível com os DOIS modelos (mesmo consumível, vários modelos).
  let ASSOC = [
    { id: 1, modelo_id: 29, toner_id: 1 },
    { id: 2, modelo_id: 31, toner_id: 1 },
  ];
  let nextAssoc = 3;
  const calls = [];    // endpoint toners
  const relCalls = []; // impressoras_modelos + impressora_modelos_toner
  const lastCall = (a) => [...calls].reverse().find((c) => c.action === a);
  const realFetch = globalThis.fetch;
  let confirmResult = true;
  const flush = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const ok = (cond, label) => check(`toners: ${label}`, !!cond);
  const rowNomes = () => [...container.querySelectorAll('.tnd-table tbody tr td:first-child')].map((td) => td.textContent.trim());
  const relLast = (ep, a) => [...relCalls].reverse().find((c) => c.endpoint === ep && c.action === a);
  const modeloLabel = (m) => [m.marca, m.nome_modelo].filter(Boolean).join(' ');
  const modelosDe = (tonerId) => ASSOC
    .filter((a) => a.toner_id === Number(tonerId))
    .map((a) => MODELOS.find((m) => m.id === a.modelo_id))
    .filter(Boolean);

  function applyList(p) {
    const limit = Math.min(200, Math.max(1, Number(p.get('limit') || 20)));
    const page = Math.max(1, Number(p.get('page') || 1));
    let rows = DB.slice();
    const search = (p.get('search') || '').trim().toLowerCase();
    if (search) rows = rows.filter((r) => String(r.codigo || '').toLowerCase().includes(search));
    const tipo = p.get('tipo');
    if (tipo) rows = rows.filter((r) => r.tipo === tipo);
    const modeloId = p.get('modelo_id');
    if (modeloId) rows = rows.filter((r) => ASSOC.some((a) => a.toner_id === r.id && a.modelo_id === Number(modeloId)));
    rows.sort((a, b) => b.id - a.id);
    const total = rows.length;
    const items = rows.slice((page - 1) * limit, (page - 1) * limit + limit)
      .map((r) => ({ ...r, modelos_compat: modelosDe(r.id).map(modeloLabel).join(', ') || null }));
    return { items, total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
  }

  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(String(url), 'http://x');
    const endpoint = u.searchParams.get('endpoint');
    const action = u.searchParams.get('action');
    const body = opts.body ? JSON.parse(opts.body) : undefined;

    if (endpoint === 'impressoras_modelos' && action === 'listar') {
      const s = (u.searchParams.get('search') || '').trim().toLowerCase();
      relCalls.push({ endpoint, action, search: s });
      const items = MODELOS.filter((m) => !s || modeloLabel(m).toLowerCase().includes(s));
      return Response.json({ success: true, data: { items, total: items.length, page: 1, limit: 20, total_pages: 1 } });
    }

    if (endpoint === 'impressora_modelos_toner') {
      if (action === 'listar') {
        const tid = Number(u.searchParams.get('toner_id') || 0);
        relCalls.push({ endpoint, action, toner_id: tid });
        const items = ASSOC.filter((a) => !tid || a.toner_id === tid).map((a) => {
          const m = MODELOS.find((x) => x.id === a.modelo_id) || {};
          const t = DB.find((x) => x.id === a.toner_id) || {};
          return { ...a, modelo_nome: m.nome_modelo, modelo_marca: m.marca, toner_codigo: t.codigo, toner_tipo: t.tipo };
        });
        return Response.json({ success: true, data: { items, total: items.length, page: 1, limit: 200, total_pages: 1 } });
      }
      if (action === 'salvar') {
        relCalls.push({ endpoint, action, body });
        if (ASSOC.some((a) => a.toner_id === Number(body?.toner_id) && a.modelo_id === Number(body?.modelo_id))) {
          return Response.json({ success: false, message: 'Registro duplicado.' }, { status: 409 });
        }
        const row = { id: nextAssoc++, toner_id: Number(body?.toner_id), modelo_id: Number(body?.modelo_id) };
        ASSOC.push(row);
        return Response.json({ success: true, data: { id: row.id } }, { status: 201 });
      }
      if (action === 'excluir') {
        relCalls.push({ endpoint, action, body });
        ASSOC = ASSOC.filter((a) => a.id !== Number(body?.id));
        return Response.json({ success: true, data: null });
      }
      return Response.json({ success: false, message: 'Ação não prevista.' }, { status: 400 });
    }

    if (endpoint !== 'toners') return realFetch(url, opts);
    calls.push({ action, params: Object.fromEntries(u.searchParams.entries()), body });
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
    ok(container.querySelectorAll('.tnd-table th').length === 8, 'grid com 8 colunas (Valor R$ + Modelos compatíveis)');
    ok([...container.querySelectorAll('.tnd-table th')].some((th) => th.textContent.includes('Modelos compatíveis')), 'coluna "Modelos compatíveis" presente');
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

    /* ---------- filtro por MODELO (autocomplete por modelo real) ---------- */
    const setModeloBusca = (v) => setVal(container.querySelector('#tnd-modelo-busca'), v);
    setModeloBusca('HP 408');
    await flush(350);
    ok(relLast('impressoras_modelos', 'listar')?.search === 'hp 408', 'autocomplete consulta a API de modelos (search)');
    const sugeridos = [...container.querySelectorAll('.tnd-modelo-opcao')];
    ok(sugeridos.length === 1 && sugeridos[0].textContent.includes('HP 408DN'), 'sugestão traz o modelo real "HP 408DN"');
    await act(async () => { sugeridos[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(350);
    ok(JSON.stringify(rowNomes()) === JSON.stringify(['W1330A']), 'buscar "HP 408" retorna só os compatíveis');
    ok(!!container.querySelector('.tnd-modelo-chip'), 'chip do filtro de modelo é exibido');
    ok((container.querySelector('.tnd-table tbody tr .tnd-modelos')?.textContent || '').includes('HP 408DN'), 'coluna mostra o modelo compatível');

    /* o MESMO consumível aparece para o outro modelo compatível (sem duplicar) */
    setModeloBusca('M404');
    await flush(350);
    const sug2 = [...container.querySelectorAll('.tnd-modelo-opcao')];
    await act(async () => { sug2[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(350);
    ok(JSON.stringify(rowNomes()) === JSON.stringify(['W1330A']), 'mesmo consumível compatível com outro modelo');

    /* limpar o filtro de modelo restaura a lista */
    await act(async () => { container.querySelector('.tnd-modelo-chip-x').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(350);
    ok(rowNomes().length === 3, 'remover o filtro de modelo restaura todos os consumíveis');

    /* ---------- editar/remover associações pelo modal do Consumível ---------- */
    const linha = (codigo) => [...container.querySelectorAll('.tnd-table tbody tr')].find((tr) => tr.textContent.includes(codigo));
    const abrirEdicao = async (codigo) => {
      await act(async () => { linha(codigo).querySelector('button[aria-label="Editar consumível"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush(); await flush(); await flush();
    };
    const chips = () => [...container.querySelectorAll('.tnd-compat-chip-txt')].map((el) => el.textContent);
    const assocW1330A = () => ASSOC.filter((a) => a.toner_id === 1);

    await abrirEdicao('W1330A');
    ok(assocW1330A().length === 2 && chips().length === 2, 'edição carrega os 2 modelos já associados');
    await act(async () => { container.querySelector('button[aria-label^="Remover HP 408DN"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(chips().length === 1, 'remover um chip atualiza a lista no modal');
    await submitForm('#tnd-form'); await flush(); await flush();
    ok(!!relLast('impressora_modelos_toner', 'excluir')?.body?.id, 'salvar remove a associação pela API (id da linha)');
    ok(assocW1330A().length === 1, 'associação removida persiste no mock');
    ok(!container.querySelector('.tnd-overlay'), 'modal fecha após salvar');

    /* reabrir confirma persistência e readiciona o segundo modelo (multi-seleção) */
    await abrirEdicao('W1330A');
    ok(chips().length === 1 && chips()[0].includes('HP M404dn'), 'reabre com apenas o modelo remanescente');
    setVal(container.querySelector('#tnd-dialog-modelo-busca'), 'HP 408');
    await flush(350);
    const opcao = [...container.querySelectorAll('.tnd-compat-opcao')];
    ok(opcao.length === 1, 'autocomplete do modal retorna o modelo a readicionar');
    await act(async () => { opcao[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(chips().length === 2, 'modal permite editar para vários modelos');
    await submitForm('#tnd-form'); await flush(); await flush();
    const assocSalvar = relLast('impressora_modelos_toner', 'salvar');
    ok(assocSalvar?.body?.toner_id === 1 && assocSalvar?.body?.modelo_id === 29, 'grava a associação extra p/ o consumível correto');
    ok(assocW1330A().length === 2, 'reassociação persiste');

    /* ---------- novo consumível: associar 2 modelos no mesmo fluxo ---------- */
    await act(async () => { [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Novo')).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    setVal(container.querySelector('#tnd-codigo'), 'M408');
    await setSelect(container.querySelector('#tnd-tipo'), 'TONER');
    for (const termo of ['HP 408', 'M404']) {
      setVal(container.querySelector('#tnd-dialog-modelo-busca'), termo);
      await flush(350);
      const opt = [...container.querySelectorAll('.tnd-compat-opcao')][0];
      await act(async () => { opt.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush();
    }
    await submitForm('#tnd-form'); await flush(); await flush();
    const assocNovos = relCalls.filter((c) => c.endpoint === 'impressora_modelos_toner' && c.action === 'salvar');
    ok(lastCall('salvar')?.body?.codigo === 'M408', 'novo consumível criado');
    ok(assocNovos.length >= 2 && assocNovos.at(-1).body.toner_id === 11, 'associações usam o id do consumível recém-criado (11)');
    ok(container.textContent.includes('criado com sucesso'), 'confirmação de criação exibida');
    ok(JSON.stringify(modelosDe(11).map(modeloLabel)) === JSON.stringify(['HP 408DN', 'HP M404dn']), 'novo consumível guardou 2 modelos');
    ok(rowNomes().filter((c) => c === 'M408').length === 1, 'grade não duplica o consumível com vários modelos');

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

