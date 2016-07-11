import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class DataLayer extends Layer {
  length: number;
  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    this.length = 100;
    console.log('Data length set');
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var range: $M.Matrix = bottoms[0];//[from, to]
    var model_weight = $M.jsa2mat([[1,2,3],[4,5,6]]);
    var data = $M.rand(3,5);
    var labels = $M.mtimes(model_weight, data);

    setTimeout(function() {
      callback([data, labels]);
    }, 1);
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = DataLayer;
