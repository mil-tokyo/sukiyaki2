/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layer');
import LayerFactory = require('./layer_factory');


class Network {
  phase: string;
  layers: { name: string, type: string, params: any, inputs: string[], outputs: string[], phase?: string[] }[];
  layer_instances: { [index: string]: Layer };
  blobs_forward: { [index: string]: $M.Matrix };
  blobs_backward: { [index: string]: $M.Matrix };

  constructor(layers: { name: string, type: string, params: any, inputs: string[], outputs: string[], phase?: string[] }[]) {
    this.phase = 'test';
    this.layers = layers;
    this.layer_instances = {};
    //construct layers
    for (var i = 0; i < this.layers.length; i++) {
      var element = this.layers[i];
      var inst = LayerFactory.create(element.type, element.params);
      this.layer_instances[element.name] = inst;
    }
  }

  init(callback: () => void): void {
    var layer_index = 0;
    var init_next_layer = () => {
      if (layer_index >= this.layers.length) {
        callback();
      } else {
        var layer_name = this.layers[layer_index].name;
        var inst = this.layer_instances[layer_name];
        inst.init(init_next_layer);
        layer_index++;
      }
    }

    init_next_layer();
  }

  forward(input_vars: { [index: string]: $M.Matrix }, callback: () => void): void {
    this.blobs_forward = {};
    this.blobs_backward = {};
    for (var key in input_vars) {
      if (input_vars.hasOwnProperty(key)) {
        this.blobs_forward[key] = input_vars[key];
      }
    }

    var layer_index = 0;
    var target_layers = this.layers.filter((item) => (item.phase == null) || (item.phase.indexOf(this.phase) >= 0));
    var forward_next = () => {//arrow function preserves "this"
      var layer_prop = target_layers[layer_index];
      var layer_instance = this.layer_instances[layer_prop.name];
      // prepare bottom vars
      var bottom_vars = [];
      for (var index = 0; index < layer_prop.inputs.length; index++) {
        var var_name = layer_prop.inputs[index];
        bottom_vars.push(this.blobs_forward[var_name]);
      }

      //console.log('forward ' + layer_prop.name);
      layer_instance.forward(bottom_vars, (tops) => {
        // save top vars
        for (var index = 0; index < tops.length; index++) {
          var top_var = tops[index];
          var top_var_name = layer_prop.outputs[index];
          this.blobs_forward[top_var_name] = top_var;
        }

        layer_index++;
        if (layer_index < target_layers.length) {
          forward_next();
        } else {
          // forward of all layers has been called
          callback();
        }
      });
    };

    forward_next();
  }

  backward(callback: () => void): void {
    var target_layers = this.layers.filter((item) => (item.phase == null) || (item.phase.indexOf(this.phase) >= 0));
    var layer_index = target_layers.length - 1;
    var update_until = layer_index;
    //find most bottom layer which requires update
    for (var index = 0; index < target_layers.length; index++) {
      var layer_prop = target_layers[index];
      var layer_instance = this.layer_instances[layer_prop.name];
      if (layer_instance.need_update) {
        update_until = index;
        break;
      }
    }

    var backward_next = () => {
      var layer_prop = target_layers[layer_index];
      var layer_instance = this.layer_instances[layer_prop.name];
      // prepare bottom vars
      var bottom_vars = [];
      for (var index = 0; index < layer_prop.inputs.length; index++) {
        var var_name = layer_prop.inputs[index];
        bottom_vars.push(this.blobs_forward[var_name]);
      }

      // prepare top_delta vars
      var top_deltas = [];
      for (var index = 0; index < layer_prop.outputs.length; index++) {
        var var_name = layer_prop.outputs[index];
        var top_delta: number[] = null;
        if (this.blobs_backward[var_name] == null) {
          //give matrix of 1 with same shape of forward variable
          var top_forward = this.blobs_forward[var_name];
          this.blobs_backward[var_name] = $M.ones($M.size(top_forward));
        }
        top_deltas.push(this.blobs_backward[var_name]);
      }

      //console.log('calculateUpdateParams ' + layer_prop.name);
      layer_instance.calculateUpdateParams(bottom_vars, top_deltas, () => {
        if (update_until < layer_index) {
          // backward needed
          //console.log('backward ' + layer_prop.name);
          layer_instance.backward(bottom_vars, top_deltas, (bottom_deltas: any[]) => {
            // save bottom_delta vars
            for (var index = 0; index < bottom_deltas.length; index++) {
              var bottom_delta = bottom_deltas[index];
              var bottom_name = layer_prop.inputs[index];
              this.blobs_backward[bottom_name] = bottom_delta;
            }

            layer_index--;
            backward_next();
          });
        } else {
          //backward finish
          callback();
        }
      });
    }

    backward_next();
  }

  release(): void {
    this.blobs_forward = null;
    this.blobs_backward = null;

    for (var key in this.layer_instances) {
      if (this.layer_instances.hasOwnProperty(key)) {
        var layer_instance = this.layer_instances[key];
        layer_instance.release();
      }
    }
  }
}

export = Network;
