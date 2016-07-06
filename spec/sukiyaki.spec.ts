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
    var layer = Sukiyaki.LayerFactory.create('linear', {in_size: 4, out_size: 3});
    (<any>layer).weight = weight;
    (<any>layer).bias = bias;
    layer.forward([bottoms_0], null, (actual_tops) => {
      var actual_top = actual_tops[0];
      expect($M.mat2jsa($M.isclose(tops_0, actual_top))).toEqual([[1,1],[1,1],[1,1]]);
      console.log('isclose ' + $M.mat2jsa($M.isclose(tops_0, actual_top)));
      console.log('mat ' + $M.mat2jsa(actual_top));
      done();
    })  
  });
});
