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
