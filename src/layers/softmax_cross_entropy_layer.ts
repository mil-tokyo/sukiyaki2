/// <reference path="../../node_modules/milsushi2/index.d.ts"/>
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
    let [loss, data_softmax] = $M.autodestruct(() => {
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
      if (config.devicetype == 'cl') {
        loss = $M.gpuArray(loss);
      }
      return [loss, data_softmax];
    });
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

    let bottom_delta = $M.autodestruct(() => {
      let bottom_delta = this.data_softmax.copy();
      var batch_size = $M.sizejsa(gtlabel)[1];//number of column
      for (var sample = 1; sample <= batch_size; sample++) {
        var label = gtlabel.get(sample) + 1;
        bottom_delta.set(label, sample, bottom_delta.get(label, sample) - 1);
      }

      bottom_delta = $M.times(bottom_delta, top_delta);
      return bottom_delta;
    });

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
