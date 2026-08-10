// @ts-nocheck — untyped on purpose, see conversation for why.
// A box is a plain array of terms. A term is a number, or anything else
// (an unresolved value, carried through untouched). Everything here is a
// free function — add(a, b), never a.add(b).

// add(a, b) — union: every term from a and b, in one box.
// add([1,2,3], [4,5,6]) => [1,2,3,4,5,6]
export const add = (a, b) => [...a, ...b];

// multiply(a, b) — every pair (x from a, y from b), combined by +.
// multiply([1,2,3], [4,5,6]) => [5,6,7,6,7,8,7,8,9]
export const multiply = (a, b) => a.flatMap((x) => b.map((y) => x + y));

// caret(a, b) — every pair (x from a, y from b), combined by *.
// caret([1,2,3], [4,5,6]) => [4,5,6,8,10,12,12,15,18]
export const caret = (a, b) => a.flatMap((x) => b.map((y) => x * y));

// evaluate(a) — collapse every number in the box into one running sum;
// anything that isn't a number is unresolved and carried through as its
// own term. All-numbers boxes evaluate to a bare number; boxes with
// leftover unresolved terms evaluate to [sum, ...unresolved].
// evaluate([1,2,3]) => 6
// evaluate([1, foo, 3]) => [4, foo]
export const evaluate = (a) => {
  let sum = 0;
  const rest = [];
  for (const term of a) {
    if (typeof term === 'number') sum += term;
    else rest.push(term);
  }
  return rest.length === 0 ? sum : [sum, ...rest];
};

// getRank(box) — how many levels of array nesting deep a value goes.
// Plain numbers are rank 0 (Zero/Natural); arrays start at rank 1.
// getRank(5)            => 0
// getRank([1,2,3])      => 1  (a flat list of terms = a Polynumber)
// getRank([[1,2],[3]])  => 2  (a list of term-lists = a Multinumber)
export const getRank = (box) =>
  Array.isArray(box) ? 1 + Math.max(0, ...box.map(getRank)) : 0;

// getDegree(box) — same recursive shape at every rank: a plain number's
// degree is itself, an array's degree is the highest degree among its terms.
// getDegree(5)            => 5
// getDegree([1,2,3])      => 3
// getDegree([[1,2],[3]])  => 3
export const getDegree = (box) =>
  Array.isArray(box) ? Math.max(0, ...box.map(getDegree)) : box;

// findType(box) — names the rank: Zero, Natural, Polynumber, Multinumber,
// Metanumber — the same hierarchy BoxEncoding used, read dynamically off
// the value instead of a static type.
// findType(0)            => 'Zero'
// findType(5)            => 'Natural'
// findType([1,2,3])      => 'Polynumber'
// findType([[1,2],[3]])  => 'Multinumber'
const RANK_NAMES = ['Natural', 'Polynumber', 'Multinumber', 'Metanumber'];
export const findType = (box) =>
  box === 0 ? 'Zero' : RANK_NAMES[getRank(box)] ?? `Rank${getRank(box)}`;

// toRootedTree(box) — a box as a generic rooted tree: every array becomes
// a node whose children are its terms, recursively; every plain value
// becomes a leaf. Renderer-agnostic on purpose — no positions, no
// three.js/R3F specifics, just { value, type, children } for a layout to walk.
// toRootedTree(5)       => { value: 5, type: 'Natural', children: [] }
// toRootedTree([1,2,3]) => { value: null, type: 'Polynumber', children: [
//                              { value: 1, type: 'Natural', children: [] },
//                              { value: 2, type: 'Natural', children: [] },
//                              { value: 3, type: 'Natural', children: [] } ] }
export const toRootedTree = (box) => ({
  value: Array.isArray(box) ? null : box,
  type: findType(box),
  children: Array.isArray(box) ? box.map(toRootedTree) : [],
});
