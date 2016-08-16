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

function load_npy(name: string): $M.Matrix {
  var path = 'spec/fixture/data_augmentation/' + name + '.npy';
  var m = $M.npyread(fs.readFileSync(path));
  if (cl_enabled) {
    m = $M.gpuArray(m);
  }
  return m;
}

var fixture_mean = load_npy('mean');
var fixture_bottom = load_npy('bottom');
var fixture_top = load_npy('top');

describe('Data augmentation layer', function () {
  it('give desired output without random', function (done) {
    var layer = new Sukiyaki.Layers.DataAugmentationLayer(
      { "out_shape": [6, 7], "scale": 0.5, "random_crop": false, "random_flip": false, "input_klass": "single" });
    layer.init(() => {
      if (cl_enabled) {
        layer.to_cl();
      }
      layer.set_data_mean(fixture_mean);

      var fwdconfig = new Sukiyaki.ForwardConfiguration();
      fwdconfig.phase = 'train';
      fwdconfig.devicetype = cl_enabled ? 'cl' : 'cpu';
      layer.forward([fixture_bottom], fwdconfig, (tops) => {
        var top = tops[0];
        expect($M.allclose(fixture_top, top)).toBeTruthy();
        done();
      });
    });
  });

  it('give desired output in random pattern', function (done) {
    var layer = new Sukiyaki.Layers.DataAugmentationLayer(
      { "out_shape": [6, 7], "scale": 1.0, "random_crop": true, "random_flip": true, "input_klass": "single" });
    layer.init(() => {
      if (cl_enabled) {
        layer.to_cl();
      }
      layer.set_data_mean(fixture_mean);

      var fwdconfig = new Sukiyaki.ForwardConfiguration();
      fwdconfig.phase = 'train';
      fwdconfig.devicetype = cl_enabled ? 'cl' : 'cpu';
      layer.forward([fixture_bottom], fwdconfig, (tops) => {
        var top = tops[0];//[out_h, out_w, c, n] 6, 7, 2, 3
        // ydiff=2, xdiff=1, cdiff=3
        expect(top.get(2, 1, 1, 1) - top.get(1, 1, 1, 1)).toBeCloseTo(2, 4);
        expect(Math.abs(top.get(3, 5, 1, 2) - top.get(3, 4, 1, 2))).toBeCloseTo(1, 4);//abs to support mirror
        expect(top.get(6, 7, 2, 3) - top.get(6, 7, 1, 3)).toBeCloseTo(3, 4);
        done();
      });
    });
  });
});
