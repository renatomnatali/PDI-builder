import {
  getPhase1AnchorQuestionsMessage,
  getPhase2BranchGateQuestionMessage,
} from '@/lib/pdi/chat-engine'
import { isStructuredPhaseOutput } from '@/lib/pdi/structured-output'
import { PDI_SECTION_ORDER, type PdiSectionKey } from '@/lib/pdi/orchestrator'
import { MarkdownContent } from './MarkdownContent'
import { PhaseAdvanceButton } from './PhaseAdvanceButton'
import { PdiShell } from './PdiShell'
import { PhaseChatRail } from './PhaseChatRail'
import { RevisionChatRail } from './RevisionChatRail'
import { Phase4Workspace } from './Phase4Workspace'
import { Phase4ChatRail } from './Phase4ChatRail'

const SECTION_LABELS: Record<PdiSectionKey, string> = {
  '4.1': 'OKRs',
  '4.2': 'Plano 30-60-90',
  '4.3': 'Roadmap Trimestral',
  '4.4': 'Competências',
  '4.5': 'Stakeholders',
  '4.6': 'Métricas e Rituais',
  '4.7': 'Gestão de Riscos',
}

type ScreenKey =
  | 'phase-1-diagnostico'
  | 'phase-2-adaptativo'
  | 'phase-3-direcao'
  | 'phase-4-pdi/inicio'
  | 'phase-4-pdi/avancado'
  | 'phase-4-pdi/consolidado'
  | 'phase-5-final/entregaveis'
  | 'phase-5-final/revisao'

interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
}

interface ConversationPayload {
  phase: string
  messages: ChatMessage[]
}

interface PdiScreenProps {
  pdiId: string
  pdiName: string
  screen: ScreenKey
  sectionsMap: Record<string, string>
  mergedDocument: string
  latestRevisionSummary?: string | null
  conversations: ConversationPayload[]
  userProfile: {
    name?: string | null
    email?: string | null
    avatarUrl?: string | null
  }
}

function getConversationPhase(screen: ScreenKey) {
  if (screen === 'phase-1-diagnostico') return 'PHASE_1_DIAGNOSTICO'
  if (screen === 'phase-2-adaptativo') return 'PHASE_2_ADAPTATIVO'
  if (screen === 'phase-3-direcao') return 'PHASE_3_DIRECAO'
  if (screen === 'phase-5-final/entregaveis') return 'PHASE_5_FINAL'
  if (screen === 'phase-5-final/revisao') return 'PHASE_REVISAO'
  return null
}

function initialMessagesForScreen(
  screen: ScreenKey,
  conversations: ConversationPayload[]
): ChatMessage[] {
  const phase = getConversationPhase(screen)
  if (!phase) return []

  const conversation = conversations.find((item) => item.phase === phase)
  const messages = conversation?.messages || []

  if (screen === 'phase-1-diagnostico' && messages.length === 0) {
    return [
      {
        id: 'phase-1-anchor',
        role: 'ASSISTANT',
        content: getPhase1AnchorQuestionsMessage(),
      },
    ]
  }

  if (screen === 'phase-2-adaptativo' && messages.length === 0) {
    return [
      {
        id: 'phase-2-gate',
        role: 'ASSISTANT',
        content: getPhase2BranchGateQuestionMessage(),
      },
    ]
  }

  return messages
}

function latestStructuredAssistantMessageForPhase(
  conversations: ConversationPayload[],
  phase: string
): string | null {
  const conversation = conversations.find((item) => item.phase === phase)
  if (!conversation) return null

  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index]
    if (message.role !== 'ASSISTANT') continue
    if (!isStructuredPhaseOutput(message.content)) continue
    return message.content
  }

  return null
}

function sidebarForScreen(screen: ScreenKey, sectionsMap: Record<string, string>) {
  const isPhase1 = screen === 'phase-1-diagnostico'
  const isPhase2 = screen === 'phase-2-adaptativo'
  const isPhase3 = screen === 'phase-3-direcao'
  const isPhase4 = screen.startsWith('phase-4-pdi')
  const isPhase4Consolidado = screen === 'phase-4-pdi/consolidado'
  const isPhase5 = screen === 'phase-5-final/entregaveis'
  const isReview = screen === 'phase-5-final/revisao'

  const beforePhase4 = isPhase1 || isPhase2 || isPhase3

  return (
    <>
      <div className="nav-label">FASES</div>
      <div className={`nav-item ${isPhase1 ? 'active' : 'done'}`}>
        <span>1. Diagnóstico Âncora</span>
        <span className={`badge ${isPhase1 ? 'warning' : 'success'}`}>{isPhase1 ? 'ATUAL' : 'OK'}</span>
      </div>
      <div className={`nav-item ${isPhase2 ? 'active' : isPhase1 ? 'blocked' : 'done'}`}>
        <span>2. Diagnóstico Adaptativo</span>
        <span className={`badge ${isPhase2 ? 'warning' : isPhase1 ? 'info' : 'success'}`}>
          {isPhase2 ? 'ATUAL' : isPhase1 ? 'BLOQ' : 'OK'}
        </span>
      </div>
      <div className={`nav-item ${isPhase3 ? 'active' : isPhase1 || isPhase2 ? 'blocked' : 'done'}`}>
        <span>3. Hipótese de Direção</span>
        <span className={`badge ${isPhase3 ? 'warning' : isPhase1 || isPhase2 ? 'info' : 'success'}`}>
          {isPhase3 ? 'ATUAL' : isPhase1 || isPhase2 ? 'BLOQ' : 'OK'}
        </span>
      </div>
      <div className={`nav-item ${isPhase4 ? 'active' : beforePhase4 ? 'blocked' : 'done'}`}>
        <span>4. PDI Completo</span>
        <span className={`badge ${isPhase4 ? 'warning' : beforePhase4 ? 'info' : 'success'}`}>
          {isPhase4 ? 'ATUAL' : beforePhase4 ? 'BLOQ' : 'OK'}
        </span>
      </div>

      {isPhase4 ? (
        <>
          <div className="nav-label" style={{ paddingLeft: 8 }}>SEÇÕES</div>
          {PDI_SECTION_ORDER.map((section) => {
            const done = Boolean(sectionsMap[section])
            return (
              <div
                key={section}
                className={`nav-item ${done ? 'done' : 'blocked'}`}
                style={{ paddingLeft: 20 }}
              >
                <span>{section} · {SECTION_LABELS[section]}</span>
                <span className={`badge ${done ? 'success' : 'info'}`}>{done ? 'OK' : 'FILA'}</span>
              </div>
            )
          })}
        </>
      ) : null}

      <div className={`nav-item ${isPhase5 ? 'active' : isReview ? 'done' : isPhase4Consolidado ? 'active' : 'blocked'}`}>
        <span>5. Entregáveis Finais</span>
        <span className={`badge ${isPhase5 ? 'warning' : isReview ? 'success' : isPhase4Consolidado ? 'brand' : 'info'}`}>
          {isPhase5 ? 'ATUAL' : isReview ? 'OK' : isPhase4Consolidado ? 'PRÓXIMO' : 'BLOQ'}
        </span>
      </div>

      {isReview ? (
        <>
          <div className="nav-label">VERSÕES</div>
          <div className="nav-item done"><span>v1.0 · Documento formalizado</span><span className="badge success">BASE</span></div>
          <div className="nav-item active"><span>v1.1 · Ajuste solicitado</span><span className="badge warning">EM REVISÃO</span></div>
        </>
      ) : null}
    </>
  )
}

function workspaceForScreen(
  pdiId: string,
  screen: ScreenKey,
  sectionsMap: Record<string, string>,
  mergedDocument: string,
  phase1StructuredOutput: string | null,
  phase2StructuredOutput: string | null,
  phase3StructuredOutput: string | null,
  phase5StructuredOutput: string | null,
  latestRevisionSummary?: string | null
) {
  if (screen === 'phase-4-pdi/inicio') {
    return (
      <Phase4Workspace
        pdiId={pdiId}
        mode="inicio"
        initialSections={sectionsMap}
        initialMergedDocument={mergedDocument}
      />
    )
  }

  if (screen === 'phase-4-pdi/avancado') {
    return (
      <Phase4Workspace
        pdiId={pdiId}
        mode="avancado"
        initialSections={sectionsMap}
        initialMergedDocument={mergedDocument}
      />
    )
  }

  if (screen === 'phase-4-pdi/consolidado') {
    return (
      <Phase4Workspace
        pdiId={pdiId}
        mode="consolidado"
        initialSections={sectionsMap}
        initialMergedDocument={mergedDocument}
      />
    )
  }

  if (screen === 'phase-1-diagnostico') {
    return (
      <>
        <header className="workspace-header">
          <div className="workspace-breadcrumb">Fase 1 · Diagnóstico Âncora</div>
          <h1 className="workspace-title">Mapeamento do ponto de partida</h1>
          <p className="workspace-subtitle">
            A conversa no chat conduz as perguntas âncora e registra as respostas confirmadas desta sessão.
          </p>
        </header>
        <section className="workspace-body">
          {phase1StructuredOutput ? (
            <article className="card">
              <div className="card-header">
                <h2 className="card-title">Diagnóstico consolidado</h2>
              </div>
              <div className="card-body">
                <MarkdownContent content={phase1StructuredOutput} />
              </div>
              <div className="card-footer">
                <PhaseAdvanceButton
                  pdiId={pdiId}
                  phase="PHASE_1_DIAGNOSTICO"
                  label="Avançar para o Diagnóstico Adaptativo →"
                />
              </div>
            </article>
          ) : null}
          <article className="card">
            <div className="card-header"><h2 className="card-title">Como esta fase funciona</h2></div>
            <div className="card-body">
              <div className="callout info">
                O assistente conduz as 4 perguntas iniciais, uma por vez, diretamente no chat. Responda no painel à direita para seguir para a fase adaptativa.
              </div>
            </div>
          </article>
        </section>
      </>
    )
  }

  if (screen === 'phase-2-adaptativo') {
    return (
      <>
        <header className="workspace-header">
          <div className="workspace-breadcrumb">Fase 2 · Diagnóstico Adaptativo</div>
          <h1 className="workspace-title">Classificação do ramo e perguntas dinâmicas</h1>
          <p className="workspace-subtitle">O mentor analisa seu obstáculo e aprofunda com perguntas específicas do padrão identificado.</p>
        </header>
        <section className="workspace-body">
          {phase2StructuredOutput ? (
            <article className="card">
              <div className="card-header">
                <h2 className="card-title">Diagnóstico adaptativo consolidado</h2>
              </div>
              <div className="card-body">
                <MarkdownContent content={phase2StructuredOutput} />
              </div>
              <div className="card-footer">
                <PhaseAdvanceButton
                  pdiId={pdiId}
                  phase="PHASE_2_ADAPTATIVO"
                  label="Avançar para a Hipótese de Direção →"
                />
              </div>
            </article>
          ) : (
            <article className="card">
              <div className="card-header"><h2 className="card-title">Em andamento</h2></div>
              <div className="card-body">
                <div className="callout info">
                  O mentor está identificando o padrão do seu obstáculo e conduzindo as perguntas específicas no chat. O diagnóstico consolidado aparecerá aqui ao final desta fase.
                </div>
              </div>
            </article>
          )}
        </section>
      </>
    )
  }

  if (screen === 'phase-3-direcao') {
    return (
      <>
        <header className="workspace-header">
          <div className="workspace-breadcrumb">Fase 3 · Hipótese de Direção</div>
          <h1 className="workspace-title">Síntese estratégica e escolha de caminho</h1>
          <p className="workspace-subtitle">O mentor sintetiza o diagnóstico, mapeia caminhos possíveis e apresenta uma recomendação fundamentada.</p>
        </header>
        <section className="workspace-body">
          {phase3StructuredOutput ? (
            <article className="card">
              <div className="card-header">
                <h2 className="card-title">Direção estratégica</h2>
              </div>
              <div className="card-body">
                <MarkdownContent content={phase3StructuredOutput} />
              </div>
              <div className="card-footer">
                <PhaseAdvanceButton
                  pdiId={pdiId}
                  phase="PHASE_3_DIRECAO"
                  label="Confirmar direção e gerar PDI completo →"
                />
              </div>
            </article>
          ) : (
            <article className="card">
              <div className="card-header"><h2 className="card-title">Em andamento</h2></div>
              <div className="card-body">
                <div className="callout info">
                  O mentor está elaborando a síntese do seu diagnóstico e os caminhos possíveis. A direção estratégica recomendada aparecerá aqui para você confirmar ou ajustar via chat.
                </div>
              </div>
            </article>
          )}
        </section>
      </>
    )
  }

  if (screen === 'phase-5-final/entregaveis') {
    return (
      <>
        <header className="workspace-header">
          <div className="workspace-breadcrumb">Fase 5 · Entregáveis finais</div>
          <h1 className="workspace-title">Pacote final de formalização do PDI</h1>
          <p className="workspace-subtitle">Checklist operacional, autoavaliação, alinhamento com gestor e one-pager.</p>
        </header>
        <section className="workspace-body">
          {phase5StructuredOutput ? (
            <article className="card">
              <div className="card-header">
                <h2 className="card-title">Entregáveis Consolidados</h2>
              </div>
              <div className="card-body">
                <MarkdownContent content={phase5StructuredOutput} />
              </div>
            </article>
          ) : null}
          <article className="card">
            <div className="card-header"><h2 className="card-title">Checklist dos próximos 7 dias</h2></div>
            <div className="card-body">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Agendar reunião de formalização com gestora.</li>
                <li>Enviar one-pager com os 3 OKRs principais.</li>
                <li>Publicar primeiro update executivo.</li>
                <li>Mapear stakeholders prioritários.</li>
                <li>Bloquear horas semanais de desenvolvimento.</li>
              </ul>
            </div>
          </article>
          <article className="card">
            <div className="card-header"><h2 className="card-title">One-pager executivo</h2></div>
            <div className="card-body">
              <div className="callout success">Documento sintetizado pronto para colar no sistema de RH.</div>
            </div>
          </article>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-breadcrumb">Pós-PDI · Revisões via chat</div>
        <h1 className="workspace-title">Comparativo entre versão atual e proposta</h1>
        <p className="workspace-subtitle">Solicite ajustes e gere nova versão mantendo consistência entre seções.</p>
      </header>
      <section className="workspace-body">
        {latestRevisionSummary ? (
          <article className="card">
            <div className="card-header"><h2 className="card-title">Resumo das mudanças aplicadas</h2></div>
            <div className="card-body">
              <MarkdownContent content={latestRevisionSummary} />
            </div>
          </article>
        ) : (
          <article className="card">
            <div className="card-header"><h2 className="card-title">Resumo das mudanças de versão</h2></div>
            <div className="card-body">
              <div className="callout info">
                Solicite ajustes via chat. As alterações são aplicadas no documento inteiro e registradas com diff auditável por seção.
              </div>
            </div>
          </article>
        )}
      </section>
    </>
  )
}

function chatForScreen(
  pdiId: string,
  screen: ScreenKey,
  conversations: ConversationPayload[],
  userProfile: PdiScreenProps['userProfile'],
  latestRevisionSummary?: string | null
) {
  if (screen.startsWith('phase-4-pdi')) {
    const progress = screen === 'phase-4-pdi/inicio' ? 43 : screen === 'phase-4-pdi/avancado' ? 86 : 100
    const text =
      screen === 'phase-4-pdi/consolidado'
        ? '7 de 7 seções concluídas · documento consolidado'
        : screen === 'phase-4-pdi/avancado'
          ? '6 de 7 seções prontas · aguardando 4.7 para consolidar'
          : '3 de 7 seções prontas · seção 4.4 em processamento'

    return (
      <Phase4ChatRail
        progress={progress}
        text={text}
        placeholder="Peça ajustes nas seções já concluídas enquanto as demais processam..."
      />
    )
  }

  if (screen === 'phase-5-final/revisao') {
    return <RevisionChatRail pdiId={pdiId} initialSummary={latestRevisionSummary} />
  }

  const config =
    screen === 'phase-1-diagnostico'
      ? {
          phase: 'PHASE_1_DIAGNOSTICO' as const,
          phaseLabel: 'Fase 1/5',
          progress: 20,
          progressText: 'Diagnóstico âncora em andamento',
          placeholder: 'Responda as perguntas da fase 1...',
          ctaPrimary: 'Enviar respostas',
          promoteStructuredAssistantOutputToWorkspace: true,
          advancePhase: 'PHASE_1_DIAGNOSTICO' as const,
          advanceLabel: 'Avançar para o Diagnóstico Adaptativo →',
        }
      : screen === 'phase-2-adaptativo'
        ? {
            phase: 'PHASE_2_ADAPTATIVO' as const,
            phaseLabel: 'Fase 2/5',
            progress: 38,
            progressText: 'Diagnóstico adaptativo com triangulação de mercado',
            placeholder: 'Responda ao mentor...',
            ctaPrimary: 'Enviar',
            promoteStructuredAssistantOutputToWorkspace: true,
            advancePhase: 'PHASE_2_ADAPTATIVO' as const,
            advanceLabel: 'Avançar para a Hipótese de Direção →',
          }
        : screen === 'phase-3-direcao'
          ? {
              phase: 'PHASE_3_DIRECAO' as const,
              phaseLabel: 'Fase 3/5',
              progress: 54,
              progressText: 'Hipótese de direção pronta para validação',
              placeholder: 'Confirme o caminho estratégico ou peça ajustes...',
              ctaPrimary: 'Enviar',
              ctaSecondary: 'Ajustar direção',
              promoteStructuredAssistantOutputToWorkspace: true,
              advancePhase: 'PHASE_3_DIRECAO' as const,
              advanceLabel: 'Confirmar direção e gerar PDI completo →',
            }
          : {
              phase: 'PHASE_5_FINAL' as const,
              phaseLabel: 'Fase 5/5',
              progress: 100,
              progressText: 'Entregáveis finais prontos para formalização',
              placeholder: 'Peça ajustes no checklist, OKRs ou one-pager...',
              ctaPrimary: 'Solicitar ajuste',
              ctaSecondary: 'Exportar PDF',
              promoteStructuredAssistantOutputToWorkspace: true,
            }

  return (
    <PhaseChatRail
      pdiId={pdiId}
      phase={config.phase}
      title="Mentoria de Carreira"
      phaseLabel={config.phaseLabel}
      progress={config.progress}
      progressText={config.progressText}
      placeholder={config.placeholder}
      ctaPrimary={config.ctaPrimary}
      ctaSecondary={config.ctaSecondary}
      promoteStructuredAssistantOutputToWorkspace={config.promoteStructuredAssistantOutputToWorkspace}
      initialMessages={initialMessagesForScreen(screen, conversations)}
      userProfile={userProfile}
      advancePhase={'advancePhase' in config ? config.advancePhase : undefined}
      advanceLabel={'advanceLabel' in config ? config.advanceLabel : undefined}
    />
  )
}

export function PdiScreen({
  pdiId,
  pdiName,
  screen,
  sectionsMap,
  mergedDocument,
  latestRevisionSummary,
  conversations,
  userProfile,
}: PdiScreenProps) {
  const phase1StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_1_DIAGNOSTICO'
  )
  const phase2StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_2_ADAPTATIVO'
  )
  const phase3StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_3_DIRECAO'
  )
  const phase5StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_5_FINAL'
  )

  return (
    <PdiShell
      pdiId={pdiId}
      pdiName={pdiName}
      pdiIdLabel={screen.toUpperCase().replaceAll('-', ' ').replaceAll('/', ' · ')}
      sidebarNav={sidebarForScreen(screen, sectionsMap)}
      workspace={workspaceForScreen(
        pdiId,
        screen,
        sectionsMap,
        mergedDocument,
        phase1StructuredOutput,
        phase2StructuredOutput,
        phase3StructuredOutput,
        phase5StructuredOutput,
        latestRevisionSummary
      )}
      chat={chatForScreen(pdiId, screen, conversations, userProfile, latestRevisionSummary)}
      userProfile={userProfile}
    />
  )
}
