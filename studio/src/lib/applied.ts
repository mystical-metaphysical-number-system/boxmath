import { toRootedTree } from 'boxmath/applied'
import type { DisplayNode } from './displayTree'

// ---------------------------------------------------------------------
// Applied mode: free-text JSON, converted to bigint, rendered as-is.
// ---------------------------------------------------------------------

// JSON has no bigint literal — every leaf JSON.parse hands back is a
// plain number, so convert the whole box to bigint before it reaches
// boxmath/applied, which now deals in bigint exclusively.
export function toBigIntBox(box: any): any {
  if (Array.isArray(box)) return box.map(toBigIntBox)
  if (typeof box === 'number') return BigInt(box)
  return box
}

// Reuse the library's own toRootedTree, then annotate each node with the
// deep sum of every leaf beneath it.
export function toAppliedDisplayTree(box: any): DisplayNode {
  const walk = (node: any): DisplayNode => {
    if (node.children.length === 0) {
      const sum = typeof node.value === 'bigint' ? node.value : 0n
      return { ...node, sum }
    }
    const children = node.children.map(walk)
    const sum = children.reduce((s: bigint, c: DisplayNode) => s + c.sum, 0n)
    return { ...node, sum, children }
  }
  return walk(toRootedTree(box))
}
