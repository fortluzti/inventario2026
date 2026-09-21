/**
 * FortLuzLogo: Logo institucional da FortLuz Materiais Elétricos em SVG vetorial
 */
export function FortLuzLogo({ width = 160, height = 48, compact = false }) {
  if (compact) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 140 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <g fontStyle="italic" fontWeight="900" fontFamily="'IBM Plex Sans', sans-serif">
          <text x="0" y="24" fontSize="22" fill="#0d1c2e" letterSpacing="-1">FORT</text>
          {/* Raio estilizado */}
          <polygon points="62,4 74,4 66,16 75,16 57,34 62,20 54,20" fill="#f59e0b" stroke="#b91c1c" strokeWidth="1" />
          <text x="76" y="24" fontSize="22" fill="#b91c1c" letterSpacing="-1">LUZ</text>
        </g>
      </svg>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 170 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <g fontStyle="italic" fontWeight="900" fontFamily="'IBM Plex Sans', sans-serif">
        <text x="2" y="32" fontSize="28" fill="#0d1c2e" letterSpacing="-1.5">FORT</text>
        {/* Raio centralizado entre FORT e LUZ */}
        <polygon points="76,6 90,6 80,20 92,20 68,44 75,26 64,26" fill="#f59e0b" stroke="#b91c1c" strokeWidth="1.2" />
        <text x="94" y="32" fontSize="28" fill="#b91c1c" letterSpacing="-1.5">LUZ</text>
      </g>
      <text
        x="6"
        y="46"
        fontSize="7"
        fontWeight="700"
        fontStyle="normal"
        letterSpacing="2.5"
        fill="#475569"
        fontFamily="'IBM Plex Sans', sans-serif"
      >
        MATERIAIS ELÉTRICOS
      </text>
    </svg>
  )
}

export default FortLuzLogo
