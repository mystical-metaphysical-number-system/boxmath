import type { PureNode } from './pure'
import type { DisplayNode } from './displayTree'

// The "clicker" tree: a box-builder alternative to typing `0`/`0ᵃ` pure
// text directly. Every node is a box (empty or nested) — never a bare
// unit, since the clicker only ever creates boxes — carrying a stable id
// so the UI can track selection/identity across edits, independent of
// tree shape.
export type DemoBox = { id: number; anti: boolean; children: DemoBox[] }

export const MAX_DEPTH = 8
export const MAX_NODES = 24

// Shared with BoxScene's rendering: a leaf box is INNER_SIZE across, and
// GAP is the constant margin a box keeps around whatever's nested
// directly inside it. Living here (not BoxScene.tsx) is what lets
// boxSize below be plain DemoBox math, importable anywhere a box's
// footprint needs to be known — e.g. App.tsx positioning two boxes side
// by side without ever overlapping, however large either grows.
export const INNER_SIZE = 1
export const GAP = 0.4

export function treeDepth(node: DemoBox): number {
  return node.children.length === 0 ? 0 : 1 + Math.max(...node.children.map(treeDepth))
}

export function countNodes(node: DemoBox): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0)
}

// A box's footprint: a leaf is just INNER_SIZE; a parent has to be wide
// enough to lay its children out in a row with a GAP between each pair
// and a GAP margin on both outer edges. One child collapses this to
// `childSize + 2*GAP` — the same "outer grows to fit" rule generalized to
// N children instead of exactly one. It's also why every ancestor of an
// edited node grows, not just its immediate parent: size is defined
// bottom-up (sum of children's sizes + gaps), so a change at any node
// recomputes every size above it up to the root, through this same
// formula.
export function boxSize(node: DemoBox): number {
  if (node.children.length === 0) return INNER_SIZE
  const childSizes = node.children.map(boxSize)
  const rowWidth = childSizes.reduce((sum, s) => sum + s, 0) + GAP * (childSizes.length - 1)
  return rowWidth + 2 * GAP
}

// Mirrors the app's real pure-mode syntax: `]` for a plain box, `]ᵃ` for
// one marked anti.
export function notationOf(node: DemoBox): string {
  return '[' + node.children.map(notationOf).join(' ') + (node.anti ? ']ᵃ' : ']')
}

// A node's shape ignoring its own top-level sign, but including every
// nested descendant's — exactly the shape a node and its anti-object
// share (the board's Mᵃ: M with only the outer sign flipped, nothing
// underneath touched). Sorted so it's insensitive to child order — boxes
// are msets, not ordered lists, so two children in either order are the
// same box.
function magnitudeKey(node: DemoBox): string {
  const childKeys = node.children.map(structureKey).sort()
  return `[${childKeys.join(',')}]`
}

function structureKey(node: DemoBox): string {
  return `${node.anti ? 'a' : 'p'}${magnitudeKey(node)}`
}

// [M Mᵃ] = [] — a box and its exact anti-object, sitting together as
// siblings, annihilate. Recurses into every child first so nested
// cancellations resolve before this level's own are checked, then
// greedily pairs off same-magnitude, opposite-sign children one at a
// time — so three copies of M against one Mᵃ leaves two M's behind, not
// zero, rather than either over- or under-cancelling.
export function reduceBox(node: DemoBox): DemoBox {
  const remaining = node.children.map(reduceBox)
  const kept: DemoBox[] = []
  while (remaining.length > 0) {
    const x = remaining.shift()!
    const xKey = magnitudeKey(x)
    const matchIndex = remaining.findIndex((y) => y.anti !== x.anti && magnitudeKey(y) === xKey)
    if (matchIndex === -1) {
      kept.push(x)
    } else {
      remaining.splice(matchIndex, 1)
    }
  }
  return { ...node, children: kept }
}

// A DemoBox is already a strict subset of PureNode's shape — every node
// is PureNode's 'box' variant, just never its 'unit' variant, since the
// clicker has no way to create a bare unit. Converting lets the clicker's
// tree flow through the exact same pureNodeToDisplay / evaluatePure /
// layout pipeline the text editor already uses, rather than duplicating
// any of that: two different ways of building the tree, one pipeline for
// everything downstream (coloring included).
export function demoBoxToPureNode(node: DemoBox): PureNode {
  return { type: 'box', negate: node.anti, children: node.children.map(demoBoxToPureNode) }
}

// A second, direct DemoBox -> DisplayNode conversion, rather than routing
// through demoBoxToPureNode + pureNodeToDisplay: PureNode has no id field
// (parsePure's text-based trees have no such identity to give it), so
// that path can't carry one through. This one can — it computes the
// exact same label/type/sum pureNodeToDisplay's box branch would (so
// coloring can't drift between the two paths), just stamped with this
// node's id, which is what lets the rooted tree and the 3D scene
// highlight the same node in sync.
export function demoBoxToDisplayNode(node: DemoBox): DisplayNode {
  return {
    id: node.id,
    value: null,
    label: node.children.length === 0 ? (node.anti ? '[ ]ᵃ' : '[ ]') : null,
    type: node.anti ? 'anti-box' : 'box',
    sum: node.anti ? -1n : 1n,
    children: node.children.map(demoBoxToDisplayNode),
  }
}

// Removes `targetId` (and everything nested inside it) from the tree,
// wherever it sits. Returns null in the one case there's nothing left to
// return — the target *is* the node being examined — which is also the
// signal a recursive caller uses to drop it from its own children.
export function removeNode(node: DemoBox, targetId: number): DemoBox | null {
  if (node.id === targetId) return null
  const children = node.children.flatMap((c) => {
    const next = removeNode(c, targetId)
    return next === null ? [] : [next]
  })
  return { ...node, children }
}

// Wraps `targetId` in a brand-new box, in place, wherever it sits — the
// target itself is carried over unmodified (same id, same contents), just
// relocated one level deeper as the new box's sole child. When the target
// *is* the tree's root, "in place" is the whole tree: the new box becomes
// the new root, exactly matching plain "nest everything" (which is also
// what a null selection falls back to at the call site).
export function wrapNode(node: DemoBox, targetId: number, anti: boolean, newId: number): DemoBox {
  if (node.id === targetId) return { id: newId, anti, children: [node] }
  return { ...node, children: node.children.map((c) => wrapNode(c, targetId, anti, newId)) }
}

// Inserts a new empty box as a sibling immediately after `targetId`,
// within whichever node actually holds it as a child — i.e. beside it, at
// its own level, not inside it. The root is nobody's child, so it can't
// be found this way; the call site handles "beside the root" itself by
// falling back to appending into the root's own children, same as plain
// "add box" with nothing selected.
export function insertBeside(node: DemoBox, targetId: number, anti: boolean, newId: number): DemoBox {
  const i = node.children.findIndex((c) => c.id === targetId)
  if (i === -1) return { ...node, children: node.children.map((c) => insertBeside(c, targetId, anti, newId)) }
  const children = [...node.children]
  children.splice(i + 1, 0, { id: newId, anti, children: [] })
  return { ...node, children }
}

// ids only ever go up (nest and add-box both mint a fresh one from the
// same counter, never reuse one), so "the node with the largest id still
// in the tree" is exactly "whatever was added most recently and hasn't
// already been deleted" — computed fresh from the tree each time rather
// than tracked separately, so it's automatically correct after a delete
// too, with no separate bookkeeping to keep in sync.
export function maxIdNode(node: DemoBox): DemoBox {
  return node.children.reduce((best, c) => {
    const childBest = maxIdNode(c)
    return childBest.id > best.id ? childBest : best
  }, node)
}
