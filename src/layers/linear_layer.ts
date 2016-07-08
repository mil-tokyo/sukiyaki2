/// <reference path="../../node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');

class LinearLayer extends Layer {
  weight: $M.Matrix;
  bias: $M.Matrix;
  delta_weight: $M.Matrix;
  delta_bias: $M.Matrix;
  in_size: number;
  out_size: number;
  in_shape: number[];

  constructor(params: any) {
    super();
    this.need_update = true;
    // scalar (1-dim) or size array (output shape from conv layer)
    if (params.in_shape) {
      this.in_shape = params.in_shape;
    } else {
      this.in_shape = [params.in_size];
    }
    this.in_size = this.in_shape.reduce((prev, cur) => prev * cur, 1);
    this.out_size = params.out_size;
    this.weight = $M.times($M.randn(this.in_size, this.in_size), 1.0 / Math.sqrt(this.in_size));
    this.bias = $M.zeros(this.in_size, 1);
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
    var data_orig_shape = $M.size(data);
    // convert to 2d with keeping batch length (flatten in fortran-order)
    data.reshape_inplace(-1, $M.size(data, this.in_shape.length + 1));
    //batch: [dim, sample]
    var top = $M.autodestruct(() => {
      var output = $M.mtimes(this.weight, data);
      var output_with_bias = $M.plus(output, $M.repmat(this.bias, 1, $M.sizejsa(data)[1]));
      return output_with_bias;
    });
    data.reshape_inplace(data_orig_shape);

    setImmediate(function () {
      callback([top]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var data_orig_shape = $M.size(data);

    var bottom_delta = $M.autodestruct(() => {
      var result = $M.mtimes($M.t(this.weight), top_delta);
      result.reshape_inplace(data_orig_shape);
      return result;
    });

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    // convert to 2d with keeping batch length
    var data_orig_shape = $M.size(data);
    data.reshape_inplace(-1, $M.size(data, this.in_shape.length + 1));

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

    data.reshape_inplace(data_orig_shape);

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
