import { useLayoutEffect, useRef, useState } from 'react'
import { highlightPure } from './lib/pure'
import { getSelectionOffsets, setCaretOffset } from './lib/domSelection'
import { POSITIVE_COLOR, NEGATIVE_COLOR } from './lib/colors'

export type Mode = 'applied' | 'pure'

export type AppliedInfo = { type: string; horizon: number; degree: string; size: number; leaves: number }
export type PureInfo = { evaluate: string; netValue: string; height: number; size: number; leaves: number }

const MODE_EXPLAINER: Record<Mode, string> = {
  applied:
    'Numbers stay numbers (bigint underneath). Fast and practical — keeps the spirit of box arithmetic without literally expanding every quantity.',
  pure:
    "Wildberger's original encoding: click to place your cursor, then paste a unit — or select text and wrap it in a box instead.",
}

type Props = {
  mode: Mode
  setMode: (m: Mode) => void
  text: string
  setText: (t: string) => void
  error: string | null
  pureText: string
  setPureText: (t: string) => void
  pureError: string | null
  info: AppliedInfo | PureInfo | null
}

// This is the single source of both text inputs — both viewers below read
// the same `mode`/`text`/`pureText` state from the parent, so a keystroke
// here recomputes both of them off one shared value in the same render
// pass instead of two independently-fed copies drifting apart.
export default function InputPanel({ mode, setMode, text, setText, error, pureText, setPureText, pureError, info }: Props) {
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
    // mode is a dependency too: the editor div only exists while
    // mode === 'pure', so switching into that mode is what first attaches
    // pureEditorRef — without mode here, that remount wouldn't re-run this
    // effect unless pureText also happened to change at the same time.
  }, [pureText, mode])

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
    <aside id="panel">
      <h1>boxmath studio</h1>

      <div id="mode-toggle">
        <button type="button" className={mode === 'applied' ? 'active' : ''} onClick={() => setMode('applied')}>
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
          <p>
            Click to place your cursor, then paste a unit. Select some text instead and the same buttons wrap it in
            a box.
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
