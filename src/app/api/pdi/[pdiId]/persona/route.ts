import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateUserByClerkId, requireClerkUserId, UnauthorizedError } from '@/lib/auth/session'
import { ensurePdiForUser, PdiNotFoundError } from '@/lib/pdi/access'
import { PERSONA_REGISTRY } from '@/lib/pdi/personas'

const patchPersonaSchema = z.object({
  personaId: z.enum(['mentoria-carreira', 'pdi-expresso']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pdiId: string }> }
) {
  try {
    const { pdiId } = await params
    const clerkId = await requireClerkUserId()
    const user = await getOrCreateUserByClerkId(clerkId)
    const body = await request.json()
    const parsed = patchPersonaSchema.parse(body)

    // Valida que a persona existe no registry
    if (!PERSONA_REGISTRY[parsed.personaId]) {
      return NextResponse.json({ error: 'INVALID_PERSONA' }, { status: 400 })
    }

    const pdi = await ensurePdiForUser(pdiId, user.id)

    // Só permite trocar a persona se ainda estiver na Fase 1 (antes de qualquer progresso)
    if (pdi.currentPhase !== 'PHASE_1_DIAGNOSTICO') {
      return NextResponse.json(
        { error: 'PERSONA_LOCKED', message: 'A persona só pode ser alterada antes de iniciar a jornada.' },
        { status: 409 }
      )
    }

    // Apaga mensagens da Fase 1 para reiniciar com a nova persona
    const phase1Conversation = await prisma.conversation.findFirst({
      where: { projectId: pdi.id, phase: 'PHASE_1_DIAGNOSTICO' },
    })

    if (phase1Conversation) {
      await prisma.message.deleteMany({
        where: { conversationId: phase1Conversation.id },
      })
    }

    const updated = await prisma.project.update({
      where: { id: pdi.id },
      data: {
        personaId: parsed.personaId,
        currentScreen: 'phase-1-diagnostico',
      },
    })

    return NextResponse.json({
      personaId: updated.personaId,
      currentScreen: updated.currentScreen,
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
