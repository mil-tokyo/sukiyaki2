import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');

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
  tmp_std: $M.Matrix;
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

    var [top, x_normalized, std] = $M.autodestruct(() => {
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
      var std = $M.power(variance, 0.5);//TODO: use sqrt
      var tmp = $M.minus(perm_data, $M.repmat(mean, 1, n));
      var normalized = $M.rdivide(tmp, $M.repmat(std, 1, n));
      tmp = $M.times(normalized, $M.repmat(this.gamma, 1, n));
      tmp = $M.plus(tmp, $M.repmat(this.beta, 1, n));
      tmp.reshape_inplace(perm_data_origsize);
      var output = $M.ipermute(tmp, perm);
      return [output, normalized, std];
    });
    this.tmp_x_normalized = x_normalized;
    this.tmp_std = std;
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

      var gamma_div_std = $M.rdivide(this.gamma, this.tmp_std);
      var tmp = $M.plus($M.times(this.tmp_x_normalized, $M.repmat(delta_gamma, 1, n)),
        $M.repmat(delta_beta, 1, n));
      tmp = $M.times(tmp, 1 / n);
      var perm_bottom_delta = $M.times($M.repmat(gamma_div_std, 1, n),
        $M.minus(perm_delta, tmp));
      perm_bottom_delta.reshape_inplace(perm_delta_origsize);
      var bottom_delta = $M.ipermute(perm_bottom_delta, perm);
      return [new_delta_gamma, new_delta_beta, bottom_delta];
    });

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
    if (this.tmp_std) {
      this.tmp_std.destruct();
      this.tmp_std = null;
    }
  }

  destruct(): void {

  }
}

export = BatchNormalizationLayer;
