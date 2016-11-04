// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class AccuracyLayer extends Layer {
  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //softmax cross entropy
    var data: $M.Matrix = bottoms[0];
    var gtlabel: $M.Matrix = bottoms[1];//label: 0 to nlabel-1
    let accuracy = $M.autodestruct(() => {
      var predlabel = $M.argmax(data, 0, 1).I;//1 to nlabel
      predlabel = $M.minus(predlabel, 1);
      var match = $M.eq(gtlabel, predlabel);
      let accuracy = $M.sum(match).get() / $M.numel(match);
      return accuracy;
    });

    setImmediate(function () {
      callback([$M.jsa2mat([accuracy])]);
    });
  }

  release(): void {
  }

  destruct(): void {

  }
}

export = AccuracyLayer;
