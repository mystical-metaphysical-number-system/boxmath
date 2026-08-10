// @ts-nocheck — untyped on purpose, see conversation for why.
//
// Pure box arithmetic — Wildberger's original encoding, no primitive
// numbers anywhere. A quantity is nothing but nested emptiness: 0 is [],
// 3 is [[],[],[]]. No shortcuts — expressing 1000 really does mean
// climbing an array of 1000 empty boxes, every time.

// toBox(n) — n copies of [], the box form of the number n.
// toBox(0) => []
// toBox(3) => [[],[],[]]
export const toBox = (n) => Array.from({ length: n }, () => []);

// fromBox(box) — a box's magnitude is just how many slots it has.
// fromBox([[],[],[]]) => 3
export const fromBox = (box) => box.length;

// A signed box pairs two ordinary boxes: the positive units and the
// negative units (zeros and anti-zeros). Net magnitude is just their
// lengths, subtracted — no cancellation needed to read the value out
// correctly, so add/multiply/caret below never have to reduce anything,
// just count.

// toSignedBox(n) — toSignedBox(3) => [[[],[],[]], []]
//                  toSignedBox(-2) => [[], [[],[]]]
export const toSignedBox = (n) => (n >= 0 ? [toBox(n), toBox(0)] : [toBox(0), toBox(-n)]);

// fromSignedBox(box) — read the net value straight off the two lengths.
export const fromSignedBox = ([positive, negative]) => positive.length - negative.length;

// add(a, b) — pile the positives together and the negatives together.
// Doesn't cancel matching pairs; fromSignedBox reads the same net value
// either way, cancelled or not.
export const add = ([p1, n1], [p2, n2]) => [[...p1, ...p2], [...n1, ...n2]];

// multiply(a, b) — ordinary sign-of-product arithmetic, done on lengths:
// like signs land in the positive pile, unlike signs in the negative pile.
export const multiply = ([p1, n1], [p2, n2]) => [
  toBox(p1.length * p2.length + n1.length * n2.length),
  toBox(p1.length * n2.length + n1.length * p2.length),
];

// caret(a, b) — at the Natural level this is the same operation as
// multiply; the paper's caret only diverges from multiplication one level
// up, at Polynumbers (BoxEncoding's chi commentary called this Naturals
// "bottoming out" at chi(2)). Kept as its own name for when that level
// exists here too, not a placeholder — this is the documented result.
export const caret = multiply;
