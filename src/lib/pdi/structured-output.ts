const MARKDOWN_TABLE_DIVIDER = /\n\|[-:\s|]+\|/
const MARKDOWN_ROW = /\|[^|\n]+\|[^|\n]+\|/

const BASE_EXECUTIVE_MARKERS: RegExp[] = [
  /\*\*fase\s*\d+/i,
  /\*\*eixo\s*\d+/i,
  /\*\*pend[êe]ncias/i,
  /\bobst[áa]culo principal identificado\b/i,
  /(^|\n)\s*(\*\*)?valida[çc][ãa]o\s*:/i,
  /\b3a\./i,
  /\b3b\./i,
  /\b3c\./i,
  /\bchecklist operacional\b/i,
  /\bone-pager executivo\b/i,
  /\balinhamento gestor-funcion[áa]rio\b/i,
  /✅\s*confirmado/i,
  /diagn[oó]stico adaptativo conclu[íi]do/i,
  /\bproposta\s+de\s+dire[çc][ãa]o\b/i,
  /\bhip[oó]tese\s+de\s+dire[çc][ãa]o\b/i,
  /##\s+s[íi]ntese\s+do\s+diagn[oó]stico/i,
  /##\s+caminhos?\s+poss[íi]veis?/i,
  /##\s+recomenda[çc][ãa]o/i,
  /###\s+caminho\s+[1-3abc]\b/i,
  /\*\*\s*caminho\s+[1-3abc]\b/i,
]

/**
 * Verifica se o conteúdo é um output estruturado de fase (deve ir para o workspace,
 * não aparecer no chat). Aceita padrões extras provenientes da persona ativa.
 */
export function isStructuredPhaseOutput(
  content: string,
  extraPatterns: RegExp[] = []
): boolean {
  const text = content.trim()
  if (!text) return false

  const hasMarkdownTable =
    MARKDOWN_ROW.test(text) && MARKDOWN_TABLE_DIVIDER.test(text)

  const allPatterns = [...BASE_EXECUTIVE_MARKERS, ...extraPatterns]
  const hasExecutiveMarkers = allPatterns.some((pattern) => pattern.test(text))

  return hasMarkdownTable || hasExecutiveMarkers
}
