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
  const boxC = useBoxBuilder()
  const panel = usePanelWidth()

  // Which box the shared nest/add-box/delete controls act on — not a
  // separate control surface per box, the *same* buttons just retarget.
  // Clicking into any box (its bracket text or its own 3D content) makes
  // it active; selectA/selectB/selectC below are what every click handler
  // for that box goes through, so switching activeBox is a side effect
  // of selecting, never a separate step.
  //
  // Two operator slots, not one: operator1 combines A with a "group" —
  // either B alone (operator2 unset) or B combined with C via operator2
  // (operator2 set). That's exactly A ⊕ (B ⊕ C), the shape the board's
  // distributive identities (A x (B+C) = (AxB)+(AxC)) are drawn in —
  // operator2 builds the inner (B+C) first, operator1 then distributes
  // A's terms across whatever that inner union contains, using the same
  // cartesian-pairing math applyOperator/distributeOperator already do
  // for two operands (see boxOperations.ts) — no separate "symbolic
  // distribution" logic needed, because a term-by-term product over a
  // union's terms already *is* the distributive law.
  //
  // Every combination is shown as a two-step chain, not toggled behind a
  // second click — A op B = <unmerged pairs> = <final, reduced result>.
  // Earlier this stage was a click-to-advance toggle (distribute, then
  // evaluate), but that hid the unmerged-pairs view behind an interaction
  // nothing on screen advertised; showing both steps at once removes the
  // discoverability problem instead of trying to make the hidden step
  // more obvious. The middle term is genuinely informative for every
  // operator, not just x/^: + has no cartesian pairing, but its "unmerged"
  // form is still the raw pre-annihilation union — [[]] + [[]ᵃ] shows as
  // [[] []ᵃ] there, then collapses to [] in the final column, which is
  // exactly the mutual-annihilation demo this was built for.
  const [operator1, setOperator1] = useState<Operator | null>(null)
  const [operator2, setOperator2] = useState<Operator | null>(null)
  const handleOperator1Click = (op: Operator) => {
    setOperator1(operator1 === op ? null : op)
  }
  const handleOperator2Click = (op: Operator) => {
    setOperator2(operator2 === op ? null : op)
  }
  const [activeBox, setActiveBox] = useState<'A' | 'B' | 'C'>('A')
  const selectA = (id: number | null) => {
    setActiveBox('A')
    boxA.setSelectedId(id)
  }
  const selectB = (id: number | null) => {
    setActiveBox('B')
    boxB.setSelectedId(id)
  }
  const selectC = (id: number | null) => {
    setActiveBox('C')
    boxC.setSelectedId(id)
  }
  const activeBuilder = activeBox === 'A' ? boxA : activeBox === 'B' ? boxB : boxC

  // The inner group — B alone, or B ⊕ C once operator2 brings C in. Always
  // the fully-reduced (applyOperator) form: this is what actually feeds
  // the outer combination, so it needs to be the *final* value of B ⊕ C,
  // not its unmerged pairs — B and C are still shown raw, side by side, as
  // the equation's operands, so nothing about the inner combination's own
  // unmerged form is lost, it's just never collapsed into a single value
  // on screen.
  const group = useMemo((): DemoBox => {
    if (!operator2) return boxB.root
    let id = 1
    return applyOperator(operator2, boxB.root, boxC.root, () => id++)
  }, [operator2, boxB.root, boxC.root])

  // A ⊕ group, computed both ways — resultPairs is the raw cartesian
  // pairing (or, for +, the raw pre-annihilation union) with nothing
  // merged or cancelled; resultFinal is the fully reduced value. Both are
  // pure functions of the same two live trees, recomputed fresh on every
  // change, the same way a spreadsheet formula cell is a function of its
  // inputs, not its own independent state. nextId only needs to be unique
  // *within* one result tree (see applyOperator's own doc), so a plain
  // counter reset per computation is enough.
  const resultPairs = useMemo((): DemoBox | null => {
    if (!operator1) return null
    let id = 1
    return distributeOperator(operator1, boxA.root, group, () => id++)
  }, [operator1, boxA.root, group])
  const resultFinal = useMemo((): DemoBox | null => {
    if (!operator1) return null
    let id = 1
    return applyOperator(operator1, boxA.root, group, () => id++)
  }, [operator1, boxA.root, group])

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
  const PAREN_WIDTH = 0.4
  const PAREN_GAP = 0.6
  const sizeA = useMemo(() => boxSize(boxA.root), [boxA.root])
  const sizeB = useMemo(() => boxSize(boxB.root), [boxB.root])
  const sizeC = useMemo(() => boxSize(boxC.root), [boxC.root])
  const sizePairs = useMemo(() => (resultPairs ? boxSize(resultPairs) : 0), [resultPairs])
  const sizeFinal = useMemo(() => (resultFinal ? boxSize(resultFinal) : 0), [resultFinal])

  // Same left-edge reasoning as the two-box version this replaced (see
  // its own long-standing note, preserved in git history): NestedBoxes is
  // left-edge anchored, so every position below is a left edge or a
  // symbol's center, laid out left to right with a running cursor, then
  // the whole thing is shifted so it's centered on x=0. `showGroup` is
  // one branch point — operator2 unset means "just A ⊕ B", the exact
  // shape this always supported; operator2 set additionally parenthesizes
  // B ⊕ C as the second operand. The chain always ends in *two* results
  // now, not one — unmerged pairs, then the final reduced value — laid out
  // the same left-edge way as everything before them.
  const equation = useMemo(() => {
    if (!operator1 || !resultFinal) {
      return {
        leftA: -INNER_SIZE / 2,
        leftB: 0,
        leftC: 0,
        leftPairs: 0,
        leftFinal: 0,
        xOp1: 0,
        xOp2: 0,
        xEq1: 0,
        xEq2: 0,
        xParenOpen: 0,
        xParenClose: 0,
        showGroup: false,
      }
    }
    const showGroup = operator2 !== null
    let cursor = 0
    const leftA = cursor
    cursor += sizeA + SPLIT_GAP
    const xOp1 = cursor + SYMBOL_SPACE / 2
    cursor += SYMBOL_SPACE + SPLIT_GAP
    let xParenOpen = 0
    if (showGroup) {
      xParenOpen = cursor + PAREN_WIDTH / 2
      cursor += PAREN_WIDTH + PAREN_GAP
    }
    const leftB = cursor
    cursor += sizeB
    let xOp2 = 0
    let leftC = 0
    let xParenClose = 0
    if (showGroup) {
      cursor += SPLIT_GAP
      xOp2 = cursor + SYMBOL_SPACE / 2
      cursor += SYMBOL_SPACE + SPLIT_GAP
      leftC = cursor
      cursor += sizeC + PAREN_GAP
      xParenClose = cursor + PAREN_WIDTH / 2
      cursor += PAREN_WIDTH
    }
    cursor += SPLIT_GAP
    const xEq1 = cursor + SYMBOL_SPACE / 2
    cursor += SYMBOL_SPACE + SPLIT_GAP
    const leftPairs = cursor
    cursor += sizePairs + SPLIT_GAP
    const xEq2 = cursor + SYMBOL_SPACE / 2
    cursor += SYMBOL_SPACE + SPLIT_GAP
    const leftFinal = cursor
    cursor += sizeFinal
    const shift = cursor / 2
    return {
      leftA: leftA - shift,
      leftB: leftB - shift,
      leftC: leftC - shift,
      leftPairs: leftPairs - shift,
      leftFinal: leftFinal - shift,
      xOp1: xOp1 - shift,
      xOp2: xOp2 - shift,
      xEq1: xEq1 - shift,
      xEq2: xEq2 - shift,
      xParenOpen: xParenOpen - shift,
      xParenClose: xParenClose - shift,
      showGroup,
    }
  }, [operator1, operator2, resultFinal, sizeA, sizeB, sizeC, sizePairs, sizeFinal])

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

  // Box B, box C, and the computed result are always clicker-built — no
  // mode/text-parsing branch needed for any of them.
  const treeB = useMemo(() => demoBoxToDisplayNode(boxB.root), [boxB.root])
  const treeC = useMemo(() => demoBoxToDisplayNode(boxC.root), [boxC.root])
  const treePairs = useMemo(() => (resultPairs ? demoBoxToDisplayNode(resultPairs) : null), [resultPairs])
  const treeFinal = useMemo(() => (resultFinal ? demoBoxToDisplayNode(resultFinal) : null), [resultFinal])

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
        boxC={boxC}
        selectA={selectA}
        selectB={selectB}
        selectC={selectC}
        activeBuilder={activeBuilder}
        activeBox={activeBox}
        operator1={operator1}
        onOperator1Click={handleOperator1Click}
        operator2={operator2}
        onOperator2Click={handleOperator2Click}
        resultPairs={resultPairs}
        resultFinal={resultFinal}
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
              selectC(null)
            }}
          >
            <NestedBoxes root={boxA.root} selectedId={boxA.selectedId} onSelect={selectA} leftEdge={equation.leftA} />
            {operator1 && resultFinal && (
              <>
                <NodeLabel position={[equation.xOp1, 0.6, 0]} text={operator1} fontSize={0.6} color="#334155" />
                {equation.showGroup && <NodeLabel position={[equation.xParenOpen, 0.6, 0]} text="(" fontSize={0.6} color="#64748b" />}
                <NestedBoxes root={boxB.root} selectedId={boxB.selectedId} onSelect={selectB} leftEdge={equation.leftB} />
                {equation.showGroup && (
                  <>
                    <NodeLabel position={[equation.xOp2, 0.6, 0]} text={operator2!} fontSize={0.6} color="#334155" />
                    <NestedBoxes root={boxC.root} selectedId={boxC.selectedId} onSelect={selectC} leftEdge={equation.leftC} />
                    <NodeLabel position={[equation.xParenClose, 0.6, 0]} text=")" fontSize={0.6} color="#64748b" />
                  </>
                )}
                <NodeLabel position={[equation.xEq1, 0.6, 0]} text="=" fontSize={0.6} color="#94a3b8" />
                <NodeLabel position={[equation.leftPairs + sizePairs / 2, 1.05, 0]} text="unmerged pairs" fontSize={0.28} color="#94a3b8" />
                <NestedBoxes root={resultPairs!} leftEdge={equation.leftPairs} />
                <NodeLabel position={[equation.xEq2, 0.6, 0]} text="=" fontSize={0.6} color="#334155" />
                <NodeLabel position={[equation.leftFinal + sizeFinal / 2, 1.05, 0]} text="final result" fontSize={0.28} color="#334155" />
                <NestedBoxes root={resultFinal} leftEdge={equation.leftFinal} />
              </>
            )}
          </BoxScene>
        </div>
        <div className="viewer-pane">
          <span className="viewer-label">rooted tree</span>
          {operator1 && resultFinal ? (
            <div className="split-canvas-row">
              <div className="split-canvas-half">
                <p className="split-canvas-caption">A</p>
                <div className="split-canvas-tree">
                  <RootedTreeView tree={tree} selectedId={treeASelectable ? boxA.selectedId : null} onSelect={treeASelectable ? selectA : undefined} />
                </div>
              </div>
              <div className="split-canvas-divider">{operator1}</div>
              {equation.showGroup && <div className="split-canvas-divider">(</div>}
              <div className="split-canvas-half">
                <p className="split-canvas-caption">B</p>
                <div className="split-canvas-tree">
                  <RootedTreeView tree={treeB} selectedId={boxB.selectedId} onSelect={selectB} />
                </div>
              </div>
              {equation.showGroup && (
                <>
                  <div className="split-canvas-divider">{operator2}</div>
                  <div className="split-canvas-half">
                    <p className="split-canvas-caption">C</p>
                    <div className="split-canvas-tree">
                      <RootedTreeView tree={treeC} selectedId={boxC.selectedId} onSelect={selectC} />
                    </div>
                  </div>
                  <div className="split-canvas-divider">)</div>
                </>
              )}
              <div className="split-canvas-divider muted">=</div>
              <div className="split-canvas-half">
                <p className="split-canvas-caption muted">unmerged pairs</p>
                <div className="split-canvas-tree">
                  <RootedTreeView tree={treePairs} />
                </div>
              </div>
              <div className="split-canvas-divider">=</div>
              <div className="split-canvas-half">
                <p className="split-canvas-caption final">final result</p>
                <div className="split-canvas-tree">
                  <RootedTreeView tree={treeFinal} />
                </div>
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
