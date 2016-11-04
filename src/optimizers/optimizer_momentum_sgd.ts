// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import Network = require('../network');
import Optimizer = require('../optimizer');

class OptimizerSGD extends Optimizer {
  lr: number;//learning rate
  momentum: number;
  last_deltas: { [index: string]: $M.Matrix };

  constructor(net: Network, lr: number = 0.01, momentum: number = 0.9) {
    super(net);
    this.lr = lr;
    this.momentum = momentum;
    this.last_deltas = {};
  }

  do_update(): void {
    // update params
    for (var key in this.net.layer_instances) {
      if (this.net.layer_instances.hasOwnProperty(key)) {
        var layer_instance = this.net.layer_instances[key];
        if (layer_instance.train_params == null) {
          continue;
        }
        for (var index = 0; index < layer_instance.train_params.length; index++) {
          var train_param_name = layer_instance.train_params[index];
          var delta_param_name = layer_instance.delta_params[index];
          var cur_weight: $M.Matrix = layer_instance[train_param_name];
          var cur_grad: $M.Matrix = layer_instance[delta_param_name];
          var param_global_name = key + '/' + train_param_name;
          var last_delta: $M.Matrix = this.last_deltas[param_global_name];
          var new_weight: $M.Matrix, new_last_delta: $M.Matrix;
          $M.autodestruct(() => {
            if (last_delta) {
              new_last_delta = $M.times(last_delta, this.momentum);
              new_last_delta = $M.plus(new_last_delta, $M.times(cur_grad, -this.lr));
            } else {
              new_last_delta = $M.times(cur_grad, -this.lr);
            }
            new_weight = $M.plus(cur_weight, new_last_delta);
            return [new_weight, new_last_delta];
          })
          cur_weight.destruct();
          layer_instance[train_param_name] = new_weight;
          if (last_delta) {
            last_delta.destruct();
          }
          this.last_deltas[param_global_name] = new_last_delta;
        }
      }
    }
  }

  release(): void {
    super.release();
  }

  destruct(): void {
    super.destruct();
    for (var key in this.last_deltas) {
      if (this.last_deltas.hasOwnProperty(key)) {
        var last_delta = this.last_deltas[key];
        last_delta.destruct();
      }
    }
    this.last_deltas = {};
  }
}

export = OptimizerSGD;
