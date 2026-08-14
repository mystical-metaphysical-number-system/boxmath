import { useRef, type ReactNode } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Mesh } from 'three'
import { type DemoBox, treeDepth, boxSize, INNER_SIZE, GAP } from './lib/demoBox'

const LAYER_HEIGHT = 0.3

// Same hues as POSITIVE_COLOR/NEGATIVE_COLOR in lib/colors.ts. Not
// imported directly — those are hex strings for a single flat color, and
// this view needs the same hue at a range of lightnesses (see
// layoutDemo below) — but they're meant to read as the same two colors
// used everywhere else in the app.
const POSITIVE_HUE = 142
const NEGATIVE_HUE = 4

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

type BoxProps = { box: PositionedBox; selected: boolean; onSelect?: (id: number | null) => void }

// A real ref per box (not just a declarative color prop) is what makes
// this clickable as a specific 3D object: r3f's pointer events already
// raycast against whatever the ref is attached to, nearest-to-camera
// first, which is exactly "select whatever's topmost under the cursor"
// for free — stacked boxes higher up (deeper nesting) sit closer to the
// camera and naturally win the hit test over the larger box beneath them.
// stopPropagation keeps a click from also selecting the boxes *behind*
// the one that was actually clicked. onSelect is optional — a computed
// result box (see App.tsx) has nothing to select into, it's read-only,
// so it's rendered with no onSelect at all rather than a do-nothing stub.
function Box({ box, selected, onSelect }: BoxProps) {
  const ref = useRef<Mesh>(null)
  return (
    <mesh
      ref={ref}
      position={[box.cx, box.y, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!onSelect) return
        e.stopPropagation()
        onSelect(box.id)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!onSelect) return
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

export type NestedBoxesProps = {
  root: DemoBox
  selectedId?: number | null
  onSelect?: (id: number | null) => void
  // Where this box's own left edge sits, in whatever coordinate space
  // the caller is using — not a center. NestedBoxes is left-edge
  // anchored internally (see layoutDemo's own comment: that's what makes
  // "add box" stable), so its rendered footprint is exactly
  // [leftEdge, leftEdge + boxSize(root)], never centered on this value.
  // Defaults to ROOT_LEFT, reproducing the original single-box behavior
  // (a lone leaf renders centered at world x=0) for callers that don't
  // need explicit placement — App.tsx's multi-box equation layout passes
  // this explicitly instead, positioning each box (and the operator/
  // equals labels between them) by real edges rather than reverse-
  // engineering a group offset around this default.
  leftEdge?: number
}

// Just the box content — no Canvas, no camera, no lighting. This is the
// piece useBoxBuilder hands back as `view`: a plain group of meshes that
// drops into whatever <Canvas> it's mounted in, so multiple independent
// box-builders can eventually share one scene (each its own `view`, at
// its own offset) instead of each needing its own Canvas. Exported so
// useBoxBuilder can import it without either file needing to know
// anything about the other's internals beyond this one component.
export function NestedBoxes({ root, selectedId, onSelect, leftEdge = ROOT_LEFT }: NestedBoxesProps) {
  const boxes: PositionedBox[] = []
  layoutDemo(root, leftEdge, 0, 0, treeDepth(root), boxes)

  return (
    <>
      {boxes.map((box) => (
        <Box key={box.id} box={box} selected={box.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  )
}

type BoxSceneProps = {
  children: ReactNode
  onPointerMissed?: () => void
}

// The "skin": Canvas, camera, lighting, controls — everything a box
// `view` needs around it to actually render, but nothing about which
// box(es) it's showing. Deliberately generic (children, not a `root`
// prop) so it can host one view today and several side by side later
// (box, operator, box, operator, result) without this component itself
// changing — only the skin should need touching to reskin it, never the
// box content.
//
// Camera sits at (0, 10, 0.01) rather than exactly (0, 10, 0) — straight
// down the Y axis is a gimbal-lock singularity for lookAt/OrbitControls
// (forward and up vectors go parallel there), so it's nudged a hair
// off-axis while still reading as a top-down view.
export default function BoxScene({ children, onPointerMissed }: BoxSceneProps) {
  return (
    <Canvas className="viewer-canvas" camera={{ position: [0, 10, 0.01], fov: 50 }} onPointerMissed={onPointerMissed}>
      <ambientLight intensity={1} />
      <directionalLight position={[5, 10, 5]} intensity={0.6} />
      <OrbitControls target={[0, 0, 0]} />
      {children}
    </Canvas>
  )
}
