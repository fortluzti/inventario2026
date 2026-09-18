import { api, getApiKey } from './client.js'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090/index.php'

export const MODULE_SCOPES = [
  'ativos_diversos', 'ativos_tipos', 'empresas', 'estacoes',
  'fornecedores', 'funcionarios', 'impressoras', 'impressoras_modelos',
  'monitores', 'nobreaks', 'setores', 'softwares', 'toners',
  'api_keys', 'configuracoes', 'health',
  'dashboard_kpis', 'dashboard_alertas', 'dashboard_atividade', 'qrcode',
]

export const SCOPE_LABELS = {
  'ativos_diversos': 'Ativos Diversos',
  'ativos_tipos': 'Tipos de Ativos',
  'empresas': 'Empresas',
  'estacoes': 'Estações',
  'fornecedores': 'Fornecedores',
  'funcionarios': 'Funcionários',
  'impressoras': 'Impressoras',
  'impressoras_modelos': 'Modelos de Impressoras',
  'monitores': 'Monitores',
  'nobreaks': 'Nobreaks',
  'setores': 'Setores',
  'softwares': 'Softwares',
  'toners': 'Toners',
  'api_keys': 'API Keys',
  'configuracoes': 'Configurações',
  'health': 'Health Check',
  'dashboard_kpis': 'Dashboard KPIs',
  'dashboard_alertas': 'Dashboard Alertas',
  'dashboard_atividade': 'Dashboard Atividade',
  'qrcode': 'QR Code',
}

/* ---------------- Dados da Empresa ---------------- */

export async function carregarEmpresa() {
  return api('configuracoes', 'empresa')
}

export async function salvarEmpresa(dados) {
  return api('configuracoes', 'salvar_empresa', { method: 'POST', body: dados })
}

export async function uploadLogo(file) {
  const url = new URL(BASE_URL)
  url.searchParams.set('endpoint', 'configuracoes')
  url.searchParams.set('action', 'upload_logo')

  const formData = new FormData()
  formData.append('arquivo', file)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-KEY': getApiKey() },
    body: formData,
  })

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(`Resposta inválida da API (HTTP ${res.status})`)
  }
  if (!json.success) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `Erro HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return json.data
}

/* ---------------- API Keys ---------------- */

export async function listarApiKeys() {
  return api('api_keys', 'listar')
}

export async function criarApiKey(dados) {
  return api('api_keys', 'criar', { method: 'POST', body: dados })
}

export async function revogarApiKey(id) {
  return api('api_keys', 'revogar', { method: 'POST', body: { id } })
}

/* ---------------- Manutenção do Banco ---------------- */

export async function gerarBackup() {
  return api('configuracoes', 'backup')
}

export async function verificarBanco() {
  return api('configuracoes', 'verificar')
}

export async function adaptarBanco() {
  return api('configuracoes', 'adaptar')
}

export async function downloadBackup(filename) {
  const url = new URL(BASE_URL)
  url.searchParams.set('endpoint', 'configuracoes')
  url.searchParams.set('action', 'download_backup')
  url.searchParams.set('file', filename)

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-KEY': getApiKey() },
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || `Erro HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(downloadUrl)
  return true
}

export function logoUrl(filename) {
  if (!filename) return ''
  const url = new URL(BASE_URL)
  url.searchParams.set('endpoint', 'configuracoes')
  url.searchParams.set('action', 'serve_logo')
  url.searchParams.set('file', filename)
  url.searchParams.set('api_key', getApiKey())
  return url.toString()
}

export function hasLogo(empresa) {
  return !!(empresa?.empresa_logo && empresa.empresa_logo.trim())
}

export function getLogoUrl(empresa) {
  if (!hasLogo(empresa)) return ''
  return logoUrl(empresa.empresa_logo)
}

/* ---------------- Licença ---------------- */

export async function carregarLicenca() {
  return api('configuracoes', 'licenca')
}

export async function salvarSerial(dados) {
  return api('configuracoes', 'salvar_serial', { method: 'POST', body: dados })
}

/* ---------------- Utilities ---------------- */

export const EMPTY_EMPRESA = {
  empresa_nome: '', empresa_cnpj: '', empresa_telefone: '', empresa_email: '',
  empresa_cep: '', empresa_logradouro: '', empresa_numero: '',
  empresa_complemento: '', empresa_bairro: '', empresa_cidade: '',
  empresa_estado: '', empresa_logo: '',
}

export function formatarCNPJ(value) {
  const nums = value.replace(/\D/g, '')
  if (nums.length > 14) return value.slice(0, 18)
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function desformatarCNPJ(value) {
  return value.replace(/\D/g, '')
}

export function formatarCEP(value) {
  const nums = value.replace(/\D/g, '')
  if (nums.length > 8) return value.slice(0, 9)
  return nums.replace(/^(\d{5})(\d)/, '$1-$2')
}

export function desformatarCEP(value) {
  return value.replace(/\D/g, '')
}

export function mascaraApiKey(prefixed) {
  if (!prefixed) return '••••••••••••••••••••'
  const prefix = prefixed.substring(0, 4)
  return prefix + '•'.repeat(20)
}
