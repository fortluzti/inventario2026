# frontend — App React do Inventário FortLuz (ativos2026)

Vite + React 18. A aparência segue o design system de `../ux/fortluz_enterprise_inventory/DESIGN.md`
(IBM Plex Sans, primária `#991b1b`, densidade WinUI, grid compacto, barra de status docked).

## Como rodar

```powershell
# 1. Subir a API (na raiz do repo)
php -S 0.0.0.0:8090 -t ativos2026/apiphp/public

# 2. Instalar e subir o frontend
cd ativos2026/frontend
npm install
npm run dev        # http://localhost:5173 (já liberado no CORS da API)
```

## Configuração

- Copie `.env.example` para `.env.local` e preencha:
  - `VITE_API_URL` — URL da API (default `http://localhost:8090/index.php`)
  - `VITE_API_KEY` — chave `flz_...` (header `X-API-KEY`).
    Gerar chave: `php apiphp/scripts/gerar_api_key.php criar "Frontend Web" "*"`
- A chave fica **apenas no `.env.local`** (não versionado) — não há interface para digitá-la.
- Alterar o `.env.local` exige reiniciar o dev server (o Vite lê as variáveis no boot).

## Estrutura

```
frontend/
├── index.html                    # fontes IBM Plex Sans + JetBrains Mono + Material Symbols
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # gate de sessão: Login (sem sessão) → Dashboard (logado)
│   ├── index.css                 # tokens do DESIGN.md (cores, densidade 28px, raio 4px)
│   ├── api/client.js             # wrapper fetch com X-API-KEY e envelope success/data
│   ├── components/DashboardKit.jsx  # AppBar, SubBar, Sidebar, QuickBar, StatCard,
│   │                                # AlertCard, painéis, DataGrid, StatusBar, Placeholder
│   └── pages/
│       ├── Login.jsx             # tela principal quando NÃO há sessão (ux/login)
│       └── Dashboard.jsx         # Dashboard Geral (ux/dashboard_geral_de_ativos)
└── .smoke/                       # harness de validação (jsdom + react act)
```

## Telas

| Tela | Mockup | Situação |
|---|---|---|
| Login / recuperação de senha | `ux/login` | ✅ implementada |
| Dashboard Geral | `ux/dashboard_geral_de_ativos` | ✅ implementada (AppBar, sub-toolbar, sidebar de 8 módulos, 5 stat cards, central de alertas, distribuição por categoria, donut de status, DataGrid de atividades, atalhos, statusbar) |
| Estações de Trabalho | Listagem e formulário de estações da UX | ✅ listagem integrada à API, filtros, busca, paginação, impressão da página atual, cadastro, edição, visualização e exclusão confirmada |
| Demais módulos do menu | — | placeholders (menu navegável, aguardando implementação) |

### Estações de Trabalho

Acesse **Equipamentos & TI → Estações de Trabalho → Nova Estação**.
O formulário segue o modal compacto da UX (820 × 580, adaptável à janela), com abas
Identificação, Hardware, Aquisição, Acessórios e Software. `Ctrl+N` abre o cadastro,
`Ctrl+K` foca a busca, `F5` atualiza, `Esc` fecha e `Ctrl+S` salva.

Os dados são persistidos no endpoint `estacoes`; os selects carregam todas as páginas
necessárias de empresas, setores, funcionários, monitores e fornecedores. Erros de API
não são substituídos por dados fictícios. O código é sugerido por `proximo_codigo` e a
API rejeita duplicidades; a sugestão não representa reserva de código concorrente.

**Limitações explícitas:** a API atual não expõe vínculos de software por estação.
A quinta aba informa essa limitação, sem controles fictícios de gravação. Cadastro
rápido de fornecedores e geração de termo/assinatura do protótipo não estão implementados.
A impressão inclui somente a página atual da listagem.

Implementação: `src/pages/Estacoes.jsx`, `src/pages/Estacoes.css`,
`src/components/EstacaoDialog.jsx` e `src/api/estacoes.js`.

**Sessão:** a tela de login é a principal enquanto não houver sessão. No Dashboard, o nome do
usuário na AppBar abre o menu com **Sair do sistema**, que encerra a sessão e retorna ao login.

## Validação

```powershell
npm run build     # build de produção
npm run smoke     # login, dashboard, estações (CRUD simulado, filtros, validação e erros), logout
```

## Próximas telas (mockups em `../ux/`)

- impressoras, monitores, estações, equipamentos (listagens + formulários com modais WinUI)
