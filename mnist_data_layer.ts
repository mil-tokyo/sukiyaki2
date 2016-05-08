/// <reference path="./typings/main.d.ts"/>
/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import ForwardConfiguration = require('./forward_configuration');
import Layer = require('./layer');
import fs = require('fs');

class MnistDataLayer extends Layer {
  length: number;
  data: $M.Matrix;
  label: $M.Matrix;
  data_dim: number = 28 * 28;
  constructor(public params: any) {
    super();
  }

  init(callback: () => void): void {
    var label_ary = new Uint8Array(fs.readFileSync(this.params.label).buffer);
    fs.readFile(this.params.data, (err, data) => {
      var data_ary = new Float32Array(data.buffer);
      this.label = $M.typedarray2mat([1, label_ary.length], 'uint8', label_ary);
      this.length = label_ary.length;
      console.log('Data length set to ' + this.length);
      this.data = $M.typedarray2mat([this.data_dim, this.length], 'single', data_ary);
      callback();
    });
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var range: $M.Matrix = bottoms[0];//[from, to]
    var range_min = range.get(1);
    var range_size = range.get(2);
    range_min = range_min % this.length;
    var range_max = range_min + range_size - 1;
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
