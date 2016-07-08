// loads test case of a layer

import fs = require('fs');
import $M = require('milsushi2');

function load_npy(basedir: string, keys: any[]) {
  // load_npy('foo', ['bar', 1]) => foo/bar.1.npy
  var path = basedir + '/';
  keys.forEach((key) => { path += key + '.'; });
  path += 'npy';
  return $M.npyread(fs.readFileSync(path));
}

function load_layer_case(case_name: string): any {
  var case_dir = 'spec/fixture/layer/' + case_name;
  var case_metadata = JSON.parse(fs.readFileSync(case_dir + '/case.json', 'utf8'));
  var layer_params = case_metadata.layer_params;//for layer_factory
  var blobs = {};
  ["train_params", "delta_params"].forEach((param_type) => {
    blobs[param_type] = {};
    if (case_metadata.blobs[param_type]) {
      case_metadata.blobs[param_type].forEach((param_name) => {
        blobs[param_type][param_name] = load_npy(case_dir, [param_type, param_name]);
      });
    }
  });

  ["forward", "backward"].forEach((param_type) => {
    blobs[param_type] = {};
    var type_vars = case_metadata.blobs[param_type];
    //type_vars == {"bottoms": 1, "tops": 1}
    for (var param_name in type_vars) {
      if (type_vars.hasOwnProperty(param_name)) {
        var param_count: number = type_vars[param_name];
        var npy_list = [];
        for (var j = 0; j < param_count; j++) {
          npy_list.push(load_npy(case_dir, [param_type, param_name, j]));
        }
        blobs[param_type][param_name] = npy_list;
      }
    }
  });

  return { layer_params: layer_params, blobs: blobs };
}

export = load_layer_case;
