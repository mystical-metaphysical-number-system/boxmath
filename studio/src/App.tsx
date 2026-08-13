import { useMemo, useState } from 'react'
import { findType, getDegree, getRank } from 'boxmath/applied'
import { toAppliedDisplayTree, toBigIntBox } from './lib/applied'
import { DEFAULT_PURE_TEXT, evaluatePure, formatPureValue, parsePure, pureCountLeaves, pureCountNodes, pureHeight, pureNodeToDisplay, pureValue } from './lib/pure'
import type { DisplayNode } from './lib/displayTree'
import InputPanel, { type AppliedInfo, type Mode, type PureInfo } from './InputPanel'
import RootedTreeView from './RootedTreeView'
import BoxView from './BoxView'
import './App.css'

const DEFAULT_BOX = '[[1,2],[3,4,5]]'

function App() {
  const [text, setText] = useState(DEFAULT_BOX)
  const [mode, setMode] = useState<Mode>('applied')
  const [pureText, setPureText] = useState(DEFAULT_PURE_TEXT)

  // The one computation both viewers hang off of: parse whichever mode is
  // active into a DisplayNode tree. Each viewer lays that same tree out
  // its own way (rooted tree vs. nested boxes), but they're reacting to
  // one shared value, so a keystroke updates both in the same render.
  const { tree, info, error, pureError } = useMemo((): {
    tree: DisplayNode | null
    info: AppliedInfo | PureInfo | null
    error: string | null
    pureError: string | null
  } => {
    if (mode === 'pure') {
      try {
        const parsed = parsePure(pureText)
        return {
          tree: pureNodeToDisplay(parsed),
          error: null,
          pureError: null,
          info: {
            evaluate: formatPureValue(evaluatePure(parsed)),
            netValue: pureValue(parsed).toString(),
            height: pureHeight(parsed),
            size: pureCountNodes(parsed),
            leaves: pureCountLeaves(parsed),
          },
        }
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
  }, [text, mode, pureText])

  return (
    <div id="studio">
      <InputPanel
        mode={mode}
        setMode={setMode}
        text={text}
        setText={setText}
        error={error}
        pureText={pureText}
        setPureText={setPureText}
        pureError={pureError}
        info={info}
      />

      <div id="viewers">
        <div className="viewer-pane">
          <span className="viewer-label">boxes in boxes (top view)</span>
          {/* BoxView is temporarily boilerplate (ignores `tree`) while we
              get the top-down camera right; wiring the box layout back in
              next. */}
          <BoxView />
        </div>
        <div className="viewer-pane">
          <span className="viewer-label">rooted tree</span>
          <RootedTreeView tree={tree} />
        </div>
      </div>
    </div>
  )
}

export default App
