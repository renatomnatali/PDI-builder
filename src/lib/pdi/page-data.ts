import { prisma } from '@/lib/db/prisma'
import { getOrCreateUserByClerkId, requireClerkUserId } from '@/lib/auth/session'
import { ensurePdiForUser } from '@/lib/pdi/access'
import { getPersonaById } from '@/lib/pdi/personas'

export async function getPdiPageData(pdiId: string) {
  const clerkId = await requireClerkUserId()
  const user = await getOrCreateUserByClerkId(clerkId)

  const pdi = await ensurePdiForUser(pdiId, user.id)

  const [latestDocument, latestRevision, conversations] = await Promise.all([
    prisma.pdiDocument.findFirst({
      where: { projectId: pdi.id },
      orderBy: { version: 'desc' },
    }),
    prisma.pdiRevision.findFirst({
      where: { projectId: pdi.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.conversation.findMany({
      where: { projectId: pdi.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ])

  const sections = latestDocument
    ? await prisma.pdiDocumentSection.findMany({
        where: { documentId: latestDocument.id },
        orderBy: { sectionKey: 'asc' },
      })
    : []

  const persona = getPersonaById(pdi.personaId)

  return {
    user,
    pdi,
    persona,
    latestDocument,
    sections,
    latestRevision,
    conversations,
  }
}
