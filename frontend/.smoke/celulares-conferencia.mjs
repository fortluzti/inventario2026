// Smoke: tela de CONFERÊNCIA de dados de celulares (somente leitura).
// Mock em memória espelhando a ação `celulares/conferencia_dados` do backend:
//  - uma linha por associação (celular × funcionário) + celulares sem associação;
//  - filtros de auditoria (status do funcionário/celular, associação, situação, tipo);
//  - ordenação por whitelist antes do slice (paginação no servidor);
//  - todos=1 devolve o conjunto filtrado inteiro (usado pela exportação CSV).
export async function testCelularesConferencia({ container, act, check, setVal, dom }) {
  // ---- dados mock (compartilhados entre mock e asserções) ----
  const DB = [
    {
      celular_id: 7, associacao_id: 6, codigo: 'CEL-014', marca: 'SAMSUNG', modelo: 'SM-J250M/DS',
      numero: '(17) 99646-8369', gmail: 'fortluz.8369@gmail.com', email_corporativo: 'vendas2@fortluz.com.br',
      funcionario_id: 6, funcionario: 'LUIS PEREIRA ANDRADE', funcionario_cargo: 'VENDEDOR',
      funcionario_email: 'vendas2@fortluz.com.br', funcionario_ativo: 0, funcionario_status: 'Inativo',
      celular_status: 'Em Uso', associacao: 'Atual', data_inicio: '2022-11-21 00:00:00', data_fim: null,
      situacoes: [
        { codigo: 'numero_duplicado', label: 'Número repetido em mais de um celular' },
        { codigo: 'funcionario_inativo_com_uso_atual', label: 'Funcionário inativo ainda possui número/e-mail em uso (associação ativa)' },
      ],
      observacoes: [],
    },
    {
      celular_id: 34, associacao_id: 45, codigo: 'CEL-048', marca: 'XIAOMI', modelo: '23129RA5FL',
      numero: '(17) 99646-8369', gmail: 'fortluz.8369@gmail.com', email_corporativo: 'vendas2@fortluz.com.br',
      funcionario_id: 4, funcionario: 'RAFAEL AMARO ARANTES', funcionario_cargo: 'VENDEDOR',
      funcionario_email: 'vendas2@fortluz.com.br', funcionario_ativo: 1, funcionario_status: 'Ativo',
      celular_status: 'Em Uso', associacao: 'Atual', data_inicio: '2026-08-05 00:00:00', data_fim: null,
      situacoes: [{ codigo: 'numero_duplicado', label: 'Número repetido em mais de um celular' }],
      observacoes: [],
    },
    {
      celular_id: 34, associacao_id: 33, codigo: 'CEL-048', marca: 'XIAOMI', modelo: '23129RA5FL',
      numero: '(17) 99646-8369', gmail: 'fortluz.8369@gmail.com', email_corporativo: 'vendas2@fortluz.com.br',
      funcionario_id: 33, funcionario: 'EDSON FERREIRA DE OLIVEIRA JUNIOR', funcionario_cargo: 'VENDEDOR',
      funcionario_email: 'vendas2@fortluz.com.br', funcionario_ativo: 0, funcionario_status: 'Inativo',
      celular_status: 'Em Uso', associacao: 'Histórica', data_inicio: '2025-04-10 00:00:00', data_fim: '2026-08-03 00:00:00',
      situacoes: [],
      observacoes: [{ codigo: 'funcionario_inativo_historico', label: 'Funcionário inativo — associação já encerrada (histórico legítimo)' }],
    },
    {
      celular_id: 4, associacao_id: 3, codigo: 'CEL-008', marca: 'SAMSUNG', modelo: 'SM-J250M/DS',
      numero: '(17) 99618-4937', gmail: 'tifortluz@gmail.com', email_corporativo: null,
      funcionario_id: 3, funcionario: 'TANIA CRISTA DE SOUZA PEDROSO', funcionario_cargo: 'COMPRAS',
      funcionario_email: 'compras1@fortluz.com.br', funcionario_ativo: 1, funcionario_status: 'Ativo',
      celular_status: 'Em Estoque', associacao: 'Histórica', data_inicio: '2022-05-19 00:00:00', data_fim: '2018-09-02 00:00:00',
      situacoes: [{ codigo: 'data_fim_antes_do_inicio', label: 'Data de fim do uso anterior à data de início' }],
      observacoes: [{ codigo: 'sem_email_corporativo', label: 'E-mail corporativo não cadastrado no celular' }],
    },
    {
      celular_id: 45, associacao_id: null, codigo: 'CEL-058', marca: 'XIAOMI', modelo: '24094RAD4G',
      numero: '(17) 99647-3718', gmail: 'comprasfortluz@gmail.com', email_corporativo: null,
      funcionario_id: null, funcionario: null, funcionario_cargo: null, funcionario_email: null,
      funcionario_ativo: null, funcionario_status: null,
      celular_status: 'Em Uso', associacao: null, data_inicio: null, data_fim: null,
      situacoes: [{ codigo: 'celular_em_uso_sem_associacao', label: 'Celular com status "Em Uso" sem associação ativa' }],
      observacoes: [{ codigo: 'sem_associacao', label: 'Celular sem nenhuma associação/histórico registrado' }],
    },
    {
      celular_id: 48, associacao_id: null, codigo: 'CEL-061', marca: 'XIAOMI', modelo: '24090RA29C',
      numero: '(17) 99636-0970', gmail: 'fortluz.0970@gmail.com', email_corporativo: null,
      funcionario_id: null, funcionario: null, funcionario_cargo: null, funcionario_email: null,
      funcionario_ativo: null, funcionario_status: null,
      celular_status: 'Em Estoque', associacao: null, data_inicio: null, data_fim: null,
      situacoes: [],
      observacoes: [{ codigo: 'sem_associacao', label: 'Celular sem nenhuma associação/histórico registrado' }],
    },
  ]

  const SORTABLE = {
    codigo: 'codigo', numero: 'numero', gmail: 'gmail', email_corporativo: 'email_corporativo',
    funcionario: 'funcionario', status_funcionario: 'funcionario_ativo', status_celular: 'celular_status',
    associacao: 'associacao', inicio: 'data_inicio', fim: 'data_fim', situacao: 'situacoes',
  }

  const REGRAS = [
    { codigo: 'numero_duplicado', label: 'Número repetido em mais de um celular', tipo: 'inconsistencia' },
    { codigo: 'funcionario_inativo_com_uso_atual', label: 'Funcionário inativo ainda possui número/e-mail em uso (associação ativa)', tipo: 'inconsistencia' },
    { codigo: 'data_fim_antes_do_inicio', label: 'Data de fim do uso anterior à data de início', tipo: 'inconsistencia' },
    { codigo: 'celular_em_uso_sem_associacao', label: 'Celular com status "Em Uso" sem associação ativa', tipo: 'inconsistencia' },
    { codigo: 'sem_associacao', label: 'Celular sem nenhuma associação/histórico registrado', tipo: 'observacao' },
    { codigo: 'funcionario_inativo_historico', label: 'Funcionário inativo — associação já encerrada (histórico legítimo)', tipo: 'observacao' },
  ]

  function resumoDe(rows) {
    const porInconsistencia = {}
    const porObservacao = {}
    REGRAS.forEach((r) => {
      const chave = r.tipo === 'inconsistencia' ? 'situacoes' : 'observacoes'
      const total = rows.reduce((acc, row) => acc + ((row[chave] || []).some((f) => f.codigo === r.codigo) ? 1 : 0), 0)
      if (r.tipo === 'inconsistencia') porInconsistencia[r.codigo] = total
      else porObservacao[r.codigo] = total
    })
    return {
      total: rows.length,
      ok: rows.filter((r) => r.situacoes.length === 0).length,
      com_inconsistencia: rows.filter((r) => r.situacoes.length > 0).length,
      por_inconsistencia: porInconsistencia,
      por_observacao: porObservacao,
      escopo: { celulares: 47, associacoes: 41, funcionarios: 45, termos_historico_uso: 6 },
    }
  }

  function applyList(p) {
    const limit = Math.min(500, Math.max(1, Number(p.get('limit') || 20)))
    const page = Math.max(1, Number(p.get('page') || 1))
    let rows = DB.slice()
    const search = (p.get('search') || '').trim().toLowerCase()
    if (search) {
      rows = rows.filter((r) => [r.codigo, r.numero, r.gmail, r.email_corporativo, r.funcionario, r.funcionario_email]
        .some((v) => String(v || '').toLowerCase().includes(search)))
    }
    if (p.get('status_funcionario') === 'ativos') rows = rows.filter((r) => r.funcionario_ativo === 1)
    if (p.get('status_funcionario') === 'inativos') rows = rows.filter((r) => r.funcionario_ativo === 0)
    if (p.get('status_celular')) rows = rows.filter((r) => r.celular_status === p.get('status_celular'))
    if (p.get('associacao') === 'atual') rows = rows.filter((r) => r.associacao === 'Atual')
    if (p.get('associacao') === 'historica') rows = rows.filter((r) => r.associacao === 'Histórica')
    if (p.get('associacao') === 'sem_associacao') rows = rows.filter((r) => r.associacao === null)
    if (p.get('situacao') === 'ok') rows = rows.filter((r) => r.situacoes.length === 0)
    if (p.get('situacao') === 'inconsistencia') rows = rows.filter((r) => r.situacoes.length > 0)
    if (p.get('situacao_codigo')) {
      const codigo = p.get('situacao_codigo')
      rows = rows.filter((r) => [...r.situacoes, ...r.observacoes].some((f) => f.codigo === codigo))
    }
    const sort = p.get('sort')
    const dir = (p.get('dir') || 'asc').toLowerCase() === 'desc' ? -1 : 1
    if (sort && SORTABLE[sort]) {
      const key = SORTABLE[sort]
      rows.sort((a, b) => {
        const av = key === 'situacoes' ? a.situacoes.length : a[key]
        const bv = key === 'situacoes' ? b.situacoes.length : b[key]
        const an = av === null || av === undefined || av === ''
        const bn = bv === null || bv === undefined || bv === ''
        if (an && bn) return b.celular_id - a.celular_id
        if (an) return -1 // NULLs primeiro em ASC (MySQL)
        if (bn) return 1
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base', numeric: true })
        return cmp !== 0 ? cmp * dir : b.celular_id - a.celular_id
      })
    } else {
      rows.sort((a, b) => b.situacoes.length - a.situacoes.length || b.celular_id - a.celular_id)
    }
    const total = rows.length
    const todos = p.get('todos') === '1'
    return {
      resumo: resumoDe(rows),
      regras: REGRAS,
      opcoes: { status_celular: ['Em Estoque', 'Em Uso'] },
      fontes: {
        numero: 'celulares.numero (número/chip do aparelho)',
        gmail: 'celulares.gmail',
        email_corporativo: 'celulares.email_corporativo',
      },
      limitacoes: [
        'Número/Gmail/e-mail são atributos do aparelho (sem versionamento por período).',
        'historico_uso guarda apenas os termos de entrega/devolução.',
        'Consulta somente leitura.',
      ],
      somente_leitura: true,
      items: todos ? rows : rows.slice((page - 1) * limit, (page - 1) * limit + limit),
      total,
      page: todos ? 1 : page,
      limit: todos ? total : limit,
      total_pages: todos ? 1 : Math.max(1, Math.ceil(total / limit)),
    }
  }

  ]
