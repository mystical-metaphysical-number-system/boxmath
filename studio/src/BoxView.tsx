import { useRef } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Mesh } from 'three'
import { type DemoBox, treeDepth } from './lib/demoBox'

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

// Same hues as POSITIVE_COLOR/NEGATIVE_COLOR in lib/colors.ts. Not
// imported directly — those are hex strings for a single flat color, and
// this view needs the same hue at a range of lightnesses (see
// layoutDemo below) — but they're meant to read as the same two colors
// used everywhere else in the app.
const POSITIVE_HUE = 142
const NEGATIVE_HUE = 4

// A box's footprint: a leaf is just INNER_SIZE; a parent has to be wide
// enough to lay its children out in a row with a GAP between each pair
// and a GAP margin on both outer edges. One child collapses this to
// `childSize + 2*GAP` — the same "outer grows to fit" rule generalized to
// N children instead of exactly one. It's also why every ancestor of an
// edited node grows, not just its immediate parent: size is defined
// bottom-up (sum of children's sizes + gaps), so a change at any node
// recomputes every size above it up to the root, through this same
// formula.
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

// A lone leaf root then renders centered at world x=0.
const ROOT_LEFT = -INNER_SIZE / 2

type BoxProps = { box: PositionedBox; selected: boolean; onSelect: (id: number | null) => void }

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

type NestedBoxesProps = { root: DemoBox; selectedId: number | null; onSelect: (id: number | null) => void }

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

type Props = { root: DemoBox; selectedId: number | null; onSelect: (id: number | null) => void }

// Purely a renderer: the "clicker" box-builder's state/editing logic
// lives in useBoxBuilder, shared with the sidebar controls — this just
// draws whatever tree it's handed and reports clicks back up. Always
// shows the clicker's own tree, independent of whichever input
// (Applied JSON / Pure text / Pure clicker) currently governs the rooted
// tree below, so it stays usable as its own tool regardless of mode.
//
// Camera sits at (0, 10, 0.01) rather than exactly (0, 10, 0) — straight
// down the Y axis is a gimbal-lock singularity for lookAt/OrbitControls
// (forward and up vectors go parallel there), so it's nudged a hair
// off-axis while still reading as a top-down view.
export default function BoxView({ root, selectedId, onSelect }: Props) {
  return (
    <Canvas className="viewer-canvas" camera={{ position: [0, 10, 0.01], fov: 50 }} onPointerMissed={() => onSelect(null)}>
      <ambientLight intensity={1} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} />
      <OrbitControls target={[0, 0, 0]} />
      <NestedBoxes root={root} selectedId={selectedId} onSelect={onSelect} />
    </Canvas>
  )
}
