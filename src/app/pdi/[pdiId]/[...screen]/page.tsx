import { notFound } from 'next/navigation'
import { PdiScreen } from '@/components/pdi/PdiScreen'
import { getPdiPageData } from '@/lib/pdi/page-data'

const allowedScreens = new Set([
  'phase-1-diagnostico',
  'phase-2-adaptativo',
  'phase-3-direcao',
  'phase-4-pdi/inicio',
  'phase-4-pdi/avancado',
  'phase-4-pdi/consolidado',
  'phase-5-final/entregaveis',
  'phase-5-final/revisao',
] as const)

type Screen =
  | 'phase-1-diagnostico'
  | 'phase-2-adaptativo'
  | 'phase-3-direcao'
  | 'phase-4-pdi/inicio'
  | 'phase-4-pdi/avancado'
  | 'phase-4-pdi/consolidado'
  | 'phase-5-final/entregaveis'
  | 'phase-5-final/revisao'

export default async function PdiScreenPage({
  params,
}: {
  params: Promise<{ pdiId: string; screen: string[] }>
}) {
  const { pdiId, screen } = await params
  const screenKey = screen.join('/') as Screen

  if (!allowedScreens.has(screenKey)) {
    notFound()
  }

  const data = await getPdiPageData(pdiId)

  const sectionsMap = Object.fromEntries(
    data.sections
      .filter((section) => data.latestDocument && section.documentId === data.latestDocument.id)
      .map((section) => [section.sectionKey, section.content || ''])
  )

  return (
    <PdiScreen
      pdiId={pdiId}
      pdiName={data.pdi.name}
      screen={screenKey}
      sectionsMap={sectionsMap}
      mergedDocument={data.latestDocument?.fullContent || ''}
      latestRevisionSummary={data.latestRevision?.summary || null}
      conversations={data.conversations.map((conversation) => ({
        phase: conversation.phase,
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
      }))}
      userProfile={{
        name: data.user.name,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl,
      }}
      persona={data.persona}
    />
  )
}
