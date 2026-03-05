'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PDI_SECTION_ORDER,
  type PdiSectionKey,
  type PdiSectionStatus,
  type PdiSectionsMap,
} from '@/lib/pdi/orchestrator'
import { MarkdownContent } from './MarkdownContent'

const SECTION_LABELS: Record<PdiSectionKey, string> = {
  '4.1': 'OKRs',
  '4.2': 'Plano 30-60-90',
  '4.3': 'Roadmap Trimestral',
  '4.4': 'Matriz de Competências',
  '4.5': 'Mapa de Stakeholders',
  '4.6': 'Métricas e Rituais',
  '4.7': 'Gestão de Riscos',
}

type Phase4Mode = 'inicio' | 'avancado' | 'consolidado'

interface StreamEvent {
  type: 'section_started' | 'section_completed' | 'section_error' | 'document_completed'
  section?: PdiSectionKey
  content?: string
  message?: string
  document?: {
    mergedContent: string
  }
}

interface Phase4WorkspaceProps {
  pdiId: string
  mode: Phase4Mode
  initialSections?: PdiSectionsMap
  initialMergedDocument?: string
}

function createInitialStatus(
  initialSections: PdiSectionsMap
): Record<PdiSectionKey, PdiSectionStatus> {
  return {
    '4.1': initialSections['4.1'] ? 'completed' : 'pending',
    '4.2': initialSections['4.2'] ? 'completed' : 'pending',
    '4.3': initialSections['4.3'] ? 'completed' : 'pending',
    '4.4': initialSections['4.4'] ? 'completed' : 'pending',
    '4.5': initialSections['4.5'] ? 'completed' : 'pending',
    '4.6': initialSections['4.6'] ? 'completed' : 'pending',
    '4.7': initialSections['4.7'] ? 'completed' : 'pending',
  }
}

export function Phase4Workspace({
  pdiId,
  mode,
  initialSections = {},
  initialMergedDocument = '',
}: Phase4WorkspaceProps) {
  const router = useRouter()
  const [briefing, setBriefing] = useState('')
  const [sections, setSections] = useState<PdiSectionsMap>(initialSections)
  const [sectionStatus, setSectionStatus] = useState<Record<PdiSectionKey, PdiSectionStatus>>(
    createInitialStatus(initialSections)
  )
  const [, setMergedDocument] = useState(initialMergedDocument)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const completedCount = useMemo(
    () =>
      PDI_SECTION_ORDER.filter((section) => sectionStatus[section] === 'completed')
        .length,
    [sectionStatus]
  )

  const progress = Math.round((completedCount / PDI_SECTION_ORDER.length) * 100)

  const applyEvent = (event: StreamEvent) => {
    if (event.type === 'section_started' && event.section) {
      setSectionStatus((prev) => ({ ...prev, [event.section as PdiSectionKey]: 'processing' }))
      return
    }

    if (event.type === 'section_completed' && event.section && event.content) {
      setSections((prev) => ({ ...prev, [event.section as PdiSectionKey]: event.content as string }))
      setSectionStatus((prev) => ({ ...prev, [event.section as PdiSectionKey]: 'completed' }))
      return
    }

    if (event.type === 'section_error' && event.section) {
      setSectionStatus((prev) => ({ ...prev, [event.section as PdiSectionKey]: 'error' }))
      setErrorMessage(event.message || `Falha ao gerar seção ${event.section}.`)
      return
    }

    if (event.type === 'document_completed') {
      setMergedDocument(event.document?.mergedContent || '')
    }
  }

  async function startGeneration() {
    if (isGenerating) return

    setErrorMessage(null)
    setIsGenerating(true)

    try {
      // Não envia `briefing` se estiver vazio — o schema Zod exige min(1) quando presente
      const briefingTrimmed = briefing.trim()
      const response = await fetch(`/api/pdi/${pdiId}/pdi/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefingTrimmed ? { briefing: briefingTrimmed } : {}),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao iniciar geração do PDI.')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Fluxo de geração indisponível.')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''

        for (const chunk of chunks) {
          const lines = chunk.split('\n')
          const eventType = lines.find((line) => line.startsWith('event: '))?.replace('event: ', '').trim()
          const dataLine = lines.find((line) => line.startsWith('data: '))?.replace('data: ', '').trim()

          if (!eventType || !dataLine) continue

          const parsed: StreamEvent = JSON.parse(dataLine)
          applyEvent({
            ...parsed,
            type: eventType as StreamEvent['type'],
          })
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro inesperado na geração.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-breadcrumb">Fase 4 · PDI Completo</div>
        <h1 className="workspace-title">
          {mode === 'consolidado'
            ? 'PDI completo gerado — revise e prossiga'
            : isGenerating
              ? 'Gerando seu PDI em tempo real…'
              : completedCount > 0
                ? `${completedCount} de 7 seções prontas — continue a geração`
                : 'Pronto para gerar seu PDI personalizado'}
        </h1>
        <p className="workspace-subtitle">
          {mode === 'consolidado'
            ? 'Todas as 7 seções foram geradas. Expanda qualquer seção para revisar antes de prosseguir para os entregáveis.'
            : 'O PDI é construído seção por seção, em tempo real, com base no diagnóstico e na direção confirmada.'}
        </p>
      </header>

      <section className="workspace-body">
        {/* Barra de progresso compacta */}
        <div className="card card-process" style={{ padding: '12px 16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>Seções geradas</span>
            <strong style={{ color: completedCount === 7 ? 'var(--color-brand-600)' : 'inherit' }}>
              {completedCount} de 7
            </strong>
          </div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Contexto adicional — colapsável via <details> nativo */}
        {mode !== 'consolidado' ? (
          <details className="card">
            <summary>
              <span>Contexto adicional <em style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(opcional)</em></span>
            </summary>
            <div className="card-body">
              <textarea
                className="chat-input"
                value={briefing}
                onChange={(event) => setBriefing(event.target.value)}
                placeholder="Adicione detalhes que o mentor ainda não sabe: restrições da empresa, budget para cursos, projetos prioritários, prazos específicos…"
              ></textarea>
            </div>
          </details>
        ) : null}

        {/* Mensagem de erro */}
        {errorMessage ? (
          <div className="callout error">{errorMessage}</div>
        ) : null}

        {/* Cards das seções — colapsáveis quando concluídas */}
        {PDI_SECTION_ORDER.map((section) => {
          const content = sections[section]
          const status = sectionStatus[section]

          if (status === 'completed' && content) {
            return (
              <details key={section} className="card">
                <summary>
                  <span>{section} · {SECTION_LABELS[section]}</span>
                  <span className="badge success" style={{ marginLeft: 'auto' }}>CONCLUÍDA</span>
                </summary>
                <div className="card-body">
                  <MarkdownContent content={content} />
                </div>
              </details>
            )
          }

          if (status === 'processing') {
            return (
              <div key={section} className="card card-process">
                <div
                  className="card-header"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <h3 className="card-title" style={{ margin: 0 }}>{section} · {SECTION_LABELS[section]}</h3>
                  <span className="badge processando">GERANDO</span>
                </div>
                <div
                  className="card-body"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}
                >
                  <span className="spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
                  <span>Gerando seção…</span>
                </div>
              </div>
            )
          }

          if (status === 'error') {
            return (
              <div key={section} className="card">
                <div
                  className="card-header"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <h3 className="card-title" style={{ margin: 0 }}>{section} · {SECTION_LABELS[section]}</h3>
                  <span className="badge error">ERRO</span>
                </div>
              </div>
            )
          }

          /* pending — exibe enquanto geração estiver em andamento */
          if (isGenerating) {
            return (
              <div key={section} className="card card-process" style={{ opacity: 0.5 }}>
                <div
                  className="card-header"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <h3 className="card-title" style={{ margin: 0 }}>{section} · {SECTION_LABELS[section]}</h3>
                  <span className="badge info">NA FILA</span>
                </div>
              </div>
            )
          }

          return null
        })}
      </section>

      {/* Barra CTA sticky */}
      {mode === 'consolidado' ? (
        <div className="workspace-cta-bar">
          <button
            className="btn primary"
            onClick={() => router.push(`/pdi/${pdiId}/phase-5-final/entregaveis`)}
          >
            Ver Entregáveis Finais →
          </button>
        </div>
      ) : isGenerating ? (
        <div className="workspace-cta-bar">
          <span className="cta-hint">{completedCount} de 7 seções concluídas</span>
          <button className="btn primary" disabled aria-busy="true">
            <span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true" />
            Gerando…
          </button>
        </div>
      ) : (
        <div className="workspace-cta-bar">
          {completedCount > 0 ? (
            <span className="cta-hint">{completedCount}/7 seções geradas · retomar geração</span>
          ) : null}
          <button className="btn primary" onClick={startGeneration}>
            {completedCount > 0 ? 'Continuar geração' : 'Gerar PDI completo →'}
          </button>
        </div>
      )}
    </>
  )
}
