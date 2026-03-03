import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  buildAssistantReply,
  buildPhase3InitialMessage,
  getPhase2BranchGateQuestionMessage,
} from '@/lib/pdi/chat-engine'
import { getOrCreateUserByClerkId, requireClerkUserId, UnauthorizedError } from '@/lib/auth/session'
import { ensurePdiForUser, PdiNotFoundError } from '@/lib/pdi/access'

const chatRequestSchema = z.object({
  phase: z.enum([
    'PHASE_1_DIAGNOSTICO',
    'PHASE_2_ADAPTATIVO',
    'PHASE_3_DIRECAO',
    'PHASE_5_FINAL',
    'PHASE_REVISAO',
  ]),
  message: z.string().min(1).max(12000),
})

const PHASE_2_SCREEN = 'phase-2-adaptativo'
const PHASE_3_SCREEN = 'phase-3-direcao'
const PHASE_4_SCREEN = 'phase-4-pdi/inicio'
const ASK_TO_ADVANCE_PHASE_2_PATTERN = /posso\s+avan[çc]ar\s+para\s+a\s+fase\s*2/i
const ASK_TO_ADVANCE_PHASE_3_PATTERN = /posso\s+avan[çc]ar\s+para\s+a\s+proposta\s+de\s+dire[çc][ãa]o/i
const ASK_ABOUT_PATH_PATTERN = /qual\s+(desses?\s+)?caminhos?|prefere\s+seguir|quer\s+seguir|por\s+qual\s+caminho|confirmar\s+o\s+caminho/i
const NEGATIVE_INTENT_PATTERN = /\b(n[aã]o|ainda n[aã]o|espera|aguarde)\b/i
const AFFIRMATIVE_INTENT_PATTERN =
  /\b(sim|ok|fechado|perfeito|pode|podemos|vamos|bora|seguir|siga|prosseguir|avan[çc]a|avan[çc]ar|pr[oó]xima fase|continuar|continue|confirmo|confirmado)\b/i

function findLatestAssistantBeforeCurrentUser(
  history: Array<{ role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }>
): string {
  for (let index = history.length - 2; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== 'ASSISTANT') continue
    return message.content
  }
  return ''
}

function isAffirmativeForPhaseAdvance(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (!text) return false
  if (NEGATIVE_INTENT_PATTERN.test(text)) return false
  return AFFIRMATIVE_INTENT_PATTERN.test(text)
}

function shouldAdvanceToPhase3(
  phase: z.infer<typeof chatRequestSchema>['phase'],
  userMessage: string,
  history: Array<{ role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }>
): boolean {
  if (phase !== 'PHASE_2_ADAPTATIVO') return false
  if (!isAffirmativeForPhaseAdvance(userMessage)) return false

  const latestAssistant = findLatestAssistantBeforeCurrentUser(history)
  return ASK_TO_ADVANCE_PHASE_3_PATTERN.test(latestAssistant)
}

function shouldAdvanceToPhase4(
  phase: z.infer<typeof chatRequestSchema>['phase'],
  userMessage: string,
  history: Array<{ role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }>
): boolean {
  if (phase !== 'PHASE_3_DIRECAO') return false
  if (!isAffirmativeForPhaseAdvance(userMessage)) return false

  const latestAssistant = findLatestAssistantBeforeCurrentUser(history)
  return ASK_ABOUT_PATH_PATTERN.test(latestAssistant)
}

function shouldAdvanceToPhase2(
  phase: z.infer<typeof chatRequestSchema>['phase'],
  userMessage: string,
  history: Array<{ role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }>
): boolean {
  if (phase !== 'PHASE_1_DIAGNOSTICO') return false
  if (!isAffirmativeForPhaseAdvance(userMessage)) return false

  const latestAssistant = findLatestAssistantBeforeCurrentUser(history)
  return ASK_TO_ADVANCE_PHASE_2_PATTERN.test(latestAssistant)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pdiId: string }> }
) {
  try {
    const { pdiId } = await params
    const clerkId = await requireClerkUserId()
    const user = await getOrCreateUserByClerkId(clerkId)
    const body = await request.json()
    const parsed = chatRequestSchema.parse(body)

    const pdi = await ensurePdiForUser(pdiId, user.id)

    const conversation = await prisma.conversation.upsert({
      where: {
        projectId_phase: {
          projectId: pdi.id,
          phase: parsed.phase,
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        projectId: pdi.id,
        phase: parsed.phase,
        status: 'ACTIVE',
      },
    })

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: parsed.message,
      },
    })

    const history = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (shouldAdvanceToPhase2(parsed.phase, parsed.message, history)) {
      const phase2Conversation = await prisma.conversation.upsert({
        where: {
          projectId_phase: {
            projectId: pdi.id,
            phase: 'PHASE_2_ADAPTATIVO',
          },
        },
        update: {
          status: 'ACTIVE',
        },
        create: {
          projectId: pdi.id,
          phase: 'PHASE_2_ADAPTATIVO',
          status: 'ACTIVE',
        },
      })

      const existingPhase2Assistant = await prisma.message.findFirst({
        where: {
          conversationId: phase2Conversation.id,
          role: 'ASSISTANT',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      const phase2AssistantMessage =
        existingPhase2Assistant ||
        (await prisma.message.create({
          data: {
            conversationId: phase2Conversation.id,
            role: 'ASSISTANT',
            content: getPhase2BranchGateQuestionMessage(),
          },
        }))

      await prisma.project.update({
        where: { id: pdi.id },
        data: {
          currentPhase: 'PHASE_2_ADAPTATIVO',
          currentScreen: PHASE_2_SCREEN,
        },
      })

      return NextResponse.json({
        conversationId: phase2Conversation.id,
        assistantMessage: {
          id: phase2AssistantMessage.id,
          role: phase2AssistantMessage.role,
          content: phase2AssistantMessage.content,
          createdAt: phase2AssistantMessage.createdAt,
        },
        nextScreen: PHASE_2_SCREEN,
      })
    }

    if (shouldAdvanceToPhase3(parsed.phase, parsed.message, history)) {
      const phase3Conversation = await prisma.conversation.upsert({
        where: {
          projectId_phase: {
            projectId: pdi.id,
            phase: 'PHASE_3_DIRECAO',
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          projectId: pdi.id,
          phase: 'PHASE_3_DIRECAO',
          status: 'ACTIVE',
        },
      })

      const existingPhase3Assistant = await prisma.message.findFirst({
        where: { conversationId: phase3Conversation.id, role: 'ASSISTANT' },
        orderBy: { createdAt: 'desc' },
      })

      const phase3AssistantMessage =
        existingPhase3Assistant ||
        (await prisma.message.create({
          data: {
            conversationId: phase3Conversation.id,
            role: 'ASSISTANT',
            content: await buildPhase3InitialMessage(history),
          },
        }))

      await prisma.project.update({
        where: { id: pdi.id },
        data: {
          currentPhase: 'PHASE_3_DIRECAO',
          currentScreen: PHASE_3_SCREEN,
        },
      })

      return NextResponse.json({
        conversationId: phase3Conversation.id,
        assistantMessage: {
          id: phase3AssistantMessage.id,
          role: phase3AssistantMessage.role,
          content: phase3AssistantMessage.content,
          createdAt: phase3AssistantMessage.createdAt,
        },
        nextScreen: PHASE_3_SCREEN,
      })
    }

    if (shouldAdvanceToPhase4(parsed.phase, parsed.message, history)) {
      const confirmContent =
        'Caminho confirmado. Vou montar o PDI completo agora. Clique em "Gerar PDI completo" no painel central para iniciar.'

      const confirmMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: confirmContent,
        },
      })

      await prisma.project.update({
        where: { id: pdi.id },
        data: { currentScreen: PHASE_4_SCREEN },
      })

      return NextResponse.json({
        conversationId: conversation.id,
        assistantMessage: {
          id: confirmMessage.id,
          role: confirmMessage.role,
          content: confirmMessage.content,
          createdAt: confirmMessage.createdAt,
        },
        nextScreen: PHASE_4_SCREEN,
      })
    }

    const assistantContent = await buildAssistantReply(
      parsed.phase,
      parsed.message,
      history
    )

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: assistantContent,
      },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (error instanceof PdiNotFoundError) {
      return NextResponse.json({ error: 'PDI_NOT_FOUND' }, { status: 404 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
