import type { DisplayNode } from './displayTree'

// ---------------------------------------------------------------------
// "Box form" layout — literal boxes inside boxes, viewed from above.
// Every node, leaf or not, is a plain square. A box's children sit on a
// square grid inside it, each shrunk a bit — that visible margin is the
// only thing that reads as "this box's border," no separate frame
// geometry needed. Coordinates come out in the same world units BoxView
// renders with directly, so there's no separate normalize-then-rescale
// pass.
// ---------------------------------------------------------------------

export const ROOT_SIZE = 6

// How much smaller than its grid cell a child sits — the gap this leaves
// around it is what makes the parent square read as a frame around it.
const SHRINK = 0.85

export type BoxNode = Omit<DisplayNode, 'children'> & {
  cx: number
  cy: number
  size: number
  depth: number
  children: BoxNode[]
}

function place(node: DisplayNode, cx: number, cy: number, size: number, depth: number): BoxNode {
  if (node.children.length === 0) {
    return { ...node, cx, cy, size, depth, children: [] }
  }

  const cols = Math.ceil(Math.sqrt(node.children.length))
  const rows = Math.ceil(node.children.length / cols)
  // scale: parent's size down to the size of one grid cell.
  const cell = size / Math.max(cols, rows)

  const children = node.children.map((child, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    // Both childCx/childCy build up the same way, in three steps:
    //   1. start at cx/cy         — the parent's own center
    //   2. shift by ±(dim*cell)/2 — jump to the grid's edge (half the grid's total width/height)
    //   3. scale col/row by cell, then shift +0.5*cell — walk `col`/`row` cells
    //      in from that edge and land in the middle of the target cell,
    //      not its corner
    // y is flipped (+ then -) vs x (- then +) only because row 0 is the
    // top row, but y grows upward.
    const childCx = cx - (cols * cell) / 2 + cell * (col + 0.5)
    const childCy = cy + (rows * cell) / 2 - cell * (row + 0.5)
    // scale: shrink the cell down to leave a visible margin (the "frame").
    return place(child, childCx, childCy, cell * SHRINK, depth + 1)
  })

  return { ...node, cx, cy, size, depth, children }
}

export function layoutBoxes(tree: DisplayNode): BoxNode {
  return place(tree, 0, 0, ROOT_SIZE, 0)
}

export function flattenBoxes(root: BoxNode): BoxNode[] {
  const out: BoxNode[] = []
  const walk = (node: BoxNode) => {
    out.push(node)
    for (const child of node.children) walk(child)
  }
  walk(root)
  return out
}
