// @ts-nocheck — untyped on purpose, see conversation for why.
// A box is a plain array of terms. A term is a bigint, or anything else
// (an unresolved value, carried through untouched) — bigint, not number,
// so this stays exact instead of quietly drifting into floating point.
// Everything here is a free function — add(a, b), never a.add(b).

// add(a, b) — union: every term from a and b, in one box.
// add([1n,2n,3n], [4n,5n,6n]) => [1n,2n,3n,4n,5n,6n]
export const add = (a, b) => [...a, ...b];

// multiply(a, b) — every pair (x from a, y from b), combined by +.
// multiply([1n,2n,3n], [4n,5n,6n]) => [5n,6n,7n,6n,7n,8n,7n,8n,9n]
export const multiply = (a, b) => a.flatMap((x) => b.map((y) => x + y));

// caret(a, b) — every pair (x from a, y from b), combined by *.
// caret([1n,2n,3n], [4n,5n,6n]) => [4n,5n,6n,8n,10n,12n,12n,15n,18n]
export const caret = (a, b) => a.flatMap((x) => b.map((y) => x * y));

// evaluate(a) — collapse every bigint in the box into one running sum;
// anything that isn't a bigint is unresolved and carried through as its
// own term. All-bigint boxes evaluate to a bare bigint; boxes with
// leftover unresolved terms evaluate to [sum, ...unresolved].
// evaluate([1n,2n,3n]) => 6n
// evaluate([1n, foo, 3n]) => [4n, foo]
export const evaluate = (a) => {
  let sum = 0n;
  const rest = [];
  for (const term of a) {
    if (typeof term === 'bigint') sum += term;
    else rest.push(term);
  }
  return rest.length === 0 ? sum : [sum, ...rest];
};

// getRank(box) — how many levels of array nesting deep a value goes.
// Plain bigints are rank 0 (Zero/Natural); arrays start at rank 1.
// getRank(5n)              => 0
// getRank([1n,2n,3n])      => 1  (a flat list of terms = a Polynumber)
// getRank([[1n,2n],[3n]])  => 2  (a list of term-lists = a Multinumber)
export const getRank = (box) =>
  Array.isArray(box) ? 1 + Math.max(0, ...box.map(getRank)) : 0;

// getDegree(box) — same recursive shape at every rank: a plain bigint's
// degree is itself, an array's degree is the highest degree among its
// terms. Written as a manual reduce, not Math.max — Math.max coerces
// through Number, which throws on bigint.
// getDegree(5n)              => 5n
// getDegree([1n,2n,3n])      => 3n
// getDegree([[1n,2n],[3n]])  => 3n
export const getDegree = (box) =>
  Array.isArray(box)
    ? box.reduce((max, term) => {
        const d = getDegree(term);
        return d > max ? d : max;
      }, 0n)
    : box;

// findType(box) — names the rank: Zero, Natural, Polynumber, Multinumber,
// Metanumber — the same hierarchy BoxEncoding used, read dynamically off
// the value instead of a static type.
// findType(0n)              => 'Zero'
// findType(5n)              => 'Natural'
// findType([1n,2n,3n])      => 'Polynumber'
// findType([[1n,2n],[3n]])  => 'Multinumber'
const RANK_NAMES = ['Natural', 'Polynumber', 'Multinumber', 'Metanumber'];
export const findType = (box) =>
  box === 0n ? 'Zero' : RANK_NAMES[getRank(box)] ?? `Rank${getRank(box)}`;

// toRootedTree(box) — a box as a generic rooted tree: every array becomes
// a node whose children are its terms, recursively; every plain value
// becomes a leaf. Renderer-agnostic on purpose — no positions, no
// three.js/R3F specifics, just { value, type, children } for a layout to walk.
// toRootedTree(5n)        => { value: 5n, type: 'Natural', children: [] }
// toRootedTree([1n,2n,3n]) => { value: null, type: 'Polynumber', children: [
//                              { value: 1n, type: 'Natural', children: [] },
//                              { value: 2n, type: 'Natural', children: [] },
//                              { value: 3n, type: 'Natural', children: [] } ] }
export const toRootedTree = (box) => ({
  value: Array.isArray(box) ? null : box,
  type: findType(box),
  children: Array.isArray(box) ? box.map(toRootedTree) : [],
});
