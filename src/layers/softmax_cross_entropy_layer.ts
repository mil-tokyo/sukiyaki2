// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class SoftmaxCrossEntropyLayer extends Layer {
  data_softmax: $M.Matrix;
  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //softmax cross entropy
    let data: $M.Matrix = bottoms[0];
    let gtlabel: $M.Matrix = bottoms[1];
    var loss: $M.Matrix;
    var data_softmax: $M.Matrix;
    if (config.devicetype == 'cl') {
      var c = $M.size(data, 1);
      var n = $M.size(data, 2);
      let data_softmax_log: $M.Matrix = new $M.CL.MatrixCL([1, n], 'single');
      data_softmax = new $M.CL.MatrixCL([c, n], 'single');

      var WebCL = $M.CL.WebCL;
      $M.CL.executeKernel(get_cl_forward_kernel(), [
        { access: WebCL.MEM_WRITE_ONLY, datum: data_softmax_log },
        { access: WebCL.MEM_WRITE_ONLY, datum: data_softmax },
        { access: WebCL.MEM_READ_ONLY, datum: data },
        { access: WebCL.MEM_READ_ONLY, datum: gtlabel },
        { datum: c, type: WebCL.type.UINT },
        { datum: n, type: WebCL.type.UINT }
      ], n, 32);
      loss = $M.sum(data_softmax_log);
      data_softmax_log.destruct();
    } else {
      [loss, data_softmax] = $M.autodestruct(() => {
        let gt = $M.zeros($M.size(data));
        let batch_size = $M.sizejsa(gtlabel)[1];//number of column
        let data_exp = $M.exp(data);
        let data_exp_sum = $M.repmat($M.sum(data_exp, 1), $M.sizejsa(data)[0], 1);
        let data_softmax = $M.rdivide(data_exp, data_exp_sum);
        let data_softmax_log = $M.log(data_softmax);
        let loss = $M.zeros(1);
        for (let sample = 1; sample <= batch_size; sample++) {
          let label = gtlabel.get(sample) + 1;
          loss = $M.minus(loss, data_softmax_log.get(label, sample) / batch_size);
        }
        return [loss, data_softmax];
      });
    }

    this.data_softmax = data_softmax;
    setImmediate(function () {
      callback([loss]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    //top_deltas[0] is usually 1.0
    var data: $M.Matrix = bottoms[0];
    var gtlabel: $M.Matrix = bottoms[1];
    var top_delta: $M.Matrix = top_deltas[0];//scalar

    var bottom_delta: $M.Matrix;
    if (config.devicetype == 'cl') {
      bottom_delta = $M.times(this.data_softmax, top_delta);
    } else {
      bottom_delta = $M.autodestruct(() => {
        let bottom_delta = this.data_softmax.copy();
        var batch_size = $M.sizejsa(gtlabel)[1];//number of column
        for (var sample = 1; sample <= batch_size; sample++) {
          var label = gtlabel.get(sample) + 1;
          bottom_delta.set(label, sample, bottom_delta.get(label, sample) - 1);
        }

        bottom_delta = $M.times(bottom_delta, $M.times(top_delta, 1.0 / batch_size));
        return bottom_delta;
      });
    }

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  release(): void {
    if (this.data_softmax != null) {
      this.data_softmax.destruct();
      this.data_softmax = null;
    }
  }

  destruct(): void {

  }
}

export = SoftmaxCrossEntropyLayer;

var cl_forward_kernel: any = null;
function get_cl_forward_kernel(): any {
  if (!cl_forward_kernel) {
    cl_forward_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *softmax_log, __global float *softmax, __global const float *score, __global const int *label, uint c, uint n)',
      '{',
      'uint batch = get_global_id(0);',
      'if (batch >= n) {return;}',
      'float sample_max = score[batch * c];',
      'for (int i = 1; i < c; i++) {',
      '  float cur_score = score[batch * c + i];',
      '  if (cur_score > sample_max) {',
      '    sample_max = cur_score;',
      '  }',
      '}',
      'float exp_sum = 0.0F;',
      'for (int i = 0; i < c; i++) {',
      '  float cur_score = score[batch * c + i];',
      '  float cur_score_exp = exp(cur_score - sample_max);',
      '  softmax[batch * c + i] = cur_score_exp;',
      '  exp_sum += cur_score_exp;',
      '}',
      'for (int i = 0; i < c; i++) {',
      '  softmax[batch * c + i] /= exp_sum;',
      '}',
      'softmax_log[batch] = -log(softmax[batch * c + label[batch]]) / (float)n;',
      'softmax[batch * c + label[batch]] -= 1.0F;',
      'for (int i = 0; i < c; i++) {',
      '  softmax[batch * c + i] /= n;',
      '}',
      '}'
    ].join('\n'));
  }
  return cl_forward_kernel;
}
