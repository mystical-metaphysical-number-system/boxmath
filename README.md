# boxmath

TypeScript implementation of [Wildberger's Box Arithmetic](https://www.youtube.com/watch?v=...) — a purely integer foundation for polynomial algebra, built from nothing but nested emptiness.

## Two implementations, one idea

The library is split into two modules that both express the same hierarchy — `Zero → Natural → Polynumber → Multinumber → Metanumber` — but make opposite tradeoffs about how a number is spelled:

- **`boxmath/pure`** is the literal encoding: a quantity *is* nested emptiness, nothing else. `0` is `[]`, `3` is `[[],[],[]]`. This is honest to the paper but expensive — a number `n` costs `n` actual boxes to build, so its size scales `O(n)`.
- **`boxmath/applied`** keeps the spirit — the same hierarchy, the same recursive shape — but a leaf is a plain JavaScript `bigint` instead of a chomped-out array of empty boxes. `3` is just `3n`, not three nested arrays. Arithmetic runs at native speed and stays exact (`bigint`, never `number`, so there's no floating point drift), at the cost of no longer being "pure" — the numbers are a primitive, not a construction.

Pick `pure` when the construction itself is the point; pick `applied` for everything else.

```ts
// [] == 0 and [[]] == 1 are both true in plain JavaScript — array-to-
// primitive coercion happens to agree with the box encoding for free.
```

## Install

```bash
npm install
```

This is an npm workspace — one install at the repo root covers the library (`packages/boxmath`) and the `studio` visualizer together.

No git experience needed to get the code itself — GitHub's **`< > Code` → Download ZIP** button works fine. See [`GETTING_STARTED.md`](./GETTING_STARTED.md) for the complete from-scratch walkthrough (Node install included).

## `boxmath/pure`

```ts
import { toBox, fromBox } from 'boxmath/pure';

toBox(0);              // []
toBox(3);               // [[],[],[]]
fromBox([[],[],[]]);     // 3
```

That's the whole surface: `toBox(n)` builds the literal box form of `n`; `fromBox(box)` reads a box's magnitude back out (just its length). No `chi`/combine operator yet — see the chat history if you want to pick that back up.

## `boxmath/applied`

```ts
import { add, multiply, caret, evaluate, getRank, getDegree, findType, toRootedTree } from 'boxmath/applied';

// add/multiply/caret all take two boxes (arrays of bigint) and return one
add([1n, 2n, 3n], [4n, 5n, 6n]);       // [1n,2n,3n,4n,5n,6n]      — union
multiply([1n, 2n, 3n], [4n, 5n, 6n]);  // [5n,6n,7n,6n,7n,8n,7n,8n,9n]  — every pair, combined by +
caret([1n, 2n, 3n], [4n, 5n, 6n]);     // [4n,5n,6n,8n,10n,12n,12n,15n,18n] — every pair, combined by *

// evaluate collapses a box's bigints into one running sum; anything that
// isn't a bigint is left alone and carried through untouched
evaluate([1n, 2n, 3n]);                // 6n

// getRank / findType read the hierarchy dynamically off a value's shape —
// a plain bigint is rank 0 (Zero or Natural), each level of array nesting
// adds one rank (Polynumber, Multinumber, Metanumber, ...)
findType(0n);                // 'Zero'
findType(5n);                // 'Natural'
findType([1n, 2n, 3n]);      // 'Polynumber'
findType([[1n, 2n], [3n]]);  // 'Multinumber'
getRank([[1n, 2n], [3n]]);   // 2
getDegree([1n, 2n, 3n]);     // 3n — same recursive shape at every rank

// toRootedTree turns a box into a plain { value, type, children } tree —
// renderer-agnostic, no positions or three.js specifics, just a shape a
// layout function can walk
toRootedTree([1n, 2n, 3n]);
// { value: null, type: 'Polynumber', children: [
//     { value: 1n, type: 'Natural', children: [] },
//     { value: 2n, type: 'Natural', children: [] },
//     { value: 3n, type: 'Natural', children: [] } ] }
```

## Studio

`studio/` is a Vite + React + react-three-fiber app that renders a box as a rooted tree in 3D — toggle between Pure and Applied to see the same box rendered both ways, including a click-to-build editor for constructing Pure boxes directly out of units and anti-units. See [`GETTING_STARTED.md`](./GETTING_STARTED.md) for a from-scratch setup guide (written for a non-JS audience), or if your machine is already set up:

```bash
npm run dev:studio
```

## Development

```bash
npm test    # runs packages/boxmath's test suite (node's built-in test runner — no Jest, no Vitest)
```

## Docs

Full API reference and encoding guides: [mystical-metaphysical-number-system.github.io/mmp](https://mystical-metaphysical-number-system.github.io/mmp)
