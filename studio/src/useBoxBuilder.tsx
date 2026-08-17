import { useEffect, useRef, useState } from 'react'
import {
  type DemoBox,
  MAX_DEPTH,
  MAX_NODES,
  countNodes,
  insertBeside,
  maxIdNode,
  removeNode,
  treeDepth,
  wrapNode,
} from './lib/demoBox'
import { NestedBoxes } from './BoxScene'

// A box's whole editable state in one value — what undo/redo actually
// snapshots and restores. Bundled together rather than tracked as two
// separate undo stacks (one for root, one for selectedId) because they
// change together: delete always resets the selection too, so a snapshot
// taken mid-action can't be half of one and half of the other.
export type BoxSnapshot = { root: DemoBox; selectedId: number | null }

// Owns the "clicker" box-builder's whole state + editing logic *and* its
// renderable content in one place — `view` below is a plain group of
// meshes with no Canvas/camera/lighting of its own, so any consumer can
// drop it into whatever scene ("skin") they're using without either side
// needing to know about the other. That's what makes multiple boxes
// sharing one scene possible later: each box gets its own
// useBoxBuilder(), each hands back its own `view`, and a shared <Canvas>
// just mounts however many of them, at whatever offsets, side by side —
// nothing about this hook or NestedBoxes has to change for that.
//
// onChange, if given, fires after every actual mutation (never on a
// no-op — the canNest/canAddBox/canDelete guards below all return before
// it'd fire) with the snapshot just left behind and the one just entered.
// App.tsx uses this to record one cross-box undo/redo timeline: each
// useBoxBuilder() instance stays fully self-contained and knows nothing
// about the other two boxes, or about undo/redo existing at all — it just
// reports its own before/after, the same way a controlled <input>
// reports onChange without knowing who's listening.
export function useBoxBuilder(onChange?: (prev: BoxSnapshot, next: BoxSnapshot) => void) {
  const nextId = useRef(1)
  const makeLeaf = (anti: boolean): DemoBox => ({ id: nextId.current++, anti, children: [] })
  const [root, setRoot] = useState<DemoBox>(() => makeLeaf(false))
  // Starts on the initial box, not null — the cursor should always be
  // somewhere, the same way a text cursor is never "nowhere." Neither
  // nest nor add-box ever needs to touch this afterward: nest wraps the
  // selected node without modifying it (so the cursor, still pointing at
  // the same id, now correctly refers to the newly-inner box), and
  // add-box doesn't modify the selected node either (so the cursor stays
  // on the same, still-outer box) — the "inner vs. outer" distinction
  // falls out of what each operation actually does to node identity,
  // rather than needing to be asserted separately per button.
  const [selectedId, setSelectedId] = useState<number | null>(() => root.id)

  const depth = treeDepth(root)
  const nodeCount = countNodes(root)
  const canNest = depth < MAX_DEPTH && nodeCount < MAX_NODES
  const canAddBox = nodeCount < MAX_NODES
  // A bare empty root has nothing to delete: the "selected/last" target
  // would just be the root itself, and resetting it to a fresh empty leaf
  // is a no-op on a tree that's already exactly that.
  const canDelete = nodeCount > 1

  // Both target the current selection, falling back to the root when
  // nothing's selected — which is exactly the old whole-tree behavior,
  // since wrapping/adding-beside the root IS the whole tree.
  //
  // Each one computes its next root as a plain value (not React's
  // functional-updater form) so it has both `root` (the snapshot just
  // left behind) and `nextRoot` (the one just entered) in hand to report
  // through onChange — safe here specifically because these only ever run
  // from a direct click/keydown handler, never from inside another
  // in-flight state update racing this one.
  const nest = (anti: boolean) => {
    if (!canNest) return
    const targetId = selectedId ?? root.id
    const nextRoot = wrapNode(root, targetId, anti, nextId.current++)
    setRoot(nextRoot)
    onChange?.({ root, selectedId }, { root: nextRoot, selectedId })
  }
  const addBox = (anti: boolean) => {
    if (!canAddBox) return
    const targetId = selectedId ?? root.id
    const nextRoot =
      targetId === root.id
        ? { ...root, children: [...root.children, makeLeaf(anti)] }
        : insertBeside(root, targetId, anti, nextId.current++)
    setRoot(nextRoot)
    onChange?.({ root, selectedId }, { root: nextRoot, selectedId })
  }
  const deleteAction = () => {
    if (!canDelete) return
    const targetId = selectedId ?? maxIdNode(root).id
    const nextRoot = targetId === root.id ? makeLeaf(false) : (removeNode(root, targetId) ?? makeLeaf(false))
    setRoot(nextRoot)
    setSelectedId(null)
    onChange?.({ root, selectedId }, { root: nextRoot, selectedId: null })
  }

  // Undo/redo's only way back in — sets both fields straight from a
  // stored snapshot, bypassing nest/addBox/deleteAction (and their
  // onChange calls) entirely, so restoring a step never itself gets
  // recorded as a new one.
  const restore = (snapshot: BoxSnapshot) => {
    setRoot(snapshot.root)
    setSelectedId(snapshot.selectedId)
  }

  // Backspace/Delete triggers the same action as the button — the "from
  // cursor" part of the metaphor, greedy fallback included. Guarded
  // against firing while focus is in one of the app's actual text inputs
  // (the Applied textarea, the Pure contentEditable), since the clicker
  // can be live even while a text input has focus; this shouldn't steal a
  // real backspace out of someone's typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!canDelete) return
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      const active = document.activeElement
      if (active instanceof HTMLElement && (active.tagName === 'TEXTAREA' || active.isContentEditable)) return
      e.preventDefault()
      deleteAction()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const view = <NestedBoxes root={root} selectedId={selectedId} onSelect={setSelectedId} />

  return { root, selectedId, setSelectedId, nest, addBox, deleteAction, restore, view, canNest, canAddBox, canDelete }
}

export type BoxBuilder = ReturnType<typeof useBoxBuilder>
