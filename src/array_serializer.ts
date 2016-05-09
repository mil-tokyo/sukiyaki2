/// <reference path="../node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layers/layer');
import Network = require('./network');

class ArraySerializer {
  static dump(net: Network): Uint8Array {
    // temporary format
    // header: json indicating offset and size of each variable
    // assuming all weights are Float32Array
    var header_obj = {};
    var offset = 32768;
    // get size
    for (var layer_name in net.layer_instances) {
      if (net.layer_instances.hasOwnProperty(layer_name)) {
        var layer_inst = net.layer_instances[layer_name];
        if (!layer_inst.train_params) {
          continue;
        }
        for (var i = 0; i < layer_inst.train_params.length; i++) {
          var train_param_name = layer_inst.train_params[i];
          var weight: $M.Matrix = layer_inst[train_param_name];
          var weight_size = $M.numel(weight) * 4;
          header_obj[layer_name + '/' + train_param_name] = {offset: offset, size: weight_size};
          offset += weight_size;
        }
      }
    }
    
    var buf = new Uint8Array(offset);
    //write header as binary
    var header_str = JSON.stringify(header_obj);
    for (var i = 0; i < header_str.length; i++) {
      buf[i] = header_str.charCodeAt(i);
    }
    
    console.log(header_str);
    //write body
    for (var obj_name in header_obj) {
      if (header_obj.hasOwnProperty(obj_name)) {
        var offset_size = header_obj[obj_name];
        var [layer_name, train_param_name] = obj_name.split('/');
        var weight: $M.Matrix = net.layer_instances[layer_name][train_param_name];
        var bin_view = new Float32Array(buf.buffer, offset_size.offset, offset_size.size / 4);
        weight.getdatacopy(null, null, bin_view);
      }
    }
    
    return buf;
  }
  
  static load(buf: Uint8Array, net: Network): void {
    //parse header
    var header_str = '';
    for (var i = 0; i < 32768; i++) {
      if (buf[i] == 0) {
        break;
      }
      header_str += String.fromCharCode(buf[i]);
    }
    console.log(header_str);
    var header_obj = JSON.parse(header_str);
    
    //copy body to each layer weight
    for (var obj_name in header_obj) {
      if (header_obj.hasOwnProperty(obj_name)) {
        var offset_size = header_obj[obj_name];
        var [layer_name, train_param_name] = obj_name.split('/');
        var weight: $M.Matrix = net.layer_instances[layer_name][train_param_name];
        var bin_view = new Float32Array(buf.buffer, offset_size.offset, offset_size.size / 4);
        if (weight) {
          weight.setdata(bin_view);
        }
      }
    }
  }
}

export = ArraySerializer;
