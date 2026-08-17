import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { highlightPure } from './lib/pure'
import { getSelectionOffsets, setCaretOffset } from './lib/domSelection'
import { POSITIVE_COLOR, NEGATIVE_COLOR } from './lib/colors'
import { OPERATORS, type Operator } from './lib/boxOperations'
import type { DemoBox } from './lib/demoBox'
import type { BoxBuilder } from './useBoxBuilder'

export type Mode = 'applied' | 'pure'
export type PureEditMode = 'text' | 'clicker'

export type AppliedInfo = { type: string; horizon: number; degree: string; size: number; leaves: number }
export type PureInfo = { evaluate: string; netValue: string; height: number; size: number; leaves: number }

const MODE_EXPLAINER: Record<Mode, string> = {
  applied:
    'Numbers stay numbers (bigint underneath). Fast and practical — keeps the spirit of box arithmetic without literally expanding every quantity.',
  pure:
    "Wildberger's original encoding: click to place your cursor, then paste a unit — or select text and wrap it in a box instead.",
}

type NotationProps = { node: DemoBox; selectedId?: number | null; onSelect?: (id: number | null) => void; readOnly?: boolean }

// The bracket text and the clicker's 3D boxes are two views of the same
// tree — this renders one bracket pair per node, each independently
// clickable and highlighted in sync with its 3D box, via the same
// selectedId/onSelect the scene uses. Mirrors the app's real pure-mode
// syntax: `]` for a plain box, `]ᵃ` for one marked anti. onSelect is
// optional — a computed result (see App.tsx) is read-only, so its
// notation renders with no click handler at all rather than one that
// does nothing; readOnly just dims it so that's visible at a glance too.
function Notation({ node, selectedId, onSelect, readOnly }: NotationProps) {
  return (
    <span
      className={[node.id === selectedId ? 'selected' : '', readOnly ? 'read-only' : ''].filter(Boolean).join(' ') || undefined}
      onClick={
        onSelect &&
        ((e) => {
          e.stopPropagation()
          onSelect(node.id)
        })
      }
    >
      [
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 ? ' ' : ''}
          <Notation node={child} selectedId={selectedId} onSelect={onSelect} readOnly={readOnly} />
        </Fragment>
      ))}
      {node.anti ? ']ᵃ' : ']'}
    </span>
  )
}

type Props = {
  width: number
  mode: Mode
  setMode: (m: Mode) => void
  text: string
  setText: (t: string) => void
  error: string | null
  pureEditMode: PureEditMode
  setPureEditMode: (m: PureEditMode) => void
  pureText: string
  setPureText: (t: string) => void
  pureError: string | null
  boxA: BoxBuilder
  boxB: BoxBuilder
  boxC: BoxBuilder
  selectA: (id: number | null) => void
  selectB: (id: number | null) => void
  selectC: (id: number | null) => void
  activeBuilder: BoxBuilder
  activeBox: 'A' | 'B' | 'C'
  // Two operator slots: operator1 combines A with a "group" (B alone, or
  // B ⊕ C once operator2 brings C in) — A ⊕ (B ⊕ C), the shape the
  // board's distributive identities are drawn in. Clicking an operator
  // button always goes through the matching handler — the same operator
  // clears it, a different one switches, App.tsx owns that logic, this
  // component just reports which button was pressed.
  operator1: Operator | null
  onOperator1Click: (op: Operator) => void
  operator2: Operator | null
  onOperator2Click: (op: Operator) => void
  // Both stages of the outer combination, always computed and always
  // shown together — never one hidden behind a second click on the other.
  // See App.tsx for why: a click-to-advance toggle here hid the
  // unmerged-pairs view behind an interaction nothing on screen
  // advertised.
  resultPairs: DemoBox | null
  resultFinal: DemoBox | null
  // One shared undo/redo timeline across all three boxes — see App.tsx's
  // `past`/`future` for why it's one stack rather than per-box: undoing
  // three edits made in A, then B, then C should back them out in that
  // same order, not per-box order.
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  info: AppliedInfo | PureInfo | null
}

type OperatorRowProps = {
  label: string
  operator: Operator | null
  onOperatorClick: (op: Operator) => void
}

// A row of ⊕ buttons — used twice (operator1, operator2), identical
// either way. Clicking the active operator again clears it; clicking a
// different one switches. No hidden second stage to advance here anymore
// — both the unmerged and final forms of whatever this combines render
// together, below, the moment an operator is picked.
function OperatorRow({ label, operator, onOperatorClick }: OperatorRowProps) {
  return (
    <>
      <p className="operator-row-label">{label}</p>
      <div className="box-operator-row">
        {OPERATORS.map((op) => (
          <button key={op} type="button" className={operator === op ? 'active' : ''} onClick={() => onOperatorClick(op)}>
            {op}
          </button>
        ))}
      </div>
    </>
  )
}

// This is the single source of every input — both viewers below read the
// same `mode`/`text`/`pureText`/clicker-tree state from the parent, so an
// edit here (typed or clicked) recomputes both of them off one shared
// value in the same render pass instead of independently-fed copies
// drifting apart.
export default function InputPanel({
  width,
  mode,
  setMode,
  text,
  setText,
  error,
  pureEditMode,
  setPureEditMode,
  pureText,
  setPureText,
  pureError,
  boxA,
  boxB,
  boxC,
  selectA,
  selectB,
  selectC,
  activeBuilder,
  activeBox,
  operator1,
  onOperator1Click,
  operator2,
  onOperator2Click,
  resultPairs,
  resultFinal,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  info,
}: Props) {
  const [hasSelection, setHasSelection] = useState(false)
  const pureEditorRef = useRef<HTMLDivElement>(null)
  const pendingCaret = useRef<number | null>(null)

  // contentEditable is mutated live by the browser as the user types —
  // letting React's JSX diffing also own those same children means React
  // and the browser fight over one DOM subtree, and a big enough edit
  // (like deleting the outer brackets) desyncs them badly enough to crash
  // the whole render, taking the WebGL canvas down with it. So React
  // renders an empty shell here, and this effect is the only thing that
  // ever touches the editor's contents, built by hand from pureText.
  useLayoutEffect(() => {
    const editor = pureEditorRef.current
    if (!editor) return
    editor.innerHTML = ''
    for (const part of highlightPure(pureText)) {
      if (typeof part === 'string') {
        editor.appendChild(document.createTextNode(part))
      } else {
        const span = document.createElement('span')
        span.className = part.anti ? 'unit neg' : 'unit pos'
        span.textContent = part.token
        editor.appendChild(span)
      }
    }
    if (pendingCaret.current !== null) {
      editor.focus()
      setCaretOffset(editor, pendingCaret.current)
      pendingCaret.current = null
    }
    // mode/pureEditMode are dependencies too: the editor div only exists
    // while mode === 'pure' && pureEditMode === 'text', so switching into
    // that combination is what first attaches pureEditorRef — without
    // these here, that remount wouldn't re-run this effect unless
    // pureText also happened to change at the same time.
  }, [pureText, mode, pureEditMode])

  const updateSelectionState = () => {
    const editor = pureEditorRef.current
    if (!editor) return
    const offsets = getSelectionOffsets(editor)
    setHasSelection(!!offsets && offsets[0] !== offsets[1])
  }

  const handlePureInput = (e: React.FormEvent<HTMLDivElement>) => {
    const editor = e.currentTarget
    const nextText = editor.textContent ?? ''
    pendingCaret.current = getSelectionOffsets(editor)?.[1] ?? nextText.length
    setPureText(nextText)
  }

  const insertAtCursor = (token: string) => {
    const editor = pureEditorRef.current
    const offsets = editor ? getSelectionOffsets(editor) : null
    const [start, end] = offsets ?? [pureText.length, pureText.length]
    setPureText(pureText.slice(0, start) + token + pureText.slice(end))
    pendingCaret.current = start + token.length
  }

  const wrapSelection = (negate: boolean) => {
    const editor = pureEditorRef.current
    const offsets = editor ? getSelectionOffsets(editor) : null
    if (!offsets || offsets[0] === offsets[1]) return
    const [start, end] = offsets
    const close = negate ? ']ᵃ' : ']'
    setPureText(pureText.slice(0, start) + '[' + pureText.slice(start, end) + close + pureText.slice(end))
    pendingCaret.current = end + 1 + close.length
    setHasSelection(false)
  }

  // With nothing typed yet, there's no cursor to paste a unit at and
  // nothing to select — the only sensible first move is a box, never a
  // bare unit, since a rooted structure always starts as a box.
  const bootstrapBox = (negate: boolean) => {
    const close = negate ? ']ᵃ' : ']'
    setPureText('[' + close)
    pendingCaret.current = 1
  }

  const resetPureText = () => {
    setPureText('[]')
    pendingCaret.current = 2
    setHasSelection(false)
  }

  return (
    <aside id="panel" style={{ width }}>
      <h1>boxmath studio</h1>

      <div id="mode-toggle">
        <button type="button" disabled title="Temporarily disabled — not the head of capability right now, coming back to it later">
          Applied
        </button>
        <button type="button" className={mode === 'pure' ? 'active' : ''} onClick={() => setMode('pure')}>
          Pure
        </button>
      </div>
      <p id="mode-explainer">{MODE_EXPLAINER[mode]}</p>

      {mode === 'applied' ? (
        <>
          <p>Enter a box (nested array). It renders as a rooted tree and as nested boxes below.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <>
          <div id="pure-edit-toggle">
            <button
              type="button"
              className={pureEditMode === 'clicker' ? 'active' : ''}
              onClick={() => setPureEditMode('clicker')}
            >
              clicker
            </button>
            <button type="button" disabled title="Temporarily disabled while the clicker gets built out">
              textbox
            </button>
          </div>

          {pureEditMode === 'clicker' ? (
            <>
              <p>
                Click a box — its bracket text, or its own 3D content — to make it active; nest/add-box/delete then
                target whichever box that was. Pick an operator to bring in box B; pick a second operator to group C
                in with B, forming A ⊕ (B ⊕ C) — the distributive-law shape (A x (B+C) = (AxB)+(AxC), and the same
                for ^). Once an operator's picked, both the raw unmerged pairing and the fully reduced result show
                below, side by side — nothing hidden behind a second click.
              </p>

              <OperatorRow label="A ⊕ …" operator={operator1} onOperatorClick={onOperator1Click} />
              <OperatorRow label="… ⊕ C (groups C in with B)" operator={operator2} onOperatorClick={onOperator2Click} />

              <div className="box-nest-notation">
                <Notation node={boxA.root} selectedId={boxA.selectedId} onSelect={selectA} />
                {operator1 && (
                  <>
                    <span className="operator-symbol">{operator1}</span>
                    {operator2 && <span className="paren">(</span>}
                    <Notation node={boxB.root} selectedId={boxB.selectedId} onSelect={selectB} />
                    {operator2 && (
                      <>
                        <span className="operator-symbol">{operator2}</span>
                        <Notation node={boxC.root} selectedId={boxC.selectedId} onSelect={selectC} />
                        <span className="paren">)</span>
                      </>
                    )}
                    {resultPairs && (
                      <>
                        <span className="operator-symbol muted">=</span>
                        <span className="result-caption">unmerged pairs</span>
                        <Notation node={resultPairs} readOnly />
                      </>
                    )}
                    {resultFinal && (
                      <>
                        <span className="operator-symbol">=</span>
                        <span className="result-caption final">final result</span>
                        <Notation node={resultFinal} readOnly />
                      </>
                    )}
                  </>
                )}
              </div>

              {operator1 && <p id="active-box-indicator">editing box {activeBox}</p>}

              <div className="box-nest-controls">
                <button type="button" onClick={onUndo} disabled={!canUndo} title="Ctrl/Cmd+Z">
                  ↶ undo
                </button>
                <button type="button" onClick={onRedo} disabled={!canRedo} title="Ctrl/Cmd+Shift+Z">
                  ↷ redo
                </button>
              </div>

              <div className="box-nest-controls">
                <button type="button" onClick={activeBuilder.deleteAction} disabled={!activeBuilder.canDelete}>
                  delete
                </button>
                <button type="button" className="positive" onClick={() => activeBuilder.addBox(false)} disabled={!activeBuilder.canAddBox}>
                  add box
                </button>
                <button type="button" className="negative" onClick={() => activeBuilder.addBox(true)} disabled={!activeBuilder.canAddBox}>
                  add antibox
                </button>
                <button type="button" className="positive" onClick={() => activeBuilder.nest(false)} disabled={!activeBuilder.canNest}>
                  nest
                </button>
                <button type="button" className="negative" onClick={() => activeBuilder.nest(true)} disabled={!activeBuilder.canNest}>
                  antinest
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Click to place your cursor, then paste a unit. Select some text instead and the same buttons wrap it
                in a box.
              </p>
              <div id="pure-buttons">
                <button
                  type="button"
                  className="add-box"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (pureText.length === 0) return bootstrapBox(false)
                    return hasSelection ? wrapSelection(false) : insertAtCursor('0')
                  }}
                >
                  {pureText.length === 0 || hasSelection ? '[ ]' : '0'}
                </button>
                <button
                  type="button"
                  className="add-anti-box"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (pureText.length === 0) return bootstrapBox(true)
                    return hasSelection ? wrapSelection(true) : insertAtCursor('0ᵃ')
                  }}
                >
                  {pureText.length === 0 || hasSelection ? '[ ]ᵃ' : '0ᵃ'}
                </button>
                <button type="button" className="reset" onMouseDown={(e) => e.preventDefault()} onClick={resetPureText}>
                  reset
                </button>
              </div>
              <div
                id="pure-editor"
                ref={pureEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handlePureInput}
                onSelect={updateSelectionState}
                onMouseUp={updateSelectionState}
                onKeyUp={updateSelectionState}
              />
              {pureError && <p className="error">{pureError}</p>}
            </>
          )}
        </>
      )}

      {info && (
        <dl id="info">
          {mode === 'applied' ? (
            <>
              <dt>Type</dt>
              <dd>{(info as AppliedInfo).type}</dd>
              <dt>Horizon (height)</dt>
              <dd>{(info as AppliedInfo).horizon}</dd>
              <dt>Degree</dt>
              <dd>{(info as AppliedInfo).degree}</dd>
            </>
          ) : (
            <>
              <dt>Evaluates to</dt>
              <dd>{(info as PureInfo).evaluate}</dd>
              <dt>Net value</dt>
              <dd>{(info as PureInfo).netValue}</dd>
              <dt>Height</dt>
              <dd>{(info as PureInfo).height}</dd>
            </>
          )}
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
          negative (deep sum below zero)
        </li>
      </ul>
    </aside>
  )
}
