# boxmath

TypeScript implementation of [Wildberger's Box Arithmetic](https://www.youtube.com/watch?v=...) — a purely integer foundation for polynomial algebra, linear algebra, and beyond.

All values are `bigint`. There is no fixed-point scaling, no division in core operations, and no floating point anywhere. The library is designed for direct composition with [`BoxMath.sol` and `PixelMath.sol`](https://github.com/mystical-metaphysical-number-system/hardhat) — identical semantics across TypeScript and Solidity.

## Install

```bash
npm install boxmath
```
const zero = []; = 0

const one = [[]] = [0] = 1
const two = [[], []] = [0, 0] = 2 = two.length

const rawAdder = (a, b) = [...a, ...b]
const alpha = [ [ [] ] ]= [ [ 0 ] ] = [ 1 ] 
const alphaAlphaSquared = [ [ [ [], [] ] ] ]
// btw
// if ( 0 == [] ) // true 

// if ([[]] == 1) // true // one can appreciate





## Primitives



### Polynomials — `Polynumber`, `Multinumber`

```ts
import { Polynumber, Multinumber, pow, caretProduct } from 'boxmath';

// 1 + 3x + x²
const p = new Multinumber([
  new Polynumber(1n, []),
  new Polynumber(3n, [1]),
  new Polynumber(1n, [2]),
]);

p.evaluate([5n]);          // 41n  (1 + 15 + 25)
p.truncate(1).evaluate([5n]);  // 16n  (1 + 15)

// Constant-product invariant xy
const k = new Multinumber([new Polynumber(1n, [1, 1])]);
k.evaluate([100n, 200n]);  // 20000n
```

### Ordered pairs — `Pixel`

A pixel `[m, n]` is a 2-listbox of natural numbers. Pixels support a non-commutative, partial **pixel product** that mirrors matrix index composition:

```ts
import { Pixel } from 'boxmath';

new Pixel(3n, 4n).pixelProduct(new Pixel(4n, 11n));  // Pixel(3n, 11n)
new Pixel(3n, 4n).pixelProduct(new Pixel(5n, 11n));  // null — nothing

// Pythagorean triples: pixel [m,n] with m > n → (m²-n², 2mn, m²+n²)
new Pixel(2n, 1n).pythagoreanTriple();  // [3n, 4n, 5n]
new Pixel(3n, 2n).pythagoreanTriple();  // [5n, 12n, 13n]
```

### Coefficient vectors — `Vexel`

```ts
import { Vexel } from 'boxmath';

const v1 = Vexel.fromArray([1n, 2n, 3n]);
const v2 = Vexel.fromArray([4n, 5n, 6n]);
v1.dot(v2);   // 32n
v1.add(v2).toArray(3);   // [5n, 7n, 9n]
```

### Sparse matrices — `Maxel`

```ts
import { Pixel, Maxel } from 'boxmath';

// Matrix multiplication via pixel product (Examples 22 & 23 from the paper)
const M = Maxel.fromPixels([new Pixel(0n, 0n), new Pixel(1n, 0n)]);
const N = Maxel.fromPixels([new Pixel(1n, 0n), new Pixel(0n, 2n), new Pixel(2n, 3n)]);

M.maxelProduct(N).get(0n, 2n);  // 1n
M.maxelProduct(N).get(1n, 2n);  // 1n
```

## Development

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

Tests use Node's built-in test runner — no Jest, no Vitest, no extra dependencies.

## Exports

```ts
import {
  // Polynomials
  Polynumber, Multinumber, pow, caretProduct,
  // Ordered structures
  Pixel, Vexel, Maxel,
} from 'boxmath';
```

## Docs

Full API reference and encoding guides: [mystical-metaphysical-number-system.github.io/mmp](https://mystical-metaphysical-number-system.github.io/mmp)
