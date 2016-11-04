// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');
import fs = require('fs');

class BlobDataLayer extends Layer {
  length: number;
  label: $M.Matrix;
  data_shape: number[];
  file_prefix: string;
  data_klass: string;
  data_klass_size: number;
  data_file: any;
  record_size: number;

  constructor(public params: any) {
    super();
    this.file_prefix = params.file_prefix;
    this.data_shape = params.data_shape;
    this.data_klass = params.data_klass || 'uint8';
    switch (this.data_klass) {
      case 'single':
        this.data_klass_size = 4;
        break;
      case 'uint8':
        this.data_klass_size = 1;
        break;
      default:
        throw new Error('Unsupported data_klass');
    }
    this.record_size = this.data_shape.reduce((pv, cv) => pv * cv, 1) * this.data_klass_size;
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
        var rawimgs;
        switch (this.data_klass) {
          case 'single':
            rawimgs = new Float32Array(buffer.buffer);
            break;
          case 'uint8':
            rawimgs = new Uint8Array(buffer.buffer);
            break;
        }
        var batch_data = $M.typedarray2mat(this.data_shape.concat(range_size), this.data_klass, rawimgs);
        if (config.devicetype == 'cl') {
          var batch_data2 = batch_data;
          batch_data = $M.gpuArray(batch_data2);
          batch_data2.destruct();
          var batch_label2 = batch_label;
          batch_label = $M.gpuArray(batch_label2);
          batch_label2.destruct();
        }
        buffer = null;
        // pseudo read ahead (to disk cache)
        var buffer_dummy = new Buffer(this.record_size * range_size);
        fs.read(this.data_file, buffer_dummy, 0, this.record_size * range_size, this.record_size * (range_max),
          (err, bytesRead, _buffer) => {});
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
