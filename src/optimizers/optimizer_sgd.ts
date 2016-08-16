import $M = require('milsushi2');
import Network = require('../network');
import Optimizer = require('../optimizer');

class OptimizerSGD extends Optimizer {
  lr: number;//learning rate

  constructor(net: Network, lr: number = 0.01) {
    super(net);
    this.lr = lr;
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
          var new_weight = $M.autodestruct(() => $M.plus(cur_weight, $M.times(cur_grad, -this.lr)));
          cur_weight.destruct();
          layer_instance[train_param_name] = new_weight;
        }
      }
    }
  }

  release(): void {
    super.release();
  }
}

export = OptimizerSGD;
