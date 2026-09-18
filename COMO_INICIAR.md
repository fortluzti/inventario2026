# Como iniciar a API e o frontend — ativos2026

## 1. API PHP (`apiphp/`)

A API é PHP puro (PDO nativo, sem dependências externas). O único ponto de entrada
é `apiphp/public/index.php`.

### Pré-requisitos

1. **PHP 8.2+** com a extensão `pdo_mysql` habilitada (verificar: `php -m | findstr pdo_mysql`).
2. **MySQL acessível** — configurado em `apiphp/.env` (DB_HOST, DB_NAME, DB_USER, DB_PASS).
3. **Migration aplicada** (uma vez): cria as tabelas `api_keys` e `audit_log`:
   ```
   mysql -u root -p inventario2 < apiphp/migrations/001_api_keys.sql
   ```
4. **Chave de API** — gerar quando necessário (CLI):
   ```
   php apiphp/scripts/gerar_api_key.php criar "Frontend Web" "*"
   ```
   A chave (`flz_...`) é exibida uma única vez. Enviar em toda requisição via header `X-API-KEY`.

### Iniciar em desenvolvimento (servidor embutido do PHP)

A partir da raiz do repositório:

```powershell
php -S 0.0.0.0:8090 -t ativos2026/apiphp/public
```

Ou, em segundo plano (PowerShell):

```powershell
Start-Process php -ArgumentList '-S','0.0.0.0:8090','-t','ativos2026\apiphp\public' -WindowStyle Hidden
```

A API fica disponível em: **http://localhost:8090/index.php**

### Iniciar em produção (Apache/XAMPP)

1. Apontar um VirtualHost (ou alias) para o diretório `apiphp/public/`
   (o `.htaccess` de lá já bloqueia `.env`/`.sql` e faz rewrite para `index.php`).
2. Garantir `APP_DEBUG=false` no `.env` e HTTPS habilitado.

### Testar se subiu

```powershell
# Health check (sem chave)
curl http://localhost:8090/index.php?endpoint=health

# Resposta esperada:
# {"success":true,"data":{"api":"ativos2026/apiphp","status":"ok","db":"ok"}}
```

### Convenção de endpoints

```
GET/POST  http://localhost:8090/index.php?endpoint=<modulo>&action=<acao>
```

- Módulos CRUD: `impressoras`, `monitores`, `estacoes`, `empresas`, `setores`, `toners`, etc.
  Ações: `listar`, `buscar_por_id`, `salvar`, `excluir`, `proximo_codigo`, `dropdown`.
- Dedicados: `health` (público), `dashboard_kpis`, `dashboard_alertas`,
  `dashboard_atividade`, `qrcode`.
- Requisições autenticadas: header `X-API-KEY: flz_...`.
- Documentação completa: `apiphp/docs/ENDPOINTS.md`.

## 2. Frontend (`ux/`)

A pasta `ux/` contém **os designs das telas** (export do Google Stitch), ainda **não
há um app frontend implementado** — é a fase seguinte do projeto.

### Visualizar os mockups (agora)

Cada pasta de tela tem um `code.html` estático. Basta abrir no navegador, por exemplo:

```powershell
Start-Process "ativos2026\ux\dashboard_geral_de_ativos\code.html"
```

Telas disponíveis: `dashboard_geral_de_ativos`, `equipamentos_listagem_geral`,
`esta_es_de_trabalho_cadastro_e_grid`, `esta_es_de_trabalho_invent_rio_fortluz`,
`esta_es_de_trabalho_listagem`, `esta_es_formul_rio_de_cadastro_e_edi_o_1024x768`,
`impressoras_listagem_invent_rio_fortluz`, `monitores_invent_rio_fortluz`,
`monitores_formul_rio_e_modais_invent_rio_fortluz`.

Design system de referência: `ux/fortluz_enterprise_inventory/DESIGN.md`
(IBM Plex Sans, primária `#991b1b`, estilo WinUI denso: grid compacto 28-32px,
raio 4px, badges de status verde/âmbar/vermelho, barra de status docked).

### Quando o app frontend for criado

Deverá consumir esta API via `X-API-KEY` seguindo `apiphp/docs/ENDPOINTS.md`.
Origens permitidas pelo CORS da API (ver `.env` → `CORS_ORIGINS`):
`https://intranet.fortluz.com.br` e `http://localhost:5173`
(porta padrão de um app Vite — sugerido para o novo frontend).

Exemplo de fluxo completo (API + frontend Vite):

```powershell
# Terminal 1 — API
php -S 0.0.0.0:8090 -t ativos2026/apiphp/public

# Terminal 2 — Frontend (quando existir, ex.: Vite)
cd ativos2026/frontend
npm install
npm run dev    # roda em http://localhost:5173 (já liberado no CORS)
```
