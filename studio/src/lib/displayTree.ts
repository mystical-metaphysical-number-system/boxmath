// The shape both modes (applied/pure) normalize into before layout —
// everything downstream (rooted-tree view, box view, coloring) reads only
// this, never the mode-specific parse trees.
export type DisplayNode = {
  value: bigint | null
  label?: string | null
  type: string
  sum: bigint
  children: DisplayNode[]
}

export type LaidOutNode = Omit<DisplayNode, 'children'> & { x: number; y: number; children: LaidOutNode[] }
export type NamedNode = LaidOutNode & { name: string }

// ---------------------------------------------------------------------
// Rooted-tree layout: leaves get increasing x, depth becomes -y. Internal
// nodes sit centered above the average x of their children.
// ---------------------------------------------------------------------

function layoutRaw(node: DisplayNode, depth: number, xRef: { current: number }): LaidOutNode {
  if (node.children.length === 0) {
    // No scale/shift here — x is just "the next unused integer slot,"
    // handed out left-to-right as leaves are visited.
    const x = xRef.current
    xRef.current += 1
    // scale: depth (0, 1, 2, ...) becomes y (0, -1, -2, ...) — flip sign
    // so deeper nodes go down the screen instead of up.
    return { ...node, x, y: -depth, children: [] }
  }
  const children = node.children.map((c) => layoutRaw(c, depth + 1, xRef))
  // Not a shift/scale — the mean of the children's x, so a parent sits
  // centered above its own subtree.
  const x = children.reduce((sum, c) => sum + c.x, 0) / children.length
  return { ...node, x, y: -depth, children }
}

// Pure shift: every node (and its whole subtree) moves by the same
// constant (dx, dy). No scaling — relative spacing between nodes is
// untouched.
function shiftTree(node: LaidOutNode, dx: number, dy: number): LaidOutNode {
  return { ...node, x: node.x + dx, y: node.y + dy, children: node.children.map((c) => shiftTree(c, dx, dy)) }
}

function treeHeight(node: DisplayNode): number {
  return node.children.length === 0 ? 0 : 1 + Math.max(...node.children.map(treeHeight))
}

// layoutRaw only ever grows into +x/-y, so the tree ends up sitting off
// to one side of the origin instead of on it — center it afterward so the
// camera/OrbitControls target (0,0,0) actually lands in the middle.
export function layout(node: DisplayNode): LaidOutNode {
  const xRef = { current: 0 }
  const raw = layoutRaw(node, 0, xRef)
  const leafSpan = xRef.current - 1
  // shift by (-leafSpan/2, +treeHeight/2): leafSpan/2 is half the tree's
  // total width, so subtracting it moves the horizontal center from
  // leafSpan/2 to 0; treeHeight/2 does the same vertically (root is at
  // y=0, deepest leaf at y=-treeHeight, so the tree's vertical midpoint
  // sits at -treeHeight/2 — adding treeHeight/2 brings that to 0 too).
  return shiftTree(raw, -leafSpan / 2, treeHeight(node) / 2)
}

// Resolves each node's display name once, so views don't each reinvent
// the same fallback: an explicit label wins, then a concrete leaf value
// (as-is, unadorned — "1" is more useful than "Natural_1"), and only when
// neither applies (an internal node with no explicit label) do we fall
// back to "Type_N" — a running count per type, so e.g. the second
// Polynumber node in the tree reads as "Polynumber_2", not just another
// unlabeled "Polynumber" indistinguishable from the first.
export function flattenTree(root: LaidOutNode): { nodes: NamedNode[]; edges: [number, number][] } {
  const nodes: NamedNode[] = []
  const edges: [number, number][] = []
  const typeCounts = new Map<string, number>()
  const walk = (node: LaidOutNode, parentId: number | null) => {
    const id = nodes.length
    let name: string
    if (node.label != null) {
      name = node.label
    } else if (node.value !== null) {
      name = node.value.toString()
    } else {
      const count = (typeCounts.get(node.type) ?? 0) + 1
      typeCounts.set(node.type, count)
      name = `${node.type}_${count}`
    }
    nodes.push({ ...node, name })
    if (parentId !== null) edges.push([parentId, id])
    for (const child of node.children) walk(child, id)
  }
  walk(root, null)
  return { nodes, edges }
}
