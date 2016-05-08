/// <reference path="./typings/main.d.ts"/>
/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Layer = require('./layer');
import fs = require('fs');

class MnistDataLayer extends Layer {
  length: number;
  data: $M.Matrix;
  label: $M.Matrix;
  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    var label_ary = new Uint8Array(fs.readFileSync('mnist/label.bin').buffer);
    fs.readFile('mnist/data.bin', (err, data) => {
      var data_ary = new Float32Array(data.buffer);
      this.label = $M.typedarray2mat([1, label_ary.length], 'uint8', label_ary);
      this.length = label_ary.length;
      var data_dim = 28 * 28;
      console.log('Data length set to ' + this.length);
      this.data = $M.typedarray2mat([data_dim, this.length], 'single', data_ary);
      callback();
    });
  }

  forward(bottoms: $M.Matrix[], callback: (tops: $M.Matrix[]) => void): void {
    var range: $M.Matrix = bottoms[0];//[from, to]
    var range_min = range.get(1);
    var range_max = range.get(2);
    var batch_data = this.data.get($M.colon(), $M.colon(range_min, range_max));
    var batch_label = this.label.get($M.colon(), $M.colon(range_min, range_max));

    setTimeout(function() {
      callback([batch_data, batch_label]);
    }, 1);
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = MnistDataLayer;
