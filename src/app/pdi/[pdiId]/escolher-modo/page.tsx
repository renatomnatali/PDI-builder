import { redirect } from 'next/navigation'
import { getPdiPageData } from '@/lib/pdi/page-data'
import { ALL_PERSONAS } from '@/lib/pdi/personas'
import { PersonaSelector } from '@/components/pdi/PersonaSelector'

export default async function EscolherModoPage({
  params,
}: {
  params: Promise<{ pdiId: string }>
}) {
  const { pdiId } = await params
  const data = await getPdiPageData(pdiId)

  // Se já avançou de Fase 1, não permite trocar
  if (data.pdi.currentPhase !== 'PHASE_1_DIAGNOSTICO') {
    redirect(`/pdi/${pdiId}/${data.pdi.currentScreen}`)
  }

  return (
    <main className="hub" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <PersonaSelector
        pdiId={pdiId}
        personas={ALL_PERSONAS}
        currentPersonaId={data.pdi.personaId}
      />
    </main>
  )
}
