import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateUserByClerkId, requireClerkUserId, UnauthorizedError } from '@/lib/auth/session'
import { ensurePdiForUser, PdiNotFoundError } from '@/lib/pdi/access'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ pdiId: string }> }
) {
  try {
    const { pdiId } = await params
    const clerkId = await requireClerkUserId()
    const user = await getOrCreateUserByClerkId(clerkId)
    const pdi = await ensurePdiForUser(pdiId, user.id)

    const resetPdi = await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({
        where: {
          conversation: {
            projectId: pdi.id,
          },
        },
      })

      await tx.conversation.deleteMany({
        where: {
          projectId: pdi.id,
        },
      })

      await tx.pdiRevision.deleteMany({
        where: {
          projectId: pdi.id,
        },
      })

      await tx.pdiGenerationRun.deleteMany({
        where: {
          projectId: pdi.id,
        },
      })

      await tx.pdiDocumentSection.deleteMany({
        where: {
          document: {
            projectId: pdi.id,
          },
        },
      })

      await tx.pdiDocument.deleteMany({
        where: {
          projectId: pdi.id,
        },
      })

      return tx.project.update({
        where: { id: pdi.id },
        data: {
          status: 'DIAGNOSTICO',
          currentPhase: 'PHASE_1_DIAGNOSTICO',
          currentScreen: 'phase-1-diagnostico',
          personaId: 'mentoria-carreira',
        },
        select: {
          id: true,
          status: true,
          currentPhase: true,
          currentScreen: true,
        },
      })
    })

    return NextResponse.json({
      ok: true,
      pdi: resetPdi,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (error instanceof PdiNotFoundError) {
      return NextResponse.json({ error: 'PDI_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
