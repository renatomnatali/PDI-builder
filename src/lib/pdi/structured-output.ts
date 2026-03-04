const MARKDOWN_TABLE_DIVIDER = /\n\|[-:\s|]+\|/
const MARKDOWN_ROW = /\|[^|\n]+\|[^|\n]+\|/

export function isStructuredPhaseOutput(content: string): boolean {
  const text = content.trim()
  if (!text) return false

  const hasMarkdownTable =
    MARKDOWN_ROW.test(text) && MARKDOWN_TABLE_DIVIDER.test(text)

  const hasExecutiveMarkers =
    /\*\*fase\s*\d+/i.test(text) ||
    /\*\*eixo\s*\d+/i.test(text) ||
    /\*\*pend[êe]ncias/i.test(text) ||
    /\bobst[áa]culo principal identificado\b/i.test(text) ||
    /(^|\n)\s*(\*\*)?valida[çc][ãa]o\s*:/i.test(text) ||
    /\b3a\./i.test(text) ||
    /\b3b\./i.test(text) ||
    /\b3c\./i.test(text) ||
    /\bchecklist operacional\b/i.test(text) ||
    /\bone-pager executivo\b/i.test(text) ||
    /\balinhamento gestor-funcion[áa]rio\b/i.test(text) ||
    /✅\s*confirmado/i.test(text) ||
    /diagn[oó]stico adaptativo conclu[íi]do/i.test(text) ||
    /\bproposta\s+de\s+dire[çc][ãa]o\b/i.test(text) ||
    /\bhip[oó]tese\s+de\s+dire[çc][ãa]o\b/i.test(text) ||
    /##\s+s[íi]ntese\s+do\s+diagn[oó]stico/i.test(text) ||
    /##\s+caminhos?\s+poss[íi]veis?/i.test(text) ||
    /##\s+recomenda[çc][ãa]o/i.test(text) ||
    /###\s+caminho\s+[1-3abc]\b/i.test(text) ||
    /\*\*\s*caminho\s+[1-3abc]\b/i.test(text)

  return hasMarkdownTable || hasExecutiveMarkers
}
