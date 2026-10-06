---
name: FortLuz Enterprise Inventory
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#59413e'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#8d706d'
  outline-variant: '#e1bfbb'
  surface-tint: '#b02d29'
  primary: '#760009'
  on-primary: '#ffffff'
  primary-container: '#991b1b'
  on-primary-container: '#ffaaa1'
  inverse-primary: '#ffb4ac'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#003f3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#005852'
  on-tertiary-container: '#79cec4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ac'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#8e1214'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#9cf2e8'
  tertiary-fixed-dim: '#80d5cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#00504a'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.04em
  code-dense:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  margin: 0.75rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system translates the robust, dense, and tactile paradigm of desktop frameworks (Avalonia, WPF, WinUI 3) into an enterprise web application. It is engineered for industrial inventory managers, supply-chain controllers, and warehouse clerks who interact with high-volume SKU databases, logistics pipelines, and financial reconciliations over multi-hour shifts.

### Aesthetic Foundation
- **Modern Industrial Utility:** A convergence of Microsoft Fluent/WinUI design principles and web-native runtime performance.
- **High-Density Compactness:** Information architecture prioritizes horizontal space optimization, tight row layouts (28–32px standard row heights), structured division lines, and minimal decorative padding.
- **Utilitarian Discipline:** Every pixel provides operational context. Skeuomorphic desktop metaphors (docked command toolbars, column sorting indicators, split-panes, fixed status bars) ground the interface in immediate familiarity.

## Colors

The palette is engineered around an institutional, commanding crimson red anchored by slate and zinc neutrals to ensure low visual fatigue across 8-hour operational desk environments.

### Core Swatches
- **Primary (`#991b1b` / `#b91c1c`):** Institutional Deep Crimson. Used for high-priority actions, destructive confirms, primary system headers, active tabs, and primary action buttons.
- **Secondary (`#d97706` / `#f59e0b`):** Warning Amber / Industrial Gold. Reserved for inventory thresholds, critical stock alerts, pending sync states, and intermediate priority tags.
- **Tertiary (`#0f766e`):** Industrial Teal. Designates verified inbound stock, operational health, and balanced audit balances.
- **Neutral (`#475569` base):** Slate/Zinc core. Provides structural scaffolding through subtle surface tinting (`#f8fafc`, `#f1f5f9`, `#e2e8f0`), deep text contrasts (`#0f172a`), and low-contrast control borders (`#cbd5e1`).

### Operational Roles
- **Canvas / App Chrome:** `#f1f5f9` (Light Slate fill) creating a native Windows client feel.
- **Surface Elevation (Cards, Panels, Grids):** `#ffffff` with `#e2e8f0` crisp hairline perimeter strokes.
- **Data Grid Alternation:** White (`#ffffff`) to muted tint (`#f8fafc`).
- **Focus Rings:** High-visibility dual-tone ring: 1px `#ffffff` internal offset with a 2px `#991b1b` primary ring.

## Typography

Typography prioritizes high-density data parsing over expressive editorial pacing. Type scales are tightly grouped between 10px and 20px, optimizing information packing for desktop resolution canvases (1920x1080 and 1440x900 displays).

- **Primary Typeface:** `IBM Plex Sans`. Delivers industrial geometry, distinct glyph separation (e.g., distinguishing uppercase `I`, lowercase `l`, and numeral `1`), and superior rendering in dense desktop tables.
- **Monospace Secondary:** `JetBrains Mono` for inventory barcodes, SKU references, serial numbers, IP configurations, and fiscal documents (NFe keys).
- **Tabular Figures:** All numeric listings (quantities, values, metrics) must render with CSS `font-variant-numeric: tabular-nums` to guarantee vertical decimal alignment across spreadsheet layouts.

## Layout & Spacing

The architecture operates on a strict **4px modular grid** with condensed spacing units to replicate native desktop software layouts like WinUI 3 and Avalonia UI.

### Desktop Layout Architecture
- **Shell Structure:** Top command menu bar (32px), persistent dynamic application toolbar (40px), split master-detail navigation canvas with collapsible side navigation (220px expanded to 48px rail), central multi-document work surface, and a docked bottom status bar (24px).
- **Density Tiering:**
  - `space-xs` (2px): Internal control alignment (icon-to-text gaps within compact buttons, status indicator margins).
  - `space-sm` (4px): Field padding, cell edge padding in dense grids, gap between grouped toolbar icons.
  - `space-md` (8px): Form field spacing, card internal padding, toolbar section separators.
  - `space-lg` (12px): Dialog body padding, panel content splits.
  - `space-xl` (16px): Structural application outer shell margins and maximum panel gutters.
- **Grid Adaptability:** Responsive behavior treats screen space as functional viewport stages. Below 1024px, split-views collapse to full overlays; beneath 768px, administrative operations display responsive warning banners urging return to desktop viewport scale.

## Elevation & Depth

Visual depth follows the WinUI/Fluent layered architectural model: depth is communicated via subtle surface layering and crisp 1px borders rather than expansive, blurry shadows.

- **Hairline Outlines:** All modular surfaces, input panels, and data grids utilize a sharp 1px border (`border border-slate-300` or `border-slate-200`).
- **Surface Elevation Layers:**
  - **Layer 0 (Canvas):** `#f1f5f9` (App workspace background).
  - **Layer 1 (Cards, Toolbars, Grids):** `#ffffff` with 1px border.
  - **Layer 2 (Flyouts, Menus, Popovers):** `#ffffff` with `0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)` and 1px border (`#cbd5e1`).
  - **Layer 3 (Modal Dialogs):** `#ffffff` centered over a 40% `#0f172a` backdrop veil, using `0 10px 15px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -4px rgba(0, 0, 0, 0.08)` and crisp border boundaries.
- **Interactive State Micro-elevation:** Avoid heavy lift effects on hover. Controls express activation via 1px border-color transitions, light background tints, and active press depression (`transform: translateY(1px)` or inner inset shadow).

## Shapes

To mirror WinUI desktop guidelines and ensure compact grid fit, the radius scale is locked to micro-radii (`roundedness: 1`).

- **Universal Radius:** `4px` (`rounded` or `0.25rem`) applied to buttons, input fields, badges, dropdown menus, and panel envelopes.
- **Pill Exceptions:** Strictly disallowed for functional enterprise controls. All buttons, indicators, and chips retain structured rectangular forms with 4px corners to preserve edge alignment across table axes.
- **Nested Corners:** Inner elements inside 4px containers drop to `2px` radius or `0px` (sharp) to prevent corner collision distortion.

## Components

### Buttons & Toolbars
- **Desktop Toolbar:** 40px height, flex row, surface `#ffffff`, border-bottom 1px `#cbd5e1`. Groups buttons using 16px tall vertical dividers (`#e2e8f0`).
- **Standard Action Button:** Height 28px (compact) or 32px (standard). Border radius 4px. Padding: 0 10px. Typography: `label-md`.
- **Primary Button:** Background `#991b1b`, text `#ffffff`, border 1px solid `#7f1d1d`. Hover: `#b91c1c`. Active: `#7f1d1d`.
- **Secondary / Toolbar Button:** Background `#ffffff`, text `#334155`, border 1px solid `#cbd5e1`. Hover: `#f1f5f9`, border `#94a3b8`.

### Data Grids (Compact Enterprise Table)
- **Header:** Height 28px, background `#f8fafc`, text `#475569`, border-bottom 1px solid `#cbd5e1`. Sticky positioning (`top: 0`). Typography: `label-sm` uppercase.
- **Rows:** Height 28px to 32px. Alternating row background (`#ffffff` / `#f8fafc`). Border-bottom 1px solid `#f1f5f9`.
- **Row States:** Hover: background `#f1f5f9`. Selected row: background `#fee2e2` with a 2px solid `#991b1b` left-edge indicator bar.
- **Cells:** Padding: 2px 8px. Text truncation with ellipses and native hover tooltips. Right-aligned for tabular currency/quantities.

### Input Fields & Controls
- **Text Inputs:** Height 28px, background `#ffffff`, border 1px solid `#cbd5e1`, border radius 4px, font size 12px. Focus: border `#991b1b`, outline: 1px solid `#991b1b`.
- **Checkboxes:** 14px x 14px square, border radius 2px, border 1.5px solid `#64748b`. Checked: background `#991b1b` with white checkmark.
- **Status Badges / Chips:** Height 20px, border-radius 3px, padding: 0 6px, typography: `label-sm`.
  - *Normal / In Stock:* Background `#f0fdf4`, text `#166534`, border 1px solid `#bbf7d0`.
  - *Warning / Low Stock:* Background `#fffbeb`, text `#b45309`, border 1px solid `#fde68a`.
  - *Critical / Out of Stock:* Background `#fef2f2`, text `#991b1b`, border 1px solid `#fecaca`.

### WinUI-Style Dialog Modals
- **Window Shell:** Border-radius 6px, border 1px solid `#cbd5e1`, background `#ffffff`, drop-shadow level 3.
- **Dialog Header:** Height 36px, background `#f8fafc`, border-bottom 1px solid `#e2e8f0`, flex row with icon, title (`headline-sm`), and system window close button.
- **Dialog Footer:** Action bar with `#f8fafc` background, border-top 1px solid `#e2e8f0`, standard 8px gap between right-aligned OK and Cancel buttons.

### Docked Status Bar
- **Dimensions:** Pinned to bottom viewport, height 24px, background `#0f172a`, text `#94a3b8`, typography `label-sm`.
- **Layout:** Flex row with system status icons, network sync indicators, active user, warehouse terminal ID, and CAPSLOCK/NUM indicators.