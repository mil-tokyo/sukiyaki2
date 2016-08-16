import $M = require('milsushi2');
import Network = require('./network');

abstract class Optimizer {
  net: Network;

  constructor(net: Network) {
    this.net = net;
  }

  zero_grads(): void {
    //zero clear gradients
    for (var key in this.net.layer_instances) {
      if (this.net.layer_instances.hasOwnProperty(key)) {
        var layer_instance = this.net.layer_instances[key];
        if (layer_instance.train_params == null) {
          continue;
        }
        for (var index = 0; index < layer_instance.train_params.length; index++) {
          var train_param_name = layer_instance.train_params[index];
          var delta_param_name = layer_instance.delta_params[index];
          if (this.net.devicetype == 'cl') {
            layer_instance[delta_param_name] = $M.zeros($M.size(layer_instance[train_param_name]), 'gpuArray');
          } else {
            layer_instance[delta_param_name] = $M.zeros($M.size(layer_instance[train_param_name]));
          }
        }
      }
    }
  }

  abstract do_update(): void;

  update(input_vars: { [index: string]: $M.Matrix }, callback: () => void): void {
    this.zero_grads();
    this.net.forward(input_vars, () => {
      this.net.backward(() => {
        this.do_update();
        callback();
      });
    });
  }

  release(): void {
    //release gradients
    for (var key in this.net.layer_instances) {
      if (this.net.layer_instances.hasOwnProperty(key)) {
        var layer_instance = this.net.layer_instances[key];
        if (layer_instance.train_params == null) {
          continue;
        }
        for (var index = 0; index < layer_instance.train_params.length; index++) {
          var delta_param_name = layer_instance.delta_params[index];
          if (layer_instance[delta_param_name] != null) {
            layer_instance[delta_param_name].destruct();
            layer_instance[delta_param_name] = null;
          }
        }
      }
    }
    this.net.release();
  }

  destruct(): void {
    //release all matrices
  }
}

export = Optimizer;
