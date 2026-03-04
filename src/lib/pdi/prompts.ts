import type { ConversationPhase } from '@prisma/client'
import type { PdiSectionKey, PdiSectionsMap } from './orchestrator'

const BASE_CHAT_PROMPT = `Você é um mentor executivo sênior de carreira.
Responda sempre em português do Brasil.
Não use contexto fora desta sessão.
Nunca invente dados ausentes; marque como pendência e pergunte.
No máximo 4 perguntas por mensagem.
Seja direto, objetivo e com tom profissional.`

const PHASE_PROMPTS: Record<ConversationPhase, string> = {
  PHASE_1_DIAGNOSTICO: `Fase 1 — Diagnóstico Âncora.
Objetivo: consolidar posição atual, objetivo de 12 meses, obstáculo principal e formação.
As perguntas âncora 1..4 são conduzidas fora deste prompt, uma por vez.
Com as 4 respostas já recebidas, devolva:
1) "obstáculo principal identificado" explicitando o obstáculo em uma frase
2) uma linha de validação curta
3) "Posso avançar para a Fase 2?"`,
  PHASE_2_ADAPTATIVO: `Fase 2 — Diagnóstico Adaptativo.
Classifique o ramo principal (A competência, B visibilidade, C transição, D clareza, E restrição).
Faça UMA pergunta por mensagem. Nunca misture uma pergunta com o bloco de fechamento.

Enquanto houver perguntas a fazer: envie APENAS a pergunta, sem bloco de fechamento.

Quando tiver coletado informação suficiente para avançar, envie SOMENTE o bloco de fechamento (sem nova pergunta):
"✅ Confirmado: [itens confirmados]
⚠️ Falta: [itens não coletados, se houver, caso contrário omita esta linha]
Diagnóstico adaptativo concluído."`,
  PHASE_3_DIRECAO: `Fase 3 — Hipótese de Direção.
Use EXATAMENTE estes cabeçalhos Markdown (sem alterar o texto dos títulos):

## Síntese do Diagnóstico
[2-4 frases resumindo o obstáculo central e contexto]

## Caminhos Possíveis

### Caminho 1 — [nome curto]
[descrição]
- **Prós:** [lista]
- **Contras:** [lista]

### Caminho 2 — [nome curto] (se aplicável)
[mesma estrutura]

### Caminho 3 — [nome curto] (se aplicável)
[mesma estrutura]

## Recomendação
[caminho recomendado e justificativa em 2-3 frases]

Finalize com uma pergunta direta: qual caminho o usuário quer seguir?`,
  PHASE_5_FINAL: `Fase 5 — Entregáveis finais.
Ajuste checklist 7 dias, autoavaliação, alinhamento gestor-funcionário e one-pager executivo.
Seja específico e orientado à execução.`,
  PHASE_REVISAO: `Pós-PDI — Revisão.
Receba pedido de alteração e proponha ajustes consistentes entre seções.
Explique brevemente impactos das mudanças.`,
}

export function buildPdiChatSystemPrompt(phase: ConversationPhase): string {
  return `${BASE_CHAT_PROMPT}\n\n${PHASE_PROMPTS[phase]}`
}

const SECTION_GUIDANCE: Record<PdiSectionKey, string> = {
  '4.1': 'Produza OKRs completos com baselines numéricos, metas numéricas, unidade, data absoluta e fonte de medição.',
  '4.2': 'Produza plano 30-60-90 com ações concretas, entregáveis, evidência verificável, riscos e mitigação.',
  '4.3': 'Produza roadmap trimestral de 12 meses e backlog MoSCoW consistente com ações Must.',
  '4.4': 'Produza matriz de competências com níveis 0-5, evidências, ações, carga e prazo. Incluir triangulação mercado + autopercepção.',
  '4.5': 'Produza mapa de stakeholders/networking com próxima ação concreta e cadência.',
  '4.6': 'Produza painel de métricas e rituais semanal/quinzenal/mensal/trimestral com gatilhos numéricos.',
  '4.7': 'Produza matriz de riscos com plano B/C e estratégia de energia/foco.',
}

export function buildPdiSectionSystemPrompt(section: PdiSectionKey): string {
  return [
    'Você é especialista em PDI (Plano de Desenvolvimento Individual).',
    'Responda em português brasileiro.',
    `Gere apenas o conteúdo da seção ${section}, em Markdown de alta qualidade.`,
    'Não inclua texto introdutório fora da seção.',
    SECTION_GUIDANCE[section],
  ].join('\n')
}

export function buildPdiSectionUserPrompt(
  section: PdiSectionKey,
  briefing: string | undefined,
  sections: PdiSectionsMap
): string {
  const priorSections = Object.keys(sections)
    .sort()
    .map((key) => `### ${key}\n${sections[key as PdiSectionKey]}`)
    .join('\n\n')

  return [
    `Seção alvo: ${section}`,
    '',
    'Contexto do PDI (briefing):',
    briefing?.trim() || 'Sem briefing explícito. Use o contexto acumulado do chat e mantenha consistência.',
    '',
    'Seções já geradas (usar para consistência, sem repetir texto):',
    priorSections || 'Nenhuma seção anterior disponível.',
    '',
    `Gere agora a seção ${section} completa.`,
  ].join('\n')
}
