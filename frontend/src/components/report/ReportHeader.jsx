import { hasLogo, logoUrl } from '../../api/configuracoes.js'
import { FortLuzLogo } from './FortLuzLogo.jsx'

export function ReportHeader({ empresa }) {
  const logoSrc = empresa && hasLogo(empresa) ? logoUrl(empresa.empresa_logo) : ''
  const nomeEmpresa = empresa?.empresa_nome || 'Fort Luz Materiais Eletricas Ltda'
  const cnpj = empresa?.empresa_cnpj ? `CNPJ: ${empresa.empresa_cnpj}` : 'CNPJ: 01.146.886/0001-49'

  const enderecoParts = [
    empresa?.empresa_logradouro || 'Avenida Nossa Senhora da Paz',
    empresa?.empresa_numero ? `${empresa.empresa_numero}` : '2275',
    empresa?.empresa_cidade ? `${empresa.empresa_cidade}, ${empresa.empresa_estado || 'SP'}` : 'São José do Rio Preto, SP'
  ].filter(Boolean)
  const enderecoStr = enderecoParts.join(', ')

  const tel = empresa?.empresa_telefone || '(17) 3215-9455'
  const email = empresa?.empresa_email || 'ti@fortluz.com.br'
  const contatoStr = `Contato: ${tel} | ${email}`

  return (
    <header className="rpt-header-inst">
      <div className="rpt-logo-wrap">
        {logoSrc ? (
          <img src={logoSrc} alt={nomeEmpresa} className="rpt-logo" />
        ) : (
          <FortLuzLogo width={165} height={46} />
        )}
      </div>

      <div className="rpt-empresa-info">
        <span className="rpt-empresa-nome">{nomeEmpresa}</span>
        <span className="rpt-empresa-cnpj">{cnpj}</span>
        <span className="rpt-empresa-endereco">{enderecoStr}</span>
        <span className="rpt-empresa-contato">{contatoStr}</span>
      </div>
    </header>
  )
}

export function ReportHeaderContinuation({ empresa, title = 'Relatório de Monitores' }) {
  const nomeEmpresa = empresa?.empresa_nome || 'Fort Luz Materiais Eletricas Ltda'
  const logoSrc = empresa && hasLogo(empresa) ? logoUrl(empresa.empresa_logo) : ''

  return (
    <header className="rpt-header-cont">
      <div className="rpt-header-cont-left">
        {logoSrc ? (
          <img src={logoSrc} alt={nomeEmpresa} className="rpt-logo rpt-logo-cont" />
        ) : (
          <FortLuzLogo width={90} height={24} compact />
        )}
        <div className="rpt-header-cont-title">
          <span className="rpt-header-cont-name">{title}</span>
          <span className="rpt-header-cont-tag">(Continuação)</span>
        </div>
      </div>
      <div className="rpt-header-cont-right">
        <span className="rpt-company-name-cont">{nomeEmpresa}</span>
      </div>
    </header>
  )
}

export default ReportHeader
