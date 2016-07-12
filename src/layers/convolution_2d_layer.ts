import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');
import im2col = require('../utils/im2col');

class Convolution2DLayer extends Layer {
  weight: $M.Matrix;
  bias: $M.Matrix;
  delta_weight: $M.Matrix;
  delta_bias: $M.Matrix;
  in_size: number;
  out_size: number;
  ksize: number[];
  stride: number[];
  pad: number[];

  constructor(params: any) {
    super();
    this.need_update = true;
    this.in_size = params.in_size;
    this.out_size = params.out_size;
    this.ksize = params.ksize;//kernel size [3,3]
    this.stride = params.stride;
    this.pad = params.pad;
    this.weight = $M.times(
      $M.randn(this.ksize[0], this.ksize[1], this.in_size, this.out_size),
      1.0 / Math.sqrt(this.ksize[0] * this.ksize[1] * this.in_size));
    this.bias = $M.zeros(this.in_size, 1);
    this.delta_weight = null;//$M.zeros(in_size, out_size);
    this.delta_bias = null;//$M.zeros(out_size, 1);
    this.train_params = ['weight', 'bias'];
    this.delta_params = ['delta_weight', 'delta_bias'];
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    console.log('data shape ' + data._size);
    var n = $M.size(data, 4);
    this.weight.reshape_inplace(this.ksize[0] * this.ksize[1] * this.in_size, this.out_size);
    var top = $M.autodestruct(() => {
      var output: $M.Matrix = null;
      for (var batch = 1; batch <= n; batch++) {
        var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
        var col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
        var col_shape = $M.sizejsa(col);
        var out_h = col_shape[0];
        var out_w = col_shape[1];
        col.reshape_inplace(out_h * out_w, -1);
        var output_b = $M.mtimes(col, this.weight);//[out_h*out_w, out_size]
        console.log('output_b ', output_b);
        var output_b_with_bias = $M.plus(output_b, $M.repmat($M.t(this.bias), $M.sizejsa(output_b)[0], 1));
        console.log('output_b_with_bias ', output_b_with_bias);
        if (batch == 1) {
          output = $M.zeros(out_h * out_w, this.out_size, n);
        }
        output.set($M.colon(), $M.colon(), batch, output_b_with_bias);
      }
      output.reshape_inplace(out_h, out_w, this.out_size, n);
      return output;
    });
    this.weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);

    console.log('top ', top.get($M.colon(), $M.colon()));
    setImmediate(function () {
      callback([top]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    //TODO
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var data_orig_shape = $M.size(data);

    var bottom_delta = $M.autodestruct(() => {
      var result = $M.zeros($M.size(data));
      return result;
    });

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    var n = $M.size(data, 4);
    var new_delta_weight: $M.Matrix = $M.autodestruct(() => {
      var output: $M.Matrix = null;
      for (var batch = 1; batch <= n; batch++) {
        var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
        var col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
        var col_shape = $M.sizejsa(col);
        var out_h = col_shape[0];
        var out_w = col_shape[1];
        col.reshape_inplace(out_h * out_w, -1);

        var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
        top_delta_batch.reshape_inplace(out_h * out_w, -1);

        var delta_weight_b = $M.mtimes($M.t(col), top_delta_batch);
        if (batch == 1) {
          output = delta_weight_b;
        } else {
          var old_output = output;
          output = $M.plus(old_output, delta_weight_b);
          old_output.destruct();
          delta_weight_b.destruct();
        }
      }
      output.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);
      return output;
    });
    var old_delta_weight = this.delta_weight;
    this.delta_weight = $M.plus(old_delta_weight, new_delta_weight);
    old_delta_weight.destruct();
    new_delta_weight.destruct();

    var new_delta_bias = $M.autodestruct(() => {
      var td_permuted = $M.permute(top_delta, [3, 1, 2, 4]);
      td_permuted.reshape_inplace($M.size(td_permuted, 1), -1);
      var delta_bias = $M.sum(td_permuted, 2);
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

export = Convolution2DLayer;
