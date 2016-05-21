/// <reference path="../../node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Network = require('../network');

class OptimizerSGD {
  net: Network;
  lr: number;//learning rate
  
  constructor(net: Network, lr: number = 0.01) {
    this.net = net;
    this.lr = lr;
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
          var delta_param_name = layer_instance.delta_params[index];
          if (this.net.devicetype == 'cl') {
            layer_instance[delta_param_name] = $M.zeros($M.size(layer_instance[delta_param_name]), 'gpuArray');
          } else {
            layer_instance[delta_param_name] = $M.zeros($M.size(layer_instance[delta_param_name]));
          }
        }
      }
    }
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
          var cur_weight : $M.Matrix = layer_instance[train_param_name];
          var cur_grad : $M.Matrix = layer_instance[delta_param_name];
          var new_weight = $M.plus(cur_weight, $M.times(cur_grad, -this.lr));
          layer_instance[train_param_name] = new_weight;
        }
      }
    }
  }
  
  update(input_vars: {[index:string]:$M.Matrix}, callback: () => void): void {
    this.zero_grads();
    this.net.forward(input_vars, () => {
      this.net.backward(() => {
        this.do_update();
        callback();
      });
    });
  }
}

export = OptimizerSGD;
