/// <reference path="../node_modules/definitely-typed-jasmine/jasmine.d.ts" />
import $M = require('milsushi2');
import Sukiyaki = require('../index');
import fs = require('fs');
import load_layer_case = require('./layer_case_loader');

declare var process;
var cl_enabled = Boolean(Number(process.env['TEST_CL']));
console.log('OpenCL ' + cl_enabled);
var MatrixCL = null;
if (cl_enabled) {
  $M.initcl();
}

var layer_test_cases = 'linear_1d linear_3d relu convolution_2d convolution_2d_stride_pad max_pooling_2d average_pooling_2d'.split(' ');

function test_layer_case(case_name: string, done: any, cl: boolean) {
  var case_data = load_layer_case(case_name, cl);
  var layer = Sukiyaki.LayerFactory.create(case_data.layer_params.type, case_data.layer_params.params);
  if (cl) {
    layer.to_cl();
  }

  //fill parameters to train (weight, bias)
  for (var param_name in case_data.blobs.train_params) {
    if (case_data.blobs.train_params.hasOwnProperty(param_name)) {
      var mat = case_data.blobs.train_params[param_name];
      layer[param_name] = mat;
    }
  }
  //zero clear gradient parameters (delta_weight, delta_bias)
  if (layer.train_params) {
    for (var index = 0; index < layer.train_params.length; index++) {
      var train_param_name = layer.train_params[index];
      var delta_param_name = layer.delta_params[index];
      layer[delta_param_name] = $M.zeros($M.size(layer[train_param_name]));
    }
  }

  layer.forward(case_data.blobs.forward.bottoms, null, (actual_tops) => {
    // test forward result
    for (var forward_top_i = 0; forward_top_i < case_data.blobs.forward.tops.length; forward_top_i++) {
      var expected_top = case_data.blobs.forward.tops[forward_top_i];
      try {
        expect($M.allclose(actual_tops[forward_top_i], expected_top, 1e-4)).toBeTruthy();
      } catch (error) {
        console.error('Exception on backward test: ' + error);
      }
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
              try {
                expect($M.allclose(layer[param_name], expected_delta)).toBeTruthy();
              } catch (error) {
                console.error('Exception on calculateUpdateParams test: ' + error);
              }
            }
          }

          // backward test
          layer.backward(case_data.blobs.backward.bottoms,
            case_data.blobs.backward.top_deltas, null, (actual_bottom_deltas) => {
              // test backward result
              for (var backward_bottom_i = 0; backward_bottom_i < case_data.blobs.backward.bottom_deltas.length; backward_bottom_i++) {
                var expected_bottom_delta = case_data.blobs.backward.bottom_deltas[backward_bottom_i];
                try {
                  expect($M.allclose(actual_bottom_deltas[backward_bottom_i], expected_bottom_delta)).toBeTruthy();
                } catch (error) {
                  console.error('Exception on backward test: ' + error);
                }
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
  layer_test_cases.forEach((case_name) => {
    it('layer case cpu ' + case_name, function (done) {
      test_layer_case(case_name, done, false);
    });
  });

  if (cl_enabled) {
    layer_test_cases.forEach((case_name) => {
      it('layer case cl ' + case_name, function (done) {
        test_layer_case(case_name, done, true);
      });
    });
  }
});
