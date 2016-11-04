import $M = require('milsushi2');
import Sukiyaki = require('../index');
import BenchBase = require('./bench_base');

class mtimes extends BenchBase {
  constructor(public m: number, public n: number, public k: number) {
    super();
    this.name = 'mtimes ' + m + ',' + n + ',' + k;
  }

  setup() {
    var a = $M.rand(this.m, this.k);
    var b = $M.rand(this.k, this.n);
    return [a, b];
  }

  run(callback: any, a: $M.Matrix, b: $M.Matrix): void {
    var c = $M.mtimes(a, b);
    setImmediate(callback);
  }
}

export = mtimes;
