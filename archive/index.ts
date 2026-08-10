export { Polynumber } from './Polynumber.ts';
export { Multinumber } from './Multinumber.ts';
export { pow, caretProduct } from './utils.ts';
export { Pixel } from './Pixel.ts';
export { Vexel } from './Vexel.ts';
export { Maxel } from './Maxel.ts';
export {
  zero, natural, polynumber, multinumber,
  readNatural, readPolynumber, readMultinumber,
} from './BoxEncoding.ts';
export type { Depth, Box, Zero, Natural, Polynumber as PolynumberBox, Multinumber as MultinumberBox } from './BoxEncoding.ts';


// recurseIntoBox(box, { ...things })
/**
 * recurseIntoBox()
 *
 */

/*
 *
 export const box = (box:any, {..args}) => {
 return
 }
 */

//box([...chomp])
//
//[1, [2,3], [[4]]]
//const arr2 = arr.map((box, i) => {
// // return box.sum()
//})
//const arr3 = arr2.map((box, i) => {
// // return box.sum()  
// })
// do until no more array
//
//
/*
export const recurseIntoBox = (box, { ...args }) => {
  return box.map((child, i) = {
    switch (typeof child) {
      case 'number':
        return child;
    }
  })
}
*/

import type { Box } from './BoxEncoding.ts';

// The one leaf a pure Box<D> can't express is "unknown" — there's no way to
// spell "unbound" using only nested emptiness. So a marker like {name: 'x'}
// stands in for it. It never floats bare in a box, though — it's wrapped
// in an array like everything else: [{name:'x'}], not {name:'x'}. That's
// the one exception the arrays-all-the-way-down rule needs.
//
// acc is the box being built: acc[0] is the constant bucket, a plain
// Natural with no marker. Each later bucket opens with a marker at slot 0
// — [{name:'x'}, [], []] reads as "2 of x" the same way [[],[],[]] reads
// as "3", just with that one extra leading element.
//
// Every child in the input is an array (a marker arrives wrapped, see
// above), so there's only one question per child: is child[0] itself an
// array (tunnel deeper) or a marker (open a new bucket)? An empty child
// folds into whichever bucket is currently open (acc[acc.length - 1]).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accumulateIntoBox = (box: any[], acc: any[] = [[]]): any[] => {
  for (const child of box) {
    if (child.length === 0) {
      (acc[acc.length - 1]).push([]);        // fold into the open bucket
    } else if (Array.isArray(child[0])) {
      accumulateIntoBox(child, acc);         // tunnel deeper, same open bucket
    } else {
      acc.push([child[0]]);                  // open a new bucket
    }
  }
  return acc;
}

export const accumulateBoxes = (
  boxOne: Box,
  boxTwo: Box
) => {
  // deep compare I suppose we'll need to extend the type of Box or precompute its heirarchy or rank and if rank = rank we can chi the boxes or perform the box dance
  switch (typeof BoxOne == BoxTwo) {}

}
