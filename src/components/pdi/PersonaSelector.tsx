'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PersonaManifest } from '@/lib/pdi/personas'

interface PersonaSelectorProps {
  pdiId: string
  personas: PersonaManifest[]
  currentPersonaId: string
}

export function PersonaSelector({ pdiId, personas, currentPersonaId }: PersonaSelectorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function selectPersona(personaId: string) {
    if (loading) return
    setLoading(personaId)

    try {
      const response = await fetch(`/api/pdi/${pdiId}/persona`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId }),
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.error === 'PERSONA_LOCKED') {
          alert('A modalidade não pode ser alterada após o início da jornada.')
          return
        }
        throw new Error(error.message || 'Erro ao selecionar modalidade')
      }

      router.push(`/pdi/${pdiId}/phase-1-diagnostico`)
      router.refresh()
    } catch {
      alert('Erro ao salvar a modalidade. Tente novamente.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="hub-section" style={{ maxWidth: 880, width: '100%' }}>
      <div className="hub-header">
        <div
          className="logo"
          style={{ justifyContent: 'center', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <div className="logo-mark">PDI</div>
          <div className="logo-text">PDI Builder</div>
        </div>
        <h1 className="hub-title">Escolha a modalidade do seu PDI</h1>
        <p className="hub-subtitle">
          Selecione como quer construir seu Plano de Desenvolvimento Individual. Você pode escolher um caminho
          mais rápido e operacional, ou um diagnóstico profundo com triangulação de mercado.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginTop: 32,
        }}
      >
        {personas.map((persona) => {
          const isActive = persona.id === currentPersonaId
          const isLoadingThis = loading === persona.id

          return (
            <button
              key={persona.id}
              onClick={() => selectPersona(persona.id)}
              disabled={loading !== null}
              style={{
                border: `2px solid ${isActive ? 'var(--color-brand-500, #3b82f6)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                background: isActive ? 'var(--color-info-light, #eff6ff)' : '#fff',
                padding: '28px 24px',
                textAlign: 'left',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && !isLoadingThis ? 0.6 : 1,
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.15)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
                  {persona.displayName}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-bg-muted)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                    marginLeft: 8,
                  }}
                >
                  {persona.estimatedTime}
                </span>
              </div>

              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {persona.shortDescription}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 20,
                }}
              >
                <span>Assistente:</span>
                <strong style={{ color: 'var(--color-text-secondary)' }}>{persona.assistantName}</strong>
              </div>

              <div
                className={`btn primary`}
                style={{
                  display: 'inline-block',
                  pointerEvents: 'none',
                  fontSize: 'var(--font-size-sm)',
                  padding: '9px 20px',
                }}
              >
                {isLoadingThis
                  ? 'Configurando...'
                  : isActive
                    ? 'Selecionado ✓'
                    : 'Selecionar esta modalidade'}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
