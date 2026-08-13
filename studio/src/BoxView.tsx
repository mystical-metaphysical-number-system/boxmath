import { Fragment, useEffect, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Mesh } from 'three'

const INNER_SIZE = 1
// Constant margin a box keeps around whatever's nested directly inside
// it, and the gap between siblings sitting in the same box. Every level
// out (or every extra sibling) adds exactly this much — the gap between a
// box and whatever's next to it never changes no matter how big the
// structure gets. (The alternative — fit everything inside one
// fixed-size outer box — is what the old BoxLayout did, and why deep
// nesting used to shrink into invisible slivers: a fixed outer forces
// its contents to shrink instead of letting the outer grow.)
const GAP = 0.4
const LAYER_HEIGHT = 0.3
const MAX_DEPTH = 8
const MAX_NODES = 24

// Same hues as POSITIVE_COLOR/NEGATIVE_COLOR in lib/colors.ts. Not
// imported directly — those are hex strings for a single flat color, and
// this view needs the same hue at a range of lightnesses (see
// NestedBoxes below) — but they're meant to read as the same two colors
// used everywhere else in the app.
const POSITIVE_HUE = 142
const NEGATIVE_HUE = 4

type DemoBox = { id: number; anti: boolean; children: DemoBox[] }

function treeDepth(node: DemoBox): number {
  return node.children.length === 0 ? 0 : 1 + Math.max(...node.children.map(treeDepth))
}

function countNodes(node: DemoBox): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0)
}

// Removes `targetId` (and everything nested inside it) from the tree,
// wherever it sits. Returns null in the one case there's nothing left to
// return — the target *is* the node being examined — which is also the
// signal a recursive caller uses to drop it from its own children.
function removeNode(node: DemoBox, targetId: number): DemoBox | null {
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
function wrapNode(node: DemoBox, targetId: number, anti: boolean, newId: number): DemoBox {
  if (node.id === targetId) return { id: newId, anti, children: [node] }
  return { ...node, children: node.children.map((c) => wrapNode(c, targetId, anti, newId)) }
}

// Inserts a new empty box as a sibling immediately after `targetId`,
// within whichever node actually holds it as a child — i.e. beside it, at
// its own level, not inside it. The root is nobody's child, so it can't
// be found this way; the call site handles "beside the root" itself by
// falling back to appending into the root's own children, same as plain
// "add box" with nothing selected.
function insertBeside(node: DemoBox, targetId: number, anti: boolean, newId: number): DemoBox {
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
function maxIdNode(node: DemoBox): DemoBox {
  return node.children.reduce((best, c) => {
    const childBest = maxIdNode(c)
    return childBest.id > best.id ? childBest : best
  }, node)
}

// A box's footprint: a leaf is just INNER_SIZE; a parent has to be wide
// enough to lay its children out in a row with a GAP between each pair
// and a GAP margin on both outer edges. One child collapses this to
// `childSize + 2*GAP` — the same "outer grows to fit" rule as before,
// just written to generalize to N children instead of exactly one. This
// total is the same regardless of how the row is anchored (see
// layoutDemo below) — packing the same sizes in a row takes the same
// total span either way. It's also why every ancestor of an edited node
// grows, not just its immediate parent: size is defined bottom-up (sum of
// children's sizes + gaps), so a change at any node recomputes every size
// above it up to the root, all the way through this same formula.
function boxSize(node: DemoBox): number {
  if (node.children.length === 0) return INNER_SIZE
  const childSizes = node.children.map(boxSize)
  const rowWidth = childSizes.reduce((sum, s) => sum + s, 0) + GAP * (childSizes.length - 1)
  return rowWidth + 2 * GAP
}

type PositionedBox = { id: number; anti: boolean; cx: number; y: number; size: number; depth: number; color: string }

// Every box stays a square (this recursion only ever moves things along
// x) — depth becomes height instead: a child's row sits one LAYER_HEIGHT
// above its parent, wedding-cake style, so a straight-down camera reads
// nesting as concentric/offset squares and siblings read as boxes side by
// side within the same ring.
//
// Anchored by each box's LEFT edge, not its center: child 0's slot starts
// GAP in from this box's own left edge, and each sibling after it is
// appended flush against the previous one's right edge — packing depends
// only on the sizes of *preceding* siblings, never on how many more get
// added later. That's what makes it stable: appending a new sibling can
// only extend the row (and this box's own footprint) rightward, it never
// moves anything already placed.
//
// This also happens to be the only anchoring that nests correctly: a box
// with several children isn't centered on its own left edge (only a
// single child would be) — pinning that child's *center* to the parent's
// reference point (an earlier version of this function did exactly that)
// undersizes the margin on one side and oversizes it on the other,
// producing a lopsided wrap the moment you nest something that already
// has siblings. Anchoring by left edge sidesteps that: nesting still
// shifts the wrapped subtree by one constant GAP (uniform, so every
// relative spacing inside it is preserved exactly), but the wrap itself
// is never lopsided, for any shape of subtree.
function layoutDemo(node: DemoBox, leftEdge: number, y: number, depth: number, maxDepth: number, out: PositionedBox[]): void {
  const size = boxSize(node)
  const cx = leftEdge + size / 2
  // Every level needs a visibly different shade — same color on two
  // adjacent rings/boxes makes them read as one solid shape from
  // top-down, hiding exactly the nesting this view exists to show.
  // Lightness ramps from the accent hue at the root (depth 0) down to a
  // pale tint at the deepest level; the hue itself is per-box, not
  // per-tree — color is local, same rule the app's real pure mode uses (a
  // box is red iff it's itself marked anti, full stop, regardless of
  // what's nested inside it).
  const t = maxDepth > 0 ? depth / maxDepth : 0
  const lightness = 40 + t * 42
  const hue = node.anti ? NEGATIVE_HUE : POSITIVE_HUE
  out.push({ id: node.id, anti: node.anti, cx, y, size, depth, color: `hsl(${hue}, 65%, ${lightness}%)` })
  if (node.children.length === 0) return

  const childY = y + LAYER_HEIGHT
  let cursor = leftEdge + GAP
  for (const child of node.children) {
    layoutDemo(child, cursor, childY, depth + 1, maxDepth, out)
    cursor += boxSize(child) + GAP
  }
}

// A lone leaf root then renders centered at world x=0, matching the
// original single-box view.
const ROOT_LEFT = -INNER_SIZE / 2

type BoxProps = { box: PositionedBox; selected: boolean; onSelect: (id: number) => void }

// A real ref per box (not just a declarative color prop) is what makes
// this clickable as a specific 3D object: r3f's pointer events already
// raycast against whatever the ref is attached to, nearest-to-camera
// first, which is exactly "select whatever's topmost under the cursor"
// for free — stacked boxes higher up (deeper nesting) sit closer to the
// camera and naturally win the hit test over the larger box beneath them.
// stopPropagation keeps a click from also selecting the boxes *behind*
// the one that was actually clicked.
function Box({ box, selected, onSelect }: BoxProps) {
  const ref = useRef<Mesh>(null)
  return (
    <mesh
      ref={ref}
      position={[box.cx, box.y, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect(box.id)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={[box.size, LAYER_HEIGHT, box.size]} />
      <meshStandardMaterial color={box.color} emissive={selected ? '#ffffff' : '#000000'} emissiveIntensity={selected ? 0.35 : 0} />
    </mesh>
  )
}

type NestedBoxesProps = { root: DemoBox; selectedId: number | null; onSelect: (id: number) => void }

function NestedBoxes({ root, selectedId, onSelect }: NestedBoxesProps) {
  const boxes: PositionedBox[] = []
  layoutDemo(root, ROOT_LEFT, 0, 0, treeDepth(root), boxes)

  return (
    <>
      {boxes.map((box) => (
        <Box key={box.id} box={box} selected={box.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  )
}

type NotationProps = { node: DemoBox; selectedId: number | null; onSelect: (id: number) => void }

// The bracket text and the 3D boxes are two views of the same tree — this
// renders one bracket pair per node, each independently clickable and
// highlighted in sync with its 3D box, via the same selectedId/onSelect
// the scene uses. Mirrors the app's real pure-mode syntax: `]` for a
// plain box, `]ᵃ` for one marked anti.
function Notation({ node, selectedId, onSelect }: NotationProps) {
  return (
    <span
      className={node.id === selectedId ? 'selected' : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
    >
      [
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 ? ' ' : ''}
          <Notation node={child} selectedId={selectedId} onSelect={onSelect} />
        </Fragment>
      ))}
      {node.anti ? ']ᵃ' : ']'}
    </span>
  )
}

// Stripped-down, self-contained demo — independent of the app's real
// box-parsing input for now. Every operation targets the current
// selection (the cursor): "nest"/"antinest" wrap the selected box in a
// new one, plain or anti; "add box"/"add antibox" instead slot a new
// empty box in beside it, within its own parent. With nothing selected,
// both fall back to the whole tree — wrapping/adding-beside the root IS
// the whole tree, so this is the same as the old always-global behavior,
// not a separate case. Click a box (in the scene or in the bracket text —
// both select the same node) to move the cursor; "delete" then removes
// it and everything nested inside it. With nothing selected, delete
// greedily targets the most recently added box instead — which is
// exactly nest/add-box's own inverse, so there's no separate undo/history
// state to maintain: delete-with-no-selection already behaves like one.
//
// Camera sits at (0, 10, 0.01) rather than exactly (0, 10, 0) — straight
// down the Y axis is a gimbal-lock singularity for lookAt/OrbitControls
// (forward and up vectors go parallel there), so it's nudged a hair
// off-axis while still reading as a top-down view.
export default function BoxView() {
  const nextId = useRef(1)
  const makeLeaf = (anti: boolean): DemoBox => ({ id: nextId.current++, anti, children: [] })
  const [root, setRoot] = useState<DemoBox>(() => makeLeaf(false))
  // Starts on the initial box, not null — the cursor should always be
  // somewhere, the same way a text cursor is never "nowhere." Neither
  // nest nor add-box ever needs to touch this afterward: nest wraps the
  // selected node without modifying it (so the cursor, still pointing at
  // the same id, now correctly refers to the newly-inner box), and
  // add-box doesn't modify the selected node either (so the cursor stays
  // on the same, still-outer box) — the "inner vs. outer" distinction
  // falls out of what each operation actually does to node identity,
  // rather than needing to be asserted separately per button.
  const [selectedId, setSelectedId] = useState<number | null>(() => root.id)

  const depth = treeDepth(root)
  const nodeCount = countNodes(root)
  const canNest = depth < MAX_DEPTH && nodeCount < MAX_NODES
  const canAddBox = nodeCount < MAX_NODES
  // A bare empty root has nothing to delete: the "selected/last" target
  // would just be the root itself, and resetting it to a fresh empty leaf
  // is a no-op on a tree that's already exactly that.
  const canDelete = nodeCount > 1

  // Both target the current selection, falling back to the root when
  // nothing's selected — which is exactly today's whole-tree behavior,
  // since wrapping/adding-beside the root IS the whole tree.
  const nest = (anti: boolean) => {
    if (!canNest) return
    const targetId = selectedId ?? root.id
    setRoot((r) => wrapNode(r, targetId, anti, nextId.current++))
  }
  const addBox = (anti: boolean) => {
    if (!canAddBox) return
    const targetId = selectedId ?? root.id
    setRoot((r) =>
      targetId === r.id
        ? { ...r, children: [...r.children, makeLeaf(anti)] }
        : insertBeside(r, targetId, anti, nextId.current++),
    )
  }
  const deleteAction = () => {
    if (!canDelete) return
    const targetId = selectedId ?? maxIdNode(root).id
    setRoot((r) => (targetId === r.id ? makeLeaf(false) : (removeNode(r, targetId) ?? makeLeaf(false))))
    setSelectedId(null)
  }

  // Backspace/Delete triggers the same action as the button — the "from
  // cursor" part of the metaphor, greedy fallback included. Guarded
  // against firing while focus is in one of the app's actual text inputs
  // (the Applied textarea, the Pure contentEditable), since both panes
  // are visible and live at once; this shouldn't steal a real backspace
  // out of someone's typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!canDelete) return
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      const active = document.activeElement
      if (active instanceof HTMLElement && (active.tagName === 'TEXTAREA' || active.isContentEditable)) return
      e.preventDefault()
      deleteAction()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="box-view-wrap">
      <div className="box-nest-controls">
        <button type="button" onClick={deleteAction} disabled={!canDelete}>
          delete
        </button>
        <span className="box-nest-notation">
          <Notation node={root} selectedId={selectedId} onSelect={setSelectedId} />
        </span>
        <button type="button" className="positive" onClick={() => addBox(false)} disabled={!canAddBox}>
          add box
        </button>
        <button type="button" className="negative" onClick={() => addBox(true)} disabled={!canAddBox}>
          add antibox
        </button>
        <button type="button" className="positive" onClick={() => nest(false)} disabled={!canNest}>
          nest
        </button>
        <button type="button" className="negative" onClick={() => nest(true)} disabled={!canNest}>
          antinest
        </button>
      </div>
      <Canvas
        className="viewer-canvas"
        camera={{ position: [0, 10, 0.01], fov: 50 }}
        onPointerMissed={() => setSelectedId(null)}
      >
        <ambientLight intensity={1} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
        <OrbitControls target={[0, 0, 0]} />
        <NestedBoxes root={root} selectedId={selectedId} onSelect={setSelectedId} />
      </Canvas>
    </div>
  )
}
