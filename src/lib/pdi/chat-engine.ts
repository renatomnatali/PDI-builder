import type { ConversationPhase, Message } from '@prisma/client'
import { chatWithAI } from '@/lib/ai/client'
import { buildPdiChatSystemPrompt } from './prompts'
import { isStructuredPhaseOutput } from './structured-output'
import { type PersonaManifest, MENTORIA_CARREIRA_PERSONA } from './personas'

export function getPhase1AnchorQuestionsMessage(persona?: PersonaManifest): string {
  const questions = persona?.anchorQuestions ?? MENTORIA_CARREIRA_PERSONA.anchorQuestions
  return questions[0]
}

export function getPhase2BranchGateQuestionMessage(persona?: PersonaManifest): string {
  const gateQuestion =
    persona?.phase2GateQuestion ?? MENTORIA_CARREIRA_PERSONA.phase2GateQuestion
  return gateQuestion ?? ''
}

const FALLBACK_BY_PHASE: Record<ConversationPhase, string> = {
  PHASE_1_DIAGNOSTICO:
    'Não consegui concluir a coleta inicial agora. Reenvie suas respostas para eu identificar o obstáculo principal e seguir para a próxima etapa.',
  PHASE_2_ADAPTATIVO:
    'Não consegui concluir o diagnóstico adaptativo agora. Reenvie sua última resposta para eu classificar o ramo e fechar ✅ Confirmado / ⚠️ Falta.',
  PHASE_3_DIRECAO:
    'Não consegui concluir a proposta de direção agora. Reenvie para eu retornar os caminhos e recomendação.',
  PHASE_5_FINAL:
    'Não consegui atualizar os entregáveis finais agora. Reenvie o ajuste desejado para eu recalibrar o documento.',
  PHASE_REVISAO:
    'Não consegui processar a revisão agora. Reenvie a alteração solicitada para gerar nova versão.',
}

function toAIMessage(
  history: Message[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
    .map((message) => ({
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
    }))
}

function countUserMessages(history: Message[]): number {
  return history.filter((message) => message.role === 'USER').length
}

function normalizePhase2SingleQuestion(content: string, extraPatterns: RegExp[] = []): string {
  const text = content.trim()
  if (!text) return text
  if (isStructuredPhaseOutput(text, extraPatterns)) return text

  const questionMatches = text
    .split(/\n+/)
    .flatMap((line) => line.match(/[^?]*\?/g) ?? [])
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0)

  if (questionMatches.length <= 1) {
    return text
  }

  const firstQuestion = questionMatches[0]
  const firstQuestionIndex = text.indexOf(firstQuestion)
  if (firstQuestionIndex < 0) {
    return firstQuestion
  }

  const intro = text.slice(0, firstQuestionIndex).trim()
  if (!intro) {
    return firstQuestion
  }

  return `${intro}\n\n${firstQuestion}`
}

export async function buildPhase3InitialMessage(
  phase2History: Message[],
  persona?: PersonaManifest
): Promise<string> {
  try {
    const aiMessages = toAIMessage(phase2History)
    aiMessages.push({ role: 'user', content: 'Pode avançar para a proposta de direção.' })

    const response = await chatWithAI({
      phase: 'pdi_chat',
      systemPrompt: buildPdiChatSystemPrompt('PHASE_3_DIRECAO', persona),
      messages: aiMessages,
    })

    const text = response.text.trim()
    return text || FALLBACK_BY_PHASE['PHASE_3_DIRECAO']
  } catch {
    return FALLBACK_BY_PHASE['PHASE_3_DIRECAO']
  }
}

export async function buildAssistantReply(
  phase: ConversationPhase,
  userMessage: string,
  history: Message[],
  persona?: PersonaManifest
) {
  const activePersona = persona ?? MENTORIA_CARREIRA_PERSONA
  const extraPatterns = activePersona.structuredOutputExtraPatterns
  const anchorQuestions = activePersona.anchorQuestions

  if (phase === 'PHASE_1_DIAGNOSTICO') {
    const userCount = countUserMessages(history)
    const nextIndex = Math.min(userCount, anchorQuestions.length - 1)

    if (userCount < anchorQuestions.length) {
      return anchorQuestions[nextIndex]
    }
  }

  try {
    const aiMessages = toAIMessage(history)
    if (aiMessages.length === 0) {
      aiMessages.push({ role: 'user', content: userMessage })
    }

    const response = await chatWithAI({
      phase: 'pdi_chat',
      systemPrompt: buildPdiChatSystemPrompt(phase, activePersona),
      messages: aiMessages,
    })

    const text = response.text.trim()
    if (!text) {
      return FALLBACK_BY_PHASE[phase]
    }

    if (phase === 'PHASE_2_ADAPTATIVO') {
      return normalizePhase2SingleQuestion(text, extraPatterns)
    }

    return text
  } catch {
    return FALLBACK_BY_PHASE[phase]
  }
}
