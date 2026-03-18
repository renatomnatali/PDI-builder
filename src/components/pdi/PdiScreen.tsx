import {
  getPhase1AnchorQuestionsMessage,
  getPhase2BranchGateQuestionMessage,
} from '@/lib/pdi/chat-engine'
import { isStructuredPhaseOutput } from '@/lib/pdi/structured-output'
import { PDI_SECTION_ORDER, type PdiSectionKey } from '@/lib/pdi/orchestrator'
import { type PersonaManifest, MENTORIA_CARREIRA_PERSONA } from '@/lib/pdi/personas'
import { MarkdownContent } from './MarkdownContent'
import { PdiShell } from './PdiShell'
import { PhaseChatRail, type SegmentState } from './PhaseChatRail'
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
  persona?: PersonaManifest
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
  conversations: ConversationPayload[],
  persona: PersonaManifest
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
        content: getPhase1AnchorQuestionsMessage(persona),
      },
    ]
  }

  if (screen === 'phase-2-adaptativo' && messages.length === 0) {
    return [
      {
        id: 'phase-2-gate',
        role: 'ASSISTANT',
        content: getPhase2BranchGateQuestionMessage(persona),
      },
    ]
  }

  return messages
}

function latestStructuredAssistantMessageForPhase(
  conversations: ConversationPayload[],
  phase: string,
  extraPatterns: RegExp[] = []
): string | null {
  const conversation = conversations.find((item) => item.phase === phase)
  if (!conversation) return null

  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index]
    if (message.role !== 'ASSISTANT') continue
    if (!isStructuredPhaseOutput(message.content, extraPatterns)) continue
    return message.content
  }

  return null
}

/**
 * Computa os 5 segmentos de progresso da barra segmentada no cabeçalho do chat.
 * Segmentos: F1 · F2 · F3 · F4 · F5
 */
function buildSegments(screen: ScreenKey, persona: PersonaManifest): SegmentState[] {
  const f2: SegmentState = persona.skipsPhase2 ? 'skipped' : 'pending'
  if (screen === 'phase-1-diagnostico')           return ['active', f2,      'pending', 'pending', 'pending']
  if (screen === 'phase-2-adaptativo')             return ['done',  'active', 'pending', 'pending', 'pending']
  if (screen === 'phase-3-direcao')               return ['done',  persona.skipsPhase2 ? 'skipped' : 'done', 'active', 'pending', 'pending']
  if (screen.startsWith('phase-4-pdi'))           return ['done',  persona.skipsPhase2 ? 'skipped' : 'done', 'done', 'active', 'pending']
  /* phase-5 (entregáveis e revisão) */           return ['done',  persona.skipsPhase2 ? 'skipped' : 'done', 'done', 'done', 'active']
}

const PHASE5_DELIVERABLES = [
  { key: '5.1', label: 'Checklist de Ações' },
  { key: '5.2', label: 'Autoavaliação Semestral' },
  { key: '5.3', label: 'Alinhamento com Gestor' },
  { key: '5.4', label: 'One-Pager Executivo' },
]

function sidebarForScreen(
  screen: ScreenKey,
  sectionsMap: Record<string, string>,
  persona: PersonaManifest,
  phase5Generated: boolean
) {
  const isPhase1 = screen === 'phase-1-diagnostico'
  const isPhase2 = screen === 'phase-2-adaptativo'
  const isPhase3 = screen === 'phase-3-direcao'
  const isPhase4 = screen.startsWith('phase-4-pdi')
  const isPhase4Consolidado = screen === 'phase-4-pdi/consolidado'
  const isPhase5 = screen === 'phase-5-final/entregaveis'
  const isReview = screen === 'phase-5-final/revisao'

  const beforePhase4 = isPhase1 || isPhase2 || isPhase3
  const skipsPhase2 = persona.skipsPhase2

  const phase1Label = persona.phases?.PHASE_1_DIAGNOSTICO?.sidebarLabel ?? 'Diagnóstico Âncora'
  const phase2Label = persona.phases?.PHASE_2_ADAPTATIVO?.sidebarLabel ?? 'Diagnóstico Adaptativo'
  const phase3Label = persona.phases?.PHASE_3_DIRECAO?.sidebarLabel ?? 'Hipótese de Direção'
  const phase5Label = persona.phases?.PHASE_5_FINAL?.sidebarLabel ?? 'Entregáveis Finais'

  const allSectionsDone = PDI_SECTION_ORDER.every((s) => Boolean(sectionsMap[s]))

  return (
    <>
      <div className="nav-label">FASES</div>
      <div className={`nav-item ${isPhase1 ? 'active' : 'done'}`}>
        <span>1. {phase1Label}</span>
        <span className={`badge ${isPhase1 ? 'warning' : 'success'}`}>{isPhase1 ? 'ATUAL' : 'OK'}</span>
      </div>

      {/* Fase 2: pulada para PDI Expresso (com badge visual), normal para Mentoria */}
      {skipsPhase2 ? (
        <div className="nav-item blocked" aria-label="Fase pulada por esta persona">
          <span style={{ opacity: 0.55, textDecoration: 'line-through' }}>2. {phase2Label}</span>
          <span className="badge pulada">PULADA</span>
        </div>
      ) : (
        <div className={`nav-item ${isPhase2 ? 'active' : isPhase1 ? 'blocked' : 'done'}`}>
          <span>2. {phase2Label}</span>
          <span className={`badge ${isPhase2 ? 'warning' : isPhase1 ? 'info' : 'success'}`}>
            {isPhase2 ? 'ATUAL' : isPhase1 ? 'BLOQ' : 'OK'}
          </span>
        </div>
      )}

      <div className={`nav-item ${isPhase3 ? 'active' : isPhase1 || isPhase2 ? 'blocked' : 'done'}`}>
        <span>{skipsPhase2 ? '2.' : '3.'} {phase3Label}</span>
        <span className={`badge ${isPhase3 ? 'warning' : isPhase1 || isPhase2 ? 'info' : 'success'}`}>
          {isPhase3 ? 'ATUAL' : isPhase1 || isPhase2 ? 'BLOQ' : 'OK'}
        </span>
      </div>

      <div className={`nav-item ${isPhase4 ? 'active' : beforePhase4 ? 'blocked' : 'done'}`}>
        <span>{skipsPhase2 ? '3.' : '4.'} PDI Completo</span>
        <span
          className={`badge ${
            isPhase4 && !allSectionsDone
              ? 'processando'
              : isPhase4 && allSectionsDone
                ? 'warning'
                : beforePhase4
                  ? 'info'
                  : 'success'
          }`}
        >
          {isPhase4 && !allSectionsDone
            ? 'GERANDO'
            : isPhase4 && allSectionsDone
              ? 'ATUAL'
              : beforePhase4
                ? 'BLOQ'
                : 'OK'}
        </span>
      </div>

      {/* Sub-itens das seções do PDI — visíveis durante a Fase 4 */}
      {isPhase4 ? (
        <>
          <div className="nav-label" style={{ paddingLeft: 8 }}>SEÇÕES</div>
          {PDI_SECTION_ORDER.map((section, idx) => {
            const done = Boolean(sectionsMap[section])
            const prevDone = idx === 0 || Boolean(sectionsMap[PDI_SECTION_ORDER[idx - 1]])
            const isProcessing = !done && prevDone
            const status = done ? 'done' : isProcessing ? 'active' : 'pending'
            return (
              <div key={section} className={`nav-sub-item ${status}`}>
                <span className={`nav-sub-icon ${status}`} aria-hidden="true" />
                <span>{section} · {SECTION_LABELS[section]}</span>
              </div>
            )
          })}
        </>
      ) : null}

      <div
        className={`nav-item ${
          isPhase5 ? 'active' : isReview ? 'done' : isPhase4Consolidado ? 'active' : 'blocked'
        }`}
      >
        <span>{skipsPhase2 ? '4.' : '5.'} {phase5Label}</span>
        <span
          className={`badge ${
            isPhase5 ? 'warning' : isReview ? 'success' : isPhase4Consolidado ? 'brand' : 'info'
          }`}
        >
          {isPhase5 ? 'ATUAL' : isReview ? 'OK' : isPhase4Consolidado ? 'PRÓXIMO' : 'BLOQ'}
        </span>
      </div>

      {/* Sub-itens dos entregáveis — visíveis na Fase 5 e revisão */}
      {isPhase5 || isReview ? (
        <>
          <div className="nav-label" style={{ paddingLeft: 8 }}>ENTREGÁVEIS</div>
          {PHASE5_DELIVERABLES.map((item) => {
            const status: 'done' | 'pending' = isReview || phase5Generated ? 'done' : 'pending'
            return (
              <div key={item.key} className={`nav-sub-item ${status}`}>
                <span className={`nav-sub-icon ${status}`} aria-hidden="true" />
                <span>{item.key} · {item.label}</span>
              </div>
            )
          })}
        </>
      ) : null}

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
  persona: PersonaManifest,
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

  const phase1Label = persona.phases?.PHASE_1_DIAGNOSTICO?.sidebarLabel ?? 'Diagnóstico Âncora'
  const phase2Label = persona.phases?.PHASE_2_ADAPTATIVO?.sidebarLabel ?? 'Diagnóstico Adaptativo'
  const phase3Label = persona.phases?.PHASE_3_DIRECAO?.sidebarLabel ?? 'Hipótese de Direção'

  if (screen === 'phase-1-diagnostico') {
    return (
      <>
        <header className="workspace-header">
          <div className="workspace-breadcrumb">Fase 1 · {phase1Label}</div>
          <h1 className="workspace-title">Mapeamento do ponto de partida</h1>
          <p className="workspace-subtitle">
            A conversa no chat conduz as perguntas iniciais e registra as respostas confirmadas desta sessão.
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
            </article>
          ) : null}
          <article className="card">
            <div className="card-header"><h2 className="card-title">Como esta fase funciona</h2></div>
            <div className="card-body">
              <div className="callout info">
                O assistente conduz as perguntas iniciais, uma por vez, diretamente no chat. Responda no painel à direita para seguir para a próxima etapa.
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
          <div className="workspace-breadcrumb">Fase 2 · {phase2Label}</div>
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
          <div className="workspace-breadcrumb">Fase 3 · {phase3Label}</div>
          <h1 className="workspace-title">Síntese e escolha de caminho</h1>
          <p className="workspace-subtitle">
            O especialista sintetizou o diagnóstico e mapeou os caminhos possíveis.
            Revise a proposta abaixo e confirme via chat para iniciar a geração do PDI.
          </p>
        </header>
        <section className="workspace-body">
          {phase3StructuredOutput ? (
            <article className="card card-process">
              <div className="card-header">
                <h2 className="card-title">Proposta de direção</h2>
              </div>
              <div className="card-body">
                <MarkdownContent content={phase3StructuredOutput} />
              </div>
            </article>
          ) : (
            <article className="card">
              <div className="card-header"><h2 className="card-title">Elaborando proposta…</h2></div>
              <div className="card-body">
                <div className="callout info">
                  O especialista está sintetizando o diagnóstico e mapeando os caminhos possíveis.
                  A proposta recomendada aparecerá aqui assim que estiver pronta.
                </div>
              </div>
            </article>
          )}
        </section>
        {/* Barra de CTA sticky — visível somente quando a proposta está pronta */}
        {phase3StructuredOutput ? (
          <div className="workspace-cta-bar">
            <span className="cta-hint">Leia a proposta e use o chat para confirmar ou solicitar ajustes</span>
          </div>
        ) : null}
      </>
    )
  }

  if (screen === 'phase-5-final/entregaveis') {
    const phase5Done = Boolean(phase5StructuredOutput)

    /* Conteúdo placeholder por entregável quando o output consolidado está pronto */
    const deliverableDetail: Record<string, string> = {
      '5.2': 'Questionário de autoavaliação para uso a cada 6 meses, alinhado com os OKRs definidos no PDI.',
      '5.3': 'Pauta estruturada para reunião de 1:1 com a gestora, com os principais pontos do PDI para apresentação.',
      '5.4': 'Síntese de uma página com os elementos-chave do PDI, pronta para colar no sistema de RH ou apresentar à liderança.',
    }

    return (
      <>
        <header className="workspace-header">
          <div className="workspace-breadcrumb">Fase 5 · Entregáveis Finais</div>
          <h1 className="workspace-title">
            {phase5Done ? 'Entregáveis finais prontos' : 'Gerando seus entregáveis…'}
          </h1>
          <p className="workspace-subtitle">
            Checklist de ações, autoavaliação semestral, alinhamento com gestor e one-pager executivo.
          </p>
        </header>
        <section className="workspace-body">
          {/* Banner de conclusão */}
          {phase5Done ? (
            <div className="callout success">
              Seu PDI está completo. Todos os entregáveis foram gerados e estão prontos para uso.
            </div>
          ) : null}

          {/* 5.1 Checklist de Ações — exibe o output da IA quando disponível */}
          {phase5Done ? (
            <details className="card">
              <summary>
                <span>5.1 · Checklist de Ações</span>
                <span className="badge success" style={{ marginLeft: 'auto' }}>CONCLUÍDA</span>
              </summary>
              <div className="card-body">
                <MarkdownContent content={phase5StructuredOutput!} />
              </div>
            </details>
          ) : (
            <div className="card card-process">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ margin: 0 }}>5.1 · Checklist de Ações</h3>
                <span className="badge processando">GERANDO</span>
              </div>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                <span className="spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
                <span>Gerando entregável…</span>
              </div>
            </div>
          )}

          {/* 5.2, 5.3, 5.4 — cards com descrição quando prontos */}
          {PHASE5_DELIVERABLES.slice(1).map((item) => (
            phase5Done ? (
              <details key={item.key} className="card">
                <summary>
                  <span>{item.key} · {item.label}</span>
                  <span className="badge success" style={{ marginLeft: 'auto' }}>CONCLUÍDA</span>
                </summary>
                <div className="card-body">
                  <div className="callout success">{deliverableDetail[item.key]}</div>
                </div>
              </details>
            ) : (
              <div key={item.key} className="card card-process" style={{ opacity: 0.6 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title" style={{ margin: 0 }}>{item.key} · {item.label}</h3>
                  <span className="badge info">AGUARDANDO</span>
                </div>
              </div>
            )
          ))}
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
  persona: PersonaManifest,
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
          phaseLabel: 'Fase 1',
          progress: 20,
          progressText: 'Coleta inicial em andamento',
          placeholder: 'Responda ao especialista...',
          ctaPrimary: 'Enviar',
          promoteStructuredAssistantOutputToWorkspace: true,
          advancePhase: 'PHASE_1_DIAGNOSTICO' as const,
          advanceLabel: persona.ctaLabels.phase1Advance,
        }
      : screen === 'phase-2-adaptativo'
        ? {
            phase: 'PHASE_2_ADAPTATIVO' as const,
            phaseLabel: 'Fase 2',
            progress: 38,
            progressText: 'Diagnóstico adaptativo com triangulação de mercado',
            placeholder: 'Responda ao mentor...',
            ctaPrimary: 'Enviar',
            promoteStructuredAssistantOutputToWorkspace: true,
            advancePhase: 'PHASE_2_ADAPTATIVO' as const,
            advanceLabel: persona.phases?.PHASE_2_ADAPTATIVO?.advanceLabel ?? 'Avançar para a Hipótese de Direção →',
          }
        : screen === 'phase-3-direcao'
          ? {
              phase: 'PHASE_3_DIRECAO' as const,
              phaseLabel: 'Fase 3',
              progress: 54,
              progressText: 'Proposta pronta para validação',
              placeholder: 'Peça ajustes ou escreva sua confirmação...',
              ctaPrimary: 'Enviar',
              promoteStructuredAssistantOutputToWorkspace: true,
              advancePhase: 'PHASE_3_DIRECAO' as const,
              advanceLabel: persona.ctaLabels.phase3Confirm,
            }
          : {
              phase: 'PHASE_5_FINAL' as const,
              phaseLabel: 'Fase 5',
              progress: 100,
              progressText: 'Entregáveis finais prontos para formalização',
              placeholder: 'Peça ajustes no documento...',
              ctaPrimary: 'Enviar',
              promoteStructuredAssistantOutputToWorkspace: true,
            }

  return (
    <PhaseChatRail
      pdiId={pdiId}
      phase={config.phase}
      title={persona.chatTitle}
      phaseLabel={config.phaseLabel}
      progress={config.progress}
      progressText={config.progressText}
      placeholder={config.placeholder}
      ctaPrimary={config.ctaPrimary}
      promoteStructuredAssistantOutputToWorkspace={config.promoteStructuredAssistantOutputToWorkspace}
      initialMessages={initialMessagesForScreen(screen, conversations, persona)}
      userProfile={userProfile}
      advancePhase={'advancePhase' in config ? config.advancePhase : undefined}
      advanceLabel={'advanceLabel' in config ? config.advanceLabel : undefined}
      assistantName={persona.assistantName}
      personaId={persona.id}
      segments={buildSegments(screen, persona)}
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
  persona = MENTORIA_CARREIRA_PERSONA,
}: PdiScreenProps) {
  const extraPatterns = persona.structuredOutputExtraPatterns

  const phase1StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_1_DIAGNOSTICO',
    extraPatterns
  )
  const phase2StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_2_ADAPTATIVO',
    extraPatterns
  )
  const phase3StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_3_DIRECAO',
    extraPatterns
  )
  const phase5StructuredOutput = latestStructuredAssistantMessageForPhase(
    conversations,
    'PHASE_5_FINAL',
    extraPatterns
  )

  const phase5Generated = phase5StructuredOutput !== null

  return (
    <PdiShell
      pdiId={pdiId}
      pdiName={pdiName}
      pdiIdLabel={screen.toUpperCase().replaceAll('-', ' ').replaceAll('/', ' · ')}
      sidebarNav={sidebarForScreen(screen, sectionsMap, persona, phase5Generated)}
      workspace={workspaceForScreen(
        pdiId,
        screen,
        sectionsMap,
        mergedDocument,
        phase1StructuredOutput,
        phase2StructuredOutput,
        phase3StructuredOutput,
        phase5StructuredOutput,
        persona,
        latestRevisionSummary
      )}
      chat={chatForScreen(pdiId, screen, conversations, userProfile, persona, latestRevisionSummary)}
      userProfile={userProfile}
    />
  )
}
