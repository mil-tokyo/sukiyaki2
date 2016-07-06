/// <reference path="../node_modules/definitely-typed-jasmine/jasmine.d.ts" />
import $M = require('milsushi2');
import Sukiyaki = require('../index');
var fs = require('fs');

describe('Sukiyaki module', function () {
  it('has network class', function () {
    expect(Sukiyaki.Network).toBeDefined();
  })
});

describe('linear layer', function () {
  it('forward', function (done) {
    var weight = $M.npyread(fs.readFileSync('spec/fixture/layer/train_params_weight.npy'));
    var bias = $M.npyread(fs.readFileSync('spec/fixture/layer/train_params_bias.npy'));
    var bottoms_0 = $M.npyread(fs.readFileSync('spec/fixture/layer/forward_bottoms_0.npy'));
    var tops_0 = $M.npyread(fs.readFileSync('spec/fixture/layer/forward_tops_0.npy'));
    var layer = Sukiyaki.LayerFactory.create('linear', { in_size: 4, out_size: 3 });
    (<any>layer).weight = weight;
    (<any>layer).bias = bias;
    layer.forward([bottoms_0], null, (actual_tops) => {
      var actual_top = actual_tops[0];
      expect($M.allclose(tops_0, actual_top)).toBeTruthy();
      done();
    });
  });

  it('backward', function (done) {
    var weight = $M.npyread(fs.readFileSync('spec/fixture/layer/train_params_weight.npy'));
    var bias = $M.npyread(fs.readFileSync('spec/fixture/layer/train_params_bias.npy'));
    var delta_weight = $M.npyread(fs.readFileSync('spec/fixture/layer/delta_params_weight.npy'));
    var delta_bias = $M.npyread(fs.readFileSync('spec/fixture/layer/delta_params_bias.npy'));
    var bottoms_0 = $M.npyread(fs.readFileSync('spec/fixture/layer/forward_bottoms_0.npy'));
    //var tops_0 = $M.npyread(fs.readFileSync('spec/fixture/layer/forward_tops_0.npy'));
    var top_deltas_0 = $M.npyread(fs.readFileSync('spec/fixture/layer/backward_top_deltas_0.npy'));
    var bottom_deltas_0 = $M.npyread(fs.readFileSync('spec/fixture/layer/backward_bottom_deltas_0.npy'));
    var layer = Sukiyaki.LayerFactory.create('linear', { in_size: 4, out_size: 3 });
    (<any>layer).weight = weight;
    (<any>layer).bias = bias;
    layer.forward([bottoms_0], null, (actual_tops) => {
      (<any>layer).delta_weight = $M.zeros($M.size(weight));
      (<any>layer).delta_bias = $M.zeros($M.size(bias));
      layer.calculateUpdateParams([bottoms_0], [top_deltas_0], null, () => {
        expect($M.allclose(delta_weight, (<any>layer).delta_weight)).toBeTruthy();
        expect($M.allclose(delta_bias, (<any>layer).delta_bias)).toBeTruthy();
        layer.backward([bottoms_0], [top_deltas_0], null, (actual_bottom_deltas) => {
          var actual_bottom_delta = actual_bottom_deltas[0];
          expect($M.allclose(bottom_deltas_0, actual_bottom_delta)).toBeTruthy();
          done();
        });
      });
    });
  });
});
