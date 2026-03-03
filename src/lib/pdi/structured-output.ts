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
    (/✅\s*confirmado/i.test(text) && /posso\s+avan[çc]ar/i.test(text)) ||
    /\bproposta\s+de\s+dire[çc][ãa]o\b/i.test(text) ||
    /\bhipótese\s+de\s+dire[çc][ãa]o\b/i.test(text) ||
    /\*\*\s*caminho\s+[abc]\b/i.test(text)

  return hasMarkdownTable || hasExecutiveMarkers
}
