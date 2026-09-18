# UX — Designs das telas (Google Stitch)

Modelo visual do futuro frontend de `ativos2026`. Cada pasta contém `code.html`
(HTML/Tailwind exportado do Stitch) e `screen.png`.

## Design System (`fortluz_enterprise_inventory/DESIGN.md`)

- **Fonte**: IBM Plex Sans (títulos 14-20px semibold; corpo 12-13px; densidade enterprise).
- **Cores**: primária `#991b1b` (vermelho FortLuz) / fundo `#f8f9ff` / superfícies azuladas
  (#eff4ff…#d5e3fc) / texto `#0d1c2e` / bordas `#cbd5e1` / status:
  verde `#f0fdf4`/`#166534` (ok), âmbar `#fffbeb`/`#b45309` (atenção), vermelho `#fef2f2`/`#991b1b` (crítico).
- **Estilo**: WinUI/densidade alta — grid compacto (linhas 28-32px, header 28px sticky),
  raio universal 4px (sem pills), botões 28-32px (primário #991b1b, secundário branco com borda),
  inputs 28px, modais estilo diálogo WinUI (header 36px + footer com OK/Cancelar),
  barra de status docked 24px (#0f172a) no rodapé.
- **Estados de linha do grid**: hover `#f1f5f9`; selecionada `#fee2e2` com barra 2px `#991b1b` à esquerda.

## Telas disponíveis → endpoints da API

| Tela (pasta) | Consumo (apiphp) |
|---|---|
| `dashboard_geral_de_ativos` | `dashboard_kpis`, `dashboard_alertas`, `dashboard_atividade` |
| `equipamentos_listagem_geral` | `ativos_diversos` (listar/buscar/salvar/excluir, proximo_codigo) |
| `impressoras_listagem_…` | `impressoras` + `impressoras_modelos` |
| `monitores_invent_rio` / `monitores_formul_rio_e_modais` | `monitores` |
| `esta_es_de_trabalho_listagem` / `…_cadastro_e_grid` / `…_formul_rio` | `estacoes` (handler dedicado — pendente) |
| `fortluz_enterprise_inventory` | Design system base (DESIGN.md) |

Regra: adaptar o HTML do Stitch para componentes do framework escolhido (Vite+React+Tailwind)
usando as cores/medidas do DESIGN.md — não copiar o HTML cru.
