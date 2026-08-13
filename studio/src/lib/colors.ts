// Just two colors, one meaning: red if the deep sum of everything at or
// below this node is negative, green ("in the black") otherwise. That's
// the same number Wildberger's mset cancellation would land on, computed
// by ordinary addition instead of physically canceling +/- unit pairs
// (see chat).
export const POSITIVE_COLOR = '#22c55e'
export const NEGATIVE_COLOR = '#ef4444'

export const nodeColor = (node: { sum: bigint }): string => (node.sum < 0n ? NEGATIVE_COLOR : POSITIVE_COLOR)
