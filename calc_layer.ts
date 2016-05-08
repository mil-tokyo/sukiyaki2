/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');

import Layer = require('./layer');

class CalcLayer extends Layer {
  weight: $M.Matrix;
  delta_weight: $M.Matrix;

  constructor(params: any) {
    super();
    this.need_update = true;
    this.weight = $M.rand(2,3);//3dim to 2dim
    this.delta_weight = $M.zeros(2,3);
    this.train_params = ['weight'];
    this.delta_params = ['delta_weight'];
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], callback: (tops: $M.Matrix[]) => void): void {
    //multiply input by weight
    var data: $M.Matrix = bottoms[0];
    //batch: [dim, sample]
    var output = $M.mtimes(this.weight, data);

    setImmediate(function() {
      callback([output]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    
    var bottom_delta = $M.mtimes($M.t(this.weight), top_delta);
    
    setImmediate(function(){
      callback([bottom_delta]);
    });
  }
  
  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], callback: () => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];
    
    var delta_weight = $M.mtimes(top_delta, $M.t(data));
    
    this.delta_weight = $M.plus(this.delta_weight, delta_weight);
    
    setImmediate(function(){
      callback();
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = CalcLayer;
