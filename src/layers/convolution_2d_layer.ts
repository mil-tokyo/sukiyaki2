import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');
import im2col = require('../utils/im2col');
import mtimes_trans = require('../utils/mtimes_trans');
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
  group: number;
  private in_size_group: number;
  private out_size_group: number;

  constructor(params: any) {
    super();
    this.need_update = true;
    this.in_size = params.in_size;
    this.out_size = params.out_size;
    this.group = params.group || 1;
    this.in_size_group = this.in_size / this.group;
    this.out_size_group = this.out_size / this.group;
    this.use_bias = params.bias == null ? true : Boolean(params.bias);
    this.ksize = ArrayHelper.repeat_scalar(params.ksize, 2);//kernel size [3,3]
    this.stride = ArrayHelper.repeat_scalar(params.stride, 2);
    this.pad = ArrayHelper.repeat_scalar(params.pad, 2);
    this.weight = $M.times(
      $M.randn(this.ksize[0], this.ksize[1], this.in_size_group, this.out_size),
      1.0 / Math.sqrt(this.ksize[0] * this.ksize[1] * this.in_size_group));
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
    if (this.group > 1) {
      this.forward = this.forward_group;
      this.backward = this.backward_group;
      this.calculateUpdateParams = this.calculateUpdateParams_group;
    } else {
      this.forward = this.forward_single;
      this.backward = this.backward_single;
      this.calculateUpdateParams = this.calculateUpdateParams_single;
    }
    this.timer_enable = false;
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  timer_begin: number;
  timer_vals: { [index: string]: number };
  timer_name: string;
  timer_enable: boolean;
  _start_timer(name: string) {
    if (this.timer_enable) {
      if (this.timer_begin) {
        this._stop_timer();
      } else {
        $M.CL.finish();
      }
      this.timer_name = name;
      this.timer_begin = Date.now();

    }
  }

  _stop_timer() {
    if (this.timer_enable) {
      $M.CL.finish();
      var end_time = Date.now();
      var time_ms = end_time - this.timer_begin;
      this.timer_vals[this.timer_name] = (this.timer_vals[this.timer_name] || 0) + time_ms;
      this.timer_begin = null;
    }
  }

  _show_timer(name: string) {
    if (this.timer_enable) {
      console.log('time for ' + name);
      for (var key in this.timer_vals) {
        if (this.timer_vals.hasOwnProperty(key)) {
          var element = this.timer_vals[key];
          console.log('' + key + ': ' + element);
        }
      }
    }
  }

  forward_single(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    var n = $M.size(data, 4);
    this.weight.reshape_inplace(this.ksize[0] * this.ksize[1] * this.in_size, this.out_size);
    this.timer_vals = {};
    var top = $M.autodestruct(() => {
      var out_h: number, out_w: number;
      var output: $M.Matrix = null;
      if (config.devicetype == 'cl') {
        this._start_timer('im2col_perm');
        var col_permute = im2col.im2col_cl_perm(data, this.ksize, this.stride, this.pad);
        var col_shape = $M.sizejsa(col_permute);
        out_h = col_shape[0];
        out_w = col_shape[1];
        col_permute.reshape_inplace(out_h * out_w * n, -1);
        this._start_timer('mtimes');
        var output_b = $M.mtimes(col_permute, this.weight);
        output_b.reshape_inplace(out_h * out_w, n, -1);
        this._start_timer('permute_output');
        var output = $M.permute(output_b, [1, 3, 2]);
        output.reshape_inplace(out_h, out_w, this.out_size, n);
        if (this.use_bias) {
          this._start_timer('plus_bias');
          var WebCL = $M.CL.WebCL;
          $M.CL.executeKernel(get_forward_bias_kernel(), [
            { access: WebCL.MEM_READ_WRITE, datum: output },
            { access: WebCL.MEM_READ_ONLY, datum: this.bias },
            { datum: out_h, type: WebCL.type.INT },
            { datum: out_w, type: WebCL.type.INT },
            { datum: this.out_size, type: WebCL.type.INT },
            { datum: n, type: WebCL.type.INT }
          ], output._numel);
        }
        this._stop_timer();
        this._show_timer('conv forward');
      } else {
        for (var batch = 1; batch <= n; batch++) {
          var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
          var col: $M.Matrix;
          col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
          img.destruct();
          var col_shape = $M.sizejsa(col);
          out_h = col_shape[0];
          out_w = col_shape[1];
          col.reshape_inplace(out_h * out_w, -1);
          var output_b = $M.mtimes(col, this.weight);//[out_h*out_w, out_size]
          col.destruct();
          if (this.use_bias) {
            var output_b_with_bias = $M.plus(output_b, $M.repmat($M.t(this.bias), $M.sizejsa(output_b)[0], 1));
            output_b.destruct();
          } else {
            var output_b_with_bias = output_b;
          }
          if (batch == 1) {
            output = $M.zeros(out_h * out_w, this.out_size, n);
          }
          output.set($M.colon(), $M.colon(), batch, output_b_with_bias);
          output_b_with_bias.destruct();
        }
        output.reshape_inplace(out_h, out_w, this.out_size, n);
      }
      return output;
    });
    this.weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);

    setImmediate(function () {
      callback([top]);
    });
  }

  backward_single(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var data_orig_shape = $M.size(data);

    this.timer_vals = {};
    var bottom_delta = $M.autodestruct(() => {
      var output: $M.Matrix;
      var n = $M.size(data, 4);
      var weight_origsize_jsa = $M.sizejsa(this.weight);
      this.weight.reshape_inplace(-1, this.out_size);
      if (config.devicetype == 'cl') {
        this._start_timer('transpose_weight');
        var top_delta_shape = $M.sizejsa(top_delta);
        var out_h = top_delta_shape[0];
        var out_w = top_delta_shape[1];
        top_delta.reshape_inplace(out_h * out_w, -1, n);
        this._start_timer('permute_top_delta');
        var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
        top_delta.reshape_inplace(top_delta_shape);
        top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
        this._start_timer('mtimes');
        //var delta_col_perm = $M.mtimes(top_delta_perm, weight_t);
        var delta_col_perm = mtimes_trans.mtimes_trans(top_delta_perm, this.weight, false, true);

        delta_col_perm.reshape_inplace(out_h, out_w, n, this.ksize[0], this.ksize[1], this.in_size);
        this._start_timer('col2im_perm');
        var output = im2col.col2im_cl_perm(delta_col_perm, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
        this._stop_timer();
        this._show_timer('conv backward');
      } else {
        var weight_t = $M.t(this.weight);
        for (var batch = 1; batch <= n; batch++) {
          var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
          var top_delta_shape = $M.sizejsa(top_delta_batch);
          var out_h = top_delta_shape[0];
          var out_w = top_delta_shape[1];
          top_delta_batch.reshape_inplace(out_h * out_w, -1);

          var delta_col_batch = $M.mtimes(top_delta_batch, weight_t);
          top_delta_batch.destruct();
          if (batch == 1) {
            output = $M.zeros($M.size(data));
          }
          delta_col_batch.reshape_inplace(out_h, out_w, this.ksize[0], this.ksize[1], this.in_size, 1);
          var bottom_delta_col: $M.Matrix;
          bottom_delta_col = im2col.col2im_cpu(delta_col_batch, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
          delta_col_batch.destruct();
          output.set($M.colon(), $M.colon(), $M.colon(), batch, bottom_delta_col);
          bottom_delta_col.destruct();
        }
        weight_t.destruct();
      }
      this.weight.reshape_inplace(weight_origsize_jsa);
      return output;
    });

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams_single(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var top_delta_shape = $M.sizejsa(top_delta);

    this.timer_vals = {};
    var n = $M.size(data, 4);
    var new_delta_weight: $M.Matrix;
    if (config.devicetype == 'cl') {
      this._start_timer('im2col_perm');
      var col_permute = im2col.im2col_cl_perm(data, this.ksize, this.stride, this.pad);
      var col_shape = $M.sizejsa(col_permute);
      var out_h = col_shape[0];
      var out_w = col_shape[1];
      col_permute.reshape_inplace(out_h * out_w * n, -1);
      this._start_timer('permute_col_t ' + $M.sizejsa(col_permute));
      //var col_permute_t = $M.t(col_permute);
      var out_h = top_delta_shape[0];
      var out_w = top_delta_shape[1];
      top_delta.reshape_inplace(out_h * out_w, -1, n);
      this._start_timer('permute_top_delta');
      var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
      top_delta.reshape_inplace(top_delta_shape);
      top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
      this._start_timer('mtimes');
      //output = $M.mtimes(col_permute_t, top_delta_perm);
      if ($M.size(col_permute, 2) * $M.size(top_delta_perm, 2) >= 64 * 64) {
        new_delta_weight = mtimes_trans.mtimes_trans_cl(col_permute, top_delta_perm, true, false);
      } else {
        new_delta_weight = mtimes_trans.mtimes_atrans_largek(col_permute, top_delta_perm);
      }
      this._start_timer('destruct');
      var issue_destruct = Date.now();
      col_permute.destruct();
      top_delta_perm.destruct();
      this._stop_timer();
      new_delta_weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);
    } else {
      new_delta_weight = $M.autodestruct(() => {
        var output: $M.Matrix = null;
        for (var batch = 1; batch <= n; batch++) {
          var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
          var col: $M.Matrix;
          col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
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
    }
    
    this._start_timer('add_delta');
    var old_delta_weight = this.delta_weight;
    this.delta_weight = $M.plus(old_delta_weight, new_delta_weight);
    old_delta_weight.destruct();
    new_delta_weight.destruct();
    this._stop_timer();

    if (this.use_bias) {
      if (config.devicetype == 'cl') {
        this._start_timer('bias');
        var WebCL = $M.CL.WebCL;
        var group_size = 256;
        $M.CL.executeKernel(get_update_bias_kernel(), [
          { access: WebCL.MEM_READ_WRITE, datum: this.delta_bias },
          { access: WebCL.MEM_READ_ONLY, datum: top_delta },
          { datum: top_delta_shape[0] * top_delta_shape[1], type: WebCL.type.UINT },
          { datum: top_delta_shape[2], type: WebCL.type.UINT },//channels
          { datum: top_delta_shape[3], type: WebCL.type.UINT }
        ], [group_size * top_delta_shape[2]], [group_size]);
        this._stop_timer();
      } else {
        var td_permuted = $M.permute(top_delta, [3, 1, 2, 4]);
        td_permuted.reshape_inplace($M.size(td_permuted, 1), -1);
        var delta_bias = $M.sum(td_permuted, 2);
        td_permuted.destruct();
        var new_delta_bias = $M.plus(this.delta_bias, delta_bias);
        delta_bias.destruct();
        this.delta_bias.destruct();
        this.delta_bias = new_delta_bias;
      }
    }
    this._show_timer('conv update');

    setImmediate(function () {
      callback();
    });
  }

  forward_group(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    var n = $M.size(data, 4);
    this.weight.reshape_inplace(this.ksize[0] * this.ksize[1] * this.in_size_group, this.out_size);
    this.timer_vals = {};
    var top = $M.autodestruct(() => {
      var out_h: number, out_w: number;
      var output: $M.Matrix = null;
      if (config.devicetype == 'cl') {
        this._start_timer('im2col_perm');
        var output_b: $M.Matrix;
        for (var g = 0; g < this.group; g++) {
          var data_group = data.get($M.colon(), $M.colon(), $M.colon(this.in_size_group * g + 1, this.in_size_group * (g + 1)), $M.colon());

          var col_permute = im2col.im2col_cl_perm(data_group, this.ksize, this.stride, this.pad);
          var col_shape = $M.sizejsa(col_permute);
          out_h = col_shape[0];
          out_w = col_shape[1];
          col_permute.reshape_inplace(out_h * out_w * n, -1);
          this._start_timer('mtimes');
          var weight_group = this.weight.get($M.colon(), $M.colon(this.out_size_group * g + 1, this.out_size_group * (g + 1)));
          var output_b_group = $M.mtimes(col_permute, weight_group);
          col_permute.destruct();
          output_b_group.reshape_inplace(out_h * out_w, n, -1);
          if (g == 0) {
            output_b = $M.zeros(out_h * out_w, n, this.out_size, 'gpuArray');
          }
          output_b.set($M.colon(), $M.colon(), $M.colon(this.out_size_group * g + 1, this.out_size_group * (g + 1)), output_b_group);
          output_b_group.destruct();
        }
        this._start_timer('permute_output');
        var output = $M.permute(output_b, [1, 3, 2]);
        output.reshape_inplace(out_h, out_w, this.out_size, n);
        if (this.use_bias) {
          this._start_timer('plus_bias');
          var WebCL = $M.CL.WebCL;
          $M.CL.executeKernel(get_forward_bias_kernel(), [
            { access: WebCL.MEM_READ_WRITE, datum: output },
            { access: WebCL.MEM_READ_ONLY, datum: this.bias },
            { datum: out_h, type: WebCL.type.INT },
            { datum: out_w, type: WebCL.type.INT },
            { datum: this.out_size, type: WebCL.type.INT },
            { datum: n, type: WebCL.type.INT }
          ], output._numel);
        }
        this._stop_timer();
        this._show_timer('conv forward');
      } else {
        for (var batch = 1; batch <= n; batch++) {
          var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
          var col: $M.Matrix;
          col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
          img.destruct();
          var col_shape = $M.sizejsa(col);
          out_h = col_shape[0];
          out_w = col_shape[1];
          col.reshape_inplace(out_h * out_w, -1);
          var output_b = $M.mtimes(col, this.weight);//[out_h*out_w, out_size]
          col.destruct();
          if (this.use_bias) {
            var output_b_with_bias = $M.plus(output_b, $M.repmat($M.t(this.bias), $M.sizejsa(output_b)[0], 1));
            output_b.destruct();
          } else {
            var output_b_with_bias = output_b;
          }
          if (batch == 1) {
            output = $M.zeros(out_h * out_w, this.out_size, n);
          }
          output.set($M.colon(), $M.colon(), batch, output_b_with_bias);
          output_b_with_bias.destruct();
        }
        output.reshape_inplace(out_h, out_w, this.out_size, n);
      }
      return output;
    });
    this.weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size_group, this.out_size);

    setImmediate(function () {
      callback([top]);
    });
  }

  backward_group(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var data_orig_shape = $M.size(data);

    this.timer_vals = {};
    try {
      var bottom_delta = $M.autodestruct(() => {
        var output: $M.Matrix;
        var n = $M.size(data, 4);
        var weight_origsize_jsa = $M.sizejsa(this.weight);
        this.weight.reshape_inplace(-1, this.out_size);
        if (config.devicetype == 'cl') {
          this._start_timer('transpose_weight');
          var top_delta_shape = $M.sizejsa(top_delta);
          var out_h = top_delta_shape[0];
          var out_w = top_delta_shape[1];
          top_delta.reshape_inplace(out_h * out_w, -1, n);
          this._start_timer('permute_top_delta');
          var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
          top_delta.reshape_inplace(top_delta_shape);
          top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
          output = $M.zeros(data_orig_shape, 'gpuArray');
          for (var g = 0; g < this.group; g++) {
            var top_delta_perm_group = top_delta_perm.get($M.colon(), $M.colon(this.out_size_group * g + 1, this.out_size_group * (g + 1)));
            this._start_timer('mtimes');
            //var delta_col_perm = $M.mtimes(top_delta_perm, weight_t);
            var weight_group = this.weight.get($M.colon(), $M.colon(this.out_size_group * g + 1, this.out_size_group * (g + 1)));
            var delta_col_perm = mtimes_trans.mtimes_trans(top_delta_perm_group, weight_group, false, true);

            delta_col_perm.reshape_inplace(out_h, out_w, n, this.ksize[0], this.ksize[1], this.in_size_group);
            this._start_timer('col2im_perm');
            var output_group = im2col.col2im_cl_perm(delta_col_perm, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
            output.set($M.colon(), $M.colon(), $M.colon(this.in_size_group * g + 1, this.in_size_group * (g + 1)), $M.colon(), output_group);
          }
          this._stop_timer();
          this._show_timer('conv backward');
        } else {
          var weight_t = $M.t(this.weight);
          for (var batch = 1; batch <= n; batch++) {
            var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
            var top_delta_shape = $M.sizejsa(top_delta_batch);
            var out_h = top_delta_shape[0];
            var out_w = top_delta_shape[1];
            top_delta_batch.reshape_inplace(out_h * out_w, -1);

            var delta_col_batch = $M.mtimes(top_delta_batch, weight_t);
            top_delta_batch.destruct();
            if (batch == 1) {
              output = $M.zeros($M.size(data));
            }
            delta_col_batch.reshape_inplace(out_h, out_w, this.ksize[0], this.ksize[1], this.in_size, 1);
            var bottom_delta_col: $M.Matrix;
            bottom_delta_col = im2col.col2im_cpu(delta_col_batch, this.stride, this.pad, [$M.size(data, 1), $M.size(data, 2)]);
            delta_col_batch.destruct();
            output.set($M.colon(), $M.colon(), $M.colon(), batch, bottom_delta_col);
            bottom_delta_col.destruct();
          }
          weight_t.destruct();
        }
        this.weight.reshape_inplace(weight_origsize_jsa);
        return output;
      });
    } catch (ex) {
      console.log(ex.stack);
    }

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams_group(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    var top_delta_shape = $M.sizejsa(top_delta);

    try {
      this.timer_vals = {};
      var n = $M.size(data, 4);
      var new_delta_weight: $M.Matrix = $M.autodestruct(() => {
        var output: $M.Matrix = null;
        var out_h = top_delta_shape[0];
        var out_w = top_delta_shape[1];
        if (config.devicetype == 'cl') {
          top_delta.reshape_inplace(out_h * out_w, -1, n);
          this._start_timer('permute_top_delta');
          var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
          top_delta.reshape_inplace(top_delta_shape);
          top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
          output = $M.zeros(this.ksize[0] * this.ksize[1] * this.in_size_group, this.out_size, 'gpuArray');
          for (var g = 0; g < this.group; g++) {
            var data_group = data.get($M.colon(), $M.colon(), $M.colon(this.in_size_group * g + 1, this.in_size_group * (g + 1)), $M.colon());
            this._start_timer('im2col_perm');
            var col_permute = im2col.im2col_cl_perm(data_group, this.ksize, this.stride, this.pad);
            var col_shape = $M.sizejsa(col_permute);
            col_permute.reshape_inplace(out_h * out_w * n, -1);
            this._start_timer('permute_col_t ' + $M.sizejsa(col_permute));
            //var col_permute_t = $M.t(col_permute);
            this._start_timer('mtimes');
            //output = $M.mtimes(col_permute_t, top_delta_perm);
            var top_delta_perm_group = top_delta_perm.get($M.colon(), $M.colon(this.out_size_group * g + 1, this.out_size_group * (g + 1)));
            var output_group = mtimes_trans.mtimes_trans(col_permute, top_delta_perm_group, true, false);
            output.set($M.colon(), $M.colon(this.out_size_group * g + 1, this.out_size_group * (g + 1)), output_group);
            output_group.destruct();
          }
          this._stop_timer();
          output.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size_group, this.out_size);
        } else {
          for (var batch = 1; batch <= n; batch++) {
            var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
            var col: $M.Matrix;
            col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
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
        }
        return output;
      });
      var old_delta_weight = this.delta_weight;
      this.delta_weight = $M.plus(old_delta_weight, new_delta_weight);
      old_delta_weight.destruct();
      new_delta_weight.destruct();

      if (this.use_bias) {
        if (config.devicetype == 'cl') {
          this._start_timer('bias');
          var WebCL = $M.CL.WebCL;
          var group_size = 256;
          $M.CL.executeKernel(get_update_bias_kernel(), [
            { access: WebCL.MEM_READ_WRITE, datum: this.delta_bias },
            { access: WebCL.MEM_READ_ONLY, datum: top_delta },
            { datum: top_delta_shape[0] * top_delta_shape[1], type: WebCL.type.UINT },
            { datum: top_delta_shape[2], type: WebCL.type.UINT },//channels
            { datum: top_delta_shape[3], type: WebCL.type.UINT }
          ], [group_size * top_delta_shape[2]], [group_size]);
          this._stop_timer();
        } else {
          var td_permuted = $M.permute(top_delta, [3, 1, 2, 4]);
          td_permuted.reshape_inplace($M.size(td_permuted, 1), -1);
          var delta_bias = $M.sum(td_permuted, 2);
          td_permuted.destruct();
          var new_delta_bias = $M.plus(this.delta_bias, delta_bias);
          delta_bias.destruct();
          this.delta_bias.destruct();
          this.delta_bias = new_delta_bias;
        }
      }
      this._show_timer('conv update');

    } catch (ex) {
      console.log(ex.stack);
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

var forward_bias_kernel: any = null;//in-place modification kernel
function get_forward_bias_kernel(): any {
  if (!forward_bias_kernel) {
    forward_bias_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *dst, __global const float *bias, int out_h, int out_w, int ch, int n)',
      '{',
      'uint i = get_global_id(0);',
      'int c = i / (out_h * out_w) % ch;',
      'float b = bias[c];',
      'dst[i] += b;',
      '}'
    ].join('\n'));
  }
  return forward_bias_kernel;
}

var update_bias_kernel: any = null;//in-place modification kernel
function get_update_bias_kernel(): any {
  if (!update_bias_kernel) {
    // similar to batch normalization
    update_bias_kernel = $M.CL.createKernel([
      '#define MAX_WORK_SIZE 256',
      '__kernel void kernel_func(__global float *delta_bias, __global const float *top_delta,',
      'uint left_size, uint channel_size, uint right_size)',
      '{',
      'uint ch = get_group_id(0);',
      'uint i = get_local_id(0);',
      'uint work_size = get_local_size(0);',
      '__local float node_sum[MAX_WORK_SIZE];',
      //get sum and squared sum
      'float local_sum = 0.0F;',
      'for (int j = i; j < left_size * right_size; j += work_size) {',
      '  float val = top_delta[(j % left_size) + (ch + j / left_size * channel_size) * left_size];',
      '  local_sum += val;',
      '}',
      'node_sum[i] = local_sum;',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      // calculate sum by node i==0
      'if (i == 0) {',
      '  for (int j = 1; j < work_size; j++) {',
      '    local_sum += node_sum[j];',
      '  }',
      '  delta_bias[ch] += local_sum;',
      '}',
      '}'].join('\n'));
  }
  return update_bias_kernel;
}
