import type { ConversationPhase } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type PersonaId = 'mentoria-carreira' | 'pdi-expresso'

export interface PhaseUiConfig {
  sidebarLabel: string
  advanceLabel?: string
}

export interface PersonaManifest {
  // Camada 1 — Identidade
  id: PersonaId
  displayName: string
  shortDescription: string
  estimatedTime: string
  assistantName: string
  chatTitle: string
  /** Quando true, a modalidade não está disponível ainda (exibida como "Em breve"). */
  isPremium?: boolean

  // Camada 2 — Fluxo
  skipsPhase2: boolean
  phases: Partial<Record<ConversationPhase, PhaseUiConfig>>

  // Camada 3 — Prompts de entrada (Fase 1)
  anchorQuestions: readonly string[]
  phase2GateQuestion: string | null // null = skip Phase 2

  // Camada 3 — Overrides de system prompt por fase
  systemPromptOverrides: Partial<Record<ConversationPhase, string>>

  // Camada 4 — Padrões de detecção extras para structured output
  structuredOutputExtraPatterns: RegExp[]

  // Camada 5 — Labels de UI específicos da persona
  ctaLabels: {
    phase1Advance: string
    phase3Confirm: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persona 1 — Mentoria de Carreira (comportamento atual)
// ─────────────────────────────────────────────────────────────────────────────

export const MENTORIA_CARREIRA_PERSONA: PersonaManifest = {
  id: 'mentoria-carreira',
  displayName: 'Mentoria de Carreira',
  isPremium: true,
  shortDescription:
    'Diagnóstico adaptativo profundo com classificação de ramo, triangulação de mercado e hipótese de direção personalizada.',
  estimatedTime: '~45 min',
  assistantName: 'Mentor Executivo',
  chatTitle: 'Mentoria de Carreira',

  skipsPhase2: false,

  phases: {
    PHASE_1_DIAGNOSTICO: { sidebarLabel: 'Diagnóstico Âncora', advanceLabel: 'Avançar para o Diagnóstico Adaptativo →' },
    PHASE_2_ADAPTATIVO: { sidebarLabel: 'Diagnóstico Adaptativo', advanceLabel: 'Avançar para a Hipótese de Direção →' },
    PHASE_3_DIRECAO: { sidebarLabel: 'Hipótese de Direção', advanceLabel: 'Confirmar direção e gerar PDI completo →' },
    PHASE_5_FINAL: { sidebarLabel: 'Entregáveis Finais' },
    PHASE_REVISAO: { sidebarLabel: 'Revisão' },
  },

  anchorQuestions: [
    '1. Onde você está hoje? (cargo, senioridade, empresa/setor, regime de trabalho)',
    '2. Qual resultado concreto você quer em 12 meses? (cargo, impacto e faixa salarial)',
    '3. Na sua visão, qual é o maior obstáculo entre o estado atual e o objetivo?',
    '4. Qual sua formação acadêmica atual? (curso, nível e status)',
  ],

  phase2GateQuestion:
    'Agora vou aprofundar o diagnóstico. Me conta: no seu dia a dia, como esse obstáculo aparece concretamente? Pode ser uma situação recente, um padrão que se repete ou uma tensão que você sente com frequência.',

  systemPromptOverrides: {},

  structuredOutputExtraPatterns: [],

  ctaLabels: {
    phase1Advance: 'Avançar para o Diagnóstico Adaptativo →',
    phase3Confirm: 'Confirmar direção e gerar PDI completo →',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Persona 2 — PDI Expresso
// ─────────────────────────────────────────────────────────────────────────────

const PDI_EXPRESSO_BASE_PROMPT = `Você é um especialista operacional em PDI (Plano de Desenvolvimento Individual).
Responda sempre em português do Brasil.
Não use contexto fora desta sessão.
Nunca invente dados ausentes; marque como pendência e pergunte.
No máximo 4 perguntas por mensagem.
Seja direto, objetivo e com tom técnico-profissional.
Não ofereça coaching, orientação de carreira ou reflexões filosóficas.
Foque em execução: planos concretos, prazos reais, recursos tangíveis.
Quando relevante, pesquise certificações e trilhas de mercado BR para sugerir caminhos reais.`

const PDI_EXPRESSO_PHASE1_PROMPT = `${PDI_EXPRESSO_BASE_PROMPT}

Fase 1 — Coleta Operacional.
Objetivo: capturar os 6 dados práticos necessários para montar o PDI.
As 6 perguntas âncora são conduzidas fora deste prompt, uma a uma.
Com os 6 dados respondidos, devolva:
1) "obstáculo principal identificado" em uma frase direta
2) uma linha de validação breve
3) "Posso avançar para a proposta de PDI?"`

const PDI_EXPRESSO_PHASE3_PROMPT = `${PDI_EXPRESSO_BASE_PROMPT}

Fase 3 — Proposta de PDI Expresso.
Com base nos dados coletados, pesquise o mercado brasileiro e proponha um PDI operacional.
Use EXATAMENTE estes cabeçalhos Markdown (sem alterar o texto dos títulos):

## Síntese do Diagnóstico
[2-3 frases diretas: cargo atual, objetivo, obstáculo principal]

## Caminhos Possíveis

### Caminho 1 — [nome curto e operacional]
[descrição com foco em ações concretas]
- **Certificações/trilhas sugeridas:** [pesquise opções reais do mercado BR]
- **Custo estimado:** [R$ ou faixas]
- **Tempo estimado:** [horas/semanas]
- **Prós:** [lista]
- **Contras:** [lista]

### Caminho 2 — [nome curto] (se aplicável)
[mesma estrutura]

### Caminho 3 — [nome curto] (se aplicável)
[mesma estrutura]

## Recomendação
[caminho recomendado, justificativa baseada nos recursos disponíveis do usuário (tempo, budget, ferramentas)]

Finalize com uma pergunta direta: qual caminho o usuário quer seguir?`

const PDI_EXPRESSO_PHASE5_PROMPT = `${PDI_EXPRESSO_BASE_PROMPT}

Fase 5 — Entregáveis do PDI Expresso.
Ajuste checklist 7 dias, plano de estudo semanal, alinhamento gestor-funcionário e resumo executivo.
Seja específico: horas por semana, plataformas concretas, marcos mensuráveis.`

const PDI_EXPRESSO_REVISAO_PROMPT = `${PDI_EXPRESSO_BASE_PROMPT}

Revisão — Ajustes no PDI.
Receba pedido de alteração e proponha ajustes consistentes entre seções.
Explique impactos operacionais das mudanças (prazo, custo, esforço).`

export const PDI_EXPRESSO_PERSONA: PersonaManifest = {
  id: 'pdi-expresso',
  displayName: 'PDI Expresso',
  shortDescription:
    'Plano direto ao ponto. 6 perguntas práticas, pesquisa de mercado automática e PDI pronto com certificações reais.',
  estimatedTime: '~15 min',
  assistantName: 'Especialista PDI',
  chatTitle: 'PDI Expresso',

  skipsPhase2: true,

  phases: {
    PHASE_1_DIAGNOSTICO: { sidebarLabel: 'Coleta Operacional', advanceLabel: 'Avançar para a Proposta de PDI →' },
    PHASE_3_DIRECAO: { sidebarLabel: 'Proposta de PDI', advanceLabel: 'Confirmar e gerar PDI completo →' },
    PHASE_5_FINAL: { sidebarLabel: 'Entregáveis Finais' },
    PHASE_REVISAO: { sidebarLabel: 'Revisão' },
  },

  anchorQuestions: [
    '1. Qual é seu cargo atual, senioridade e setor? (ex: Analista de Dados Pleno, Fintech)',
    '2. Qual é seu objetivo profissional em 12 meses? (cargo, responsabilidades, faixa salarial)',
    '3. Qual é o maior obstáculo técnico ou profissional que está te impedindo agora?',
    '4. Quantas horas por semana você pode dedicar ao seu desenvolvimento? (ex: 5h/semana)',
    '5. Qual é seu budget disponível para cursos, certificações ou ferramentas? (ex: R$ 200/mês ou zero)',
    '6. Quais ferramentas, plataformas ou tecnologias você já usa no trabalho?',
  ],

  phase2GateQuestion: null, // PDI Expresso não tem Phase 2

  systemPromptOverrides: {
    PHASE_1_DIAGNOSTICO: PDI_EXPRESSO_PHASE1_PROMPT,
    PHASE_3_DIRECAO: PDI_EXPRESSO_PHASE3_PROMPT,
    PHASE_5_FINAL: PDI_EXPRESSO_PHASE5_PROMPT,
    PHASE_REVISAO: PDI_EXPRESSO_REVISAO_PROMPT,
  },

  structuredOutputExtraPatterns: [
    /##\s+proposta\s+de\s+pdi/i,
    /##\s+coleta\s+operacional/i,
    /certificaç[õo]es\/trilhas\s+sugeridas/i,
  ],

  ctaLabels: {
    phase1Advance: 'Avançar para a Proposta de PDI →',
    phase3Confirm: 'Confirmar e gerar PDI completo →',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry e helpers
// ─────────────────────────────────────────────────────────────────────────────

export const PERSONA_REGISTRY: Record<PersonaId, PersonaManifest> = {
  'mentoria-carreira': MENTORIA_CARREIRA_PERSONA,
  'pdi-expresso': PDI_EXPRESSO_PERSONA,
}

export const ALL_PERSONAS: PersonaManifest[] = [
  PDI_EXPRESSO_PERSONA,
  MENTORIA_CARREIRA_PERSONA,
]

export function getPersonaById(id: string): PersonaManifest {
  return PERSONA_REGISTRY[id as PersonaId] ?? MENTORIA_CARREIRA_PERSONA
}
