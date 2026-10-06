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
  const relCalls = []; // impressoras_modelos + impressora_modelos_toner + apoio dos modais
  /* --- Dados das operações da tela (troca / recebimento / histórico) --- */
  const IMPRESSORAS = [
    { id: 16, codigo_interno_impressora: 'IMP-004', modelo_id: 29, modelo_nome: '408DN', modelo_marca: 'HP', setor_id: 11, setor_nome: 'TI' },
    { id: 17, codigo_interno_impressora: 'IMP-005', modelo_id: 31, modelo_nome: 'M404dn', modelo_marca: 'HP', setor_id: 14, setor_nome: 'FINANCEIRO' },
  ];
  const FUNCIONARIOS = [{ id: 32, nome: 'ALEX FABIANO LONGO' }];
  const SETORES = [{ id: 11, nome: 'TI' }, { id: 14, nome: 'FINANCEIRO' }];
  const FORNECEDORES = [{ id: 55, nome: 'DISTRIBUIDORA ALPHA', cnpj: '11.222.333/0001-44', nome_vendedor: 'JOAO', ativo: 1 }];
  const HISTORICO = [];    // linhas gravadas em historico_troca_toner
  const RECEBIMENTOS = []; // lotes gravados em recebimentos_toner
  const pagina = (arr) => ({ items: arr, total: arr.length, page: 1, limit: 200, total_pages: 1 });
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

    /* Apoio dos modais: impressoras (troca/histórico), funcionários (recebimento)
       e setores (filtro do histórico) — mesmos endpoints genéricos da API. */
    if (endpoint === 'impressoras' || endpoint === 'funcionarios' || endpoint === 'setores' || endpoint === 'fornecedores') {
      relCalls.push({ endpoint, action });
      const base = endpoint === 'impressoras' ? IMPRESSORAS : endpoint === 'funcionarios' ? FUNCIONARIOS : endpoint === 'fornecedores' ? FORNECEDORES : SETORES;
      return Response.json({ success: true, data: pagina(base) });
    }

    if (endpoint !== 'toners') return realFetch(url, opts);
    calls.push({ action, params: Object.fromEntries(u.searchParams.entries()), body });

    /* ---------- Ações das operações da tela (troca / recebimento / histórico) ---------- */
    if (action === 'dropdown') {
      return Response.json({ success: true, data: DB.map((r) => ({ id: r.id, nome: r.codigo })) });
    }
    if (action === 'listar_compativeis') {
      const impId = Number(u.searchParams.get('impressora_id') || 0);
      const imp = IMPRESSORAS.find((i) => i.id === impId);
      if (!imp) return Response.json({ success: false, message: 'Impressora nao encontrada.' }, { status: 404 });
      const items = DB.filter((r) => ASSOC.some((a) => a.toner_id === r.id && a.modelo_id === imp.modelo_id));
      return Response.json({ success: true, data: { impressora_id: impId, modelo_id: imp.modelo_id, items } });
    }
    if (action === 'registrar_troca') {
      const imp = IMPRESSORAS.find((i) => i.id === Number(body?.id_impressora));
      const t = DB.find((r) => r.id === Number(body?.id_toner));
      if (!imp || !t) return Response.json({ success: false, message: 'Registro nao encontrado.' }, { status: 404 });
      if (!ASSOC.some((a) => a.toner_id === t.id && a.modelo_id === imp.modelo_id)) {
        return Response.json({ success: false, message: 'Consumivel incompativel com o modelo da impressora selecionada.' }, { status: 422 });
      }
      if ((t.estoque ?? 0) <= 0) {
        return Response.json({ success: false, message: 'Consumivel sem estoque disponivel para troca.' }, { status: 422 });
      }
      t.estoque -= 1;
      HISTORICO.push({
        id: HISTORICO.length + 1,
        data_cadastro: '2026-10-01 10:00:00',
        id_toner: t.id,
        id_impressora: imp.id,
        toner_codigo: t.codigo,
        toner_tipo: t.tipo,
        impressora_codigo: imp.codigo_interno_impressora,
        modelo_nome: imp.modelo_nome,
        modelo_marca: imp.modelo_marca,
        setor_id: imp.setor_id,
        setor_nome: imp.setor_nome,
        usuario_cadastro: body?.usuario || '',
        responsavel: body?.usuario || '',
        observacoes: body?.observacoes || '',
      });
      return Response.json({ success: true, data: { id: HISTORICO.length, codigo: t.codigo, estoque: t.estoque }, message: 'Troca registrada com sucesso. Estoque atualizado.' });
    }
    if (action === 'receber_multiplos') {
      const itens = Array.isArray(body?.toners) ? body.toners : [];
      if (!Number(body?.funcionario_recebedor_id)) return Response.json({ success: false, message: 'Funcionario recebedor e obrigatorio.' }, { status: 422 });
      if (!itens.length) return Response.json({ success: false, message: 'Selecione ao menos um consumivel com quantidade.' }, { status: 422 });
      for (const it of itens) {
        const t = DB.find((r) => r.id === Number(it.toner_id));
        if (!t) return Response.json({ success: false, message: 'Consumivel inexistente no lote.' }, { status: 422 });
        t.estoque = (t.estoque ?? 0) + Number(it.quantidade);
      }
      RECEBIMENTOS.push({ ...body, toners: itens });
      return Response.json({ success: true, data: { funcionario_recebedor: FUNCIONARIOS[0].nome, itens }, message: 'Recebimento registrado com sucesso.' });
    }
    if (action === 'listar_historico') {
      let rows = HISTORICO.slice();
      const impId = u.searchParams.get('impressora_id');
      const setorId = u.searchParams.get('setor_id');
      const tonerId = u.searchParams.get('toner_id');
      if (impId) rows = rows.filter((r) => String(r.id_impressora) === String(impId));
      if (setorId) rows = rows.filter((r) => String(r.setor_id) === String(setorId));
      if (tonerId) rows = rows.filter((r) => String(r.id_toner) === String(tonerId));
      // total_geral = total existente ANTES dos filtros (mesmo com paginação).
      return Response.json({ success: true, data: { items: rows, total: rows.length, total_geral: HISTORICO.length, page: 1, limit: 50, total_pages: 1 } });
    }
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

  /* `<textarea>` precisa do setter de HTMLTextAreaElement (setVal só vale p/ input). */
  function setTextarea(el, value) {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }

  /* ---------- Padrão global: SearchableSelect (dropdown pesquisável) ---------- */
  const ssItems = () => [...container.querySelectorAll('.ss-drop .ss-item')];
  async function ssOpen(btnSel) {
    // Fecha qualquer dropdown aberto (clique fora) antes de abrir outro.
    await act(async () => { dom.window.document.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })); });
    await flush();
    const btn = container.querySelector(btnSel);
    await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(); await flush(); // autofocus usa setTimeout(0)
    return container.querySelector('.ss-drop');
  }
  async function ssClickItem(match) {
    const el = ssItems().find((i) => i.textContent.includes(match));
    await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(); await flush();
    return el;
  }
  async function ssSearch(texto) {
    setVal(container.querySelector('.ss-drop .ss-search-input'), texto);
    await flush();
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

    /* ================= Operações da tela: TUDO em MODAL ================= */
    const headerBtns = () => [...container.querySelectorAll('.tnd-page-header button')].map((b) => b.textContent.trim());
    ok(headerBtns().some((t) => t.includes('Novo Consumível')), 'topo mantém "Novo Consumível"');
    ok(headerBtns().some((t) => t.includes('Registrar Troca')), 'topo tem "Registrar Troca"');
    ok(headerBtns().some((t) => t.includes('Recebimento de Toners')), 'topo tem "Recebimento de Toners"');
    ok(headerBtns().some((t) => t.includes('Ver Histórico de Trocas')), 'topo tem "Ver Histórico de Trocas"');

    const itensMenu = [...container.querySelectorAll('.module-item')].map((b) => b.textContent);
    ok(!itensMenu.some((t) => t.includes('Recebimento de Toners')), 'menu lateral SEM item "Recebimento de Toners"');
    ok(!itensMenu.some((t) => t.includes('Histórico de Trocas')), 'menu lateral SEM item "Histórico de Trocas"');

    const abrirOperacao = async (rotulo) => {
      const btn = [...container.querySelectorAll('.tnd-page-header button')].find((b) => b.textContent.includes(rotulo));
      await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush(); await flush();
    };
    const fecharOverlay = async () => {
      const btn = [...container.querySelectorAll('.tnd-overlay button')].find((b) => b.getAttribute('aria-label') === 'Fechar');
      await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush(); await flush();
    };
    const linhasDoOverlay = () => container.querySelectorAll('.tnd-overlay .tnd-table tbody tr');

    /* ---------- 1. Registrar Troca ---------- */
    await abrirOperacao('Registrar Troca');
    ok(!!container.querySelector('.tnd-overlay'), '"Registrar Troca" abre MODAL');
    ok(!!container.querySelector('#tnd-troca-impressora'), 'modal da troca tem botão de impressora (padrão pesquisável)');
    ok(!container.querySelector('#tnd-receb-func'), 'modal da troca NÃO permite escolher funcionário');
    ok(container.textContent.includes('USUÁRIO LOGADO'), 'responsável exibido = usuário logado');
    await flush(); await flush(); await flush();

    /* Padrão global: busca no topo, foco automático, filtro, limpar e seleção */
    const dropImp = await ssOpen('#tnd-troca-impressora');
    ok(!!dropImp && !!dropImp.querySelector('.ss-search-input'), 'dropdown de impressora abre com "🔍 Buscar..." no topo');
    ok(dom.window.document.activeElement === dropImp.querySelector('.ss-search-input'), 'foco automático no campo de busca');
    ok(ssItems().length === 2, 'modal lista as impressoras cadastradas');
    await ssSearch('IMP-005');
    ok(ssItems().length === 1 && ssItems()[0].textContent.includes('IMP-005'), 'busca filtra conforme a digitação');
    await ssSearch('nao-existe');
    ok(ssItems().length === 0 && dropImp.textContent.includes('Nenhum registro'), 'busca sem resultado exibe vazio');
    await act(async () => { dropImp.querySelector('.ss-clear').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(ssItems().length === 2, 'limpar a busca restaura os resultados');
    await ssSearch('IMP-004');
    await ssClickItem('IMP-004');
    ok(!container.querySelector('.ss-drop'), 'selecionar item fecha o dropdown');
    ok(container.querySelector('#tnd-troca-impressora').textContent.includes('IMP-004'), 'valor selecionado é mantido no campo');
    await flush(); await flush();
    ok(lastCall('listar_compativeis')?.params?.impressora_id === '16', 'troca consulta os consumíveis compatíveis com a impressora');
    const dropTon = await ssOpen('#tnd-troca-toner');
    ok(ssItems().length === 1, 'só o consumível compatível com o modelo é oferecido');
    ok(ssItems()[0].textContent.includes('W1330A'), 'compatível = W1330A (TONER/CILINDRO pela mesma relação)');
    await ssClickItem('W1330A');
    setTextarea(container.querySelector('#tnd-troca-obs'), 'Troca de teste');
    await flush();
    const estoqueAntes = DB.find((r) => r.id === 1).estoque;
    await submitForm('#tnd-troca-form');
    const trocaBody = lastCall('registrar_troca')?.body;
    ok(trocaBody?.id_impressora === 16 && trocaBody?.id_toner === 1, 'envia impressora + consumível');
    ok(trocaBody?.usuario === 'admin.ti', 'responsável = usuário logado (login enviado, sem funcionário manual)');
    ok(DB.find((r) => r.id === 1).estoque === estoqueAntes - 1, 'troca baixa 1 unidade no estoque');
    ok(HISTORICO.length === 1, 'troca gravada no histórico');
    ok(!container.querySelector('.tnd-overlay'), 'modal da troca fecha após confirmar');
    ok(container.textContent.includes('Estoque atualizado'), 'confirmação da troca exibida na tela');

    /* ---------- 2. Recebimento de Toners (múltiplo) ---------- */
    await abrirOperacao('Recebimento de Toners');
    ok(!!container.querySelector('#tnd-receb-func'), '"Recebimento de Toners" abre MODAL');
    ok(!!container.querySelector('#tnd-receb-data'), 'modal tem data do recebimento');
    ok(!!container.querySelector('#tnd-receb-obs'), 'modal tem observação');
    ok(!!container.querySelector('#tnd-receb-fornecedor'), 'modal tem campo Fornecedor (opcional)');
    await flush(); await flush(); await flush();

    /* Funcionário recebedor: padrão pesquisável */
    const dropFunc = await ssOpen('#tnd-receb-func');
    ok(!!dropFunc?.querySelector('.ss-search-input'), 'recebedor usa dropdown com busca no topo');
    ok(ssItems().length === 1, 'modal lista o funcionário recebedor');
    await ssSearch('alex');
    ok(ssItems().length === 1 && ssItems()[0].textContent.includes('ALEX'), 'busca localiza o recebedor');
    await ssClickItem('ALEX FABIANO');
    ok(container.querySelector('#tnd-receb-func').textContent.includes('ALEX'), 'recebedor selecionado mantém o valor');

    /* Fornecedor: cadastro real com busca (1º recebimento fica SEM fornecedor) */
    const dropForn1 = await ssOpen('#tnd-receb-fornecedor');
    ok(!!dropForn1?.querySelector('.ss-search-input'), 'fornecedor usa dropdown com busca no topo');
    ok(ssItems().length === 1, 'dropdown lista o cadastro real de fornecedores');
    await ssSearch('alpha');
    ok(ssItems()[0]?.textContent.includes('ALPHA'), 'busca localiza o fornecedor pelo nome');
    await act(async () => { dom.window.document.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })); });
    await flush();

    const est1Antes = DB.find((r) => r.id === 1).estoque;
    const est2Antes = DB.find((r) => r.id === 2).estoque;
    const addLote = async () => {
      const btn = [...container.querySelectorAll('.tnd-receb-add button')].find((b) => b.textContent.includes('Adicionar'));
      await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush();
    };
    const escolherConsumivel = async (texto) => {
      await ssOpen('#tnd-receb-toner');
      await ssSearch(texto);
      await ssClickItem(texto);
    };
    await escolherConsumivel('W1330A');
    await addLote();
    ok(container.querySelectorAll('.tnd-receb-item').length === 1, 'primeiro consumível entra no lote');
    setVal(container.querySelector('.tnd-receb-item input'), '3');
    await flush();
    await escolherConsumivel('W1332');
    await addLote();
    ok(container.querySelectorAll('.tnd-receb-item').length === 2, 'lote aceita VÁRIOS consumíveis');
    await submitForm('#tnd-receb-form');
    const recebBody = lastCall('receber_multiplos')?.body;
    ok(recebBody?.funcionario_recebedor_id === 32, 'envia o funcionário recebedor');
    ok(recebBody?.fornecedor_id == null, 'fornecedor omitido continua funcionando (opcional)');
    ok(recebBody?.toners?.length === 2, 'envia os 2 consumíveis com quantidade');
    ok(DB.find((r) => r.id === 1).estoque === est1Antes + 3, 'estoque somou 3 no 1º consumível');
    ok(DB.find((r) => r.id === 2).estoque === est2Antes + 1, 'estoque somou 1 no 2º consumível');
    ok(RECEBIMENTOS.length === 1, 'recebimento registrado na tabela de recebimentos');
    ok(!container.querySelector('.tnd-overlay'), 'modal do recebimento fecha após confirmar');
    ok(container.textContent.includes('Estoque atualizado'), 'confirmação do recebimento exibida');

    /* 2b. Segundo recebimento COM fornecedor (persistência no cadastro real) */
    await abrirOperacao('Recebimento de Toners');
    await flush(); await flush(); await flush();
    await ssOpen('#tnd-receb-func');
    await ssClickItem('ALEX FABIANO');
    const dropForn2 = await ssOpen('#tnd-receb-fornecedor');
    await ssSearch('alpha');
    await ssClickItem('DISTRIBUIDORA ALPHA');
    ok(container.querySelector('#tnd-receb-fornecedor').textContent.includes('ALPHA'), 'fornecedor selecionado mantém o valor');
    await escolherConsumivel('W1330A');
    await addLote();
    const est1Antes2 = DB.find((r) => r.id === 1).estoque;
    await submitForm('#tnd-receb-form');
    const recebBody2 = lastCall('receber_multiplos')?.body;
    ok(recebBody2?.fornecedor_id === 55, 'recebimento com fornecedor envia o id do cadastro real');
    ok(RECEBIMENTOS[1]?.fornecedor_id === 55, 'fornecedor persistido no recebimento');
    ok(DB.find((r) => r.id === 1).estoque === est1Antes2 + 1, 'estoque atualizado no 2º recebimento');
    ok(RECEBIMENTOS.length === 2, '2º recebimento registrado');
    ok(!container.querySelector('.tnd-overlay'), 'modal fecha após o 2º recebimento');

    /* ---------- 3. Histórico de Trocas ---------- */
    await abrirOperacao('Ver Histórico de Trocas');
    await flush(); await flush(); await flush();
    ok(!!container.querySelector('.tnd-overlay'), '"Histórico de Trocas" abre MODAL');
    ok(!!container.querySelector('.tnd-page'), 'listagem de Toners segue montada (sem navegação)');
    ok(!container.textContent.includes('ainda não implementado'), 'nenhuma operação cai em página em construção');
    const filtrosHist = container.querySelectorAll('.tnd-overlay .tnd-hist-filtros .ss-root');
    ok(filtrosHist.length === 3, 'preserva os filtros impressora, setor e consumível (todos pesquisáveis)');

    /* Contagens: total sem filtros x registros encontrados com os filtros atuais */
    const contagemTotal = () => Number((container.querySelector('.tnd-hist-total strong')?.textContent || '0').replace(/\D/g, ''));
    const contagemEncontrados = () => Number((container.querySelector('.tnd-hist-encontrados strong')?.textContent || '0').replace(/\D/g, ''));
    ok(container.textContent.includes('Total de registros:'), 'exibe "Total de registros" (antes dos filtros)');
    ok(container.textContent.includes('Registros encontrados:'), 'exibe "Registros encontrados" (resultado dos filtros)');
    ok(contagemTotal() === 1, `total de registros = 1 (recebimentos não contam: ${contagemTotal()})`);
    ok(contagemEncontrados() === 1, `registros encontrados = 1 sem filtros (${contagemEncontrados()})`);
    ok(linhasDoOverlay().length === 1, 'histórico lista a troca registrada');
    const cel = [...linhasDoOverlay()[0].querySelectorAll('td')].map((td) => td.textContent);
    ok(cel[0].includes('/'), 'coluna Data');
    ok(cel[1].includes('408DN') && cel[1].includes('IMP-004'), 'coluna Modelo / Impressora');
    ok(cel[2].includes('TI'), 'coluna Setor');
    ok(cel[3].includes('W1330A'), 'coluna Consumível');
    ok(cel[4].includes('admin.ti'), 'coluna Responsável');
    ok(cel[5].includes('Troca de teste'), 'coluna Observações');

    /* Filtro por impressora: pesquisável e enviado à API; contagens atualizam */
    const dropHistImp = await ssOpen('#tnd-hist-impressora');
    ok(!!dropHistImp?.querySelector('.ss-search-input'), 'filtro de impressora tem busca no topo');
    await ssSearch('IMP-005');
    ok(ssItems().length === 1 && ssItems()[0].textContent.includes('IMP-005'), 'busca filtra o filtro de impressora');
    await ssClickItem('IMP-005');
    await flush(); await flush();
    ok(lastCall('listar_historico')?.params?.impressora_id === '17', 'filtro por impressora é enviado à API');
    ok(linhasDoOverlay().length === 1 && linhasDoOverlay()[0].textContent.includes('Nenhum registro'),
      'filtro por outra impressora devolve vazio');
    ok(contagemTotal() === 1, 'total de registros NÃO muda ao aplicar filtro');
    ok(contagemEncontrados() === 0, 'registros encontrados = 0 com o filtro aplicado');

    /* Limpar filtros restaura contagens e registros */
    const btnLimpar = [...container.querySelectorAll('.tnd-hist-filtros button')].find((b) => b.textContent.includes('Limpar'));
    await act(async () => { btnLimpar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush(); await flush();
    ok(!lastCall('listar_historico')?.params?.impressora_id, 'limpar filtros reenvia sem filtro');
    ok(linhasDoOverlay().length === 1, 'limpar filtros restaura os registros');
    ok(contagemTotal() === 1 && contagemEncontrados() === 1, 'limpar filtros restaura as contagens');

    await fecharOverlay();
    ok(!container.querySelector('.tnd-overlay'), 'modal do histórico fecha');
    ok(!!container.querySelector('.tnd-page'), 'volta para a tela de Toners sem navegação');
  } finally {
    globalThis.fetch = realFetch;
  }
}

