// The caret/selection lives as plain character offsets into the text —
// not a DOM Range — computed via the standard "range-to-string-length"
// trick, which works no matter how the text is chopped up into spans.
export function getSelectionOffsets(root: HTMLElement): [number, number] | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const measure = (container: Node, offset: number) => {
    const r = document.createRange()
    r.selectNodeContents(root)
    r.setEnd(container, offset)
    return r.toString().length
  }
  const a = measure(range.startContainer, range.startOffset)
  const b = measure(range.endContainer, range.endOffset)
  return a <= b ? [a, b] : [b, a]
}

export function setCaretOffset(root: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node = walker.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    remaining -= len
    node = walker.nextNode()
  }
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}
