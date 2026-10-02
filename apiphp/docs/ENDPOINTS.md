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
- **fornecedores**: `nome`*, `tipo`* (`Fornecedor de Produtos` | `Prestador de Serviços`),
  `cnpj` (único), `telefone`, `endereco`, `nome_vendedor`, `email`,
  `ativo` (0/1 — migration `003_funcionarios_fornecedores_ativo.sql`) —
  dropdown ✔ (ativo=1) · ordenação (`sort`): nome, cnpj, telefone, tipo,
  nome_vendedor, email, status · `excluir` responde 409 quando há vínculos
  (estações, monitores, impressoras, celulares, nobreaks, toners, ativos_diversos,
  manutenções, orçamentos) — nesse caso a ação correta é inativar (`ativo=0`)
- **funcionarios**: `nome`*, `cargo`, `setor`, `setor_id`, `rg`, `email`, `gmail`
  (⚠ `senha_gmail` existe na tabela mas está FORA da whitelist por segurança)
- **impressoras**: `modelo_id`, `numero_serie`, `setor_id`, `ano_compra`, `status`,
  `data_compra`, `nota_fiscal`, `fornecedor_id`, `empresa_id` —
  `proximo_codigo` ✔ (`IMP-014`) · dropdown ✔ · busca: codigo_interno/numero_serie
- **impressoras_modelos** (tabela `impressora_modelos`): `nome_modelo`*, `marca`, `descricao`,
  `estoque_minimo_toner`*, `estoque_minimo_cilindro`* (colunas da migration `005_consumiveis_regra.sql`)
- **impressora_modelos_toner** (tabela `impressora_modelos_toner`, migration `006_impressora_modelos_toner.sql`):
  `modelo_id`*, `toner_id`* — consumíveis compatíveis de um modelo (vários por modelo).
  Filtros: `modelo_id`, `toner_id`. `listar` devolve também `toner_codigo`, `toner_tipo`,
  `toner_estoque` (JOIN com `toner`) e `modelo_nome`/`modelo_marca` (LEFT JOIN com
  `impressora_modelos`) — usado no modal do Consumível. **O tipo (TONER/CILINDRO) vem sempre
  de `toner.tipo`** (cadastro do consumível) — não existe campo de tipo nesta tabela e o
  cliente não o envia. Duplicidade (modelo_id, toner_id) responde 409. A tabela não tem
  `data_cadastro`/`data_atualizacao` (`'audit_columns' => false` no registry).
- **monitores**: `marca`, `modelo`, `numero_serie`, `status`, `data_compra`, `nota_fiscal`,
  `fornecedor_id`, `empresa_id`, `portas` — `proximo_codigo` ✔ (`MON-027`)
- **nobreaks**: `marca`, `potencia`, `quantidade_bateria`, `numero_serie`, `setor_id`,
  `status`, `data_compra`, `nf`, `fornecedor_id`, `empresa_id` — `proximo_codigo` ✔ (`NB-002`)
- **setores**: `nome`*, `descricao`, `ativo` (0/1 — a tabela não tem `status`) — dropdown ✔ (ativo=1)
- **softwares**: `nome`*, `numero_serie`, `observacao`
- **toners** (tabela `toner`, singular): `codigo`*, `tipo`* (`TONER`|`CILINDRO`),
  `estoque`, `estoque_minimo`, `autonomia`, `valor` (migration `007_toner_valor.sql`,
  `DECIMAL(10,2)`, só cadastro), `data_compra`, `nota_fiscal`, `fornecedor_id`,
  `empresa_id` (sem `proximo_codigo` — códigos são modelos de toner, ex.: `TN-3442`).
  Busca: `codigo`. Filtros: `tipo` e `modelo_id` (este último restringe aos consumíveis
  ligados ao modelo via `impressora_modelos_toner`, usando `EXISTS` — um consumível
  aparece **uma única vez** mesmo compatível com vários modelos). `listar` devolve também
  `modelos_compat` (lista agregada dos modelos compatíveis). Regras: `estoque_minimo`
  continua sendo o mínimo do consumível e `tipo` continua determinando TONER/CILINDRO.

  **Ações dedicadas** (mesmo endpoint `toners`, handler `src/handlers/toners_handler.php`) —
  as operações que o sistema antigo separava em `historico_troca_toner_handler.php` e
  `recebimentos_toner_handler.php` ficam concentradas na tela de Toners (nenhuma página nova):

  | Ação | Método | Params/Body | Retorno / regras |
  |---|---|---|---|
  | `listar_compativeis` | GET | `impressora_id` | `data`: `{impressora_id, modelo_id, items[]}` — consumíveis do **MODELO** da impressora (relação `impressora_modelos_toner`, TONER e CILINDRO juntos). 404 se a impressora não existe. |
  | `registrar_troca` | POST | `{id_impressora, id_toner, observacoes?, usuario?}` | `data`: `{id, id_impressora, id_toner, codigo, estoque, responsavel}`. Em **transação**: grava `historico_troca_toner`, dá baixa de 1 unidade no estoque e atualiza `impressoras.data_ultima_troca_toner`. **422** se o consumível não for compatível com o modelo da impressora ou se o estoque estiver zerado. |
  | `listar_historico` | GET | `impressora_id?`, `setor_id?`, `toner_id?`, `page`, `limit` | `data`: `{items, total, page, limit, total_pages}` com `data_cadastro`, `modelo_nome`, `impressora_codigo`, `setor_nome`, `toner_codigo`/`toner_tipo`, `responsavel` e `observacoes`. |
  | `receber_multiplos` | POST | `{funcionario_recebedor_id, data_recebimento?, observacoes?, usuario?, toners:[{toner_id, quantidade}]}` | `data`: `{funcionario_recebedor, data_recebimento, itens[], responsavel}`. Em **transação**: soma o estoque e grava **uma linha por consumível** em `recebimentos_toner`. Itens repetidos do mesmo consumível são somados. **422** sem funcionário ou sem itens. |

  `usuario` é o **usuário logado** (o modal de troca não oferece seleção de funcionário
  responsável); o valor é sanitizado (máx. 50 chars) e usado apenas para responsabilização —
  o histórico resolve o funcionário de **mesmo nome** (`users.nome` × `funcionarios.nome`)
  e, na ausência, exibe o próprio login. `GET action=dropdown` devolve `[{id, nome}]`
  (códigos dos consumíveis) e alimenta o filtro "Consumível" do histórico.

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

### `sistema` (requer escopo `sistema` ou `*`)
Fonte única da versão instalada — tabela `sistema_info` (migration `004_sistema_info.sql`)
+ histórico em `schema_migrations`. Nenhuma versão/build fica hardcoded no frontend.

| Ação | Método | Retorno |
|---|---|---|
| `versao` (alias `info`) | GET | payload abaixo |

```json
{ "success": true, "data": {
    "app_versao": "2026.1.0",
    "app_build": "web",
    "build": "2026.1.0-web",
    "db_versao": "004",
    "db_nome": "inventario2",
    "migrations_aplicadas": 4,
    "atualizado_em": "2026-09-29 17:23:34"
} }
```

`app_versao` (release da aplicação) e `db_versao` (migration efetivamente aplicada) são
conceitos distintos; `build` é o texto pronto para exibição (`app_versao-app_build`).
Sem `sistema_info` no banco a resposta é **503** orientando a rodar
`php apiphp/scripts/migrate.php`.

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
impressoras, impressoras_modelos, impressora_modelos_toner, monitores, nobreaks, setores, softwares, toners,
api_keys, configuracoes, health, dashboard_kpis, dashboard_alertas, dashboard_atividade,
qrcode, sistema, usuarios`.

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

### `usuarios` (requer escopo `usuarios` ou `*`)

Gerenciamento de contas de acesso do sistema. Tabela base: `users` (id_usuario, nome, login, email, senha).

**IMPORTANTE**: A tabela `users` NÃO possui campo `ativo`. O status (ativo/inativo) é obtido da tabela `funcionarios` apenas quando há correspondência por email. Usuários sem registro em `funcionarios` são considerados ativos por padrão.

| Ação | Método | Params | Body | Retorno |
|---|---|---|---|---|
| `buscar_por_id` (alias `buscar`) | GET | `id` (login, email ou id_usuario numérico) | — | `data`: `{id, nome, login, email, cargo?, setor?, rg?, ativo_func?, funcionario_id?}` — senha **nunca** retornada |
| `listar` | GET | `page`, `limit` (≤200), `search` (nome/login/email/RG/cargo/setor) | — | `data`: `{items, total, page, limit, total_pages}` |
| `salvar` | POST | — | `{id, nome?, login?, email?, cargo?, setor?, rg?}` ou `{id, trocar_senha: true, nova_senha}` | mensagem de sucesso |
| `alterar_senha` | POST | — | `{id, senha_atual?, nova_senha}` | mensagem de sucesso |
| `ativar` | POST | `id`, `ativo?` | — | `data`: `{ativo}` — toggla `ativo` em `funcionarios` (requer registro vinculado) |
| `novo` | POST | — | `{nome, login, senha, email?, cargo?, setor?, rg?}` | `data`: `{id}` — cria em `users` e opcionalmente em `funcionarios` |

**Notas de segurança:**
- `senha` nunca é retornada em nenhuma resposta.
- Em `salvar`, `login` é atualizável, mas mudar o login pode invalidar referências
  em outras tabelas (ex.: `celulares.usuario_cadastro`). Use com cuidado.
- `alterar_senha` verifica `senha_atual` apenas se informada; `nova_senha` requer mínimo 6 caracteres.
- O `id` aceita tanto id_usuario numérico quanto login/email (string) como identificador.

## Ainda NÃO portados (lógica dedicada, ver README "Pendências")

`celulares` (entregas/devoluções/danos/histórico), `estacoes` (com softwares associados),
`manutencoes` (orçamentos/peças/serviços/aprovação), `chamados`, `perfis`,
`nobreaks_historico_trocas`, `configuracoes`, `db_migrator`, `*_relatorio.php`.

## Segurança operacional

- Chaves: gerar via `php scripts/gerar_api_key.php criar <nome> <scopes|lista>`; revogar com `revogar <id>`.
- Escopos: lista de módulos permitidos ou `*`. Autorização verificada por requisição.
- Rate limit: por chave (coluna `rate_limit`) com fallback do `.env`.
- Auditoria: toda chamada autenticada grava em `audit_log` (endpoint, IP, UA, ação).
