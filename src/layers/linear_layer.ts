/// <reference path="../../node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');

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
    this.delta_weight = null;//$M.zeros(out_size, in_size);
    this.delta_bias = null;//$M.zeros(out_size, 1);
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
    var top = $M.autodestruct(() => {
      var output = $M.mtimes(this.weight, data);
      var output_with_bias = $M.plus(output, $M.repmat(this.bias, 1, $M.sizejsa(data)[1]));
      return output_with_bias;
    });

    setImmediate(function () {
      callback([top]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    var bottom_delta = $M.autodestruct(() => $M.mtimes($M.t(this.weight), top_delta));

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    var new_delta_weight = $M.autodestruct(() => {
      var delta_weight = $M.mtimes(top_delta, $M.t(data));
      return $M.plus(this.delta_weight, delta_weight);
    });
    this.delta_weight.destruct();
    this.delta_weight = new_delta_weight;
    var new_delta_bias = $M.autodestruct(() => {
      var delta_bias = $M.sum(top_delta, 2);
      return $M.plus(this.delta_bias, delta_bias);
    });
    this.delta_bias.destruct();
    this.delta_bias = new_delta_bias;

    setImmediate(function () {
      callback();
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = LinearLayer;
