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

// Owns the "clicker" box-builder's whole state + editing logic in one
// place, so the sidebar controls (buttons) and the 3D scene (click-to-
// select, keyboard shortcut) can share a single source of truth instead
// of each keeping their own copy.
export function useBoxBuilder() {
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
  const nest = (anti: boolean) => {
    if (!canNest) return
    const targetId = selectedId ?? root.id
    setRoot((r) => wrapNode(r, targetId, anti, nextId.current++))
  }
  const addBox = (anti: boolean) => {
    if (!canAddBox) return
    const targetId = selectedId ?? root.id
    setRoot((r) =>
      targetId === r.id
        ? { ...r, children: [...r.children, makeLeaf(anti)] }
        : insertBeside(r, targetId, anti, nextId.current++),
    )
  }
  const deleteAction = () => {
    if (!canDelete) return
    const targetId = selectedId ?? maxIdNode(root).id
    setRoot((r) => (targetId === r.id ? makeLeaf(false) : (removeNode(r, targetId) ?? makeLeaf(false))))
    setSelectedId(null)
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

  return { root, selectedId, setSelectedId, nest, addBox, deleteAction, canNest, canAddBox, canDelete }
}

export type BoxBuilder = ReturnType<typeof useBoxBuilder>
