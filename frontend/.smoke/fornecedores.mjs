// Smoke: listagem de Fornecedores — busca/filtros, ordenação por cabeçalho,
// paginação e CRUD em modal (novo/editar/visualizar/excluir), espelhando o
// Crud do apiphp (whitelist sortable, filtro ativo, 409 de exclusão com vínculos).
export async function testFornecedores({ container, act, check, setVal, dom }) {
  // ---- dados mock (campos reais da tabela `fornecedores` do inventario2) ----
  const DB = [
    { id: 12, nome: '( ML ) Wii business solution importacao', cnpj: '11.478.152/0004-63', telefone: '', endereco: '', tipo: 'Fornecedor de Produtos', nome_vendedor: '', email: '', ativo: 1 },
    { id: 11, nome: 'AMAZON', cnpj: null, telefone: '', endereco: '', tipo: 'Fornecedor de Produtos', nome_vendedor: '', email: '', ativo: 1 },
    { id: 10, nome: 'ROBSON ZANELATO', cnpj: null, telefone: '17991213137', endereco: '', tipo: 'Prestador de Serviços', nome_vendedor: 'ROBSON', email: '', ativo: 1 },
    { id: 9, nome: 'NADIEL COMERCIO DE ELETRONICOS LTDA', cnpj: null, telefone: '1731211618', endereco: '', tipo: 'Fornecedor de Produtos', nome_vendedor: '', email: '', ativo: 1 },
    { id: 7, nome: 'FABELIA', cnpj: null, telefone: '', endereco: '', tipo: 'Fornecedor de Produtos', nome_vendedor: 'JAKELINE', email: '', ativo: 1 },
    { id: 6, nome: 'KABUM', cnpj: null, telefone: '1921144444', endereco: 'WWW.KABUM.COM.BR', tipo: 'Fornecedor de Produtos', nome_vendedor: 'LOJA ONLINE', email: '', ativo: 1 },
    { id: 3, nome: 'FORNECEDOR INATIVO LTDA', cnpj: '12.345.678/0001-90', telefone: '', endereco: '', tipo: 'Prestador de Serviços', nome_vendedor: '', email: '', ativo: 0 },
  ];
  // massa extra para paginação real (menor opção do select é 10)
  for (let i = 1; i <= 12; i++) {
    DB.push({ id: 40 + i, nome: `FORNECEDORES MOCK ${String(i).padStart(2, '0')}`, cnpj: null, telefone: '', endereco: '', tipo: 'Fornecedor de Produtos', nome_vendedor: '', email: '', ativo: 1 });
  }
  const VINCULADOS = new Set([11]); // histórico real bloqueia exclusão (409)
  const SORTABLE = { nome: 'nome', cnpj: 'cnpj', telefone: 'telefone', tipo: 'tipo', nome_vendedor: 'nome_vendedor', email: 'email', status: 'ativo' };
  let nextId = 60; // acima dos mocks (41..52) para não colidir keys no React
  let confirmResult = true;

  function applyList(p) {
    const limit = Math.min(200, Math.max(1, Number(p.get('limit') || 20)));
    const page = Math.max(1, Number(p.get('page') || 1));
    let rows = DB.slice();
    const search = (p.get('search') || '').trim().toLowerCase();
    if (search) rows = rows.filter((r) => [r.nome, r.cnpj, r.nome_vendedor].some((v) => String(v || '').toLowerCase().includes(search)));
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
        const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base', numeric: true });
        return cmp !== 0 ? cmp * dir : b.id - a.id;
      });
    } else {
      rows.sort((a, b) => b.id - a.id);
    }
    const total = rows.length;
    return { items: rows.slice((page - 1) * limit, (page - 1) * limit + limit), total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
  }

  // ---- mock de fetch (espelha client.js: success/message/status) ----
  const calls = [];
  const realFetch = globalThis.fetch;
  const realConfirm = dom.window.confirm;
  dom.window.confirm = () => confirmResult;
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(String(url), 'http://localhost');
    const endpoint = u.searchParams.get('endpoint');
    const action = u.searchParams.get('action');
    const method = opts.method || 'GET';
    let body = null;
    try { body = opts.body ? JSON.parse(opts.body) : null; } catch { /* corpo inválido */ }
    calls.push({ endpoint, action, method, body, params: u.searchParams });
    const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }), text: async () => JSON.stringify({ success: true, data }) });
    const err = (status, message) => ({ ok: false, status, json: async () => ({ success: false, message }), text: async () => JSON.stringify({ success: false, message }) });

    if (endpoint !== 'fornecedores') return ok({ items: [], total: 0, page: 1, limit: 20, total_pages: 0 });
    if (action === 'listar') return ok(applyList(u.searchParams));
    if (action === 'buscar_por_id') {
      const row = DB.find((r) => r.id === Number(u.searchParams.get('id')));
      return row ? ok(row) : err(404, 'Registro nao encontrado.');
    }
    if (action === 'salvar') {
      if (!body || !String(body.nome || '').trim()) return err(422, 'Erros de validacao.');
      if (DB.some((r) => r.cnpj && r.cnpj === body.cnpj && r.id !== Number(body.id || 0))) return err(409, 'Registro duplicado: ja existe um registro com este valor unico.');
      if (body.id) {
        const row = DB.find((r) => r.id === Number(body.id));
        Object.assign(row, body);
        return ok({ id: row.id });
      }
      const novo = { cnpj: null, telefone: null, endereco: null, nome_vendedor: null, email: null, ativo: 1, ...body, id: nextId++ };
      DB.push(novo);
      return ok({ id: novo.id });
    }
    if (action === 'excluir') {
      const id = Number(body && body.id);
      if (VINCULADOS.has(id)) return err(409, 'Nao e possivel excluir: vinculos encontrados - 2 registro(s) em celulares. Inative o registro (ativo = 0) para preservar o historico.');
      const idx = DB.findIndex((r) => r.id === id);
      if (idx < 0) return err(404, 'Registro nao encontrado para exclusao.');
      DB.splice(idx, 1);
      return ok(null);
    }
    return err(400, 'Acao invalida ou nao especificada para este modulo.');
  };

  const flush = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  // assinatura do check do interactive.mjs é (name, cond) — wrapper para ler (cond, name).
  const ok = (cond, name) => check(name, cond);
  const lastCall = (action) => [...calls].reverse().find((c) => c.endpoint === 'fornecedores' && c.action === action);
  const headers = () => [...container.querySelectorAll('.forn-table thead th')];
  // th ordenável tem <span class="th-sort-label"> + ícone Material no textContent
  const findByLabel = (label) => headers().find((th) => (th.querySelector('.th-sort-label')?.textContent || th.textContent).replace(/[↕↑↓\s]/g, '').trim() === label);
  const rowNomes = () => [...container.querySelectorAll('.forn-table tbody tr')].map((tr) => tr.querySelector('.forn-name')?.textContent || '');
  const setSelect = (el, v) => { el.value = v; el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const submitForm = async (id) => {
    const form = container.querySelector(id);
    await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
  };

  try {
    // navega para Fornecedores via menu lateral (o botão tem ícone Material no textContent)
    const menuItem = [...container.querySelectorAll('.module-item, button, a')].find((el) => el.textContent.includes('Fornecedores'));
    if (menuItem) { await act(async () => { menuItem.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); }
    await flush();
    ok(!!container.querySelector('.forn-table'), 'abre listagem de Fornecedores');

    // cabeçalhos ordenáveis (padrão SortableTh) + coluna Ações
    const esperados = ['Nome', 'CNPJ', 'Telefone', 'Tipo', 'Vendedor', 'E-mail', 'Status'];
    const faltando = esperados.filter((l) => !findByLabel(l));
    ok(faltando.length === 0, `cabeçalhos ordenáveis renderizados${faltando.length ? ' (faltando: ' + faltando.join(', ') + ')' : ''}`);
    ok(!!findByLabel('Nome')?.classList.contains('th-sortable'), 'coluna Nome usa o componente ordenável');
    ok(headers().length === 8, '8 colunas no cabeçalho (7 ordenáveis + Ações)');

    // filtro padrão = Ativos (id 3 inativo fora da listagem)
    ok(!rowNomes().includes('FORNECEDOR INATIVO LTDA'), 'filtro padrão ativo=1 esconde inativos');
    ok(rowNomes().includes('AMAZON'), 'listagem renderiza registros ativos');

    const clickTh = async (label) => {
      const th = findByLabel(label);
      // o handler de ordenação está no botão interno .th-sort (SortableTh)
      const btn = th.querySelector('.th-sort') || th;
      await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
      await flush();
      return findByLabel(label);
    };

    // ordenação: asc ↑ → desc ↓ → padrão
    let th = await clickTh('Nome');
    let p = lastCall('listar')?.params;
    ok(!!p && p.get('sort') === 'nome' && p.get('dir') === 'asc', '1º clique em Nome → sort=nome dir=asc');
    ok(th.querySelector('.mat')?.textContent === 'arrow_upward', 'indicador ↑ (arrow_upward) no cabeçalho ativo');
    const asc = rowNomes();
    ok(JSON.stringify(asc) === JSON.stringify([...asc].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))), 'linhas em ordem crescente');
    th = await clickTh('Nome');
    p = lastCall('listar')?.params;
    ok(!!p && p.get('sort') === 'nome' && p.get('dir') === 'desc', '2º clique em Nome → sort=nome dir=desc');
    ok(th.querySelector('.mat')?.textContent === 'arrow_downward', 'indicador ↓ (arrow_downward) no cabeçalho ativo');
    await clickTh('Nome');
    p = lastCall('listar')?.params;
    ok(!!p && !p.get('sort') && !p.get('dir'), '3º clique → estado padrão (sem sort/dir)');
    await clickTh('Status');
    p = lastCall('listar')?.params;
    ok(!!p && p.get('sort') === 'status', 'clique em Status → sort=status (ativo)');

    // busca com debounce + filtro de status
    const search = container.querySelector('input[aria-label^="Buscar"]');
    setVal(search, 'amazon');
    await flush(350);
    p = lastCall('listar')?.params;
    ok(!!p && p.get('search') === 'amazon', 'busca enviada após debounce (search=amazon)');
    ok(JSON.stringify(rowNomes()) === JSON.stringify(['AMAZON']), 'busca filtra a listagem');

    const statusSel = container.querySelector('select[aria-label="Filtrar por status"]');
    setSelect(statusSel, '0');
    const formFilters = container.querySelector('#forn-filters');
    await act(async () => { formFilters.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
    const btnLimpar = [...formFilters.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Limpar');
    await act(async () => { btnLimpar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();

    // paginação (menor opção do select = 10; 18 ativos → 2 páginas)
    const porPagina = container.querySelector('select[aria-label="Registros por página"]');
    setSelect(porPagina, '10');
    await flush();
    p = lastCall('listar')?.params;
    ok(rowNomes().length === 10, `limit=10 devolve 10 linhas (veio ${rowNomes().length})`);
    ok(!!p && p.get('limit') === '10' && p.get('page') === '1', `parâmetros page/limit enviados (limit=${p?.get('limit')}, page=${p?.get('page')})`);
    const btnProx = [...container.querySelectorAll('.forn-pagination button')].find((b) => b.textContent.trim() === 'Próximo');
    await act(async () => { btnProx.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    p = lastCall('listar')?.params;
    ok(!!p && p.get('page') === '2', 'paginação avança para page=2');
    ok(rowNomes().length === 8, `page=2 devolve as 8 linhas restantes (veio ${rowNomes().length})`);
    // restaura paginação padrão para os próximos fluxos
    setSelect(container.querySelector('select[aria-label="Registros por página"]'), '20');
    await flush();

    /* ---------- Novo em modal ---------- */
    const btnNovo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Novo Fornecedor'));
    await act(async () => { btnNovo.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!!container.querySelector('.forn-overlay .forn-dialog'), 'modal Novo Fornecedor abre (overlay WinUI)');
    ok(container.textContent.includes('NOVO CADASTRO'), 'badge NOVO CADASTRO no header');

    // submissão vazia → mensagem de erro (não fecha o modal)
    await submitForm('#forn-form');
    ok(!!container.querySelector('.forn-message.error'), 'validação bloqueia submissão vazia');
    ok(!!container.querySelector('.forn-overlay .forn-dialog'), 'modal permanece aberto com erro');

    const nomeInput = container.querySelector('#forn-nome');
    setVal(nomeInput, 'FORNECEDORES TESTE SMOKE');
    setSelect(container.querySelector('#forn-tipo'), 'Prestador de Serviços');
    await flush();
    await submitForm('#forn-form');
    const salvar1 = lastCall('salvar');
    ok(!!salvar1 && salvar1.method === 'POST' && salvar1.action === 'salvar', 'salvar chama POST action=salvar');
    ok(!!salvar1?.body && salvar1.body.nome === 'FORNECEDORES TESTE SMOKE' && salvar1.body.tipo === 'Prestador de Serviços', 'payload com nome e tipo reais');
    ok(!!salvar1?.body && salvar1.body.ativo === 1 && !salvar1.body.id, 'payload novo: ativo=1 e sem id');
    ok(!container.querySelector('.forn-overlay'), 'modal fecha após salvar');
    ok(container.textContent.includes('Fornecedor criado com sucesso.'), 'confirmação de criação exibida');

    /* ---------- Editar em modal ---------- */
    const btnEditar = [...container.querySelectorAll('button[aria-label="Editar fornecedor"]')][0];
    await act(async () => { btnEditar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!!lastCall('buscar_por_id'), 'editar carrega via buscar_por_id');
    const nomeEdit = container.querySelector('#forn-nome');
    ok(!!nomeEdit && nomeEdit.value.length > 0, 'form de edição preenchido');
    ok(container.textContent.includes('EM EDIÇÃO'), 'badge EM EDIÇÃO no header');
    ok(!!container.querySelector('#forn-ativo'), 'checkbox Ativo disponível na edição');
    setVal(container.querySelector('#forn-telefone'), '19000000000');
    await submitForm('#forn-form');
    const salvar2 = lastCall('salvar');
    ok(!!salvar2?.body && Number(salvar2.body.id) > 0 && salvar2.body.telefone === '19000000000', 'edição envia id e campos alterados');
    ok(container.textContent.includes('Fornecedor atualizado com sucesso.'), 'confirmação de atualização exibida');

    /* ---------- Visualizar (somente leitura) ---------- */
    const btnView = [...container.querySelectorAll('button[aria-label="Visualizar fornecedor"]')][0];
    await act(async () => { btnView.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(container.textContent.includes('SOMENTE LEITURA'), 'modal Visualizar é SOMENTE LEITURA');
    ok(!!container.querySelector('.forn-dialog fieldset[disabled]') || container.querySelector('.forn-dialog fieldset')?.disabled, 'fieldset desabilitado na visualização');
    ok(!container.querySelector('button[type="submit"][form="forn-form"]'), 'sem botão de salvar na visualização');
    const btnFechar = [...container.querySelectorAll('.forn-dialog button')].find((b) => b.textContent.includes('Fechar'));
    await act(async () => { btnFechar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!container.querySelector('.forn-overlay'), 'modal de visualização fecha');

    /* ---------- Exclusão: cancelada, confirmada e bloqueada por vínculo (409) ---------- */
    confirmResult = false;
    const btnExcluir = () => [...container.querySelectorAll('button[aria-label="Excluir fornecedor"]')][0];
    await act(async () => { btnExcluir().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!lastCall('excluir'), 'exclusão cancelada não chama a API');

    confirmResult = true;
    await act(async () => { btnExcluir().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!!lastCall('excluir'), 'exclusão confirmada chama a API');
    ok(container.textContent.includes('excluído com sucesso'), 'mensagem de exclusão exibida');

    // registro com vínculo → 409 do backend → orientação de inativar
    const busca = container.querySelector('input[aria-label^="Buscar"]');
    setVal(busca, 'AMAZON');
    await flush(350);
    ok(JSON.stringify(rowNomes()) === JSON.stringify(['AMAZON']), 'busca isola o registro com vínculo (AMAZON)');
    await act(async () => { btnExcluir().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
    ok(!!lastCall('excluir') && lastCall('excluir').body?.id === 11, 'exclusão do vínculo enviada para a API');
    const erroExibido = container.querySelector('.forn-message.error')?.textContent || 'SEM MENSAGEM';
    ok(erroExibido.includes('Inative o registro'), `409 com vínculos orienta a inativar (exibido: ${erroExibido.slice(0, 90)})`);
  } finally {
    globalThis.fetch = realFetch;
    dom.window.confirm = realConfirm;
  }
}
