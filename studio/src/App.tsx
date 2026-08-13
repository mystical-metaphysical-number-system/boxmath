import { useMemo, useState } from 'react'
import { findType, getDegree, getRank } from 'boxmath/applied'
import { toAppliedDisplayTree, toBigIntBox } from './lib/applied'
import { DEFAULT_PURE_TEXT, evaluatePure, formatPureValue, parsePure, pureCountLeaves, pureCountNodes, pureHeight, pureNodeToDisplay, pureValue, type PureNode } from './lib/pure'
import { demoBoxToDisplayNode, demoBoxToPureNode } from './lib/demoBox'
import type { DisplayNode } from './lib/displayTree'
import InputPanel, { type AppliedInfo, type Mode, type PureEditMode, type PureInfo } from './InputPanel'
import RootedTreeView from './RootedTreeView'
import BoxView from './BoxView'
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
  const [mode, setMode] = useState<Mode>('applied')
  const [pureEditMode, setPureEditMode] = useState<PureEditMode>('clicker')
  const [pureText, setPureText] = useState(DEFAULT_PURE_TEXT)
  const boxBuilder = useBoxBuilder()
  const panel = usePanelWidth()

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
          tree: demoBoxToDisplayNode(boxBuilder.root),
          error: null,
          pureError: null,
          info: pureInfo(demoBoxToPureNode(boxBuilder.root)),
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
  }, [text, mode, pureText, pureEditMode, boxBuilder.root])

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
        boxBuilder={boxBuilder}
        info={info}
      />
      <div
        className={`panel-resize-handle${panel.dragging ? ' dragging' : ''}`}
        onPointerDown={panel.startDrag}
      />

      <div id="viewers">
        <div className="viewer-pane">
          <span className="viewer-label">boxes in boxes (top view)</span>
          <BoxView root={boxBuilder.root} selectedId={boxBuilder.selectedId} onSelect={boxBuilder.setSelectedId} />
        </div>
        <div className="viewer-pane">
          <span className="viewer-label">rooted tree</span>
          <RootedTreeView
            tree={tree}
            // Only meaningful in clicker mode: that's the only case
            // where the tree's node ids actually correspond to
            // boxBuilder's — in applied/typed-pure mode, tree nodes have
            // no id, so nothing could ever match a stray selection
            // anyway, but passing null/undefined here keeps that
            // explicit rather than relying on it.
            selectedId={mode === 'pure' && pureEditMode === 'clicker' ? boxBuilder.selectedId : null}
            onSelect={mode === 'pure' && pureEditMode === 'clicker' ? boxBuilder.setSelectedId : undefined}
          />
        </div>
      </div>
    </div>
  )
}

export default App
