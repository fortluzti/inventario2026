import { useState, useCallback, useRef } from 'react'

export function limparCEP(cep) {
  return (cep || '').replace(/\D/g, '')
}

export function formatarCEP(cep) {
  const digits = limparCEP(cep)
  if (digits.length <= 5) return digits
  if (digits.length <= 8) return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

export const useCep = (onFillAddress) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  const fetchCep = useCallback(
    async (cepRaw) => {
      const cep = limparCEP(cepRaw)
      setError(null)

      if (cep.length < 8) {
        return
      }

      clearTimeout(debounceRef.current)

      return new Promise((resolve) => {
        debounceRef.current = setTimeout(async () => {
          setLoading(true)
          try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
            const data = await res.json()

            if (data.erro || !data.localidade) {
              const msg = data.erro ? 'CEP não encontrado' : 'Não foi possível localizar este CEP'
              setError(msg)
              resolve(null)
            } else {
              const endereco = {
                logradouro: data.logradouro || '',
                bairro: data.bairro || '',
                cidade: data.localidade || '',
                estado: data.uf || '',
                cep: data.cep || '',
              }
              onFillAddress?.(endereco)
              resolve(endereco)
            }
          } catch (e) {
            setError('Erro ao buscar CEP')
            resolve(null)
          } finally {
            setLoading(false)
          }
        }, 500)
      })
    },
    [onFillAddress]
  )

  const clear = useCallback(() => {
    clearTimeout(debounceRef.current)
    setError(null)
    setLoading(false)
  }, [])

  return { fetchCep, loading, error, clear, limparCEP, formatarCEP }
}
