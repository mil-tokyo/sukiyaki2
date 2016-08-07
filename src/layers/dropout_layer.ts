import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class DropoutLayer extends Layer {
  dropout_ratio: number;
  mask: $M.Matrix;
  constructor(params: any) {
    super();
    this.dropout_ratio = params.dropout_ratio;
    if (!(this.dropout_ratio >= 0.0 && this.dropout_ratio < 1.0)) {
      throw Error('dropout_ratio must be 0 <= dropout_ratio < 1');
    }
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var output: $M.Matrix;
    if (config.phase == 'train') {
      var [m, o] = $M.autodestruct(() => {
        // TODO: faster version for CL
        // mask = Bernoulli distribution * scale
        var mask = $M.rand($M.size(data));
        mask = $M.ge(mask, this.dropout_ratio);
        mask = $M.times(mask, 1.0 / (1.0 - this.dropout_ratio));
        var out = $M.times(mask, data);
        return [mask, out];
      });
      this.mask = m;
      output = o;
    } else {
      output = data.copy();
    }
    setImmediate(function () {
      callback([output]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    let bottom_delta: $M.Matrix;
    if (config.phase == 'train') {
      bottom_delta = $M.times(top_delta, this.mask);
    } else {
      bottom_delta = top_delta.copy();
    }


    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  release(): void {
    if (this.mask) {
      this.mask.destruct();
      this.mask = null;
    }
  }

  destruct(): void {

  }
}

export = DropoutLayer;
