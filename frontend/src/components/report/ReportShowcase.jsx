import { useMemo, useState } from 'react'
import { ReportViewer } from './ReportViewer.jsx'
import { formatDate } from './reportUtils.js'

/**
 * Dataset oficial de 26 monitores para replicar exatamente a referência visual (3 páginas A4)
 */
const MONITORES_DATASET = [
  // Página 1 (10 registros)
  { id: 1, codigo: 'MON-026', marca: 'HWP', modelo: 'HP V194bz', serie: 'BRC404018N', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 2, codigo: 'MON-025', marca: 'SAM', modelo: 'SA300/SA350', serie: 'HQAB812254', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 3, codigo: 'MON-024', marca: 'VXPRO', modelo: 'VX170C', serie: 'VXV170C00770', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Estoque', data_compra: '2024-02-03' },
  { id: 4, codigo: 'MON-023', marca: 'DELL', modelo: 'E1916HF', serie: 'BR-00KKFDW-TVB00-7B8-5MPI-A04', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 5, codigo: 'MON-022', marca: 'PCTOP', modelo: 'MLP170HDMI', serie: 'CMT0036392APR290503MLT1700', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2024-06-30' },
  { id: 6, codigo: 'MON-021', marca: 'PHL', modelo: 'Philips 196V4', serie: 'FX51320052834', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Estoque', data_compra: null },
  { id: 7, codigo: 'MON-020', marca: 'PHILIPS', modelo: '196V4LSB2/57', serie: 'FX5A1320052666', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 8, codigo: 'MON-019', marca: 'SAM', modelo: 'LF24T35', serie: 'HX5W915493', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 9, codigo: 'MON-018', marca: 'HWP', modelo: 'HP V194bz', serie: 'BRC3470189', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 10, codigo: 'MON-017', marca: 'DEL', modelo: 'DELL E177FP', serie: '6418067J2EDK', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },

  // Página 2 (10 registros)
  { id: 11, codigo: 'MON-016', marca: 'AOC', modelo: '20S0W', serie: 'DTK3AIA015116', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 12, codigo: 'MON-015', marca: 'AOC', modelo: '2070W', serie: '19S48IA000059', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Estoque', data_compra: null },
  { id: 13, codigo: 'MON-014', marca: 'PHL', modelo: 'Philips 196V4', serie: 'FX51320052853', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 14, codigo: 'MON-013', marca: 'DEL', modelo: 'DELL E1916H', serie: '0KFDW7AB4SEI', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 15, codigo: 'MON-012', marca: 'SAM', modelo: 'LF24T35', serie: 'HX5W915487', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: null },
  { id: 16, codigo: 'MON-011', marca: 'DELL', modelo: 'P2422H', serie: 'CN-0P2422H-742', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2023-11-10' },
  { id: 17, codigo: 'MON-010', marca: 'LG', modelo: '29WK600', serie: 'LG-29WK-88190', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2022-09-12' },
  { id: 18, codigo: 'MON-009', marca: 'SAM', modelo: 'T350 24"', serie: 'SAM-T350-9901', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Estoque', data_compra: '2023-05-18' },
  { id: 19, codigo: 'MON-008', marca: 'DELL', modelo: 'E2222H', serie: 'DL-E2222-4411', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2024-01-15' },
  { id: 20, codigo: 'MON-007', marca: 'AOC', modelo: 'E970SWNL', serie: 'AOC-E970-3321', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Manutenção', data_compra: '2021-08-20' },

  // Página 3 (6 registros)
  { id: 21, codigo: 'MON-006', marca: 'PHILIPS', modelo: '221V8L', serie: 'PHL-221V-0092', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2023-03-04' },
  { id: 22, codigo: 'MON-005', marca: 'DELL', modelo: 'UltraSharp U2723QE', serie: 'CN-0U2723-889', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2023-05-22' },
  { id: 23, codigo: 'MON-004', marca: 'HWP', modelo: 'HP P204v', serie: 'BRC9918231', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Estoque', data_compra: '2022-10-15' },
  { id: 24, codigo: 'MON-003', marca: 'SAM', modelo: 'Odyssey G3 24"', serie: 'SAM-G3-99120', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2023-09-20' },
  { id: 25, codigo: 'MON-002', marca: 'LG', modelo: 'UltraFine 32UN650', serie: 'LG-32UN-0918', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Em Uso', data_compra: '2024-01-18' },
  { id: 26, codigo: 'MON-001', marca: 'AOC', modelo: 'Speed 24G2HE', serie: 'AOC-24G2-8812', empresa_nome: 'FORT LUZ MATERIAIS ELETRICOS LTDA', status: 'Danificado', data_compra: '2022-04-10' },
]

export function ReportShowcase({ empresa, onClose }) {
  // Filtros dinâmicos
  const [selectedStatus, setSelectedStatus] = useState('Todos')
  const [selectedEmpresa, setSelectedEmpresa] = useState('Todas')
  const [selectedMarca, setSelectedMarca] = useState('Todas')
  const [selectedModelo, setSelectedModelo] = useState('Todos')
  const [dtInicio, setDtInicio] = useState('')
  const [dtFim, setDtFim] = useState('')

  // Filtros aplicados efetivamente
  const [applied, setApplied] = useState({
    status: 'Todos',
    empresa: 'Todas',
    marca: 'Todas',
    modelo: 'Todos',
    dtInicio: '',
    dtFim: '',
  })

  function handleApply() {
    setApplied({
      status: selectedStatus,
      empresa: selectedEmpresa,
      marca: selectedMarca,
      modelo: selectedModelo,
      dtInicio,
      dtFim,
    })
  }

  function handleClear() {
    setSelectedStatus('Todos')
    setSelectedEmpresa('Todas')
    setSelectedMarca('Todas')
    setSelectedModelo('Todos')
    setDtInicio('')
    setDtFim('')
    setApplied({
      status: 'Todos',
      empresa: 'Todas',
      marca: 'Todas',
      modelo: 'Todos',
      dtInicio: '',
      dtFim: '',
    })
  }

  // Filtragem dos dados
  const filteredRows = useMemo(() => {
    return MONITORES_DATASET.filter((row) => {
      if (applied.status !== 'Todos' && row.status !== applied.status) return false
      if (applied.marca !== 'Todas' && row.marca !== applied.marca) return false
      if (applied.modelo !== 'Todos' && !row.modelo.toLowerCase().includes(applied.modelo.toLowerCase())) return false
      return true
    })
  }, [applied])

  // Colunas da tabela
  const columns = [
    { key: 'codigo', label: 'CÓDIGO', width: '80px', isCode: true },
    { key: 'marca', label: 'MARCA', width: '70px' },
    { key: 'modelo', label: 'MODELO', width: '130px' },
    { key: 'serie', label: 'Nº SÉRIE', width: '140px', isMono: true },
    { key: 'empresa_nome', label: 'EMPRESA', width: '150px' },
    { key: 'status', label: 'STATUS', width: '85px' },
    {
      key: 'data_compra',
      label: 'DT. COMPRA',
      width: '85px',
      render: (row) => formatDate(row.data_compra),
      csvRender: (row) => row.data_compra ? formatDate(row.data_compra) : '',
    },
  ]

  // Texto descritivo de filtros para a barra de metadados
  const filtersSummaryText = useMemo(() => {
    const list = []
    if (applied.status !== 'Todos') list.push(`Status: ${applied.status}`)
    if (applied.marca !== 'Todas') list.push(`Marca: ${applied.marca}`)
    if (applied.modelo !== 'Todos') list.push(`Modelo: ${applied.modelo}`)
    if (list.length === 0) return 'Todos os registros'
    return list.join(' | ')
  }, [applied])

  // Controles de filtros no padrão visual da Linha 2
  const filterControls = (
    <>
      <div className="rpt-filter-group">
        <span className="rpt-filter-label">Status</span>
        <select
          className="rpt-filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="Todos">Todos</option>
          <option value="Em Uso">Em Uso</option>
          <option value="Em Estoque">Em Estoque</option>
          <option value="Em Manutenção">Em Manutenção</option>
          <option value="Danificado">Danificado</option>
        </select>
      </div>

      <div className="rpt-filter-group">
        <span className="rpt-filter-label">Empresa</span>
        <select
          className="rpt-filter-select"
          value={selectedEmpresa}
          onChange={(e) => setSelectedEmpresa(e.target.value)}
        >
          <option value="Todas">Todas</option>
          <option value="FortLuz">FORT LUZ MATERIAIS ELETRICOS LTDA</option>
        </select>
      </div>

      <div className="rpt-filter-group">
        <span className="rpt-filter-label">Marca</span>
        <select
          className="rpt-filter-select"
          value={selectedMarca}
          onChange={(e) => setSelectedMarca(e.target.value)}
        >
          <option value="Todas">Todas</option>
          <option value="HWP">HWP</option>
          <option value="SAM">SAM</option>
          <option value="DELL">DELL</option>
          <option value="AOC">AOC</option>
          <option value="PHILIPS">PHILIPS</option>
          <option value="LG">LG</option>
          <option value="VXPRO">VXPRO</option>
          <option value="PCTOP">PCTOP</option>
        </select>
      </div>

      <div className="rpt-filter-group">
        <span className="rpt-filter-label">Modelo</span>
        <select
          className="rpt-filter-select"
          value={selectedModelo}
          onChange={(e) => setSelectedModelo(e.target.value)}
        >
          <option value="Todos">Todos</option>
          <option value="HP V194bz">HP V194bz</option>
          <option value="SA300/SA350">SA300/SA350</option>
          <option value="E1916HF">E1916HF</option>
          <option value="LF24T35">LF24T35</option>
          <option value="20S0W">20S0W</option>
          <option value="2070W">2070W</option>
        </select>
      </div>

      <div className="rpt-filter-group">
        <span className="rpt-filter-label">Período (Compra)</span>
        <div className="rpt-period-inputs">
          <input
            type="date"
            className="rpt-filter-input"
            value={dtInicio}
            onChange={(e) => setDtInicio(e.target.value)}
          />
          <span className="rpt-period-separator">a</span>
          <input
            type="date"
            className="rpt-filter-input"
            value={dtFim}
            onChange={(e) => setDtFim(e.target.value)}
          />
        </div>
      </div>

      <div className="rpt-filter-actions">
        <button
          className="rpt-btn rpt-btn-filter-apply"
          type="button"
          onClick={handleApply}
        >
          Aplicar
        </button>

        <button
          className="rpt-btn rpt-btn-filter-clear"
          type="button"
          onClick={handleClear}
        >
          Limpar
        </button>
      </div>
    </>
  )

  return (
    <ReportViewer
      empresa={empresa}
      title="RELATÓRIO DE MONITORES"
      subtitle="Inventário e gestão de monitores corporativos."
      emissionDate="18/09/2026"
      emissionTime="17:04:22"
      filtersText={filtersSummaryText}
      filterControls={filterControls}
      columns={columns}
      rows={filteredRows}
      firstPageCapacity={10}
      subsequentPageCapacity={10}
      onClose={onClose}
    />
  )
}

export default ReportShowcase
