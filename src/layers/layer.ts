// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');

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

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    throw new Error('Not implemented');
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    throw new Error('Not implemented');
  }

  calculateUpdateParams(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: () => void): void {
    setImmediate(function () {
      callback();
    });
  }

  to_cpu(): void {
    if (this.train_params) {
      for (var i = 0; i < this.train_params.length; i++) {
        var param_name = this.train_params[i];
        var m: $M.Matrix = this[param_name];
        if ($M.devicetype(m) == 'cl') {
          var cpum = $M.gather(m);
          this[param_name] = cpum;
          m.destruct();
        }
      }
    }
  }

  to_cl(): void {
    if (this.train_params) {
      for (var i = 0; i < this.train_params.length; i++) {
        var param_name = this.train_params[i];
        var m: $M.Matrix = this[param_name];
        if ($M.devicetype(m) == 'cpu') {
          var clm = $M.gpuArray(m);
          this[param_name] = clm;
          m.destruct();
        }
      }
    }
  }

  release(): void {
    //release internal data for a batch
  }

  destruct(): void {
    //release data in the layer
  }
}

export = Layer;
