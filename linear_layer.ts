/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('./forward_configuration');

class LinearLayer extends Layer {
  weight: $M.Matrix;
  bias: $M.Matrix;
  delta_weight: $M.Matrix;
  delta_bias: $M.Matrix;

  constructor(params: any) {
    super();
    this.need_update = true;
    var in_size = params.in_size;
    var out_size = params.out_size;
    this.weight = $M.times($M.randn(out_size, in_size), 1.0 / Math.sqrt(in_size));
    this.bias = $M.zeros(out_size, 1);
    this.delta_weight = $M.zeros(out_size, in_size);
    this.delta_bias = $M.zeros(out_size, 1);
    this.train_params = ['weight', 'bias'];
    this.delta_params = ['delta_weight', 'delta_bias'];
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //multiply input by weight
    var data: $M.Matrix = bottoms[0];
    //batch: [dim, sample]
    var output = $M.mtimes(this.weight, data);
    output = $M.plus(output, $M.repmat(this.bias, 1, $M.sizejsa(data)[1]));

    setImmediate(function() {
      callback([output]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    var bottom_delta = $M.mtimes($M.t(this.weight), top_delta);

    setImmediate(function() {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    var delta_weight = $M.mtimes(top_delta, $M.t(data));
    var delta_bias = $M.sum(top_delta, 2);

    this.delta_weight = $M.plus(this.delta_weight, delta_weight);
    this.delta_bias = $M.plus(this.delta_bias, delta_bias);

    setImmediate(function() {
      callback();
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = LinearLayer;
