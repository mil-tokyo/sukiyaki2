/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');

class Layer {
  train_params: string[];
  delta_params: string[];
  need_update: boolean;
  
  constructor() {
    this.need_update = false;
  }
  
  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], callback: (tops: $M.Matrix[]) => void): void {
    throw new Error('Not implemented');
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], callback: (bottom_deltas: $M.Matrix[]) => void): void {
    throw new Error('Not implemented');
  }
  
  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], callback: () => void): void {
    setImmediate(function(){
      callback();
    });
  }

  release(): void {
    //release internal data for a batch
  }

  destruct(): void {
    //release data in the layer
  }
}

export = Layer;
