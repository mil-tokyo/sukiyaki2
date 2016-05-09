/// <reference path="../../node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class ReluLayer extends Layer {

  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //multiply input by weight
    var data: $M.Matrix = bottoms[0];
    //batch: [dim, sample]
    var output = $M.max(data, 0);
    setImmediate(function() {
      callback([output]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    
    var coef = $M.zeros($M.size(data));
    coef.set($M.gt(data, 0), 1.0);
    var bottom_delta = $M.times(top_delta, coef);
    
    setImmediate(function(){
      callback([bottom_delta]);
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = ReluLayer;
