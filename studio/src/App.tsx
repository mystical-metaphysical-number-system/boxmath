import { useMemo, useState } from 'react'
import { findType, getDegree, getRank } from 'boxmath/applied'
import { toAppliedDisplayTree, toBigIntBox } from './lib/applied'
import { DEFAULT_PURE_TEXT, evaluatePure, formatPureValue, parsePure, pureCountLeaves, pureCountNodes, pureHeight, pureNodeToDisplay, pureValue, type PureNode } from './lib/pure'
import { demoBoxToDisplayNode, demoBoxToPureNode, boxSize, INNER_SIZE, type DemoBox } from './lib/demoBox'
import { applyOperator, distributeOperator, type Operator } from './lib/boxOperations'
import type { DisplayNode } from './lib/displayTree'
import InputPanel, { type AppliedInfo, type Mode, type PureEditMode, type PureInfo } from './InputPanel'
import RootedTreeView from './RootedTreeView'
import BoxScene, { NestedBoxes } from './BoxScene'
import NodeLabel from './NodeLabel'
import { useBoxBuilder } from './useBoxBuilder'
import { usePanelWidth } from './usePanelWidth'
import './App.css'

const DEFAULT_BOX = '[[1,2],[3,4,5]]'

// Shared by both pure-mode input methods (typed text or the clicker) —
// same PureNode in, same DisplayNode/info out, so coloring/layout can't
// drift between them: it's one code path either way.
function pureInfo(parsed: PureNode): PureInfo {
  return {
    evaluate: formatPureValue(evaluatePure(parsed)),
    netValue: pureValue(parsed).toString(),
    height: pureHeight(parsed),
    size: pureCountNodes(parsed),
    leaves: pureCountLeaves(parsed),
  }
}

function App() {
  const [text, setText] = useState(DEFAULT_BOX)
  // Applied is greyed out in the sidebar for now (see InputPanel's
  // mode-toggle) — starting there would land on an unreachable mode with
  // no way back to it via the UI.
  const [mode, setMode] = useState<Mode>('pure')
  const [pureEditMode, setPureEditMode] = useState<PureEditMode>('clicker')
  const [pureText, setPureText] = useState(DEFAULT_PURE_TEXT)
  const boxA = useBoxBuilder()
  const boxB = useBoxBuilder()
  const panel = usePanelWidth()

  // Which box the shared nest/add-box/delete controls act on — not a
  // separate control surface per box, the *same* buttons just retarget.
  // Clicking into either box (its bracket text or its own 3D content)
  // makes it active; selectA/selectB below are what every click handler
  // for that box goes through, so switching activeBox is a side effect
  // of selecting, never a separate step.
  const [operator, setOperator] = useState<Operator | null>(null)
  // x/^ are genuine cartesian products, so there's a real intermediate
  // stage to show: the (ai, bi) pairs before they're merged/multiplied
  // into single terms — the board's "distribute into pairs, then
  // evaluate" reading of A x (B+C) = (AxB)+(AxC). + is a union, not a
  // product — there's no pairing to distribute in the first place, so it
  // only ever shows 'evaluate'. Clicking a fresh operator starts at
  // 'distribute' for x/^ (straight to 'evaluate' for +); clicking the
  // *same* operator again advances distribute -> evaluate, or clears it.
  const [stage, setStage] = useState<'distribute' | 'evaluate'>('evaluate')
  const handleOperatorClick = (op: Operator) => {
    if (operator !== op) {
      setOperator(op)
      setStage(op === '+' ? 'evaluate' : 'distribute')
      return
    }
    if (op !== '+' && stage === 'distribute') {
      setStage('evaluate')
      return
    }
    setOperator(null)
  }
  const [activeBox, setActiveBox] = useState<'A' | 'B'>('A')
  const selectA = (id: number | null) => {
    setActiveBox('A')
    boxA.setSelectedId(id)
  }
  const selectB = (id: number | null) => {
    setActiveBox('B')
    boxB.setSelectedId(id)
  }
  const activeBuilder = activeBox === 'A' ? boxA : boxB

  // A + B = C — computed fresh from A/B every time either changes (or the
  // operator/stage does), never mutated/stored: it's a pure function of
  // the two live trees, the same way a spreadsheet formula cell is a
  // function of its inputs, not its own independent state. nextId only
  // needs to be unique *within* this one result tree (see
  // applyOperator's own doc), so a plain counter reset on every
  // computation is enough — it doesn't need to coordinate with boxA/
  // boxB's own id counters at all.
  const result = useMemo((): DemoBox | null => {
    if (!operator) return null
    let id = 1
    const combine = stage === 'distribute' ? distributeOperator : applyOperator
    return combine(operator, boxA.root, boxB.root, () => id++)
  }, [operator, stage, boxA.root, boxB.root])

  // Boxes grow (nest/add-box has no upper bound besides MAX_NODES), so
  // fixed split positions eventually overlap — this instead lays the
  // whole equation out left to right using each term's *actual* current
  // size, then shifts the entire thing so it's centered on x=0, the same
  // spot a single box has always rendered at.
  //
  // Worked in terms of *left edges*, not centers, and deliberately so:
  // NestedBoxes is itself left-edge anchored (a box's rendered footprint
  // is exactly [leftEdge, leftEdge + size], see its own doc for why), so
  // reasoning in the same terms it does is what keeps this correct as
  // sizes change — an earlier version of this computed *centers* and
  // wrapped each box in a <group> at that offset, which quietly assumed
  // NestedBoxes centers itself locally. It doesn't, so the operator/
  // equals labels (placed relative to those assumed centers) drifted out
  // of sync with where a growing box's edge actually ended up, even
  // though the boxes' own overlap-avoidance (computed the same left-edge
  // way as here) stayed correct throughout.
  const SPLIT_GAP = 1.5
  const SYMBOL_SPACE = 1
  const sizeA = useMemo(() => boxSize(boxA.root), [boxA.root])
  const sizeB = useMemo(() => boxSize(boxB.root), [boxB.root])
  const sizeC = useMemo(() => (result ? boxSize(result) : 0), [result])

  const equation = useMemo(() => {
    if (!operator || !result) return { leftA: -INNER_SIZE / 2, leftB: 0, leftC: 0, xOp: 0, xEq: 0 }
    let cursor = 0
    const leftA = cursor
    cursor += sizeA + SPLIT_GAP
    const xOp = cursor + SYMBOL_SPACE / 2
    cursor += SYMBOL_SPACE + SPLIT_GAP
    const leftB = cursor
    cursor += sizeB + SPLIT_GAP
    const xEq = cursor + SYMBOL_SPACE / 2
    cursor += SYMBOL_SPACE + SPLIT_GAP
    const leftC = cursor
    cursor += sizeC
    const shift = cursor / 2
    return { leftA: leftA - shift, leftB: leftB - shift, leftC: leftC - shift, xOp: xOp - shift, xEq: xEq - shift }
  }, [operator, result, sizeA, sizeB, sizeC])

  // The one computation both viewers hang off of: parse whichever
  // mode/input is active into a DisplayNode tree. Each viewer lays that
  // same tree out its own way (rooted tree vs. nested boxes), but they're
  // reacting to one shared value, so an edit — typed or clicked —
  // recomputes both in the same render.
  const { tree, info, error, pureError } = useMemo((): {
    tree: DisplayNode | null
    info: AppliedInfo | PureInfo | null
    error: string | null
    pureError: string | null
  } => {
    if (mode === 'pure') {
      // The clicker's tree is built structurally (nest/add-box/delete),
      // never parsed from text, so there's nothing here that can fail —
      // no try/catch needed, unlike the typed-text path below it.
      if (pureEditMode === 'clicker') {
        // demoBoxToDisplayNode rather than pureNodeToDisplay(demoBoxToPureNode(...)):
        // computes the identical label/type/sum, just also stamped with
        // each node's id — that id is what selection-syncing with the 3D
        // scene needs, and PureNode has nowhere to carry it.
        return {
          tree: demoBoxToDisplayNode(boxA.root),
          error: null,
          pureError: null,
          info: pureInfo(demoBoxToPureNode(boxA.root)),
        }
      }
      try {
        const parsed = parsePure(pureText)
        return { tree: pureNodeToDisplay(parsed), error: null, pureError: null, info: pureInfo(parsed) }
      } catch (err) {
        return { tree: null, info: null, error: null, pureError: (err as Error).message }
      }
    }
    try {
      const box = toBigIntBox(JSON.parse(text))
      const displayTree = toAppliedDisplayTree(box)
      const nodeCount = (n: DisplayNode): number => 1 + n.children.reduce((s, c) => s + nodeCount(c), 0)
      const leafCount = (n: DisplayNode): number => (n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leafCount(c), 0))
      return {
        tree: displayTree,
        error: null,
        pureError: null,
        info: {
          type: findType(box),
          horizon: getRank(box),
          degree: getDegree(box).toString(),
          size: nodeCount(displayTree),
          leaves: leafCount(displayTree),
        },
      }
    } catch (err) {
      return { tree: null, info: null, error: (err as Error).message, pureError: null }
    }
  }, [text, mode, pureText, pureEditMode, boxA.root])

  // Box B and the computed result are always clicker-built — no
  // mode/text-parsing branch needed for either.
  const treeB = useMemo(() => demoBoxToDisplayNode(boxB.root), [boxB.root])
  const treeC = useMemo(() => (result ? demoBoxToDisplayNode(result) : null), [result])

  const treeASelectable = mode === 'pure' && pureEditMode === 'clicker'

  return (
    <div id="studio">
      <InputPanel
        width={panel.width}
        mode={mode}
        setMode={setMode}
        text={text}
        setText={setText}
        error={error}
        pureEditMode={pureEditMode}
        setPureEditMode={setPureEditMode}
        pureText={pureText}
        setPureText={setPureText}
        pureError={pureError}
        boxA={boxA}
        boxB={boxB}
        selectA={selectA}
        selectB={selectB}
        activeBuilder={activeBuilder}
        activeBox={activeBox}
        operator={operator}
        onOperatorClick={handleOperatorClick}
        stage={stage}
        result={result}
        info={info}
      />
      <div
        className={`panel-resize-handle${panel.dragging ? ' dragging' : ''}`}
        onPointerDown={panel.startDrag}
      />

      <div id="viewers">
        <div className="viewer-pane">
          <span className="viewer-label">boxes in boxes (top view)</span>
          <BoxScene
            onPointerMissed={() => {
              selectA(null)
              selectB(null)
            }}
          >
            <NestedBoxes root={boxA.root} selectedId={boxA.selectedId} onSelect={selectA} leftEdge={equation.leftA} />
            {operator && result && (
              <>
                <NodeLabel position={[equation.xOp, 0.6, 0]} text={operator} fontSize={0.6} color="#334155" />
                <NestedBoxes root={boxB.root} selectedId={boxB.selectedId} onSelect={selectB} leftEdge={equation.leftB} />
                <NodeLabel position={[equation.xEq, 0.6, 0]} text="=" fontSize={0.6} color="#334155" />
                <NestedBoxes root={result} leftEdge={equation.leftC} />
              </>
            )}
          </BoxScene>
        </div>
        <div className="viewer-pane">
          <span className="viewer-label">rooted tree</span>
          {operator && result ? (
            <div className="split-canvas-row">
              <div className="split-canvas-half">
                <RootedTreeView tree={tree} selectedId={treeASelectable ? boxA.selectedId : null} onSelect={treeASelectable ? selectA : undefined} />
              </div>
              <div className="split-canvas-divider">{operator}</div>
              <div className="split-canvas-half">
                <RootedTreeView tree={treeB} selectedId={boxB.selectedId} onSelect={selectB} />
              </div>
              <div className="split-canvas-divider">=</div>
              <div className="split-canvas-half">
                <RootedTreeView tree={treeC} />
              </div>
            </div>
          ) : (
            // Only meaningful in clicker mode: that's the only case where
            // the tree's node ids actually correspond to boxA's — in
            // applied/typed-pure mode, tree nodes have no id, so nothing
            // could ever match a stray selection anyway, but passing
            // null/undefined here keeps that explicit rather than relying
            // on it.
            <RootedTreeView tree={tree} selectedId={treeASelectable ? boxA.selectedId : null} onSelect={treeASelectable ? selectA : undefined} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
