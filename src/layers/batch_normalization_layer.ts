import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');

var bn_forward_kernel: any = null;
var bn_backward_kernel: any = null;

function get_bn_forward_kernel(): any {
  if (!bn_forward_kernel) {
    bn_forward_kernel = $M.CL.createKernel([
      '#define MAX_WORK_SIZE 256',
      '__kernel void kernel_func(__global float *top, __global float *x_normalized, __global float *inv_std,',
      '__global const float *data, __global const float *gamma, __global const float *beta,',
      'uint left_size, uint channel_size, uint right_size, float eps)',
      '{',
      'uint ch = get_group_id(0);',
      'uint i = get_local_id(0);',
      'uint work_size = get_local_size(0);',
      '__local float node_sum[MAX_WORK_SIZE];',
      '__local float node_sqsum[MAX_WORK_SIZE];',
      //get sum and squared sum
      'float local_sum = 0.0F, local_sqsum = 0.0F;',
      'for (int j = i; j < left_size * right_size; j += work_size) {',
      '  float val = data[(j % left_size) + (ch + j / left_size * channel_size) * left_size];',
      '  local_sum += val;',
      '  local_sqsum += val * val;',
      '}',
      'node_sum[i] = local_sum;',
      'node_sqsum[i] = local_sqsum;',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      // calculate mean, std by node i==0
      'float mean = 0.0F, variance = 0.0F, inv_stdev = 0.0F;',
      'if (i == 0) {',
      '  for (int j = 1; j < work_size; j++) {',
      '    local_sum += node_sum[j];',
      '    local_sqsum += node_sqsum[j];',
      '  }',
      '  mean = local_sum / (left_size * right_size);',
      '  variance = local_sqsum / (left_size * right_size) - mean * mean;',
      '  inv_stdev = 1.0F / sqrt(variance + eps);',
      '  node_sum[0] = mean;',//pass to other nodes
      '  node_sqsum[0] = inv_stdev;',
      '  inv_std[ch] = inv_stdev;',
      '}',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      // normalize variables
      'mean = node_sum[0];',
      'inv_stdev = node_sqsum[0];',
      'float ch_gamma = gamma[ch], ch_beta = beta[ch];',
      'for (int j = i; j < left_size * right_size; j += work_size) {',
      '  int idx = (j % left_size) + (ch + j / left_size * channel_size) * left_size;',
      '  float val = data[idx];',
      '  val = (val - mean) * inv_stdev;',
      '  x_normalized[idx] = val;',
      '  val = val * ch_gamma + ch_beta;',
      '  top[idx] = val;',
      '}',
      '}'].join('\n'));
  }
  return bn_forward_kernel;
}

function get_bn_backward_kernel(): any {
  if (!bn_backward_kernel) {
    bn_backward_kernel = $M.CL.createKernel([
      '#define MAX_WORK_SIZE 256',
      '__kernel void kernel_func(__global float *bottom_delta, __global float *new_delta_gamma, __global float *new_delta_beta,',
      '__global const float *top_delta, __global const float *tmp_x_normalized, __global const float *tmp_inv_std,',
      '__global const float *gamma, __global const float *delta_gamma, __global const float *delta_beta,',
      'uint left_size, uint channel_size, uint right_size)',
      '{',
      'uint ch = get_group_id(0);',
      'uint i = get_local_id(0);',
      'uint work_size = get_local_size(0);',
      '__local float node_top_delta_sum[MAX_WORK_SIZE];',
      '__local float node_top_delta_x_norm_sum[MAX_WORK_SIZE];',
      //get sum and squared sum
      'float local_top_delta_sum = 0.0F, local_top_delta_x_norm_sum = 0.0F;',
      'for (int j = i; j < left_size * right_size; j += work_size) {',
      '  int idx = (j % left_size) + (ch + j / left_size * channel_size) * left_size;',
      '  float val_delta = top_delta[idx];',
      '  float val_txnorm = tmp_x_normalized[idx];',
      '  local_top_delta_sum += val_delta;',
      '  local_top_delta_x_norm_sum += val_delta * val_txnorm;',
      '}',
      'node_top_delta_sum[i] = local_top_delta_sum;',
      'node_top_delta_x_norm_sum[i] = local_top_delta_x_norm_sum;',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      // calculate mean, std by node i==0
      'float cur_delta_beta = 0.0F, cur_delta_gamma = 0.0F;',
      'if (i == 0) {',
      '  for (int j = 1; j < work_size; j++) {',
      '    local_top_delta_sum += node_top_delta_sum[j];',
      '    local_top_delta_x_norm_sum += node_top_delta_x_norm_sum[j];',
      '  }',
      '  cur_delta_beta = local_top_delta_sum;',
      '  cur_delta_gamma = local_top_delta_x_norm_sum;',
      '  node_top_delta_sum[0] = cur_delta_beta;',//pass to other nodes
      '  node_top_delta_x_norm_sum[0] = cur_delta_gamma;',
      '  new_delta_gamma[ch] = cur_delta_gamma + delta_gamma[ch];',
      '  new_delta_beta[ch] = cur_delta_beta + delta_beta[ch];',
      '}',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      // normalize variables
      'cur_delta_beta = node_top_delta_sum[0];',
      'cur_delta_gamma = node_top_delta_x_norm_sum[0];',
      'float gds = gamma[ch] * tmp_inv_std[ch];',
      'float coef1 = cur_delta_gamma / (left_size * right_size);',
      'float coef2 = cur_delta_beta / (left_size * right_size);',
      'for (int j = i; j < left_size * right_size; j += work_size) {',
      '  int idx = (j % left_size) + (ch + j / left_size * channel_size) * left_size;',
      '  bottom_delta[idx] = (top_delta[idx] - tmp_x_normalized[idx] * coef1 - coef2) * gds;',
      '}',
      '}'].join('\n'));
  }
  return bn_backward_kernel;
}

class BatchNormalizationLayer extends Layer {
  gamma: $M.Matrix;
  beta: $M.Matrix;
  delta_gamma: $M.Matrix;
  delta_beta: $M.Matrix;
  target_dim: number;
  in_size: number;
  eps: number;

  // temporary vars between forward and backward
  tmp_x_normalized: $M.Matrix;
  tmp_inv_std: $M.Matrix;
  tmp_bottom_delta: $M.Matrix;
  calc_update_called: boolean;

  constructor(params: any) {
    super();
    this.need_update = true;
    this.eps = params.eps || 1e-5;
    this.target_dim = params.target_dim || 1;
    this.in_size = params.in_size;
    this.gamma = $M.ones(this.in_size, 1);
    this.beta = $M.zeros(this.in_size, 1);
    this.delta_gamma = null;
    this.delta_beta = null;
    this.train_params = ['gamma', 'beta'];
    this.delta_params = ['delta_gamma', 'delta_beta'];
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //TODO: use saved mean / var when testing
    var data: $M.Matrix = bottoms[0];

    if (config.devicetype == 'cl') {
      var data_size = $M.sizejsa(data);
      var data_size_mat = $M.size(data);
      // divide matrix dimensions to left of channel, channel, right of channel
      var left_size = 1;
      var channel_size = 1;
      var right_size = 1;
      for (var dim = 0; dim < data_size.length; dim++) {
        var dim_size = data_size[dim];
        if (dim + 1 < this.target_dim) {
          left_size *= dim_size;
        } else if (dim + 1 == this.target_dim) {
          channel_size = dim_size;
        } else {
          right_size *= dim_size;
        }
      }
      var top: any = $M.zeros(data_size_mat, 'gpuArray');
      var x_normalized: any = $M.zeros(data_size_mat, 'gpuArray');
      var inv_std: any = $M.zeros(channel_size, 1, 'gpuArray');

      var WebCL = $M.CL.WebCL;
      var group_size = 256;
      $M.CL.executeKernel(get_bn_forward_kernel(), [
        { access: WebCL.MEM_WRITE_ONLY, datum: top },
        { access: WebCL.MEM_WRITE_ONLY, datum: x_normalized },
        { access: WebCL.MEM_WRITE_ONLY, datum: inv_std },
        { access: WebCL.MEM_READ_ONLY, datum: data },
        { access: WebCL.MEM_READ_ONLY, datum: this.gamma },
        { access: WebCL.MEM_READ_ONLY, datum: this.beta },
        { datum: left_size, type: WebCL.type.UINT },
        { datum: channel_size, type: WebCL.type.UINT },
        { datum: right_size, type: WebCL.type.UINT },
        { datum: this.eps, type: WebCL.type.FLOAT }
      ], [group_size * channel_size], [group_size]);
      // one local group handles one channel
    } else {
      var [top, x_normalized, inv_std] = $M.autodestruct(() => {
        // move dimension to be normalized into first dim
        var ndim = $M.ndims(data);
        var perm = [this.target_dim];
        for (var i = 1; i <= ndim; i++) {
          if (i != this.target_dim) {
            perm.push(i);
          }
        }
        var perm_data = $M.permute(data, perm);
        var perm_data_origsize = $M.size(perm_data);
        perm_data.reshape_inplace(this.in_size, -1);//(c, n) or (c, h*w*n)
        var n = $M.size(perm_data, 2);
        var mean = $M.mean(perm_data, 2);
        var variance = $M.variance(perm_data, 1, 2);//w=1 to correspond to chainer
        variance = $M.plus(variance, this.eps);
        var inv_std = $M.power(variance, -0.5);//TODO: use sqrt
        var tmp = $M.minus(perm_data, $M.repmat(mean, 1, n));
        var normalized = $M.times(tmp, $M.repmat(inv_std, 1, n));
        tmp = $M.times(normalized, $M.repmat(this.gamma, 1, n));
        tmp = $M.plus(tmp, $M.repmat(this.beta, 1, n));
        tmp.reshape_inplace(perm_data_origsize);
        var output = $M.ipermute(tmp, perm);
        return [output, normalized, inv_std];
      });

    }
    this.tmp_x_normalized = x_normalized;//cl: data_shape, cpu: (c, h*w*n)
    this.tmp_inv_std = inv_std;
    this.calc_update_called = false;

    setImmediate(function () {
      callback([top]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    if (!this.calc_update_called) {
      throw Error('calculateUpdateParams have to be called before backward');
    }

    var bottom_delta = this.tmp_bottom_delta;
    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    // for efficiency, bottom_delta is computed here
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    var new_delta_gamma: any;
    var new_delta_beta: any;
    var bottom_delta: any;
    if (config.devicetype == 'cl') {
      var data_size = $M.sizejsa(top_delta);
      var data_size_mat = $M.size(top_delta);
      // divide matrix dimensions to left of channel, channel, right of channel
      var left_size = 1;
      var channel_size = 1;
      var right_size = 1;
      for (var dim = 0; dim < data_size.length; dim++) {
        var dim_size = data_size[dim];
        if (dim + 1 < this.target_dim) {
          left_size *= dim_size;
        } else if (dim + 1 == this.target_dim) {
          channel_size = dim_size;
        } else {
          right_size *= dim_size;
        }
      }
      
      bottom_delta = $M.zeros(data_size_mat, 'gpuArray');
      new_delta_gamma = $M.zeros(channel_size, 1, 'gpuArray');
      new_delta_beta = $M.zeros(channel_size, 1, 'gpuArray');

      var WebCL = $M.CL.WebCL;
      var group_size = 256;
      $M.CL.executeKernel(get_bn_backward_kernel(), [
        { access: WebCL.MEM_WRITE_ONLY, datum: bottom_delta },
        { access: WebCL.MEM_WRITE_ONLY, datum: new_delta_gamma },
        { access: WebCL.MEM_WRITE_ONLY, datum: new_delta_beta },
        { access: WebCL.MEM_READ_ONLY, datum: top_delta },
        { access: WebCL.MEM_READ_ONLY, datum: this.tmp_x_normalized },
        { access: WebCL.MEM_READ_ONLY, datum: this.tmp_inv_std },
        { access: WebCL.MEM_READ_ONLY, datum: this.gamma },
        { access: WebCL.MEM_READ_ONLY, datum: this.delta_gamma },
        { access: WebCL.MEM_READ_ONLY, datum: this.delta_beta },
        { datum: left_size, type: WebCL.type.UINT },
        { datum: channel_size, type: WebCL.type.UINT },
        { datum: right_size, type: WebCL.type.UINT }
      ], [group_size * channel_size], [group_size]);

    } else {
    var [new_delta_gamma, new_delta_beta, bottom_delta] = $M.autodestruct(() => {
      // move dimension to be normalized into first dim
      var ndim = $M.ndims(data);
      var perm = [this.target_dim];
      for (var i = 1; i <= ndim; i++) {
        if (i != this.target_dim) {
          perm.push(i);
        }
      }

      var perm_delta = $M.permute(top_delta, perm);
      var perm_delta_origsize = $M.size(perm_delta);
      perm_delta.reshape_inplace(this.in_size, -1);//(c, n) or (c, h*w*n)
      var n = $M.size(perm_delta, 2);
      var delta_beta = $M.sum(perm_delta, 2);
      var delta_gamma = $M.sum($M.times(perm_delta, this.tmp_x_normalized), 2);

      var new_delta_gamma = $M.plus(this.delta_gamma, delta_gamma);
      var new_delta_beta = $M.plus(this.delta_beta, delta_beta);

      var gamma_div_std = $M.times(this.gamma, this.tmp_inv_std);
      var tmp = $M.plus($M.times(this.tmp_x_normalized, $M.repmat(delta_gamma, 1, n)),
        $M.repmat(delta_beta, 1, n));
      tmp = $M.times(tmp, 1 / n);
      var perm_bottom_delta = $M.times($M.repmat(gamma_div_std, 1, n),
        $M.minus(perm_delta, tmp));
      perm_bottom_delta.reshape_inplace(perm_delta_origsize);
      var bottom_delta = $M.ipermute(perm_bottom_delta, perm);
      return [new_delta_gamma, new_delta_beta, bottom_delta];
    });

    }

    this.delta_gamma.destruct();
    this.delta_gamma = new_delta_gamma;
    this.delta_beta.destruct();
    this.delta_beta = new_delta_beta;
    this.tmp_bottom_delta = bottom_delta;
    this.calc_update_called = true;

    setImmediate(function () {
      callback();
    });
  }

  release(): void {
    if (this.tmp_x_normalized) {
      this.tmp_x_normalized.destruct();
      this.tmp_x_normalized = null;
    }
    if (this.tmp_inv_std) {
      this.tmp_inv_std.destruct();
      this.tmp_inv_std = null;
    }
  }

  destruct(): void {

  }
}

export = BatchNormalizationLayer;
