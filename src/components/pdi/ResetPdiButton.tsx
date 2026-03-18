'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ResetPdiButtonProps {
  pdiId: string
}

export function ResetPdiButton({ pdiId }: ResetPdiButtonProps) {
  const router = useRouter()
  const [isResetting, setIsResetting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirmReset() {
    if (isResetting) return

    setIsResetting(true)
    setError(null)

    try {
      const response = await fetch(`/api/pdi/${pdiId}/reset`, {
        method: 'POST',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao resetar o PDI.')
      }

      router.push(`/pdi/${pdiId}/escolher-modo`)
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao resetar o PDI.'
      )
    } finally {
      setIsResetting(false)
      setConfirming(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {!confirming ? (
        <button
          className="btn secondary"
          onClick={() => {
            setError(null)
            setConfirming(true)
          }}
          disabled={isResetting}
        >
          Reset
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            Isso apaga conversas e documentos para retestar desde o início.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => setConfirming(false)} disabled={isResetting}>
              Cancelar
            </button>
            <button className="btn primary" onClick={onConfirmReset} disabled={isResetting}>
              {isResetting ? 'Resetando...' : 'Confirmar reset'}
            </button>
          </div>
        </div>
      )}
      {error ? (
        <div style={{ fontSize: 11, color: 'var(--color-error)' }}>{error}</div>
      ) : null}
    </div>
  )
}
