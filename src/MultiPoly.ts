import { Monomial } from './Monomial.ts';

export class MultiPoly {
  readonly terms: Monomial[];

  constructor(terms: Monomial[]) {
    this.terms = [...terms];
  }

  get numVariables(): number {
    return Math.max(...this.terms.map(t => t.extent), 0) + 1;
  }

  static linear(coeffs: (number | bigint)[]): MultiPoly {
    const terms = coeffs.map((c, i) => {
      const exponents = new Array(coeffs.length).fill(0);
      exponents[i] = 1;
      return new Monomial(BigInt(c), exponents);
    });
    return new MultiPoly(terms);
  }

  static constant(value: bigint): MultiPoly {
    return new MultiPoly([new Monomial(value, [])]);
  }

  evaluate(point: bigint[]): bigint {
    return this.terms.reduce(
      (sum, term) => sum + term.evaluate(point),
      0n
    );
  }

  add(other: MultiPoly): MultiPoly {
    return new MultiPoly([...this.terms, ...other.terms]);
  }

  truncate(k: number): MultiPoly {
    return new MultiPoly(this.terms.filter(t => t.degree <= k));
  }

  multiply(other: MultiPoly): MultiPoly {
    const newTerms: Monomial[] = [];

    for (const t1 of this.terms) {
      for (const t2 of other.terms) {
        newTerms.push(t1.multiply(t2));
      }
    }

    return new MultiPoly(newTerms);
  }

  toString(varNames?: string[]): string {
    return this.terms
      .map(t => t.toString(varNames))
      .join(' + ')
      .replace(/\+ -/g, '- ');
  }
}
