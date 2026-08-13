import { useMemo, useRef } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import type { Mesh } from 'three'
import type { DisplayNode, NamedNode } from './lib/displayTree'
import { layout, flattenTree } from './lib/displayTree'
import { nodeColor } from './lib/colors'
import NodeLabel from './NodeLabel'

const SPACING = 1.6

type TreeNodeProps = { node: NamedNode; selected: boolean; onSelect?: (id: number | null) => void }

// Mirrors BoxView's Box component: a real ref per node is what makes it
// clickable as a specific 3D object (r3f raycasts against it directly),
// and the same emissive-highlight trick marks the selected one. Only
// nodes with an id (clicker-sourced trees — see lib/demoBox.ts) are
// meaningfully selectable; other trees just never match any selectedId,
// so this degrades to "not clickable" without needing a separate flag.
function TreeNode({ node, selected, onSelect }: TreeNodeProps) {
  const ref = useRef<Mesh>(null)
  const radius = node.children.length === 0 ? 0.18 : 0.24
  return (
    <mesh
      ref={ref}
      position={[node.x * SPACING, node.y * SPACING, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!onSelect || node.id === undefined) return
        e.stopPropagation()
        onSelect(node.id)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!onSelect || node.id === undefined) return
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial color={nodeColor(node)} emissive={selected ? '#ffffff' : '#000000'} emissiveIntensity={selected ? 0.35 : 0} />
      <NodeLabel position={[0, radius + 0.12, 0]} text={node.name} />
    </mesh>
  )
}

type Props = {
  tree: DisplayNode | null
  selectedId?: number | null
  onSelect?: (id: number | null) => void
}

export default function RootedTreeView({ tree, selectedId = null, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => (tree ? flattenTree(layout(tree)) : { nodes: [], edges: [] }), [tree])

  return (
    <Canvas
      className="viewer-canvas"
      camera={{ position: [0, -2, 10], fov: 50 }}
      onPointerMissed={() => onSelect?.(null)}
    >
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
        <TreeNode key={i} node={node} selected={node.id !== undefined && node.id === selectedId} onSelect={onSelect} />
      ))}
    </Canvas>
  )
}
