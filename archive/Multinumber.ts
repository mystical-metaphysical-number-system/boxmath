import { Polynumber } from './Polynumber.ts';

export class Multinumber {
  readonly terms: Polynumber[];

  constructor(terms: Polynumber[]) {
    this.terms = [...terms];
  }

  get numVariables(): number {
    return Math.max(...this.terms.map(t => t.extent), 0) + 1;
  }

  static linear(coeffs: (number | bigint)[]): Multinumber {
    const terms = coeffs.map((c, i) => {
      const exponents = new Array(coeffs.length).fill(0);
      exponents[i] = 1;
      return new Polynumber(BigInt(c), exponents);
    });
    return new Multinumber(terms);
  }

  static constant(value: bigint): Multinumber {
    return new Multinumber([new Polynumber(value, [])]);
  }

  evaluate(point: bigint[]): bigint {
    return this.terms.reduce(
      (sum, term) => sum + term.evaluate(point),
      0n
    );
  }

  add(other: Multinumber): Multinumber {
    return new Multinumber([...this.terms, ...other.terms]);
  }

  truncate(k: number): Multinumber {
    return new Multinumber(this.terms.filter(t => t.degree <= k));
  }

  multiply(other: Multinumber): Multinumber {
    const newTerms: Polynumber[] = [];

    for (const t1 of this.terms) {
      for (const t2 of other.terms) {
        newTerms.push(t1.multiply(t2));
      }
    }

    return new Multinumber(newTerms);
  }

  toString(varNames?: string[]): string {
    return this.terms
      .map(t => t.toString(varNames))
      .join(' + ')
      .replace(/\+ -/g, '- ');
  }
}
