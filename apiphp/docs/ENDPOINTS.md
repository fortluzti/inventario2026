# ENDPOINTS — apiphp

Base: `/apiphp/public/index.php` · Autenticação: header `X-API-KEY` (exceto `health`).

Envelopes (compatíveis com o legado):

```json
// sucesso
{ "success": true, "data": ..., "message": "..." }
// erro
{ "success": false, "message": "...", "errors": { "campo": ["msg"] } }
```

Códigos: 200/201 (ok), 400 (ação/params), 401 (chave ausente/inválida/expirada),
403 (sem escopo), 404 (não encontrado/endpoint), 405 (método), 409 (duplicidade),
422 (validação), 429 (rate limit), 500/503 (servidor/BD).

---

## Módulos CRUD genéricos

Ações padrão (mesmos nomes do legado; alias preservados):

| Ação legado | Método | Params |
|---|---|---|
| `listar` (alias `listar_estacoes`) | GET | `page`, `limit` (≤200), `search`, filtros do módulo |
| `buscar_por_id` (alias `buscar`) | GET | `id` |
| `salvar` | POST | campos do módulo; `id` presente = update |
| `excluir` | POST | `id` |
| `proximo_codigo` (alias `get_next_codigo`) | GET | — |
| `dropdown` (alias `listar_simples`) | GET | — (só módulos com dropdown) |

Resposta de `listar`:
```json
{ "success": true, "data": { "items": [...], "total": 137, "page": 1, "limit": 20, "total_pages": 7 } }
```

### Módulos e campos (whitelist de `salvar`) — VALIDADOS contra o schema real de `inventario2`

- **ativos_diversos**: `codigo_patrimonio`, `tipo_id`, `marca`, `modelo`, `numero_serie`,
  `setor_id`, `status`, `data_compra`, `nota_fiscal`, `fornecedor_id`, `empresa_id`,
  `observacoes` — filtros: status/tipo_id · `proximo_codigo` ✔ (`DIV-005`)
- **ativos_tipos**: `nome`*, `descricao`
- **empresas**: `unidade`, `nome`*, `cnpj`, `endereco`, `telefone`, `cidade`, `bairro`, `cep` — dropdown ✔
- **estacoes**: `codigo_interno_estacao`*, `setor_id`*, `status`*, `ip`, `processador`,
  `memoria`, `hd`, `estado_hd`, `id_monitor`, `acessorios`, `ano_compra`, `data_compra`,
  `nota_fiscal`, `fornecedor_id`, `empresa_id`, `funcionario_id`.
  Filtros: `status`, `setor_id`, `empresa_id`, `funcionario_id` (colunas SQL qualificadas).
  `listar` e `buscar_por_id` incluem `empresa_nome`, `empresa_unidade`, `setor_nome`,
  `funcionario_nome`, `funcionario_cargo`, `monitor_codigo` e `monitor_modelo`.
  `proximo_codigo` retorna `{ "next_codigo": "EST-043" }` (exemplo, não reserva o código).
  `acessorios` é uma string separada por vírgulas: `Mouse,Teclado,Barcode,Webcam,Headset,Outro`.
  Status: `Em Uso`, `Em Estoque`, `Em Manutenção`, `Danificado`, `Descartado`.
  Vínculos de software por estação não estão disponíveis neste endpoint.
  Validação SQL somente leitura: `php scripts/validar_estacoes.php` (na pasta da API).
- **fornecedores**: `nome`*, `cnpj`, `telefone`, `endereco`, `tipo`, `nome_vendedor`, `email` — dropdown ✔
- **funcionarios**: `nome`*, `cargo`, `setor`, `setor_id`, `rg`, `email`, `gmail`
  (⚠ `senha_gmail` existe na tabela mas está FORA da whitelist por segurança)
- **impressoras**: `modelo_id`, `numero_serie`, `setor_id`, `ano_compra`, `status`,
  `data_compra`, `nota_fiscal`, `fornecedor_id`, `empresa_id` —
  `proximo_codigo` ✔ (`IMP-014`) · dropdown ✔ · busca: codigo_interno/numero_serie
- **impressoras_modelos** (tabela `impressora_modelos`): `nome_modelo`*, `marca`, `descricao`
- **monitores**: `marca`, `modelo`, `numero_serie`, `status`, `data_compra`, `nota_fiscal`,
  `fornecedor_id`, `empresa_id`, `portas` — `proximo_codigo` ✔ (`MON-027`)
- **nobreaks**: `marca`, `potencia`, `quantidade_bateria`, `numero_serie`, `setor_id`,
  `status`, `data_compra`, `nf`, `fornecedor_id`, `empresa_id` — `proximo_codigo` ✔ (`NB-002`)
- **setores**: `nome`*, `descricao`, `ativo` (0/1 — a tabela não tem `status`) — dropdown ✔ (ativo=1)
- **softwares**: `nome`*, `numero_serie`, `observacao`
- **toners** (tabela `toner`, singular): `codigo`*, `estoque`, `estoque_minimo`,
  `autonomia`, `data_compra`, `nota_fiscal`, `fornecedor_id`, `empresa_id`
  (sem `proximo_codigo` — códigos são modelos de toner, ex.: `TN-3442`)

**REMOVIDO**: `acessorios` — a tabela não existe no backup `inventario2` restaurado
(o handler legado `acessorios_handler.php` permanece na v1; recriar tabela se o módulo for necessário).

`*` = obrigatório. Campos não listados são **descartados** (anti mass-assignment).

---

## Endpoints dedicados

### `health` (GET, sem chave)
`{ "success": true, "data": { "api": "ativos2026/apiphp", "status": "ok", "db": "ok" } }`

### `dashboard_kpis` (GET)
Totais: `total_estacoes`, `total_monitores`, `total_impressoras`, `total_nobreaks`,
`total_celulares`, `total_funcionarios`, `toners_estoque`, `manutencoes_abertas`.

### `dashboard_alertas` (GET)
Lista de alertas: toners com estoque ≤ mínimo, equipamentos em manutenção.

### `dashboard_atividade` (GET)
Últimas 20 manutenções (data desc).

### `qrcode` (portado do legado `qrcode_handler.php`)
- `?endpoint=qrcode&codigo=IMP001` → localiza o ativo por código (qualquer tipo).
- `action=get_ativos_por_tipo&tipo_ativo=monitores|estacoes|impressoras|nobreaks`
- `action=gerar_qrcodes` (POST): `tipo_ativo`, `ativos` (IDs CSV).
  Gera PNG via `endroid/qr-code` se instalado; sem a lib, devolve os códigos
  (`data.gerado=false`) para o cliente gerar localmente.

---

## Endpoints dedicados — Administração

### `api_keys` (requer escopo `api_keys` ou `*`)
Gerenciamento de chaves de API via interface web.

| Ação | Método | Body | Retorno |
|---|---|---|---|
| `listar` | GET | — | `data`: array de `{id, nome, key_masked, scopes, rate_limit, ativo, expira_em, criado_em, ultimo_uso}` |
| `criar` | POST | `{nome, scopes (* ou CSV de módulos), rate_limit?}` | `data`: `{id, nome, scopes, key}` — **a chave em `key` é exibida apenas uma vez** |
| `atualizar` | POST | `{id, nome, scopes, rate_limit?, ativo?, expira_em?}` | mensagem de sucesso |
| `revogar` | POST | `{id}` | mensagem de sucesso (soft-delete: `ativo=0`) |

Scopos válidos: `*` (todas) ou lista de nomes de módulos:
`ativos_diversos, ativos_tipos, empresas, estacoes, fornecedores, funcionarios,
impressoras, impressoras_modelos, monitores, nobreaks, setores, softwares, toners,
api_keys, configuracoes, health, dashboard_kpis, dashboard_alertas, dashboard_atividade, qrcode`.

### `configuracoes` (requer escopo `configuracoes` ou `*`)
Configurações gerais do sistema.

| Ação | Método | Body | Retorno |
|---|---|---|---|
| `empresa` | GET | — | `data`: `{empresa_nome, empresa_cnpj, empresa_telefone, empresa_email, empresa_cep, empresa_logradouro, empresa_numero, empresa_complemento, empresa_bairro, empresa_cidade, empresa_estado, empresa_logo}` |
| `salvar_empresa` | POST | `{empresa_*}` | mensagem de sucesso |
| `upload_logo` | POST (multipart) | `$_FILES['arquivo']` | `{file, url}` |
| `backup` | GET | — | `{file, size, sha256, created_at}` |
| `verificar` | GET | — | `{status_geral, tabelas_verificadas, tabelas_ok, tabelas_faltando[], colunas_faltando{}, detalhes{}}` |
| `adaptar` | GET | — | `{alteracoes[], total}` |
| `licenca` | GET | — | `{serial, status, mensagem}` |
| `salvar_serial` | POST | `{serial}` | mensagem de sucesso |

Status de licença retornados por `licenca`: `nao_validada` (sem validação disponível).

## Ainda NÃO portados (lógica dedicada, ver README "Pendências")

`celulares` (entregas/devoluções/danos/histórico), `estacoes` (com softwares associados),
`manutencoes` (orçamentos/peças/serviços/aprovação), `chamados`, `usuarios`,
`perfis`, `recebimentos_toner`, `historico_troca_toner`, `nobreaks_historico_trocas`,
`configuracoes`, `db_migrator`, `*_relatorio.php`.

## Segurança operacional

- Chaves: gerar via `php scripts/gerar_api_key.php criar <nome> <scopes|lista>`; revogar com `revogar <id>`.
- Escopos: lista de módulos permitidos ou `*`. Autorização verificada por requisição.
- Rate limit: por chave (coluna `rate_limit`) com fallback do `.env`.
- Auditoria: toda chamada autenticada grava em `audit_log` (endpoint, IP, UA, ação).
