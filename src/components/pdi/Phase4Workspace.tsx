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

function statusBadge(status: PdiSectionStatus) {
  if (status === 'completed') return <span className="badge success">CONCLUÍDA</span>
  if (status === 'processing') return <span className="badge warning">PROCESSANDO</span>
  if (status === 'error') return <span className="badge error">ERRO</span>
  return <span className="badge info">NA FILA</span>
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
  const [expandedSections, setExpandedSections] = useState<Set<PdiSectionKey>>(new Set())

  function toggleSection(section: PdiSectionKey) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

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
      const response = await fetch(`/api/pdi/${pdiId}/pdi/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing }),
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
        <div className="workspace-breadcrumb">Fase 4 · Execução incremental por seções</div>
        <h1 className="workspace-title">
          {mode === 'inicio'
            ? 'PDI aparecendo por seção, em tempo real'
            : mode === 'avancado'
              ? 'Quase pronto: falta apenas a seção 4.7'
              : 'Documento 4.1-4.7 consolidado para o usuário'}
        </h1>
        <p className="workspace-subtitle">
          Processamento interno com uma chamada por seção (4.1 a 4.7) e exibição incremental no painel.
        </p>
      </header>

      <section className="workspace-body">
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Orquestração de geração</h2>
          </div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="data-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Seção</th>
                    <th>Status</th>
                    <th>Conteúdo no painel</th>
                  </tr>
                </thead>
                <tbody>
                  {PDI_SECTION_ORDER.map((section) => (
                    <tr key={section}>
                      <td>{section}</td>
                      <td>{statusBadge(sectionStatus[section])}</td>
                      <td>{sections[section] ? 'Publicado para o usuário' : 'Aguardando geração'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="callout info" style={{ marginTop: 12 }}>
              Progresso atual: {completedCount}/7 ({progress}%).
            </div>
          </div>
        </article>

        {mode !== 'consolidado' ? (
          <article className="card">
            <div className="card-header">
              <h2 className="card-title">Contexto adicional (opcional)</h2>
            </div>
            <div className="card-body">
              <textarea
                className="chat-input"
                value={briefing}
                onChange={(event) => setBriefing(event.target.value)}
                placeholder="Adicione detalhes que o mentor ainda não sabe: restrições da empresa, budget para cursos, projetos prioritários, prazos específicos..."
              ></textarea>
              <div className="chat-cta">
                <button className="btn primary" onClick={startGeneration} disabled={isGenerating}>
                  {isGenerating ? 'Gerando...' : 'Gerar PDI completo (4.1 a 4.7)'}
                </button>
              </div>
              {errorMessage ? (
                <div className="callout error" style={{ marginTop: 12 }}>
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </article>
        ) : null}

        {PDI_SECTION_ORDER.map((section) => {
          const content = sections[section]
          if (!content) return null
          const isExpanded = expandedSections.has(section)
          return (
            <article className="card" key={section}>
              <div
                className="card-header"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSection(section)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    {section} · {SECTION_LABELS[section]}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge success">CONCLUÍDA</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                      {isExpanded ? '▲ recolher' : '▼ expandir'}
                    </span>
                  </div>
                </div>
              </div>
              {isExpanded ? (
                <div className="card-body">
                  <MarkdownContent content={content} />
                </div>
              ) : null}
            </article>
          )
        })}

        {mode === 'consolidado' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0 16px' }}>
            <button
              className="btn primary"
              onClick={() => router.push(`/pdi/${pdiId}/phase-5-final/entregaveis`)}
            >
              Ver Entregáveis Finais →
            </button>
          </div>
        ) : null}
      </section>
    </>
  )
}
