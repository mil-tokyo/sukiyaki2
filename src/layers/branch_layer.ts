import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class BranchLayer extends Layer {
  n_output: number;

  constructor(params: any) {
    super();

    if (!(params.n_output >= 1)) {
      throw Error('n_output must be positive integer');
    }
    this.n_output = params.n_output;
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //copy inputs
    var data: $M.Matrix = bottoms[0];
    console.log('branch shape ' + $M.sizejsa(data));
    var outputs = [];
    for (var i = 0; i < this.n_output; i++) {
      outputs.push(data.copy());
    }
    setImmediate(function() {
      callback(outputs);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    //sum all deltas
    var top_delta: $M.Matrix = top_deltas[0];
    var bottom_delta: $M.Matrix;
    if (this.n_output == 1) {
      bottom_delta = top_deltas[0].copy();
    } else {
      bottom_delta = $M.plus(top_deltas[0], top_deltas[1]);
      for (var i = 2; i < this.n_output; i++) {
        var new_bottom_delta = $M.plus(bottom_delta, top_deltas[i]);
        bottom_delta.destruct();
        bottom_delta = new_bottom_delta;
      }
    }
    
    setImmediate(function(){
      callback([bottom_delta]);
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = BranchLayer;
