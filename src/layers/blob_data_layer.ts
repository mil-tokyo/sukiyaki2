import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');
import fs = require('fs');

class BlobDataLayer extends Layer {
  length: number;
  label: $M.Matrix;
  data_shape: number[];
  file_prefix: string;
  data_file: any;
  record_size: number;

  constructor(public params: any) {
    super();
    this.file_prefix = params.file_prefix;
    this.data_shape = params.data_shape;
    this.record_size = this.data_shape.reduce((pv, cv) => pv * cv, 1) * 4;
  }

  init(callback: () => void): void {
    var label_ary = new Int32Array(JSON.parse(fs.readFileSync(this.file_prefix + '.json', 'utf8')));
    this.label = $M.typedarray2mat([1, label_ary.length], 'int32', label_ary);
    this.length = label_ary.length;
    this.data_file = fs.openSync(this.file_prefix + '.bin', 'r');
    console.log('Data length set to ' + this.length);
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var range: $M.Matrix = bottoms[0];//[from, to]
    var range_min = range.get(1);//1 to length
    var range_size = range.get(2);
    range_min = (range_min - 1) % this.length + 1;
    if (range_min + range_size - 1 > this.length) {
      range_min = 1;
    }
    var range_max = range_min + range_size - 1;
    var batch_label = this.label.get($M.colon(), $M.colon(range_min, range_max));
    var buffer = new Buffer(this.record_size * range_size);
    fs.read(this.data_file, buffer, 0, this.record_size * range_size, this.record_size * (range_min - 1),
      (err, bytesRead, _buffer) => {
        var rawimgs = new Float32Array(buffer.buffer);
        var batch_data = $M.typedarray2mat(this.data_shape.concat(range_size), 'single', rawimgs);
        if (config.devicetype == 'cl') {
          var batch_data2 = batch_data;
          batch_data = $M.gpuArray(batch_data2);
          batch_data2.destruct();
          var batch_label2 = batch_label;
          batch_label = $M.gpuArray(batch_label2);
          batch_label2.destruct();
        }
        buffer = null;
        callback([batch_data, batch_label]);
      });

  }

  release(): void {

  }

  destruct(): void {
    fs.closeSync(this.data_file);
  }
}

export = BlobDataLayer;
