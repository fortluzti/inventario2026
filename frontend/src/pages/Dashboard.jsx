import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Estacoes from './Estacoes.jsx'
import Monitores from './Monitores.jsx'
import Impressoras from './Impressoras.jsx'
import Setores from './Setores.jsx'
import Configuracoes from './Configuracoes.jsx'
import Funcionarios from './Funcionarios.jsx'
import EstacoesReport from '../components/EstacoesReport.jsx'
import MonitoresReport from '../components/MonitoresReport.jsx'
import ImpressaoReport from '../components/ImpressaoReport.jsx'
import { ReportShowcase } from '../components/report/ReportShowcase.jsx'
import { api } from '../api/client.js'
import { carregarEmpresa, hasLogo, logoUrl } from '../api/configuracoes.js'
import {
  AppBar, SubBar, ModulesSidebar, QuickBar, StatCard, AlertCard,
  DistributionPanel, StatusDonutPanel, ActivityPanel, ShortcutsBar,
  DashStatusBar, PlaceholderModule, NAV_ITEMS, DASHBOARD_MODULE,
} from '../components/DashboardKit.jsx'

const BUILD = '2026.1.0-web'
const DB_LABEL = 'inventario2'

/* Cores do tema (espelham o tailwind-config do protótipo) */
const C = {
  primary: '#991b1b',
  secondary: '#904d00',
  tertiary: '#005852',
  tint: '#b02d29',
  inverse: '#233144',
  error: '#ba1a1a',
}

export default function Dashboard({ user, onLogout, searchRef }) {
  const [kpis, setKpis] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [atividade, setAtividade] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [latency, setLatency] = useState('—')
  const [period, setPeriod] = useState('Hoje')
  const [module, setModule] = useState('dashboard')
  const [empresaLogo, setEmpresaLogo] = useState('')
  const [estacoesRefresh, setEstacoesRefresh] = useState(0)
  const [estacoesNew, setEstacoesNew] = useState(0)
  const [monitoresRefresh, setMonitoresRefresh] = useState(0)
  const [monitoresNew, setMonitoresNew] = useState(0)
  const [impressorasRefresh, setImpressorasRefresh] = useState(0)
  const [impressorasNew, setImpressorasNew] = useState(0)
  const [funcionariosRefresh, setFuncionariosRefresh] = useState(0)
  const [funcionariosNew, setFuncionariosNew] = useState(0)
  const [reportEmpresa, setReportEmpresa] = useState(null)
  const [filter, setFilter] = useState('')
  const localSearch = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    try {
      const [k, a, at] = await Promise.all([
        api('dashboard_kpis', 'listar'),
        api('dashboard_alertas', 'listar'),
        api('dashboard_atividade', 'listar'),
      ])
      setLatency(`${Math.round(performance.now() - t0)}ms`)
      setKpis(k)
      setAlertas(Array.isArray(a) ? a : [])
      setAtividade(Array.isArray(at) ? at : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }

    try {
      const empresa = await carregarEmpresa()
      setEmpresaLogo(hasLogo(empresa) ? logoUrl(empresa.empresa_logo) : '')
    } catch {
      setEmpresaLogo('')
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (isReportModule) {
      carregarEmpresa().then(setReportEmpresa).catch(() => setReportEmpresa(null))
    }
  }, [module])

  /* Atalhos de teclado do protótipo (F5, Ctrl+K, Ctrl+N) */
  useEffect(() => {
    function onKey(e) {
      if (document.querySelector('.est-dialog') || document.querySelector('.mon-dialog') || document.querySelector('.cfg-dialog') || document.querySelector('.imp-overlay') || document.querySelector('.set-overlay')) return
        if (e.key === 'F5') {
          e.preventDefault()
          if (module === 'estacoes') setEstacoesRefresh((v) => v + 1)
          else if (module === 'monitores') setMonitoresRefresh((v) => v + 1)
          else if (module === 'impressoras') setImpressorasRefresh((v) => v + 1)
          else load()
        }
        if (module === 'estacoes' || module === 'monitores' || module === 'impressoras' || module === 'setores' || module === 'funcionarios') return
        if (isReportModule) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const el = searchRef?.current || localSearch.current
        if (el) el.focus()
      }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
          e.preventDefault()
          if (module === 'estacoes') setEstacoesNew((v) => v + 1)
          else if (module === 'monitores') setMonitoresNew((v) => v + 1)
          else if (module === 'impressoras') setImpressorasNew((v) => v + 1)
          else if (module === 'funcionarios') setFuncionariosNew((v) => v + 1)
          else if (module !== 'configuracoes') setModule('setores')
        }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [load, searchRef, module])

  /* ---- Dados derivados para os widgets ---- */
  const d = useMemo(() => {
    const k = kpis || {}
    const total = (k.total_estacoes || 0) + (k.total_monitores || 0) + (k.total_impressoras || 0)
      + (k.total_nobreaks || 0) + (k.total_celulares || 0)
    const manut = k.manutencoes_abertas || 0
    const pct = (v) => (total > 0 ? (v * 100) / total : 0)

    const categories = [
      { label: 'Monitores Corporativos', value: k.total_monitores || 0, color: C.primary },
      { label: 'Estações (Desktop/Note)', value: k.total_estacoes || 0, color: C.secondary },
      { label: 'Smartphones Corporativos', value: k.total_celulares || 0, color: C.tertiary },
      { label: 'Impressoras / Multifuncionais', value: k.total_impressoras || 0, color: C.tint },
      { label: 'Nobreaks & Estabilizadores', value: k.total_nobreaks || 0, color: C.inverse },
    ].map((c) => ({ ...c, pct: pct(c.value) }))

    const emUso = Math.max(total - manut, 0)
    const segments = [
      { label: 'Em Uso Ativo', value: emUso, color: C.tertiary, pct: pct(emUso), ring: true },
      { label: 'Em Manutenção', value: manut, color: C.secondary, pct: pct(manut), ring: true },
      { label: 'Toners em Estoque', value: k.toners_estoque || 0, color: C.tint, pct: pct(k.toners_estoque || 0), ring: false },
    ]

    const tonersCriticos = alertas.filter((a) => a.tipo === 'toner_baixo').length

    const cards = [
      {
        name: 'Total Equipamentos', icon: 'devices', watermark: 'devices',
        accent: C.primary, value: total,
        tag: 'Base 2026', tagBg: 'rgba(156,242,232,0.3)', tagFg: C.tertiary,
        footL: 'Base Total Cadastrada', footR: '100%',
      },
      {
        name: 'Estações de Trabalho', icon: 'verified',
        accent: C.tertiary, value: k.total_estacoes ?? '—',
        tag: `${pct(k.total_estacoes || 0).toFixed(1)}%`,
        tagBg: 'rgba(156,242,232,0.4)', tagFg: '#00504a',
        footL: 'Desktop / Notebook', footR: `${k.total_funcionarios ?? 0} func.`,
      },
      {
        name: 'Monitores / Impressoras', icon: 'desktop_windows',
        accent: C.tint, value: (k.total_monitores || 0) + (k.total_impressoras || 0),
        tag: `${pct((k.total_monitores || 0) + (k.total_impressoras || 0)).toFixed(1)}%`,
        tagBg: 'rgba(255,180,172,0.35)', tagFg: C.primary,
        footL: 'Periféricos de TI', footR: `${k.total_monitores ?? 0} mon.`,
      },
      {
        name: 'Manut. / Estoque', icon: 'swap_horiz',
        accent: C.secondary, value: manut,
        tag: `${manut} O.S.`,
        tagBg: 'rgba(255,220,195,0.5)', tagFg: '#2f1500',
        footL: 'Ordens em aberto', footR: `${k.total_nobreaks ?? 0} nobreaks`,
      },
      {
        name: 'Toners Almoxarifado', icon: 'print',
        accent: C.error, value: k.toners_estoque ?? 0,
        tag: `${tonersCriticos} Críticos`,
        tagBg: '#ffdad6', tagFg: '#93000a',
        footL: 'Itens em estoque', footR: `${k.total_celulares ?? 0} celulares`,
      },
    ]

    const alertCards = alertas.slice(0, 4).map((a, i) => {
      const toner = a.tipo === 'toner_baixo'
      const m = /'([^']+)'\s*\((\d+)\/(\d+)\)/.exec(a.mensagem || '')
      return toner
        ? {
            id: `al-${i}`, tone: 'red', kind: 'Estoque Crítico',
            pill: m ? `${m[2]} un` : '—',
            title: m ? `Toner ${m[1]}` : 'Toner abaixo do mínimo',
            desc: m
              ? `Nível abaixo da reserva técnica mínima (Mínimo: ${m[3]}). Reposição necessária no almoxarifado.`
              : a.mensagem,
            footL: 'Almoxarifado TI', action: 'Solicitar Compra',
          }
        : {
            id: `al-${i}`, tone: 'amber', kind: 'Tempo em Manutenção',
            pill: 'Aberto',
            title: a.mensagem,
            desc: 'Equipamentos aguardando intervenção técnica. Consulte as ordens de serviço vinculadas.',
            footL: 'Bancada TI', action: 'Ver O.S.',
          }
    })

    const atividadeRows = atividade.map((m) => {
      const raw = m.data_cadastro || m.data_inicio || ''
      const dt = raw ? new Date(String(raw).replace(' ', 'T')) : null
      const ok = dt && !Number.isNaN(dt.getTime())
      const st = String(m.status || '')
      const pendente = !/conclu/i.test(st) && !/cancel/i.test(st)
      return {
        key: `m-${m.id}`,
        id: m.id,
        hora: ok ? dt.toLocaleTimeString('pt-BR', { hour12: false }) : '--:--:--',
        dia: ok ? dt.toLocaleDateString('pt-BR') : '—',
        acao: pendente ? 'Manutenção' : 'O.S. Concluída',
        icon: pendente ? 'build' : 'autorenew',
        tone: pendente ? '' : 'green',
        ativo: `O.S. #${m.id}`,
        modelo: m.aprovacao_status || 'em aberto',
        descricao: m.problema_relatado || 'Sem descrição registrada.',
        responsavel: 'admin.ti',
        status: st || '—',
        dot: pendente ? C.secondary : C.tertiary,
      }
    })

    const seed = `${total}${atividade.length}${manut}${k.toners_estoque || 0}`
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    const checksum = h.toString(16).padStart(8, '0').replace(/(.{4})(.{4})/, '$1-$2')

    return { total, manut, categories, segments, cards, alertCards, atividadeRows, checksum, tonersCriticos, alertTotal: alertas.length }
  }, [kpis, alertas, atividade])

  const activeModule = NAV_ITEMS.find((m) => m.id === module) || NAV_ITEMS[0]
  const showDashboard = module === 'dashboard'
  const isReportModule = module.startsWith('relatorio-')

  return (
    <div className="app">
      <AppBar
        user={user}
        onLogout={onLogout}
        notifCount={d.alertTotal}
        searchRef={searchRef || localSearch}
        empresaLogo={empresaLogo}
      />
      <SubBar total={d.total}
        onRefresh={() => {
          if (module === 'estacoes') setEstacoesRefresh((v) => v + 1)
          else if (module === 'monitores') setMonitoresRefresh((v) => v + 1)
          else if (module === 'impressoras') setImpressorasRefresh((v) => v + 1)
          else load()
        }}
        onNovoAtivo={() => {
          if (module === 'estacoes') setEstacoesNew((v) => v + 1)
          else if (module === 'monitores') setMonitoresNew((v) => v + 1)
          else if (module === 'impressoras') setImpressorasNew((v) => v + 1)
          else if (module === 'funcionarios') setFuncionariosNew((v) => v + 1)
          else setModule('setores')
        }}
      />

      <div className="app-main">
        <ModulesSidebar active={module} onSelect={setModule} />

        <main className="dash-main">
          <div className="dash-scroll">
            {module === 'estacoes' && <Estacoes refreshKey={estacoesRefresh} newRequest={estacoesNew} onChanged={load} />}
            {module === 'monitores' && <Monitores refreshKey={monitoresRefresh} newRequest={monitoresNew} onChanged={load} />}
            {module === 'impressoras' && <Impressoras refreshKey={impressorasRefresh} newRequest={impressorasNew} onChanged={load} />}
            {module === 'setores' && <Setores refreshKey={estacoesRefresh} newRequest={estacoesNew} onChanged={load} />}
            {module === 'funcionarios' && <Funcionarios refreshKey={estacoesRefresh} newRequest={estacoesNew} onChanged={load} />}
            {module === 'configuracoes' && <Configuracoes />}
            {module === 'relatorio-mestre' && <ReportShowcase empresa={reportEmpresa} onClose={() => setModule('dashboard')} />}
            {module === 'relatorio-estacoes' && <EstacoesReport empresa={reportEmpresa} filters={{}} onClose={() => setModule('dashboard')} />}
            {module === 'relatorio-monitores' && <MonitoresReport empresa={reportEmpresa} filters={{}} onClose={() => setModule('dashboard')} />}
            {module === 'relatorio-impressoras' && <ImpressaoReport empresa={reportEmpresa} filters={{}} onClose={() => setModule('dashboard')} />}
            {!showDashboard && module !== 'estacoes' && module !== 'monitores' && module !== 'impressoras' && module !== 'setores' && module !== 'configuracoes' && !module.startsWith('relatorio-') && (
              <PlaceholderModule
                label={activeModule.label}
                icon={activeModule.icon}
                onBack={() => setModule('dashboard')}
              />
            )}

            {showDashboard && (
              <>
                <QuickBar period={period} onPeriod={setPeriod} onRefresh={load} />

                <div className="stat-row">
                  {d.cards.map((c) => <StatCard key={c.name} {...c} />)}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div className="t">
                      <span className="mat" style={{ color: C.primary }}>notification_important</span>
                      <h2>Central de Alertas &amp; Intervenções Imediatas</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="s">{d.alertTotal} pendências operacionais ativas</span>
                      <button className="link-btn" type="button">Dispensar Resolvidos</button>
                    </div>
                  </div>

                  {d.alertCards.length === 0 ? (
                    <div className="empty" style={{ padding: 16 }}>
                      {loading ? 'Carregando alertas…' : (error ? `Erro na API: ${error}` : 'Nenhum alerta ativo no momento.')}
                    </div>
                  ) : (
                    <div className="alert-grid">
                      {d.alertCards.map((a) => <AlertCard key={a.id} {...a} />)}
                    </div>
                  )}
                </div>

                <div className="bento">
                  <DistributionPanel rows={d.categories} total={d.total} />
                  <StatusDonutPanel
                    total={d.total}
                    segments={d.segments}
                    footerL={`Ordens em manutenção: ${d.manut} — atenção operacional`}
                    footerR="Histórico de Baixas"
                  />
                </div>

                <ActivityPanel
                  rows={d.atividadeRows}
                  loading={loading}
                  error={error}
                  filter={filter}
                  onFilter={setFilter}
                />

                <ShortcutsBar onNavigate={setModule} checksum={d.checksum} />
              </>
            )}
          </div>

          <DashStatusBar
            latency={latency}
            db={DB_LABEL}
            total={d.total}
            build={BUILD}
            user={user}
          />
        </main>
      </div>
    </div>
  )
}