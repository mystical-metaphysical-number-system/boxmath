import type { DisplayNode } from './displayTree'

// ---------------------------------------------------------------------
// Pure mode: real text, a real cursor. The whole box is one string, built
// from three tokens: `0` (a unit), `0ᵃ` (an anti-unit), and `[...]` /
// `[...]ᵃ` (a box, optionally negating everything inside it). Brackets are
// never signed by themselves — only units are — an anti-bracket instead
// means "negate this whole group," resolving the "does wrapping negate?"
// question explicitly in the syntax rather than leaving it as a hidden
// convention. The two buttons paste a unit at the cursor, or — when text
// is selected — wrap the selection in brackets instead.
// ---------------------------------------------------------------------

export const DEFAULT_PURE_TEXT = '[]'

export type PureNode = { type: 'unit'; sign: 1 | -1 } | { type: 'box'; negate: boolean; children: PureNode[] }

export function parsePure(text: string): PureNode {
  let i = 0
  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i])) i++
  }
  function parseNode(): PureNode {
    skipWs()
    if (text[i] === '[') {
      i++
      const children: PureNode[] = []
      skipWs()
      while (i < text.length && text[i] !== ']') {
        children.push(parseNode())
        skipWs()
      }
      if (text[i] !== ']') throw new Error(`expected ']' at position ${i}`)
      i++
      const negate = text[i] === 'ᵃ'
      if (negate) i++
      return { type: 'box', negate, children }
    }
    if (text[i] === '0') {
      i++
      const anti = text[i] === 'ᵃ'
      if (anti) i++
      return { type: 'unit', sign: anti ? -1 : 1 }
    }
    throw new Error(`unexpected '${text[i] ?? 'end of input'}' at position ${i}`)
  }
  skipWs()
  const result = parseNode()
  skipWs()
  if (i < text.length) throw new Error(`unexpected trailing content at position ${i}`)
  return result
}

export function pureValue(node: PureNode): bigint {
  if (node.type === 'unit') return BigInt(node.sign)
  const sum = node.children.reduce((s, c) => s + pureValue(c), 0n)
  return node.negate ? -sum : sum
}

// evaluatePure — reads a box the way the board does: Nat = mset of Zeros
// (chomp them into a plain count), Poly = mset of Nats (each element's
// own count becomes an exponent of α, repeats add up into coefficients).
// [000] = 3, [[0]00] = α + 2 — a bare unit sitting beside real nesting is
// a Nat "0" (α⁰, the constant term); a one-level-nested box that reduces
// to n is Nat "n" (αⁿ). Verified against exactly those two examples.
// Third-level-and-deeper nesting (genuine Multinumbers) isn't something
// the board settled on a simple notation for either — this generalizes
// by climbing to a new variable per extra layer (β, γ, ...), a reasonable
// guess, not a verified match to the paper's own indexed-α convention.
const POLY_VARIABLES = ['α', 'β', 'γ', 'δ', 'ε']
type Monomial = { coeff: bigint; exponents: number[] }

function combineLikeTerms(monomials: Monomial[]): Monomial[] {
  const byKey = new Map<string, Monomial>()
  for (const m of monomials) {
    const key = m.exponents.join(',')
    const existing = byKey.get(key)
    if (existing) existing.coeff += m.coeff
    else byKey.set(key, { ...m })
  }
  return [...byKey.values()].filter((m) => m.coeff !== 0n)
}

export function evaluatePure(node: PureNode): bigint | Monomial[] {
  if (node.type === 'unit') return BigInt(node.sign)

  if (node.children.every((c) => c.type === 'unit')) {
    const sum = node.children.reduce((s, c) => s + (c as { sign: 1 | -1 }).sign, 0)
    const value = BigInt(sum)
    return node.negate ? -value : value
  }

  const monomials = node.children.flatMap((child): Monomial[] => {
    const value = evaluatePure(child)
    if (typeof value === 'bigint') {
      const exponent = child.type === 'unit' ? 0 : Math.abs(Number(value))
      const coeff = child.type === 'unit' ? value : value < 0n ? -1n : 1n
      return [{ coeff, exponents: [exponent] }]
    }
    // child is itself a polynomial (third-level+ nesting) — climb a variable.
    return value.map((m) => ({ coeff: m.coeff, exponents: [0, ...m.exponents] }))
  })

  const combined = combineLikeTerms(monomials)
  return node.negate ? combined.map((m) => ({ ...m, coeff: -m.coeff })) : combined
}

function formatMonomial(m: Monomial): string {
  const varPart = m.exponents
    .map((e, i) => (e === 0 ? '' : e === 1 ? POLY_VARIABLES[i] : `${POLY_VARIABLES[i]}^${e}`))
    .join('')
  if (!varPart) return m.coeff.toString()
  if (m.coeff === 1n) return varPart
  if (m.coeff === -1n) return `-${varPart}`
  return `${m.coeff}${varPart}`
}

export function formatPureValue(value: bigint | Monomial[]): string {
  if (typeof value === 'bigint') return value.toString()
  if (value.length === 0) return '0'
  const sorted = [...value].sort(
    (a, b) => b.exponents.reduce((s, e) => s + e, 0) - a.exponents.reduce((s, e) => s + e, 0),
  )
  return sorted
    .map(formatMonomial)
    .join(' + ')
    .replace(/\+ -/g, '- ')
}

export function pureHeight(node: PureNode): number {
  if (node.type === 'unit' || node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map(pureHeight))
}
export function pureCountNodes(node: PureNode): number {
  if (node.type === 'unit') return 1
  return 1 + node.children.reduce((s, c) => s + pureCountNodes(c), 0)
}
export function pureCountLeaves(node: PureNode): number {
  if (node.type === 'unit') return 1
  return node.children.length === 0 ? 1 : node.children.reduce((s, c) => s + pureCountLeaves(c), 0)
}

// Color is local, not computed: a node is red iff it's itself marked
// anti (an anti-unit, or a box closed with `]ᵃ`), full stop — regardless
// of what its contents add up to. No cancellation, no aggregation; that
// was overly clever for what this needs to show right now.
export function pureNodeToDisplay(node: PureNode): DisplayNode {
  if (node.type === 'unit') {
    return { value: null, label: node.sign === 1 ? '0' : '0ᵃ', type: 'unit', sum: BigInt(node.sign), children: [] }
  }
  const children = node.children.map(pureNodeToDisplay)
  return {
    value: null,
    label: node.children.length === 0 ? (node.negate ? '[ ]ᵃ' : '[ ]') : null,
    type: node.negate ? 'anti-box' : 'box',
    sum: node.negate ? -1n : 1n,
    children,
  }
}

// Syntax highlighting: color just the `0`/`0ᵃ` units, leave brackets and
// whitespace as plain text. A lightweight scan, not a full parse — it has
// to render sensibly even while the text is mid-edit and invalid.
export function highlightPure(text: string): (string | { token: string; anti: boolean })[] {
  const parts: (string | { token: string; anti: boolean })[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '0') {
      const anti = text[i + 1] === 'ᵃ'
      const token = anti ? '0ᵃ' : '0'
      parts.push({ token, anti })
      i += token.length
    } else {
      let j = i
      while (j < text.length && text[j] !== '0') j++
      parts.push(text.slice(i, j))
      i = j
    }
  }
  return parts
}
