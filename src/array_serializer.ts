// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import Layer = require('./layers/layer');
import Network = require('./network');

class ArraySerializer {
  static dump(net: Network, gradient: boolean = false): Uint8Array {
    // temporary format
    // header: json indicating offset and size of each variable
    // assuming all weights are Float32Array
    var header_obj;
    var max_header_size = 1024;
    var offset;
    var header_str;
    while (true) {
      header_obj = {};
      offset = max_header_size;
      // get size
      for (var layer_name in net.layer_instances) {
        if (net.layer_instances.hasOwnProperty(layer_name)) {
          var layer_inst = net.layer_instances[layer_name];
          if (!layer_inst.train_params) {
            continue;
          }
          var params_names = gradient ? layer_inst.delta_params : layer_inst.train_params;
          for (var i = 0; i < params_names.length; i++) {
            var train_param_name = params_names[i];
            var weight: $M.Matrix = layer_inst[train_param_name];
            if ($M.klass(weight) != 'single') {
              throw new Error('Only matrix of klass single is supported');
            }
            var weight_size = $M.numel(weight) * 4;
            header_obj[layer_name + '/' + train_param_name] = { offset: offset, size: weight_size };
            offset += weight_size;
          }
        }
      }
      header_str = JSON.stringify(header_obj);
      if (header_str.length < max_header_size) {
        //ok
        break;
      }
      max_header_size = Math.ceil(header_str.length / 1024) * 1024 + 1024;//increase header size and retry
    }

    var buf = new Uint8Array(offset);
    //write header as binary
    for (var i = 0; i < header_str.length; i++) {
      buf[i] = header_str.charCodeAt(i);
    }

    //console.log(header_str);
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
    //console.log(header_str);
    var header_obj = JSON.parse(header_str);

    //copy body to each layer weight
    for (var obj_name in header_obj) {
      if (header_obj.hasOwnProperty(obj_name)) {
        var offset_size = header_obj[obj_name];
        var [layer_name, train_param_name] = obj_name.split('/');
        //console.log(layer_name);
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
