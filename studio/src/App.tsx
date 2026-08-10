import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import { toRootedTree, getRank, getDegree, findType } from 'boxmath/applied'
import './App.css'

// Just two colors, one meaning: red if the deep sum of everything at or
// below this node is negative, blue otherwise. That's the same number
// Wildberger's mset cancellation would land on, computed by ordinary
// addition instead of physically canceling +/- unit pairs (see chat).
const POSITIVE_COLOR = '#3b82f6'
const NEGATIVE_COLOR = '#ef4444'
const nodeColor = (node: any): string => (node.sum < 0n ? NEGATIVE_COLOR : POSITIVE_COLOR)

const SPACING = 1.6

// ---------------------------------------------------------------------
// Applied mode: free-text JSON, converted to bigint, rendered as-is.
// ---------------------------------------------------------------------

// JSON has no bigint literal — every leaf JSON.parse hands back is a
// plain number, so convert the whole box to bigint before it reaches
// boxmath/applied, which now deals in bigint exclusively.
function toBigIntBox(box: any): any {
  if (Array.isArray(box)) return box.map(toBigIntBox)
  if (typeof box === 'number') return BigInt(box)
  return box
}

// Reuse the library's own toRootedTree, then annotate each node with the
// deep sum of every leaf beneath it.
function toAppliedDisplayTree(box: any): any {
  const walk = (node: any): any => {
    if (node.children.length === 0) {
      const sum = typeof node.value === 'bigint' ? node.value : 0n
      return { ...node, sum }
    }
    const children = node.children.map(walk)
    const sum = children.reduce((s: bigint, c: any) => s + c.sum, 0n)
    return { ...node, sum, children }
  }
  return walk(toRootedTree(box))
}

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

const DEFAULT_PURE_TEXT = '[]'

type PureNode = { type: 'unit'; sign: 1 | -1 } | { type: 'box'; negate: boolean; children: PureNode[] }

function parsePure(text: string): PureNode {
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

function pureValue(node: PureNode): bigint {
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

function evaluatePure(node: PureNode): bigint | Monomial[] {
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

function formatPureValue(value: bigint | Monomial[]): string {
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

function pureHeight(node: PureNode): number {
  if (node.type === 'unit' || node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map(pureHeight))
}
function pureCountNodes(node: PureNode): number {
  if (node.type === 'unit') return 1
  return 1 + node.children.reduce((s, c) => s + pureCountNodes(c), 0)
}
function pureCountLeaves(node: PureNode): number {
  if (node.type === 'unit') return 1
  return node.children.length === 0 ? 1 : node.children.reduce((s, c) => s + pureCountLeaves(c), 0)
}

// Color is local, not computed: a node is red iff it's itself marked
// anti (an anti-unit, or a box closed with `]ᵃ`), full stop — regardless
// of what its contents add up to. No cancellation, no aggregation; that
// was overly clever for what this needs to show right now.
function pureNodeToDisplay(node: PureNode): any {
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
function highlightPure(text: string): (string | { token: string; anti: boolean })[] {
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

// The caret/selection lives as plain character offsets into the text —
// not a DOM Range — computed via the standard "range-to-string-length"
// trick, which works no matter how the text is chopped up into spans.
function getSelectionOffsets(root: HTMLElement): [number, number] | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const measure = (container: Node, offset: number) => {
    const r = document.createRange()
    r.selectNodeContents(root)
    r.setEnd(container, offset)
    return r.toString().length
  }
  const a = measure(range.startContainer, range.startOffset)
  const b = measure(range.endContainer, range.endOffset)
  return a <= b ? [a, b] : [b, a]
}

function setCaretOffset(root: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node = walker.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    remaining -= len
    node = walker.nextNode()
  }
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

// ---------------------------------------------------------------------
// Shared: a simple rooted-tree layout + flatten, used by both modes.
// ---------------------------------------------------------------------

// Leaves get increasing x, depth becomes -y. Internal nodes sit centered
// above the average x of their children.
function layoutRaw(node: any, depth: number, xRef: { current: number }): any {
  if (node.children.length === 0) {
    const x = xRef.current
    xRef.current += 1
    return { ...node, x, y: -depth, children: [] }
  }
  const children = node.children.map((c: any) => layoutRaw(c, depth + 1, xRef))
  const x = children.reduce((sum: number, c: any) => sum + c.x, 0) / children.length
  return { ...node, x, y: -depth, children }
}

function shiftTree(node: any, dx: number, dy: number): any {
  return { ...node, x: node.x + dx, y: node.y + dy, children: node.children.map((c: any) => shiftTree(c, dx, dy)) }
}

function treeHeight(node: any): number {
  return node.children.length === 0 ? 0 : 1 + Math.max(...node.children.map(treeHeight))
}

// layoutRaw only ever grows into +x/-y, so the tree ends up sitting off
// to one side of the origin instead of on it — center it afterward so the
// camera/OrbitControls target (0,0,0) actually lands in the middle.
function layout(node: any): any {
  const xRef = { current: 0 }
  const raw = layoutRaw(node, 0, xRef)
  const leafSpan = xRef.current - 1
  return shiftTree(raw, -leafSpan / 2, treeHeight(node) / 2)
}

function flattenTree(root: any) {
  const nodes: any[] = []
  const edges: [number, number][] = []
  const walk = (node: any, parentId: number | null) => {
    const id = nodes.length
    nodes.push(node)
    if (parentId !== null) edges.push([parentId, id])
    for (const child of node.children) walk(child, id)
  }
  walk(root, null)
  return { nodes, edges }
}

const DEFAULT_BOX = '[[1,2],[3,4,5]]'

const MODE_EXPLAINER: Record<'applied' | 'pure', string> = {
  applied:
    'Numbers stay numbers (bigint underneath). Fast and practical — keeps the spirit of box arithmetic without literally expanding every quantity.',
  pure:
    "Wildberger's original encoding: click to place your cursor, then paste a unit — or select text and wrap it in a box instead.",
}

function App() {
  const [text, setText] = useState(DEFAULT_BOX)
  const [mode, setMode] = useState<'applied' | 'pure'>('applied')
  const [error, setError] = useState<string | null>(null)

  const [pureText, setPureText] = useState(DEFAULT_PURE_TEXT)
  const [pureError, setPureError] = useState<string | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const pureEditorRef = useRef<HTMLDivElement>(null)
  const pendingCaret = useRef<number | null>(null)

  // contentEditable is mutated live by the browser as the user types —
  // letting React's JSX diffing also own those same children means React
  // and the browser fight over one DOM subtree, and a big enough edit
  // (like deleting the outer brackets) desyncs them badly enough to crash
  // the whole render, taking the WebGL canvas down with it. So React
  // renders an empty shell here, and this effect is the only thing that
  // ever touches the editor's contents, built by hand from pureText.
  useLayoutEffect(() => {
    const editor = pureEditorRef.current
    if (!editor) return
    editor.innerHTML = ''
    for (const part of highlightPure(pureText)) {
      if (typeof part === 'string') {
        editor.appendChild(document.createTextNode(part))
      } else {
        const span = document.createElement('span')
        span.className = part.anti ? 'unit neg' : 'unit pos'
        span.textContent = part.token
        editor.appendChild(span)
      }
    }
    if (pendingCaret.current !== null) {
      editor.focus()
      setCaretOffset(editor, pendingCaret.current)
      pendingCaret.current = null
    }
    // mode is a dependency too: the editor div only exists while
    // mode === 'pure', so switching into that mode is what first attaches
    // pureEditorRef — without mode here, that remount wouldn't re-run this
    // effect unless pureText also happened to change at the same time.
  }, [pureText, mode])

  const updateSelectionState = () => {
    const editor = pureEditorRef.current
    if (!editor) return
    const offsets = getSelectionOffsets(editor)
    setHasSelection(!!offsets && offsets[0] !== offsets[1])
  }

  const handlePureInput = (e: React.FormEvent<HTMLDivElement>) => {
    const editor = e.currentTarget
    const nextText = editor.textContent ?? ''
    pendingCaret.current = getSelectionOffsets(editor)?.[1] ?? nextText.length
    setPureText(nextText)
  }

  const insertAtCursor = (token: string) => {
    const editor = pureEditorRef.current
    const offsets = editor ? getSelectionOffsets(editor) : null
    const [start, end] = offsets ?? [pureText.length, pureText.length]
    setPureText(pureText.slice(0, start) + token + pureText.slice(end))
    pendingCaret.current = start + token.length
  }

  const wrapSelection = (negate: boolean) => {
    const editor = pureEditorRef.current
    const offsets = editor ? getSelectionOffsets(editor) : null
    if (!offsets || offsets[0] === offsets[1]) return
    const [start, end] = offsets
    const close = negate ? ']ᵃ' : ']'
    setPureText(pureText.slice(0, start) + '[' + pureText.slice(start, end) + close + pureText.slice(end))
    pendingCaret.current = end + 1 + close.length
    setHasSelection(false)
  }

  // With nothing typed yet, there's no cursor to paste a unit at and
  // nothing to select — the only sensible first move is a box, never a
  // bare unit, since a rooted structure always starts as a box.
  const bootstrapBox = (negate: boolean) => {
    const close = negate ? ']ᵃ' : ']'
    setPureText('[' + close)
    pendingCaret.current = 1
  }

  const resetPureText = () => {
    setPureText(DEFAULT_PURE_TEXT)
    pendingCaret.current = DEFAULT_PURE_TEXT.length
    setHasSelection(false)
  }

  const { nodes, edges, info } = useMemo(() => {
    if (mode === 'pure') {
      try {
        const tree = parsePure(pureText)
        setPureError(null)
        const { nodes, edges } = flattenTree(layout(pureNodeToDisplay(tree)))
        return {
          nodes,
          edges,
          info: {
            evaluate: formatPureValue(evaluatePure(tree)),
            netValue: pureValue(tree).toString(),
            height: pureHeight(tree),
            size: pureCountNodes(tree),
            leaves: pureCountLeaves(tree),
          },
        }
      } catch (err) {
        setPureError((err as Error).message)
        return { nodes: [], edges: [], info: null }
      }
    }
    try {
      const box = toBigIntBox(JSON.parse(text))
      const { nodes, edges } = flattenTree(layout(toAppliedDisplayTree(box)))
      setError(null)
      return {
        nodes,
        edges,
        info: {
          type: findType(box),
          horizon: getRank(box),
          degree: getDegree(box).toString(),
          size: nodes.length,
          leaves: nodes.filter((n) => n.children.length === 0).length,
        },
      }
    } catch (err) {
      setError((err as Error).message)
      return { nodes: [], edges: [], info: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mode, pureText])

  return (
    <div id="studio">
      <aside id="panel">
        <h1>boxmath studio</h1>

        <div id="mode-toggle">
          <button type="button" className={mode === 'applied' ? 'active' : ''} onClick={() => setMode('applied')}>
            Applied
          </button>
          <button type="button" className={mode === 'pure' ? 'active' : ''} onClick={() => setMode('pure')}>
            Pure
          </button>
        </div>
        <p id="mode-explainer">{MODE_EXPLAINER[mode]}</p>

        {mode === 'applied' ? (
          <>
            <p>Enter a box (nested array). It renders as a rooted tree.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            {error && <p className="error">{error}</p>}
          </>
        ) : (
          <>
            <p>
              Click to place your cursor, then paste a unit. Select some text instead and the same
              buttons wrap it in a box.
            </p>
            <div id="pure-buttons">
              <button
                type="button"
                className="add-box"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (pureText.length === 0) return bootstrapBox(false)
                  return hasSelection ? wrapSelection(false) : insertAtCursor('0')
                }}
              >
                {pureText.length === 0 || hasSelection ? '[ ]' : '0'}
              </button>
              <button
                type="button"
                className="add-anti-box"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (pureText.length === 0) return bootstrapBox(true)
                  return hasSelection ? wrapSelection(true) : insertAtCursor('0ᵃ')
                }}
              >
                {pureText.length === 0 || hasSelection ? '[ ]ᵃ' : '0ᵃ'}
              </button>
              <button type="button" className="reset" onMouseDown={(e) => e.preventDefault()} onClick={resetPureText}>
                reset
              </button>
            </div>
            <div
              id="pure-editor"
              ref={pureEditorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handlePureInput}
              onSelect={updateSelectionState}
              onMouseUp={updateSelectionState}
              onKeyUp={updateSelectionState}
            />
            {pureError && <p className="error">{pureError}</p>}
          </>
        )}

        {info && (
          <dl id="info">
            {mode === 'applied' ? (
              <>
                <dt>Type</dt>
                <dd>{info.type}</dd>
                <dt>Horizon (height)</dt>
                <dd>{info.horizon}</dd>
                <dt>Degree</dt>
                <dd>{info.degree}</dd>
              </>
            ) : (
              <>
                <dt>Evaluates to</dt>
                <dd>{info.evaluate}</dd>
                <dt>Net value</dt>
                <dd>{info.netValue}</dd>
                <dt>Height</dt>
                <dd>{info.height}</dd>
              </>
            )}
            <dt>Size (nodes)</dt>
            <dd>{info.size}</dd>
            <dt>Leaves</dt>
            <dd>{info.leaves}</dd>
          </dl>
        )}

        <ul id="legend">
          <li>
            <span className="swatch" style={{ background: POSITIVE_COLOR }} />
            non-negative
          </li>
          <li>
            <span className="swatch" style={{ background: NEGATIVE_COLOR }} />
            negative (deep sum below zero)
          </li>
        </ul>
      </aside>

      <Canvas id="canvas" camera={{ position: [0, -2, 10], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <OrbitControls />

        {edges.map(([parentId, childId], i) => (
          <Line
            key={i}
            points={[
              [nodes[parentId].x * SPACING, nodes[parentId].y * SPACING, 0],
              [nodes[childId].x * SPACING, nodes[childId].y * SPACING, 0],
            ]}
            color="#8888aa"
            lineWidth={1}
          />
        ))}

        {nodes.map((node, i) => (
          <mesh key={i} position={[node.x * SPACING, node.y * SPACING, 0]}>
            <sphereGeometry args={[node.children.length === 0 ? 0.18 : 0.24, 24, 24]} />
            <meshStandardMaterial color={nodeColor(node)} />
            <Html distanceFactor={10}>
              <div className="node-label">
                {node.label ?? (node.value !== null ? node.value.toString() : node.type)}
              </div>
            </Html>
          </mesh>
        ))}
      </Canvas>
    </div>
  )
}

export default App
