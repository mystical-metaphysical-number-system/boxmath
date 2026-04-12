import { Monomial } from './Monomial.ts';

export class MultiPoly {
  readonly terms: Monomial[];
  readonly precision: number;
  readonly numVariables: number;
  
  constructor(terms: Monomial[], precision: number = 18) {
    this.terms = [...terms];
    this.precision = precision;
    this.numVariables = Math.max(...terms.map(t => t.extent), 0) + 1;
  }
  
  static linear(coeffs: (number | bigint)[], precision: number = 18): MultiPoly {
    // TODO: Confirm if linear coefficients should be pre-scaled or not
    const scale = 10n ** BigInt(precision);
    const terms = coeffs.map((c, i) => {
      const exponents = new Array(coeffs.length).fill(0);
      exponents[i] = 1;
      return new Monomial(BigInt(c) * scale, exponents);
    });
    
    return new MultiPoly(terms, precision);
  }
  
  static constant(value: bigint, precision: number = 18): MultiPoly {
    return new MultiPoly([new Monomial(value, [])], precision);
  }
  
  evaluate(point: bigint[]): bigint {
    // TODO: Consider if dimension mismatch should pad with zeros instead of throwing
    if (point.length !== this.numVariables) {
      throw new Error('Dimension mismatch');
    }
    
    return this.terms.reduce(
      (sum, term) => sum + term.evaluate(point, this.precision),
      0n
    );
  }
  
  add(other: MultiPoly): MultiPoly {
    if (this.precision !== other.precision) {
      throw new Error('Precision mismatch');
    }
    
    return new MultiPoly(
      [...this.terms, ...other.terms],
      this.precision
    );
  }
  
  multiply(other: MultiPoly): MultiPoly {
    if (this.precision !== other.precision) {
      throw new Error('Precision mismatch');
    }
    
    const newTerms: Monomial[] = [];
    
    for (const t1 of this.terms) {
      for (const t2 of other.terms) {
        newTerms.push(t1.multiply(t2));
      }
    }
    
    return new MultiPoly(newTerms, this.precision);
  }
  
  toString(varNames?: string[]): string {
    return this.terms
      .map(t => t.toString(varNames))
      .join(' + ')
      .replace(/\+ -/g, '- ');
  }
}
