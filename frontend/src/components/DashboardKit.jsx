import { useEffect, useRef, useState } from 'react'

/* Rodapé de auditoria do dashboard */
export const TERMINAL = 'FORTLUZ-TI-01'
export const MODULE_TITLE = 'Inventário FortLuz ERP'

/* Módulos do sistema — espelha a sidebar de ux/dashboard_geral_de_ativos/code.html */
/* Dashboard Geral é standalone (fora dos grupos recolhíveis) */
export const DASHBOARD_MODULE = { id: 'dashboard', label: 'Dashboard Geral', icon: 'dashboard' }

export const MODULES = [
  { group: '2. Equipamentos & TI', items: [
    { id: 'estacoes', label: 'Estações de Trabalho', icon: 'computer' },
    { id: 'monitores', label: 'Monitores', icon: 'desktop_windows' },
    { id: 'impressoras', label: 'Impressoras', icon: 'print' },
    { id: 'celulares', label: 'Celulares Corporativos', icon: 'smartphone' },
    { id: 'nobreaks', label: 'Nobreaks', icon: 'battery_charging_full' },
    { id: 'diversos', label: 'Ativos Diversos', icon: 'devices_other' },
    { id: 'softwares', label: 'Softwares', icon: 'terminal' },
    { id: 'servicos', label: 'Serviços Online', icon: 'cloud_done' },
  ]},
  { group: '3. Estoque & Insumos', items: [
    { id: 'toners', label: 'Toners em Estoque', icon: 'inventory_2' },
    { id: 'recebimento', label: 'Recebimento de Toners', icon: 'move_to_inbox' },
    { id: 'historico', label: 'Histórico de Trocas', icon: 'history' },
  ]},
  { group: '4. Manutenção & Suporte', items: [
    { id: 'manutencoes', label: 'Ordens & Manutenções', icon: 'build' },
    { id: 'orcamentos', label: 'Orçamentos', icon: 'request_quote' },
    { id: 'chamados', label: 'Chamados TI', icon: 'support_agent' },
  ]},
  { group: '5. Cadastros Básicos', items: [
    { id: 'empresas', label: 'Empresas', icon: 'corporate_fare' },
    { id: 'setores', label: 'Setores', icon: 'schema' },
    { id: 'funcionarios', label: 'Funcionários', icon: 'badge' },
    { id: 'fornecedores', label: 'Fornecedores', icon: 'local_shipping' },
  ]},
  { group: '6. Etiquetas & Patrimônio', items: [
    { id: 'qrcodes', label: 'Gerar QR / Etiquetas', icon: 'qr_code_2' },
    { id: 'impressoras-etiqueta', label: 'Impressoras de Etiquetas', icon: 'label' },
    { id: 'modelos', label: 'Modelos', icon: 'style' },
  ]},
  { group: '7. Relatórios', items: [
    { id: 'relatorio-estacoes', label: 'Relatório de Estações', icon: 'computer' },
    { id: 'relatorio-monitores', label: 'Relatório de Monitores', icon: 'desktop_windows' },
    { id: 'relatorio-impressoras', label: 'Relatório de Impressoras', icon: 'print' },
    { id: 'ativos-funcionarios', label: 'Ativos x Funcionários', icon: 'assignment_ind' },
  ]},
  { group: '8. Administração', items: [
    { id: 'usuarios', label: 'Usuários & Perfis (RBAC)', icon: 'admin_panel_settings' },
    { id: 'permissoes', label: 'Permissões', icon: 'lock_person' },
    { id: 'configuracoes', label: 'Configurações do Sistema', icon: 'settings' },
    { id: 'banco', label: 'Banco de Dados', icon: 'database' },
  ]},
]

export const NAV_ITEMS = [DASHBOARD_MODULE, ...MODULES.flatMap((g) => g.items)]

/* ---------------- App bar (h-12) ---------------- */
export function AppBar({ user, onLogout, notifCount = 0, searchRef, terminal, empresaLogo }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <header className="appbar">
      <div className="appbar-left">
        {empresaLogo ? (
          <img
            src={empresaLogo}
            alt="Logo da empresa"
            className="appbar-logo-img"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="appbar-logo">FL</div>
        )}
        <span className="appbar-title">{MODULE_TITLE}</span>
        <button className="appbar-icon-btn" title="Recolher Menu Lateral" type="button">
          <span className="mat" style={{ fontSize: 18 }}>menu</span>
        </button>
        <div className="breadcrumb">
          <span className="mat" style={{ fontSize: 14 }}>terminal</span>
          <span>Ativos TI</span>
          <span style={{ color: '#e1bfbb' }}>/</span>
          <span style={{ color: 'var(--on-surface)' }}>Console Central</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="appbar-search">
          <span className="mat">search</span>
          <input ref={searchRef} placeholder="Pesquisar patrimônio, serial, IP..." type="text" />
          <span className="kbd">Ctrl+K</span>
        </div>

        <button className="appbar-icon-btn" title="Notificações e Alertas do Sistema" type="button">
          <span className="mat" style={{ fontSize: 18 }}>notifications</span>
          {notifCount > 0 && <span className="badge-count">{notifCount}</span>}
        </button>

        <div className="appbar-user" ref={wrapRef}>
          <div className="who">
            <div className="name">
              <span style={{ width: 6, height: 6, borderRadius: 2, background: '#005852', display: 'inline-block' }} />
              {user?.usuario || 'operador'}
            </div>
            <div className="term">Terminal 01 - {terminal || 'Almoxarifado'}</div>
          </div>
          <div className="avatar">
            <span className="mat" style={{ fontSize: 18 }}>person</span>
          </div>
          <button
            className="appbar-icon-btn"
            title="Menu do Usuário"
            type="button"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="mat">expand_more</span>
          </button>

          {open && (
            <div className="user-menu">
              <div className="head">Sessão ativa</div>
              <div style={{ padding: '4px 8px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="avatar" style={{ width: 28, height: 28 }}>
                  <span className="mat" style={{ fontSize: 16 }}>person</span>
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.usuario || 'operador'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Perfil: Administrador TI</div>
                </div>
              </div>
              <div className="sep" />
              <button className="item" type="button">
                <span className="mat" style={{ fontSize: 16 }}>account_circle</span>
                Meu perfil
              </button>
              <button className="item" type="button">
                <span className="mat" style={{ fontSize: 16 }}>vpn_key</span>
                Alterar senha
              </button>
              <button className="item" type="button">
                <span className="mat" style={{ fontSize: 16 }}>settings</span>
                Preferências
              </button>
              <div className="sep" />
              <button className="item danger" type="button" onClick={onLogout}>
                <span className="mat" style={{ fontSize: 16 }}>logout</span>
                Sair do sistema
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/* ---------------- Sub-toolbar (h-9) ---------------- */
export function SubBar({ total, onRefresh, onNovoAtivo }) {
  return (
    <div className="subbar">
      <div className="subbar-left">
        <button className="mini" type="button" onClick={onRefresh}>
          <span className="mat" style={{ color: '#005852' }}>refresh</span>
          <span>Atualizar</span>
          <span className="hint">(F5)</span>
        </button>
        <button className="mini primary" type="button" onClick={onNovoAtivo}>
          <span className="mat">add_box</span>
          <span>Novo Ativo</span>
          <span className="hint" style={{ color: '#ffb4ac' }}>(Ctrl+N)</span>
        </button>
        <button className="mini" type="button">
          <span className="mat">travel_explore</span>
          <span>Busca Global</span>
          <span className="hint">(Ctrl+K)</span>
        </button>
        <button className="mini" type="button">
          <span className="mat">download</span>
          <span>Exportar</span>
        </button>
      </div>
      <div className="subbar-right">
        <span className="info">
          <span className="mat" style={{ color: '#904d00' }}>dns</span>
          {total} Ativos Conectados
        </span>
        <span className="info">
          <span className="mat" style={{ color: '#005852' }}>verified_user</span>
          Licença Corporativa Ativa
        </span>
      </div>
    </div>
  )
}

/* ---------------- Sidebar de módulos ---------------- */
export function ModulesSidebar({ active, onSelect }) {
  const [openGroups, setOpenGroups] = useState({})

  const toggleGroup = (group) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const isActiveItem = (id) => active === id

  return (
    <aside className="modules">
      <div className="modules-head">Módulos do Sistema</div>
      <nav style={{ padding: '4px 0' }}>
        <button
          type="button"
          className={`module-item ${isActiveItem(DASHBOARD_MODULE.id) ? 'active' : ''}`}
          onClick={() => onSelect(DASHBOARD_MODULE.id)}
        >
          <span className="mat">{DASHBOARD_MODULE.icon}</span>
          {DASHBOARD_MODULE.label}
        </button>

        {MODULES.map((g) => {
          const isOpen = openGroups[g.group] === true
          const isReports = g.group === '7. Relatórios'
          return (
            <div key={g.group} className={`modules-group-wrap ${isReports ? 'reports-wrap' : ''}`}>
              <button
                type="button"
                className={`modules-group ${isReports ? 'reports-group' : ''} ${isOpen ? 'open' : ''}`}
                onClick={() => toggleGroup(g.group)}
                aria-expanded={isOpen}
              >
                <span className="group-label">{g.group}</span>
                <span className="mat group-chevron" aria-hidden="true">
                  {isOpen ? 'expand_more' : 'chevron_right'}
                </span>
              </button>
              <div className="modules-group-items" hidden={!isOpen}>
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className={`module-item ${isActiveItem(it.id) ? 'active' : ''}`}
                    onClick={() => onSelect(it.id)}
                  >
                    <span className="mat">{it.icon}</span>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

/* ---------------- Ações rápidas + período ---------------- */
export function QuickBar({ period, onPeriod, onRefresh }) {
  return (
    <div className="quickbar">
      <div className="quickbar-left">
        <span className="lbl">Ações Rápidas:</span>
        <button className="qb primary" type="button">
          <span className="mat">add</span>
          <span>Ativo Diverso</span>
        </button>
        <button className="qb" type="button">
          <span className="mat" style={{ color: 'var(--primary)' }}>build</span>
          <span>Nova Manutenção</span>
        </button>
        <button className="qb" type="button">
          <span className="mat" style={{ color: '#904d00' }}>support_agent</span>
          <span>Novo Chamado</span>
        </button>
        <button className="qb" type="button">
          <span className="mat" style={{ color: '#003f3a' }}>local_shipping</span>
          <span>Novo Fornecedor</span>
        </button>
        <button className="qb outline" type="button">
          <span className="mat">summarize</span>
          <span>Gerar Relatório Geral</span>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="period-switch">
          {['Hoje', 'Esta Semana', 'Este Mês'].map((p) => (
            <button
              key={p}
              type="button"
              className={period === p ? 'active' : ''}
              onClick={() => onPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button className="qb" type="button" title="Atualizar Base de Dados" onClick={onRefresh}>
          <span className="mat" style={{ color: '#005852', fontSize: 13 }}>sync</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>F5 Atualizar</span>
        </button>
      </div>
    </div>
  )
}

/* ---------------- Stat card ---------------- */
export function StatCard({ name, icon, value, unit, tag, tagBg, tagFg, footL, footR, watermark, accent }) {
  return (
    <div className="stat-card">
      {watermark && (
        <div className="watermark">
          <span className="mat">{watermark}</span>
        </div>
      )}
      <div className="head">
        <span className="name" style={accent ? { color: accent } : undefined}>
          <span className="dot" style={{ background: accent || 'var(--primary)' }} />
          {name}
        </span>
        <span className="mat" style={accent ? { color: accent } : undefined}>{icon}</span>
      </div>
      <div className="values">
        <span className="big" style={accent ? { color: accent } : undefined}>{value}</span>
        {tag && <span className="tag" style={{ background: tagBg, color: tagFg }}>{tag}</span>}
      </div>
      <div className="foot">
        <span>{footL}</span>
        <span className="v">{footR}</span>
      </div>
    </div>
  )
}

/* ---------------- Central de alertas ---------------- */
const ALERT_STYLE = {
  red:    { cls: 'alert-red',    icon: 'warning' },
  amber:  { cls: 'alert-amber',  icon: 'schedule' },
  teal:   { cls: 'alert-teal',   icon: 'link_off' },
  orange: { cls: 'alert-orange', icon: 'crisis_alert' },
}

export function AlertCard({ tone = 'amber', kind, pill, title, desc, footL, action }) {
  const s = ALERT_STYLE[tone] || ALERT_STYLE.amber
  return (
    <div className={`alert-card ${s.cls}`}>
      <div>
        <div className="top">
          <span className="kind">
            <span className="mat">{s.icon}</span>
            {kind}
          </span>
          {pill && <span className="pill">{pill}</span>}
        </div>
        <p className="title">{title}</p>
        <p className="desc">{desc}</p>
      </div>
      <div className="foot">
        <span className="who">{footL}</span>
        {action && <button type="button">{action}</button>}
      </div>
    </div>
  )
}

/* ---------------- Distribuição por categoria ---------------- */
export function DistributionPanel({ rows, total }) {
  return (
    <div className="panel col-7">
      <div>
        <div className="panel-head">
          <div className="t">
            <span className="mat" style={{ color: 'var(--primary)' }}>pie_chart</span>
            <h3>Distribuição por Categoria de Hardware</h3>
          </div>
          <span className="s">{total} Itens Mapeados</span>
        </div>

        <div className="seg-bar">
          {rows.map((r) => (
            <div
              key={r.label}
              style={{ width: `${r.pct}%`, background: r.color }}
              title={`${r.label}: ${r.value} (${r.pct.toFixed(1)}%)`}
            />
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div className="metric-row" key={r.label}>
              <div className="nm">
                <span className="sq" style={{ background: r.color }} />
                <span>{r.label}</span>
              </div>
              <div className="track">
                <div style={{ width: `${r.pct}%`, background: r.color }} />
              </div>
              <div className="nums">
                <span className="u">{r.value} un</span>
                <span className="p">{r.pct.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-foot">
        <span className="grp">
          <span className="mat" style={{ fontSize: 13, color: '#005852' }}>verified</span>
          Contagem obtida da API REST v2 — dashboard_kpis
        </span>
        <button className="link-btn" type="button">Ver Todos os Tipos →</button>
      </div>
    </div>
  )
}

/* ---------------- Status operacional (donut) ---------------- */
export function StatusDonutPanel({ total, segments, footerL, footerR }) {
  let offset = 0
  return (
    <div className="panel col-5">
      <div>
        <div className="panel-head">
          <div className="t">
            <span className="mat" style={{ color: '#005852' }}>donut_large</span>
            <h3>Status Operacional dos Ativos</h3>
          </div>
          <span className="s" style={{ background: 'var(--surface-container)', padding: '1px 6px', borderRadius: 3, color: 'var(--on-surface)' }}>
            {total} Total
          </span>
        </div>

        <div className="donut-wrap">
          <div className="donut">
            <svg viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="#e6eeff" strokeWidth="4.5"
              />
              {segments.filter((s) => s.ring !== false).map((s) => {
                const dash = `${s.pct}, 100`
                const off = -offset
                offset += s.pct
                return (
                  <path
                    key={s.label}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={s.color} strokeWidth="4.5"
                    strokeDasharray={dash} strokeDashoffset={off}
                  />
                )
              })}
            </svg>
            <div className="center">
              <span className="v">{segments[0] ? `${segments[0].pct.toFixed(1)}%` : '—'}</span>
              <span className="l">Em Produção</span>
            </div>
          </div>

          <div className="legend">
            {segments.map((s) => (
              <div className="row" key={s.label}>
                <div className="l">
                  <span className="dot" style={{ background: s.color }} />
                  <span>{s.label}</span>
                </div>
                <span className="v" style={{ color: s.color }}>
                  {s.value} ({s.pct.toFixed(2)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-foot">
        <span>{footerL}</span>
        <button className="link-btn" type="button">{footerR}</button>
      </div>
    </div>
  )
}

/* ---------------- DataGrid de atividades ---------------- */
export function ActivityPanel({ rows, loading, error, filter, onFilter }) {
  const [page, setPage] = useState(1)
  const perPage = 10
  const filtered = rows.filter((r) =>
    !filter ||
    `${r.id} ${r.acao} ${r.ativo} ${r.descricao} ${r.responsavel} ${r.status}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  )
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="gridbar">
        <div className="t">
          <span className="mat">browse_activity</span>
          <h3>Painel de Atividades Recentes em Tempo Real</h3>
          <span className="live" title="Stream Ativo" />
        </div>
        <div className="tools">
          <div className="filter">
            <span className="mat">filter_list</span>
            <input
              placeholder="Filtrar eventos..."
              value={filter}
              onChange={(e) => { onFilter(e.target.value); setPage(1) }}
            />
          </div>
          <button className="csv" type="button">
            <span className="mat">file_download</span>
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 96 }}>Data/Hora</th>
              <th style={{ width: 144 }}>Ação Operacional</th>
              <th style={{ width: 192 }}>Equipamento / Ativo</th>
              <th>Descrição Detalhada do Registro</th>
              <th style={{ width: 144 }}>Responsável</th>
              <th style={{ width: 64, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando registros da API…</td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--crit-fg)' }}>Falha ao carregar: {error}</td></tr>
            )}
            {!loading && !error && slice.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum evento encontrado.</td></tr>
            )}
            {!loading && !error && slice.map((r) => (
              <tr key={r.key}>
                <td className="time">
                  <span className="v">{r.hora}</span>
                  <span className="d">{r.dia}</span>
                </td>
                <td>
                  <span className={`act ${r.tone}`}>
                    <span className="mat">{r.icon}</span>
                    {r.acao}
                  </span>
                </td>
                <td>
                  <div className="eq">
                    <span className="id">{r.ativo}</span>
                    <span className="md">({r.modelo})</span>
                  </div>
                </td>
                <td className="desc">{r.descricao}</td>
                <td className="user"><span>{r.responsavel}</span></td>
                <td className="st">
                  <span className="dot" style={{ background: r.dot }} title={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            Mostrando <strong className="v">{slice.length}</strong> de <strong className="v">{filtered.length}</strong> registros
          </span>
        </div>
        <div className="pgs">
          <button type="button" disabled={cur === 1} onClick={() => setPage(1)}>Primeiro</button>
          <button type="button" disabled={cur === 1} onClick={() => setPage(cur - 1)}>Anterior</button>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              className={p === cur ? 'cur' : ''}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          <button type="button" disabled={cur === pages} onClick={() => setPage(cur + 1)}>Próximo</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Atalhos do módulo ---------------- */
const SHORTCUTS = [
  { id: 'estacoes', label: 'Estações de Trabalho', icon: 'computer' },
  { id: 'toners', label: 'Estoque de Toners', icon: 'inventory_2' },
  { id: 'manutencoes', label: 'Ordens de Manutenção', icon: 'build' },
  { id: 'qrcodes', label: 'Impressão de Etiquetas', icon: 'qr_code_2' },
  { id: 'ativos-funcionarios', label: 'Termos e Cautelas', icon: 'assignment_ind' },
]

export function ShortcutsBar({ onNavigate, checksum }) {
  return (
    <div className="shortcuts">
      <div className="grp">
        <span className="lbl">Atalhos do Módulo:</span>
        {SHORTCUTS.map((s) => (
          <a
            key={s.id}
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate(s.id) }}
          >
            <span className="mat">{s.icon}</span>
            <span>{s.label}</span>
          </a>
        ))}
      </div>
      <div className="meta">
        <span>Checksum: <strong>{checksum}</strong></span>
        <span>Terminal: <strong>{TERMINAL}</strong></span>
      </div>
    </div>
  )
}

/* ---------------- Barra de status docked ---------------- */
export function DashStatusBar({ latency, db, total, build, user }) {
  return (
    <footer className="dash-statusbar">
      <div className="grp">
        <span className="on">
          <span className="dot" />
          Conectado ao Servidor FortLuz ERP (API REST v2.4)
        </span>
        <span className="sep">|</span>
        <span className="mut">DB: {db}</span>
        <span className="sep">|</span>
        <span className="mut">Latência: {latency}</span>
      </div>
      <div className="grp">
        <span className="mut">Usuário: {user?.usuario || '—'}</span>
        <span className="sep">|</span>
        <span className="mut">Licença: Corporativa TI - {total} Ativos Registrados</span>
        <span className="sep">|</span>
        <span className="mut">Versão: Build {build}</span>
        <span className="sep">|</span>
        <span className="key">CAPS</span>
        <span className="key">NUM</span>
      </div>
    </footer>
  )
}

/* ---------------- Página em construção (módulos ainda não implementados) ---------------- */
export function PlaceholderModule({ label, icon, onBack }) {
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 320 }}>
      <span className="mat" style={{ fontSize: 48, color: 'var(--outline)' }}>{icon}</span>
      <div className="headline-sm">{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 420, lineHeight: 16 }}>
        Módulo mapeado no menu conforme o protótipo, porém ainda não implementado no frontend.
        O endpoint correspondente precisa existir na API <span className="mono">apiphp</span>.
      </div>
      <button className="link-btn" type="button" onClick={onBack}>Voltar ao Dashboard Geral</button>
    </div>
  )
}

