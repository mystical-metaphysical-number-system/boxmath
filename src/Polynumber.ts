import { pow } from './utils.ts';

export class Polynumber {
  readonly coefficient: bigint;
  readonly exponents: number[];

  constructor(coefficient: bigint, exponents: number[]) {
    this.coefficient = coefficient;
    this.exponents = [...exponents];
  }

  get degree(): number {
    return this.exponents.reduce((sum, exp) => sum + exp, 0);
  }

  get extent(): number {
    for (let i = this.exponents.length - 1; i >= 0; i--) {
      if (this.exponents[i] !== 0) return i;
    }
    return 0;
  }

  evaluate(point: bigint[]): bigint {
    let result = this.coefficient;

    for (let i = 0; i < this.exponents.length; i++) {
      if (this.exponents[i] > 0) {
        const base = point[i] ?? 0n;
        result = result * pow(base, this.exponents[i]);
      }
    }

    return result;
  }

  multiply(other: Polynumber): Polynumber {
    const newCoeff = this.coefficient * other.coefficient;

    const maxLen = Math.max(this.exponents.length, other.exponents.length);
    const newExps = new Array(maxLen).fill(0);

    for (let i = 0; i < maxLen; i++) {
      const e1 = i < this.exponents.length ? this.exponents[i] : 0;
      const e2 = i < other.exponents.length ? other.exponents[i] : 0;
      newExps[i] = e1 + e2;
    }

    return new Polynumber(newCoeff, newExps);
  }

  toString(varNames: string[] = ['x', 'y', 'z']): string {
    if (this.coefficient === 0n) return '0';

    let str = this.coefficient !== 1n ? this.coefficient.toString() : '';

    for (let i = 0; i < this.exponents.length; i++) {
      if (this.exponents[i] === 0) continue;

      const varName = i < varNames.length ? varNames[i] : `β${i}`;
      str += varName;
      if (this.exponents[i] > 1) str += `^${this.exponents[i]}`;
    }

    return str || '1';
  }
}
