# AGENTS.md — ativos2026 (API + Frontend)

This file contains high-signal guidance for future OpenCode sessions working in the `ativos2026` folder.

## 🚨 Authentication Required (API)
- **All API endpoints require an API Key** via `X-API-KEY` header (except `health`).
- The key must be sent as: `X-API-KEY: flz_...`
- If no key or invalid key → 401 `Acesso nao autorizado`.
- Keys have **scopes** (list of allowed modules or `*` for all) and **rate limits**.
- To add a new scope: create the key via `php scripts/gerar_api_key.php` with the desired module list, or update an existing key's scopes.
- **Never** pass the key as `?api_key=` in the URL (not recommended, only for debugging).

### API Key Management
- **Generate**: `php ativos2026/apiphp/scripts/gerar_api_key.php criar "<nome>" "<modulos_csv>"`
- **Revoke**: `php ativos2026/apiphp/scripts/gerar_api_key.php revogar <id>` (soft-delete: `ativo=0`)
- List keys: `GET ?endpoint=api_keys&action=listar` (requires `api_keys` scope or `*`)
- The generated key is displayed **once only** — store it securely.

## 🗄️ Database & Migrations
- **Database name**: `inventario2` (configured in `apiphp/.env`).
- **PDO connection** via `apiphp/src/Database.php` — DSN from env, `EMULATE_PREPARES=off` (anti-SQL injection).
- **Migration system** in `apiphp/migrations/`:
  - `001_api_keys.sql` — creates `api_keys` and `audit_log` tables (apply once).
  - Run via: `mysql -u root -p inventario2 < apiphp/migrations/001_api_keys.sql`
- **Never** hardcode credentials — use `apiphp/.env` (gitignored, copy from `.env.example`).
- **.env handling**:
  - Copy `apiphp/.env.example` → `apiphp/.env` and adjust.
  - `.env` is **gitignored** — do not commit it.
  - Key vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_CHARSET`, `API_SIGNING_SECRET`, `APP_ENV`, `APP_DEBUG`, `CORS_ORIGINS`, `RATE_LIMIT_PER_MIN`.

## 📦 Module Registry & CRUD Endpoints
- **Modules are registered in** `apiphp/src/modules.php` — this is the source of truth for available endpoints.
- Each module defines: `table`, `fields` (with types/validation), `search`, `filters`, `code_field`, `code_format`, `dropdown` config, and optional `select` for JOINs.
- **CRUD convention**: `GET ?endpoint=<modulo>&action=listar` (with `page`, `limit`, `search`, `filters`).
- **Save**: `POST ?endpoint=<modulo>&action=salvar` — body whitelisted against `modules.php` fields; unknown fields are discarded (anti mass-assignment).
- **Delete**: `POST ?endpoint=<modulo>&action=excluir` with `id`.
- **Next code**: `GET ?endpoint=<modulo>&action=proximo_codigo` (e.g., returns `DIV-005`, `IMP-014`, `MON-027`).
- **Dropdown/listar simples**: `GET ?endpoint=<modulo>&action=dropdown` or `listar_simples`.

### Module-specific notes (from ENDPOINTS.md)
| Module | Key fields | Notes |
|---|---|---|
| `estacoes` | `codigo_interno_estacao` (req), `setor_id` (req), `status` (req) | Filters: `empresa_id`, `funcionario_id`, `setor_id`. `listar` includes joined `empresa_nome`, `setor_nome`, `funcionario_nome`, `monitor_codigo`, `monitor_modelo`. |
| `celulares` | `imei` (req, unique), `marco` (req), `modelo` (req) | `status` ENUM: `Em Estoque`, `Em Uso`, `Danificado`. Includes join with `celulares_funcionarios` for last delivery info. |
| `toner` (singular) | `codigo` (req), `estoque`, `estoque_minimo`, `autonomia` | No `proximo_codigo`. Codes are model prefixes like `TN-3442`. |
| `impressoras` | `modelo_id`, `numero_serie`, `setor_id`, `status` | `proximo_codigo` ✔ (`IMP-014`). Dropdown + busca por código interno/serie. |
| `monitores` | `marca` (req), `modelo` (req), `numero_serie` (req) | `proximo_codigo` ✔ (`MON-027`). Has `portas` field. |

**To add a new module**:
1. Add entry in `apiphp/src/modules.php` with `table`, `fields`, `search`, `filters`, `code_field`, `code_format`.
2. Ensure the table exists in `inventario2` DB (or create migration).
3. Test via: `GET ?endpoint=<modulo>&action=listar` (with API Key).

## 🌐 Frontend (React + Vite)
- **Framework**: React 18 + Vite 5.
- **Entry**: `frontend/src/main.jsx`.
- **Dev server**: `cd frontend && npm run dev` → `http://localhost:5173` (CORS allows `localhost:5173` and `https://intranet.fortluz.com.br`).
- **Build**: `npm run build` → outputs to `frontend/dist/`.
- **Preview**: `npm run preview`.
- **API client hooks** in `frontend/src/api/client.js` — configure base URL and API Key there.
- **Pages** (already implemented):
  - `Dashboard.jsx` / `Dashboard.css` — KPIs and alerts
  - `Setores.jsx` / `Setores.css` — module CRUD
  - `Monitores.jsx` / `Monitores.css`
  - `Impressoras.jsx` / `Impressoras.css`
  - `Funcionarios.jsx` / `Funcionarios.css`
  - `Estacoes.jsx` / `Estacoes.css`
  - `Celulares.jsx` / `Celulares.css` + `CelularesConferencia.jsx`
  - Plus report components, dialogs, and API hooks.

**To add a new page**:
1. Create `<nome>.jsx` and `<nome>.css` in `frontend/src/pages/`.
2. Use `useTableSort.js` / `useCep.js` hooks if needed.
3. Consume the API via `frontend/src/api/*.js` hooks (they add the `X-API-KEY` header automatically if the key is set).
4. Add route in `App.jsx` if needed.
5. Run `npm run dev` to verify.

## 🎨 UX Designs (Google Stitch mockups)
- **Designs are in** `ux/` — these are **static mockups exported from Google Stitch**, NOT yet implemented as React components.
- Each screen has a `code.html` that can be opened in a browser, and `screen.png` preview.
- **Available mockups**: `dashboard_geral_de_ativos`, `equipamentos_listagem_geral`, `esta_es_de_trabalho_cadastro_e_grid`, `esta_es_de_trabalho_invent_rio_fortluz`, `esta_es_de_trabalho_listagem`, `esta_es_formul_rio_de_cadastro_e_edi_o_1024x768`, `impressoras_listagem_invent_rio_fortluz`, `monitores_invent_rio_fortluz`, `monitores_formul_rio_e_modais_invent_rio_fortluz`, `login`.
- **Design system**: `ux/fortluz_enterprise_inventory/DESIGN.md` — IBM Plex Sans, primary `#991b1b`, WinUI style: grid compacto 28-32px, raio 4px, badges verde/âmbar/vermelho, barra de status docked.
- **Frontend task**: When implementing the React app, reference these designs for UI consistency.

## ⚙️ Scripts & Utilities (API side)
| Script | Purpose |
|---|---|
| `apiphp/scripts/gerar_api_key.php` | Create/revoke API keys via CLI |
| `apiphp/scripts/validar_estacoes.php` | SQL-only validation for `estacoes` table (whitelist vs schema) |
| `apiphp/.env.example` → `.env` | Local configuration template |

## ⚠️ Gotchas & Quirks
- **API Key is mandatory** for all endpoints except `health`. Forgetting the header → 401.
- **`toner` table is singular** (`toner`, not `toners`) — reflected in `modules.php` and ENDPOINTS.md.
- **`acessorios` module removed** — table doesn't exist in `inventario2`. Handler legacy remains in `api/` root but is not available in `apiphp`.
- **`funcionarios.senha_gmail`** is intentionally **outside the whitelist** (sensitive data) — will be discarded if sent in `salvar`.
- **SQL mode**: All queries use prepared statements (`EMULATE_PREPARES=off`). Never concatenate user input into SQL.
- **Rate limit** per key (default 120/min) with 429 + `Retry-After` response.
- **CORS** is allowlist-only (`apiphp/.env` → `CORS_ORIGINS`). Local dev: `http://localhost:5173` is already included.
- **Código formatado**: modules use patterned codes (`DIV-%03d`, `EST-%03d`, `IMP-%03d`, `MON-%03d`, `NB-%03d`, `CEL-%03d`). `proximo_codigo` returns the next value; does NOT reserve it.
- **No composer dependencies** in `apiphp/` — PDO only, zero external libs (except `endroid/qr-code` planned for QR generation).
- **Auditoría**: Toda chamada autenticada grava em `audit_log` (chave, endpoint, IP, UA, ação).
- **Health check** (`?endpoint=health`) **does NOT require API key** and does not connect to the DB fully (just `SELECT 1` ping).

## 🛠️ Common Development Operations
| Goal | Command |
|---|---|
| Start API server (PHP built-in) | `php -S 0.0.0.0:8090 -t ativos2026/apiphp/public` |
| Start frontend dev server | `cd ativos2026/frontend && npm run dev` (port 5173) |
| Run both (recommended) | Terminal 1: API; Terminal 2: Frontend `npm run dev` |
| Apply initial migration | `mysql -u root -p inventario2 < ativos2026/apiphp/migrations/001_api_keys.sql` |
| Generate first API key | `php ativos2026/apiphp/scripts/gerar_api_key.php criar "Frontend Web" "*"` |
| List available modules | `GET ?endpoint=health` (returns api status) or `GET ?endpoint=api_keys&action=listar` (with key) |
| Validate estacoes schema | `php ativos2026/apiphp/scripts/validar_estacoes.php` |
| Build frontend | `cd ativos2026/frontend && npm run build` |
| Run frontend smoke test | `cd ativos2026/frontend && npm run smoke` |

## 📚 Referenced Sources (Trust these over memory)
- `apiphp/src/modules.php` — module registry and field whitelist.
- `apiphp/src/Database.php` — PDO singleton, DSN from env.
- `apiphp/src/Config.php` — env loading, validation.
- `apiphp/src/ApiKeyAuth.php` — authentication + authorization by scope.
- `apiphp/public/index.php` — front controller entrypoint.
- `apiphp/docs/ENDPOINTS.md` — complete endpoint catalog (modules, params, codes, dedicate endpoints).
- `apiphp/.env.example` → `.env` — local configuration (never commit).
- `frontend/src/main.jsx` — React entry point.
- `frontend/src/api/client.js` — API client with base URL + key handling.
- `COMO_INICIAR.md` — step-by-step local setup instructions.
- `README.md` — high-level repo overview.
- `ux/fortluz_enterprise_inventory/DESIGN.md` — design system reference for frontend implementation.