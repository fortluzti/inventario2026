# apiphp — API v2 do Sistema de Ativos (PHP)

Recriação da API legado (`api/` na raiz), **obrigatoriamente em PHP**, com os **mesmos
endpoints** e **segurança reforçada por API Key**. Sem dependências externas (PDO nativo).

## Estrutura

```
apiphp/
├── .env.example          Modelo de configuracao (copie para .env)
├── public/
│   ├── index.php         Front controller (unico ponto de entrada)
│   └── .htaccess         Bloqueia .env/.sql/logs; rewrite para index.php
├── src/
│   ├── bootstrap.php     Setup, error handlers (JSON), headers de seguranca
│   ├── Config.php        Leitura do .env (credenciais nunca no codigo)
│   ├── Database.php      PDO singleton (emulate_prepares OFF)
│   ├── Security.php      Headers, CORS allowlist, coleta de input (form/JSON)
│   ├── ApiKeyAuth.php    Autenticacao + autorizacao por escopo
│   ├── RateLimiter.php   Rate limit por chave (janela por minuto)
│   ├── Audit.php         Log de auditoria (tabela audit_log)
│   ├── Validator.php     Whitelist de campos + tipos (anti mass-assignment)
│   ├── Crud.php          Motor generico: listar/dropdown/buscar/salvar/excluir/proximo_codigo
│   ├── modules.php       Registry de modulos (tabela, campos, filtros)
│   └── handlers/         dashboard.php, qrcode.php (endpoints dedicados)
├── migrations/001_api_keys.sql   Tabelas api_keys + audit_log
├── scripts/gerar_api_key.php     CLI: criar/revogar chaves
├── storage/              Rate limit + logs (fora do git)
└── docs/ENDPOINTS.md     Documentacao completa de endpoints
```

## Instalação

1. **Configurar ambiente**
   ```powershell
   Copy-Item .env.example .env   # e edite DB_HOST/DB_USER/DB_PASS/API_SIGNING_SECRET
   ```

2. **Aplicar migration** (cria `api_keys` e `audit_log` no banco):
   ```sql
   SOURCE migrations/001_api_keys.sql;   -- ou: mysql -u root -p inventario2 < migrations/001_api_keys.sql
   ```

3. **Criar a primeira chave de API** (CLI):
   ```powershell
   php scripts/gerar_api_key.php criar "Frontend Web" "*"
   # ou com escopo restrito:
   php scripts/gerar_api_key.php criar "App Desktop" "impressoras,monitores,estacoes"
   ```
   A chave (`flz_...`) é exibida **uma única vez** — o banco guarda apenas o SHA-256.

4. **Usar**: enviar header `X-API-KEY: flz_...` em toda requisição.

```powershell
# Exemplo
curl "http://localhost/apiphp/public/index.php?endpoint=impressoras&action=listar" -H "X-API-KEY: flz_..."
```

## Como os endpoints funcionam

Mesma convenção do legado — envelope compatível (`success/data/message/errors`):

```
GET/POST  ?endpoint=<modulo>&action=<acao>
```

- **Módulos CRUD genéricos** (mesmos handlers do legado): `acessorios`, `ativos_diversos`,
  `empresas`, `fornecedores`, `funcionarios`, `impressoras`, `impressoras_modelos`,
  `monitores`, `nobreaks`, `setores`, `softwares`, `toners`, `ativos_tipos`.
  Ações: `listar` (page/limit/search/filtros), `buscar_por_id`, `salvar` (POST, `id` opcional),
  `excluir` (POST), `proximo_codigo`/`get_next_codigo`, `dropdown`/`listar_simples`.
- **Dedicados**: `health` (sem chave), `dashboard_kpis`, `dashboard_alertas`,
  `dashboard_atividade`, `qrcode` (`get_ativos_por_tipo`, `gerar_qrcodes`, consulta por `codigo`).

Detalhes de parâmetros e permissões: `docs/ENDPOINTS.md`.

## Melhorias de segurança vs. legado

| # | Legado (`api/`) | apiphp |
|---|---|---|
| 1 | Sessão PHP (cookie) | **API Key** por consumidor, revogável, com expiração |
| 2 | Chave fixa `API_KEY` em config | Chaves com **hash SHA-256** no banco + `hash_equals` (timing-safe) |
| 3 | Sem rate limit | **Rate limit** por chave (default 120/min) + 429 com `Retry-After` |
| 4 | CORS irrestrito/ausente | **CORS por allowlist** (`.env`) |
| 5 | Erros às vezes expõem detalhes do BD | Erros mascarados em produção (`APP_DEBUG=false`), detalhes só em `error_log` |
| 6 | Sem auditoria de API | **audit_log** (chave, endpoint, IP, user-agent, contexto) |
| 7 | Campos de entrada livres | **Whitelist de campos/tipos** (anti mass-assignment) |
| 8 | Senha/creds no código | **.env fora do web root** e bloqueado por `.htaccess` |
| 9 | SQLInjection mitigado parcialmente | 100% prepared statements + `EMULATE_PREPARES=off` |
| 10 | — | Headers: `nosniff`, `DENY`, HSTS (prod), Permissions-Policy |

## Pendências / próximos passos

- [x] Validar whitelist de campos contra o schema real de `inventario2` (backup restaurado —
      tabela `toner` no singular, `setores.ativo`, `empresas` sem email, `acessorios` inexistente).
- [x] Banco configurado: `inventario2` / root (`.env` local). Migration `001_api_keys.sql` aplicada.
- [x] Testes ao vivo contra o banco real: health ✔, listar ✔, dropdown ✔, proximo_codigo ✔
      (IMP-014, DIV-005), dashboard ✔, validação 422 ✔, chave inválida 401 ✔.
- [ ] Portar módulos complexos com lógica dedicada: `celulares` (entregas/devoluções),
      `estacoes` (associação de softwares), `manutencoes` (orçamentos/peças), `chamados`,
      `usuarios`, `recebimentos_toner`, `historico_troca_toner`, `configuracoes`, `db_migrator`.
- [ ] `composer require endroid/qr-code` para gerar imagens de QR Code no servidor.
- [ ] HTTPS obrigatório + subdomínio dedicado (ex.: `api.fortluz.com.br`) na publicação.
- [ ] Criar usuário MySQL dedicado (`apiphp_ro`) com privilégios mínimos e trocar o `root` no `.env`.

## Frontend (fase seguinte)

Os designs das telas estão em `../ux/` (export Google Stitch): dashboard, listagens
(impressoras, monitores, estações, equipamentos) e formulários com modais.
O design system de referência é `../ux/fortluz_enterprise_inventory/DESIGN.md`
(IBM Plex Sans, primária `#991b1b`, estilo WinUI denso: grid compacto 28-32px, raio 4px,
badges de status verde/âmbar/vermelho, barra de status docked). O frontend deve consumir
esta API via `X-API-KEY` seguindo `docs/ENDPOINTS.md`.
