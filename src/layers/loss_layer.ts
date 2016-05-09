/// <reference path="../../node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');

class LossLayer extends Layer {

  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    //square loss
    var data: $M.Matrix = bottoms[0];
    var gt: $M.Matrix = bottoms[1];
    var loss = $M.sum($M.sum($M.power($M.minus(data, gt), 2.0)));

    setImmediate(function() {
      callback([loss]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    //top_deltas[0] is usually 1.0
    var data: $M.Matrix = bottoms[0];
    var gt: $M.Matrix = bottoms[1];
    var top_delta: $M.Matrix = top_deltas[0];//scalar
    
    var bottom_delta = $M.times($M.minus(data, gt), top_delta);
    
    setImmediate(function(){
      callback([bottom_delta]);
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = LossLayer;
