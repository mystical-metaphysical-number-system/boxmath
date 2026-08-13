import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import type { DisplayNode } from './lib/displayTree'
import { layout, flattenTree } from './lib/displayTree'
import { nodeColor } from './lib/colors'
import NodeLabel from './NodeLabel'

const SPACING = 1.6

type Props = {
  tree: DisplayNode | null
}

export default function RootedTreeView({ tree }: Props) {
  const { nodes, edges } = useMemo(() => (tree ? flattenTree(layout(tree)) : { nodes: [], edges: [] }), [tree])

  return (
    <Canvas className="viewer-canvas" camera={{ position: [0, -2, 10], fov: 50 }}>
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

      {nodes.map((node, i) => {
        const radius = node.children.length === 0 ? 0.18 : 0.24
        return (
          <mesh key={i} position={[node.x * SPACING, node.y * SPACING, 0]}>
            <sphereGeometry args={[radius, 24, 24]} />
            <meshStandardMaterial color={nodeColor(node)} />
            <NodeLabel position={[0, radius + 0.12, 0]} text={node.name} />
          </mesh>
        )
      })}
    </Canvas>
  )
}
