/// <reference path="../node_modules/definitely-typed-jasmine/jasmine.d.ts" />
import $M = require('milsushi2');
import Sukiyaki = require('../index');
import fs = require('fs');
import load_layer_case = require('./layer_case_loader');

function test_layer_case(case_name, done) {
  var case_data = load_layer_case(case_name);
  var layer = Sukiyaki.LayerFactory.create(case_data.layer_params.type, case_data.layer_params.params);

  //fill parameters to train (weight, bias)
  for (var param_name in case_data.blobs.train_params) {
    if (case_data.blobs.train_params.hasOwnProperty(param_name)) {
      var mat = case_data.blobs.train_params[param_name];
      layer[param_name] = mat;
    }
  }
  //zero clear gradient parameters (delta_weight, delta_bias)
  for (var index = 0; index < layer.train_params.length; index++) {
    var train_param_name = layer.train_params[index];
    var delta_param_name = layer.delta_params[index];
    layer[delta_param_name] = $M.zeros($M.size(layer[train_param_name]));
  }

  layer.forward(case_data.blobs.forward.bottoms, null, (actual_tops) => {
    // test forward result
    for (var forward_top_i = 0; forward_top_i < case_data.blobs.forward.tops.length; forward_top_i++) {
      var expected_top = case_data.blobs.forward.tops[forward_top_i];
      expect($M.allclose(actual_tops[forward_top_i], expected_top)).toBeTruthy();
    }

    if (case_data.blobs.backward.bottom_deltas.length == 0) {
      //no backward test
      done();
    } else {
      // update test
      layer.calculateUpdateParams(case_data.blobs.backward.bottoms,
        case_data.blobs.backward.top_deltas, null, () => {
          // test update result
          for (var param_name in case_data.blobs.delta_params) {
            if (case_data.blobs.delta_params.hasOwnProperty(param_name)) {
              var expected_delta = case_data.blobs.delta_params[param_name];
              expect($M.allclose(layer[param_name], expected_delta)).toBeTruthy();
            }
          }

          // backward test
          layer.backward(case_data.blobs.backward.bottoms,
            case_data.blobs.backward.top_deltas, null, (actual_bottom_deltas) => {
              // test backward result
              for (var backward_bottom_i = 0; backward_bottom_i < case_data.blobs.backward.bottom_deltas.length; backward_bottom_i++) {
                var expected_bottom_delta = case_data.blobs.backward.bottom_deltas[backward_bottom_i];
                expect($M.allclose(actual_bottom_deltas[backward_bottom_i], expected_bottom_delta)).toBeTruthy();
              }

              done();
            });
        });
    }
  });
}

describe('Sukiyaki module', function () {
  it('has network class', function () {
    expect(Sukiyaki.Network).toBeDefined();
  })
});

describe('layer test', function () {
  'linear_1d linear_3d'.split(' ').forEach((case_name) => {
    it('layer case ' + case_name, function (done) {
      test_layer_case(case_name, done);
    });
  });
});
