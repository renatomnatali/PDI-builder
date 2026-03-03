'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface PhaseAdvanceButtonProps {
  pdiId: string
  phase: 'PHASE_1_DIAGNOSTICO' | 'PHASE_2_ADAPTATIVO' | 'PHASE_3_DIRECAO'
  label: string
}

export function PhaseAdvanceButton({ pdiId, phase, label }: PhaseAdvanceButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    if (isLoading) return
    setIsLoading(true)

    try {
      const response = await fetch(`/api/pdi/${pdiId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, message: 'sim' }),
      })

      const data = await response.json()

      if (typeof data.nextScreen === 'string' && data.nextScreen.trim().length > 0) {
        router.push(`/pdi/${pdiId}/${data.nextScreen}`)
        router.refresh()
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button className="btn primary" onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Aguardando...' : label}
    </button>
  )
}
