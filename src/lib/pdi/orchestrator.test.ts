import { describe, expect, it, vi } from 'vitest'
import { generatePdiSections, PDI_SECTION_ORDER, type GenerateSectionInput } from './orchestrator'

describe('generatePdiSections', () => {
  it('deve executar as seções em ordem e emitir documento final consolidado', async () => {
    const generateSection = vi.fn(async ({ section }: GenerateSectionInput) => ({
      content: `Conteúdo da seção ${section}`,
    }))

    const events = [] as Array<Record<string, unknown>>
    for await (const event of generatePdiSections({
      pdiId: 'pdi-1',
      generateSection,
    })) {
      events.push(event as unknown as Record<string, unknown>)
    }

    expect(generateSection.mock.calls.map((call) => call[0].section)).toEqual(PDI_SECTION_ORDER)
    expect(events.filter((event) => event.type === 'section_completed').map((event) => event.section)).toEqual(PDI_SECTION_ORDER)
    expect(events.at(-1)).toMatchObject({
      type: 'document_completed',
    })
  })

  it('deve enviar contexto acumulado para a seção seguinte', async () => {
    const generateSection = vi.fn(async ({ section }: GenerateSectionInput) => ({
      content: `Conteúdo da seção ${section}`,
    }))

    for await (const event of generatePdiSections({
      pdiId: 'pdi-1',
      generateSection,
    })) {
      expect(event).toBeDefined()
    }

    expect(generateSection.mock.calls[1][0].context.sections['4.1']).toContain('Conteúdo da seção 4.1')
    expect(generateSection.mock.calls[2][0].context.sections['4.2']).toContain('Conteúdo da seção 4.2')
  })

  it('deve interromper fluxo quando uma seção falhar', async () => {
    const generateSection = vi.fn(async ({ section }: { section: string }) => {
      if (section === '4.4') {
        throw new Error('Falha da seção 4.4')
      }

      return { content: `Conteúdo da seção ${section}` }
    })

    const events = [] as Array<Record<string, unknown>>
    for await (const event of generatePdiSections({
      pdiId: 'pdi-1',
      generateSection,
    })) {
      events.push(event as unknown as Record<string, unknown>)
    }

    expect(generateSection.mock.calls.map((call) => call[0].section)).toEqual(['4.1', '4.2', '4.3', '4.4'])
    expect(events.some((event) => event.type === 'section_error' && event.section === '4.4')).toBe(true)
    expect(events.some((event) => event.type === 'document_completed')).toBe(false)
  })
})
