import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class PlusLayer extends Layer {
  n_input: number;

  constructor(params: any) {
    super();

    if (!(params.n_input >= 1)) {
      throw Error('n_input must be positive integer');
    }
    this.n_input = params.n_input;
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //sum up inputs
    var top: $M.Matrix;
    if (this.n_input == 1) {
      top = bottoms[0].copy();
    } else {
      top = $M.plus(bottoms[0], bottoms[1]);
      for (var i = 2; i < this.n_input; i++) {
        var new_top = $M.plus(top, bottoms[i]);
        top.destruct();
        top = new_top;
      }
    }
    setImmediate(function() {
      callback([top]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    //copy deltas
    var data: $M.Matrix = top_deltas[0];
    var outputs = [];
    for (var i = 0; i < this.n_input; i++) {
      outputs.push(data.copy());
    }
    
    setImmediate(function(){
      callback(outputs);
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = PlusLayer;
