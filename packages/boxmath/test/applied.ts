import { test } from 'node:test';
import assert from 'node:assert';
import { add, multiply, caret, evaluate, getRank, getDegree, findType, toRootedTree } from '../src/applied.ts';

const testOne = [1, 2, 3];
const testTwo = [4, 5, 6];
const foo = { bar: '5' };
const testThree = [1, foo, 3];

test('add(testOne, testTwo) concatenates the two boxes', () => {
  assert.deepStrictEqual(add(testOne, testTwo), [1, 2, 3, 4, 5, 6]);
});

test('add(testOne, testThree) works with a non-number term too', () => {
  assert.deepStrictEqual(add(testOne, testThree), [1, 2, 3, 1, foo, 3]);
});

test('multiply(testOne, testTwo) pairs every term with +', () => {
  assert.deepStrictEqual(multiply(testOne, testTwo), [5, 6, 7, 6, 7, 8, 7, 8, 9]);
});

test('caret(testOne, testTwo) pairs every term with *', () => {
  assert.deepStrictEqual(caret(testOne, testTwo), [4, 5, 6, 8, 10, 12, 12, 15, 18]);
});

test('evaluate(testOne) sums a box of plain numbers', () => {
  assert.strictEqual(evaluate(testOne), 6);
});

test('evaluate(testThree) carries the non-number term through untouched', () => {
  assert.deepStrictEqual(evaluate(testThree), [4, foo]);
});

test('findType names the full hierarchy: Zero, Natural, Polynumber, Multinumber, Metanumber', () => {
  assert.strictEqual(findType(0), 'Zero');
  assert.strictEqual(findType(5), 'Natural');
  assert.strictEqual(findType([1, 2, 3]), 'Polynumber');
  assert.strictEqual(findType([[1, 2], [3]]), 'Multinumber');
  assert.strictEqual(findType([[[1]]]), 'Metanumber');
});

test('getRank matches the same hierarchy: 0, 0, 1, 2, 3', () => {
  assert.strictEqual(getRank(0), 0);
  assert.strictEqual(getRank(5), 0);
  assert.strictEqual(getRank([1, 2, 3]), 1);
  assert.strictEqual(getRank([[1, 2], [3]]), 2);
  assert.strictEqual(getRank([[[1]]]), 3);
});

test('getDegree works on a bare number too', () => {
  assert.strictEqual(getDegree(5), 5);
  assert.strictEqual(getDegree([1, 2, 3]), 3);
});

test('toRootedTree(5) is a leaf', () => {
  assert.deepStrictEqual(toRootedTree(5), { value: 5, type: 'Natural', children: [] });
});

test('toRootedTree([1,2,3]) is a Polynumber node with three leaves', () => {
  assert.deepStrictEqual(toRootedTree([1, 2, 3]), {
    value: null,
    type: 'Polynumber',
    children: [
      { value: 1, type: 'Natural', children: [] },
      { value: 2, type: 'Natural', children: [] },
      { value: 3, type: 'Natural', children: [] },
    ],
  });
});

test('toRootedTree nests correctly for a Multinumber', () => {
  const tree = toRootedTree([[1, 2], [3]]);
  assert.strictEqual(tree.type, 'Multinumber');
  assert.strictEqual(tree.children.length, 2);
  assert.strictEqual(tree.children[0].type, 'Polynumber');
  assert.strictEqual(tree.children[0].children.length, 2);
});
