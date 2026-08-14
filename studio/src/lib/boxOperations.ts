import { reduceBox, type DemoBox } from './demoBox'

export type Operator = '+' | 'x' | '^'
export const OPERATORS: Operator[] = ['+', 'x', '^']

export const OPERATOR_LABEL: Record<Operator, string> = {
  '+': 'union',
  x: 'product (counts add)',
  '^': 'product (counts multiply)',
}

// Only x and ^ are genuinely product-like — a term formed by combining
// an anti term with a plain one is itself anti, and two antis cancel
// back to plain, same as ordinary sign multiplication. + only
// concatenates the two operands' terms; it never touches any term's own
// sign.
function combinedSign(a: boolean, b: boolean): boolean {
  return a !== b
}

// Every piece of A/B that ends up inside a result tree goes through
// this first — a result is always its own tree, with fresh ids all the
// way down, never sharing so much as one id with either operand's own
// still-live, still-editable tree.
function cloneWithFreshIds(node: DemoBox, nextId: () => number): DemoBox {
  return { ...node, id: nextId(), children: node.children.map((c) => cloneWithFreshIds(c, nextId)) }
}

// The three combinators off the board's "Algebra with Poly" sheet,
// verified against packages/boxmath/src/applied.ts's own add/multiply/
// caret — which operate the same way, just on flat bigint arrays rather
// than DemoBox trees. The correspondence: a DemoBox term's "value" here
// is its own children.length, the same way a bigint term's value stands
// in for a coefficient there.
//
//   A = [1 2], B = [3 4 5]     (terms of size 1,2 and 3,4,5)
//   A + B = [1 2 3 4 5]        every term from both, side by side
//   A x B = [4 5 6 5 6 7]      each (x,y) pair combined by +: sizes add
//   A ^ B = [3 4 5 6 8 10]     each (x,y) pair combined by *: sizes multiply
//
// '^' stands in for the board's wedge/caret operator (∧) — ASCII, not
// the unicode glyph, to keep this quick to type.
//
// Sizes *add* by concatenating the two terms' own children — a box with
// (Cx + Cy) children is just Cx children followed by Cy more. Sizes
// *multiply* the same way any product of two counts has to be built out
// of concatenation: Cx copies of bi's own Cy children, laid end to end —
// (Cx * Cy) children total. (This replaced an earlier version of ^ that
// nested the two terms as sub-boxes instead — a reasonable-looking guess
// straight off the whiteboard picture, but not what "sizes multiply"
// actually means; nesting increases rank, it doesn't multiply a count.)
//
// Every case is wrapped in reduceBox before returning — [M Mᵃ] = [], and
// that's a property of the *result*, not of any one operator: whichever
// combinator produced a term and its exact anti-object as siblings, they
// annihilate the same way. This is what makes the final answer canonical
// rather than just "technically correct but not fully simplified" — e.g.
// [[]] + [[]ᵃ] builds [[] []ᵃ] from the raw concatenation, and reduceBox
// is what collapses that the rest of the way down to [].
export function applyOperator(op: Operator, a: DemoBox, b: DemoBox, nextId: () => number): DemoBox {
  switch (op) {
    case '+':
      return reduceBox({
        id: nextId(),
        anti: false,
        children: [
          ...a.children.map((c) => cloneWithFreshIds(c, nextId)),
          ...b.children.map((c) => cloneWithFreshIds(c, nextId)),
        ],
      })
    case 'x':
      return reduceBox({
        id: nextId(),
        anti: false,
        children: a.children.flatMap((ai) =>
          b.children.map((bi) => ({
            id: nextId(),
            anti: combinedSign(ai.anti, bi.anti),
            children: [
              ...ai.children.map((c) => cloneWithFreshIds(c, nextId)),
              ...bi.children.map((c) => cloneWithFreshIds(c, nextId)),
            ],
          })),
        ),
      })
    case '^':
      return reduceBox({
        id: nextId(),
        anti: false,
        children: a.children.flatMap((ai) =>
          b.children.map((bi) => ({
            id: nextId(),
            anti: combinedSign(ai.anti, bi.anti),
            children: ai.children.flatMap(() => bi.children.map((c) => cloneWithFreshIds(c, nextId))),
          })),
        ),
      })
  }
}

// The same cartesian product x/^ build, but stopped one step earlier:
// each (ai, bi) pair is kept as two separate, unmerged sub-boxes side by
// side rather than combined into one term. This is the "expand into
// pairs first" reading of the board's distributive identities
// (A x (B+C) = (AxB)+(AxC)) — the pairing applyOperator's x/^ cases
// build is the same, just shown before the merge/multiply step collapses
// each pair down to a single term.
//
// Deliberately *not* reduced (unlike applyOperator) — the whole point of
// this stage is showing the raw, unsimplified expansion, cancelling
// pairs included, before evaluation collapses them away.
//
// + has no pairing to distribute in the first place (it's a union, not a
// product) — its case here builds the same raw concatenation
// applyOperator('+', ...) does, just without that function's own
// reduceBox step, rather than delegating to it and inheriting a
// reduction this stage isn't supposed to have.
export function distributeOperator(op: Operator, a: DemoBox, b: DemoBox, nextId: () => number): DemoBox {
  if (op === '+') {
    return {
      id: nextId(),
      anti: false,
      children: [
        ...a.children.map((c) => cloneWithFreshIds(c, nextId)),
        ...b.children.map((c) => cloneWithFreshIds(c, nextId)),
      ],
    }
  }
  return {
    id: nextId(),
    anti: false,
    children: a.children.flatMap((ai) =>
      b.children.map((bi) => ({
        id: nextId(),
        anti: false,
        children: [cloneWithFreshIds(ai, nextId), cloneWithFreshIds(bi, nextId)],
      })),
    ),
  }
}
