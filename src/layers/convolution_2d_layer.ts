import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');
import im2col = require('../utils/im2col');
import ArrayHelper = require('../utils/array_helper');

class Convolution2DLayer extends Layer {
  weight: $M.Matrix;
  bias: $M.Matrix;
  use_bias: boolean;
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
    this.use_bias = params.bias == null ? true : Boolean(params.bias);
    this.ksize = ArrayHelper.repeat_scalar(params.ksize, 2);//kernel size [3,3]
    this.stride = ArrayHelper.repeat_scalar(params.stride, 2);
    this.pad = ArrayHelper.repeat_scalar(params.pad, 2);
    this.weight = $M.times(
      $M.randn(this.ksize[0], this.ksize[1], this.in_size, this.out_size),
      1.0 / Math.sqrt(this.ksize[0] * this.ksize[1] * this.in_size));
    this.delta_weight = null;//$M.zeros(in_size, out_size);
    this.delta_bias = null;//$M.zeros(out_size, 1);
    if (this.use_bias) {
      this.bias = $M.zeros(this.out_size, 1);
      this.train_params = ['weight', 'bias'];
      this.delta_params = ['delta_weight', 'delta_bias'];
    } else {
      this.bias = null;
      this.train_params = ['weight'];
      this.delta_params = ['delta_weight'];
    }
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  timer_begin: number;
  timer_vals: {[index:string]:number};
  timer_name: string;
  _start_timer(name: string) {
    if (this.timer_begin) {
      this._stop_timer();
    } else {
      $M.CL.finish();
    }
    this.timer_name = name;
    this.timer_begin = Date.now();
  }

  _stop_timer() {
    $M.CL.finish();
    var end_time = Date.now();
    var time_ms = end_time - this.timer_begin;
    this.timer_vals[this.timer_name] = (this.timer_vals[this.timer_name] || 0) + time_ms;
    this.timer_begin = null;
  }

  _show_timer() {
    for (var key in this.timer_vals) {
      if (this.timer_vals.hasOwnProperty(key)) {
        var element = this.timer_vals[key];
        console.log('' + key + ': ' + element);
      }
    }
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    var n = $M.size(data, 4);
    this.weight.reshape_inplace(this.ksize[0] * this.ksize[1] * this.in_size, this.out_size);
    this.timer_vals = {};
    var top = $M.autodestruct(() => {
      var output: $M.Matrix = null;
      // for (var batch = 1; batch <= n; batch++) {
      //   this._start_timer('get_img');
      //   var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
      //   var col: $M.Matrix;
      //   this._start_timer('im2col');
      //   if (config.devicetype == 'cl') {
      //     col = im2col.im2col_cl(img, this.ksize, this.stride, this.pad);
      //   } else {
      //     col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
      //   }
      //   var col_shape = $M.sizejsa(col);
      //   var out_h = col_shape[0];
      //   var out_w = col_shape[1];
      //   col.reshape_inplace(out_h * out_w, -1);
      //   this._start_timer('mtimes');
      //   var output_b = $M.mtimes(col, this.weight);//[out_h*out_w, out_size]
      //   this._start_timer('plus_bias');
      //   if (this.use_bias) {
      //     var output_b_with_bias = $M.plus(output_b, $M.repmat($M.t(this.bias), $M.sizejsa(output_b)[0], 1));
      //   } else {
      //     var output_b_with_bias = output_b;
      //   }
      //   if (batch == 1) {
      //     if (config.devicetype == 'cl') {
      //       output = $M.zeros(out_h * out_w, this.out_size, n, 'gpuArray');
      //     } else {
      //       output = $M.zeros(out_h * out_w, this.out_size, n);
      //     }
      //   }
      //   this._start_timer('set_output');
      //   output.set($M.colon(), $M.colon(), batch, output_b_with_bias);
      //   this._stop_timer();
      // }
      this._start_timer('im2col_perm');
      var col_permute = im2col.im2col_cl_perm(data, this.ksize, this.stride, this.pad);
         var col_shape = $M.sizejsa(col_permute);
         var out_h = col_shape[0];
         var out_w = col_shape[1];
         col_permute.reshape_inplace(out_h * out_w * n, -1);
      this._start_timer('mtimes');
         var output_b = $M.mtimes(col_permute, this.weight);
         output_b.reshape_inplace(out_h * out_w, n, -1);
      this._start_timer('permute_output');
         var output = $M.permute(output_b, [1, 3, 2]);
      output.reshape_inplace(out_h, out_w, this.out_size, n);
         if (this.use_bias) {
      this._start_timer('plus_bias');
      this.bias.reshape_inplace(1, 1, -1);
           var output = $M.plus(output, $M.repmat(this.bias, out_h, out_w, 1, n));
           this.bias.reshape_inplace(-1, 1);
         }
      this._stop_timer();
      console.log('#forward times');
      this._show_timer();
      return output;
    });
    this.weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);

    setImmediate(function () {
      callback([top]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var data_orig_shape = $M.size(data);

    this.timer_vals = {};
    var bottom_delta = $M.autodestruct(() => {
      var output: $M.Matrix;
      var n = $M.size(data, 4);
      var weight_origsize_jsa = $M.sizejsa(this.weight);
      this.weight.reshape_inplace(-1, this.out_size);
      this._start_timer('transpose_weight');
      var weight_t = $M.t(this.weight);
      this.weight.reshape_inplace(weight_origsize_jsa);
      var top_delta_shape = $M.sizejsa(top_delta);
         var out_h = top_delta_shape[0];
         var out_w = top_delta_shape[1];
         top_delta.reshape_inplace(out_h * out_w, -1, n);
      this._start_timer('permute_top_delta');
      var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
      top_delta.reshape_inplace(top_delta_shape);
      top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
      this._start_timer('mtimes');
      var delta_col_perm = $M.mtimes(top_delta_perm, weight_t);
      delta_col_perm.reshape_inplace(out_h, out_w, n, this.ksize[0], this.ksize[1], this.in_size);
      this._start_timer('col2im_perm');
      var output = im2col.col2im_cl_perm(delta_col_perm, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
      this._stop_timer();
      console.log('#backward times');
      this._show_timer();
      // for (var batch = 1; batch <= n; batch++) {
      //   var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
      //   var top_delta_shape = $M.sizejsa(top_delta_batch);
      //   var out_h = top_delta_shape[0];
      //   var out_w = top_delta_shape[1];
      //   top_delta_batch.reshape_inplace(out_h * out_w, -1);

      //   var delta_col_batch = $M.mtimes(top_delta_batch, weight_t);
      //   if (batch == 1) {
      //     if (config.devicetype == 'cl') {
      //       output = $M.zeros($M.size(data), 'gpuArray');
      //     } else {
      //       output = $M.zeros($M.size(data));
      //     }
      //   }
      //   delta_col_batch.reshape_inplace(out_h, out_w, this.ksize[0], this.ksize[1], this.in_size, 1);
      //   var bottom_delta_col: $M.Matrix;
      //   if (config.devicetype == 'cl') {
      //     bottom_delta_col = im2col.col2im_cl(delta_col_batch, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
      //   } else {
      //     bottom_delta_col = im2col.col2im_cpu(delta_col_batch, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
      //   }
      //   output.set($M.colon(), $M.colon(), $M.colon(), batch, bottom_delta_col);
      // }
      return output;
    });

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    this.timer_vals = {};
    var n = $M.size(data, 4);
    var new_delta_weight: $M.Matrix = $M.autodestruct(() => {
      var output: $M.Matrix = null;
      // for (var batch = 1; batch <= n; batch++) {
      //   var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
      //   var col: $M.Matrix;
      //   if (config.devicetype == 'cl') {
      //     col = im2col.im2col_cl(img, this.ksize, this.stride, this.pad);
      //   } else {
      //     col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
      //   }
      //   var col_shape = $M.sizejsa(col);
      //   var out_h = col_shape[0];
      //   var out_w = col_shape[1];
      //   col.reshape_inplace(out_h * out_w, -1);

      //   var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
      //   top_delta_batch.reshape_inplace(out_h * out_w, -1);

      //   var delta_weight_b = $M.mtimes($M.t(col), top_delta_batch);
      //   if (batch == 1) {
      //     output = delta_weight_b;
      //   } else {
      //     var old_output = output;
      //     output = $M.plus(old_output, delta_weight_b);
      //     old_output.destruct();
      //     delta_weight_b.destruct();
      //   }
      // }
      this._start_timer('im2col');
      var col = im2col.im2col_cl(data, this.ksize, this.stride, this.pad);
         var col_shape = $M.sizejsa(col);
         var out_h = col_shape[0];
         var out_w = col_shape[1];
         col.reshape_inplace(out_h * out_w, -1, n);
      this._start_timer('permute_col_t');
         var col_permute = $M.permute(col, [2, 1, 3]);
         col_permute.reshape_inplace(-1, out_h * out_w * n);
      var top_delta_shape = $M.sizejsa(top_delta);
         var out_h = top_delta_shape[0];
         var out_w = top_delta_shape[1];
         top_delta.reshape_inplace(out_h * out_w, -1, n);
      this._start_timer('permute_top_delta');
      var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
      top_delta.reshape_inplace(top_delta_shape);
      top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
      this._start_timer('mtimes');
      output = $M.mtimes(col_permute, top_delta_perm);
      this._stop_timer();
      console.log('#update times');
      this._show_timer();
      output.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);
      return output;
    });
    var old_delta_weight = this.delta_weight;
    this.delta_weight = $M.plus(old_delta_weight, new_delta_weight);
    old_delta_weight.destruct();
    new_delta_weight.destruct();

    if (this.use_bias) {
      var new_delta_bias = $M.autodestruct(() => {
        var td_permuted = $M.permute(top_delta, [3, 1, 2, 4]);
        td_permuted.reshape_inplace($M.size(td_permuted, 1), -1);
        var delta_bias = $M.sum(td_permuted, 2);
        return $M.plus(this.delta_bias, delta_bias);
      });
      this.delta_bias.destruct();
      this.delta_bias = new_delta_bias;
    }

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
