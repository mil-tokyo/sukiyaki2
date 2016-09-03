import $M = require('milsushi2');
import Layer = require('./layers/layer');
import LayerFactory = require('./layers/layer_factory');
import ForwardConfiguration = require('./forward_configuration');


class Network {
  phase: string;
  devicetype: string;//cpu or cl
  layers: { name: string, type: string, params: any, inputs: string[], outputs: string[], phase?: string[] }[];
  layer_instances: { [index: string]: Layer };
  blobs_forward: { [index: string]: $M.Matrix };
  blobs_backward: { [index: string]: $M.Matrix };
  layer_time: { [index: string]: number };

  constructor(layers: { name: string, type: string, params: any, inputs: string[], outputs: string[], phase?: string[] }[]) {
    this.phase = 'test';
    this.devicetype = 'cpu';
    this.layers = layers;
    this.layer_instances = {};
    //construct layers
    for (var i = 0; i < this.layers.length; i++) {
      var element = this.layers[i];
      var inst = LayerFactory.create(element.type, element.params);
      this.layer_instances[element.name] = inst;
    }
    this.timer_enable = false;
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

  to_cpu(): void {
    if (this.devicetype == 'cpu') {
      return;
    }
    for (var key in this.layer_instances) {
      if (this.layer_instances.hasOwnProperty(key)) {
        var inst = this.layer_instances[key];
        inst.to_cpu();
      }
    }
    this.devicetype = 'cpu';
  }

  to_cl(): void {
    if (this.devicetype == 'cl') {
      return;
    }
    for (var key in this.layer_instances) {
      if (this.layer_instances.hasOwnProperty(key)) {
        var inst = this.layer_instances[key];
        inst.to_cl();
      }
    }
    this.devicetype = 'cl';
  }

  timer_val: number;
  timer_name: string;
  timer_enable: boolean;
  _start_timer(name: string) {
    if (this.timer_enable) {
      this.timer_name = name;
      if (this.devicetype == 'cl') {
        $M.CL.finish();
      }
      this.timer_val = Date.now();
    }
  }

  _stop_timer() {
    if (this.timer_enable) {
      if (this.layer_time) {
        if (this.devicetype == 'cl') {
          $M.CL.finish();
        }
        var end_time = Date.now();
        var time_ms = end_time - this.timer_val;
        this.layer_time[this.timer_name] = time_ms;
      }
    }
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
    var forward_config = new ForwardConfiguration();
    forward_config.phase = this.phase;
    forward_config.devicetype = this.devicetype;
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
      this._start_timer(layer_prop.name + '.forward');
      layer_instance.forward(bottom_vars, forward_config, (tops) => {
        this._stop_timer();
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

    var forward_config = new ForwardConfiguration();
    forward_config.phase = this.phase;
    forward_config.devicetype = this.devicetype;

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
          var ones: $M.Matrix;
          if (this.devicetype == 'cl') {
            ones = $M.ones($M.size(top_forward), 'gpuArray');
          } else {
            ones = $M.ones($M.size(top_forward));
          }
          this.blobs_backward[var_name] = ones;
        }
        top_deltas.push(this.blobs_backward[var_name]);
      }

      //console.log('calculateUpdateParams ' + layer_prop.name);
      this._start_timer(layer_prop.name + '.calcUpdate');
      layer_instance.calculateUpdateParams(bottom_vars, top_deltas, forward_config, () => {
        this._stop_timer();
        if (update_until < layer_index) {
          // backward needed
          //console.log('backward ' + layer_prop.name);
          this._start_timer(layer_prop.name + '.backward');
          layer_instance.backward(bottom_vars, top_deltas, forward_config, (bottom_deltas: any[]) => {
            this._stop_timer();
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
    if (this.blobs_forward != null) {
      for (var key in this.blobs_forward) {
        if (this.blobs_forward.hasOwnProperty(key)) {
          var element = this.blobs_forward[key];
          element.destruct();
        }
      }
      this.blobs_forward = null;
    }
    if (this.blobs_backward != null) {
      for (var key in this.blobs_backward) {
        if (this.blobs_backward.hasOwnProperty(key)) {
          var element = this.blobs_backward[key];
          element.destruct();
        }
      }
      this.blobs_backward = null;
    }

    for (var key in this.layer_instances) {
      if (this.layer_instances.hasOwnProperty(key)) {
        var layer_instance = this.layer_instances[key];
        layer_instance.release();
      }
    }
  }
}

export = Network;
