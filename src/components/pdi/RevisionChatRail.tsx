'use client'

import { useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { PdiVersionDiff } from '@/types/pdi'

const DIFF_STATUS_LABELS: Record<PdiVersionDiff['status'], string> = {
  updated: 'ALTERADA',
  added: 'ADICIONADA',
  unchanged: 'SEM MUDANÇA',
}

const DIFF_STATUS_BADGE: Record<PdiVersionDiff['status'], string> = {
  updated: 'warning',
  added: 'success',
  unchanged: 'info',
}

interface RevisionChatRailProps {
  pdiId: string
  initialSummary?: string | null
}

export function RevisionChatRail({
  pdiId,
  initialSummary,
}: RevisionChatRailProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState(initialSummary || '')
  const [diff, setDiff] = useState<PdiVersionDiff[]>([])
  const [revisionVersion, setRevisionVersion] = useState<number | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  async function requestReview() {
    if (!input.trim() || isLoading) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/pdi/${pdiId}/pdi/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request: input.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao gerar revisão.')
      }

      setSummary(data.summary)
      setDiff(data.diff)
      setRevisionVersion(data.toVersion ?? null)
      setInput('')
    } catch (error) {
      setSummary(
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao solicitar revisão.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    if (event.nativeEvent.isComposing) return

    event.preventDefault()
    void requestReview()
  }

  function handleApprove() {
    setIsApproving(true)
    router.push(`/pdi/${pdiId}/phase-5-final/entregaveis`)
    router.refresh()
  }

  function handleReject() {
    setSummary('')
    setDiff([])
    setRevisionVersion(null)
  }

  const hasPendingRevision = diff.length > 0 || (revisionVersion !== null)
  const updatedSections = diff.filter((item) => item.status !== 'unchanged')

  return (
    <aside className="panel chat">
      <header className="chat-header">
        <div className="chat-title-row">
          <div className="chat-title">Mentoria de Carreira</div>
          <span className="phase-pill">Pós-PDI</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '100%' }}></div>
        </div>
        <span className="progress-text">
          {hasPendingRevision
            ? `v${revisionVersion ?? '?'} gerada · aguardando aprovação`
            : 'Solicite ajustes via chat'}
        </span>
      </header>
      <section className="chat-stream">
        {summary ? (
          <article className="chat-message">
            <div className="chat-avatar ai">AI</div>
            <div className="chat-bubble" style={{ whiteSpace: 'pre-line' }}>
              <span className="chat-author">Mentor Executivo</span>
              {summary}
            </div>
          </article>
        ) : (
          <article className="chat-message">
            <div className="chat-avatar ai">AI</div>
            <div className="chat-bubble" style={{ whiteSpace: 'pre-line' }}>
              <span className="chat-author">Mentor Executivo</span>
              {initialSummary
                ? initialSummary
                : 'PDI finalizado. Descreva o ajuste que deseja aplicar no documento e gere uma nova versão com consistência garantida.'}
            </div>
          </article>
        )}

        {updatedSections.map((item) => (
          <article className="chat-message" key={item.section}>
            <div className="chat-avatar ai">AI</div>
            <div className="chat-bubble">
              <span className="chat-author">
                Seção {item.section} · <span className={`badge ${DIFF_STATUS_BADGE[item.status]}`}>{DIFF_STATUS_LABELS[item.status]}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'block', marginTop: 4 }}>
                {item.after.slice(0, 120)}{item.after.length > 120 ? '...' : ''}
              </span>
            </div>
          </article>
        ))}

        {hasPendingRevision ? (
          <article className="chat-message">
            <div className="chat-avatar ai">AI</div>
            <div className="chat-bubble">
              <span className="chat-author">Ação necessária</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  className="btn secondary"
                  onClick={handleReject}
                  disabled={isApproving}
                  style={{ flex: 1 }}
                >
                  Rejeitar v{revisionVersion ?? '?'}
                </button>
                <button
                  className="btn primary"
                  onClick={handleApprove}
                  disabled={isApproving}
                  style={{ flex: 1 }}
                >
                  {isApproving ? 'Aprovando...' : `Aprovar v${revisionVersion ?? '?'}`}
                </button>
              </div>
            </div>
          </article>
        ) : null}
      </section>
      <footer className="chat-composer">
        <textarea
          className="chat-input"
          placeholder="Descreva o ajuste que deseja aplicar..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={isLoading}
        ></textarea>
        <div className="chat-cta">
          <button className="btn primary" onClick={requestReview} disabled={isLoading || !input.trim()}>
            {isLoading ? 'Processando...' : 'Solicitar ajuste'}
          </button>
        </div>
      </footer>
    </aside>
  )
}
