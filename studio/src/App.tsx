import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import { toRootedTree, getRank, getDegree, findType } from 'boxmath/applied'
import './App.css'

// Just two colors, one meaning: red if a negative value lives anywhere
// at or below this node, blue otherwise. No separate color for type/rank —
// that's a different question from sign, and mixing the two into one
// legend is what made six colors mean nothing.
const POSITIVE_COLOR = '#3b82f6'
const NEGATIVE_COLOR = '#ef4444'

// Annotate every node with whether it (or anything below it) is negative.
function markNegative(node: any): any {
  if (node.children.length === 0) {
    return { ...node, negative: typeof node.value === 'number' && node.value < 0 }
  }
  const children = node.children.map(markNegative)
  return { ...node, negative: children.some((c: any) => c.negative), children }
}

const nodeColor = (node: any): string => (node.negative ? NEGATIVE_COLOR : POSITIVE_COLOR)

const SPACING = 1.6

// Simple tree layout: leaves get increasing x, depth becomes -y.
// Internal nodes sit centered above the average x of their children.
function layout(node: any, depth = 0, xRef = { current: 0 }): any {
  if (node.children.length === 0) {
    const x = xRef.current
    xRef.current += 1
    return { ...node, x, y: -depth, children: [] }
  }
  const children = node.children.map((c: any) => layout(c, depth + 1, xRef))
  const x = children.reduce((sum: number, c: any) => sum + c.x, 0) / children.length
  return { ...node, x, y: -depth, children }
}

// Flatten the laid-out tree into a node list plus [parentId, childId] edges,
// which is what a Canvas actually wants to iterate over.
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

function App() {
  const [text, setText] = useState(DEFAULT_BOX)
  const [error, setError] = useState<string | null>(null)

  const { nodes, edges, info } = useMemo(() => {
    try {
      const box = JSON.parse(text)
      const tree = layout(markNegative(toRootedTree(box)))
      const { nodes, edges } = flattenTree(tree)
      setError(null)
      return {
        nodes,
        edges,
        info: {
          type: findType(box),
          // box depth = tree height, in the paper's own dictionary; this
          // is also this box's "horizon" — how far down it actually goes.
          horizon: getRank(box),
          degree: getDegree(box),
          size: nodes.length,
          leaves: nodes.filter((n) => n.children.length === 0).length,
        },
      }
    } catch (err) {
      setError((err as Error).message)
      return { nodes: [], edges: [], info: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <div id="studio">
      <aside id="panel">
        <h1>boxmath studio</h1>
        <p>Enter a box (nested array). It renders as a rooted tree.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        {error && <p className="error">{error}</p>}

        {info && (
          <dl id="info">
            <dt>Type</dt>
            <dd>{info.type}</dd>
            <dt>Horizon (height)</dt>
            <dd>{info.horizon}</dd>
            <dt>Degree</dt>
            <dd>{info.degree}</dd>
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
            negative (somewhere below)
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
                {node.value !== null ? node.value : node.type}
              </div>
            </Html>
          </mesh>
        ))}
      </Canvas>
    </div>
  )
}

export default App
