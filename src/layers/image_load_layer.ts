/// <reference path="./jpeg-turbo.d.ts" />
import $M = require('milsushi2');
import jpg = require('jpeg-turbo');
import fs = require('fs');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class ImageLoadLayer extends Layer {
  base_dir: string;
  shuffle: boolean;
  grayscale: boolean;
  list_path: string;
  file_paths: string[];
  file_labels: $M.Matrix;//int32 row vector of labels
  length: number;

  constructor(params: any) {
    super();

    // params: {list_path: string, shuffle: boolean, base_dir: string}
    // file format: foo.jpg 1(integer label)

    this.base_dir = (params['base_dir'] || '.') + '/';
    this.shuffle = params['shuffle'] || false;
    this.grayscale = params['grayscale'] || false;
    if (typeof params['list_path'] !== 'string') {
      throw Error('list_path must be string');
    }
    this.list_path = params['list_path'];
  }

  init(callback: () => void): void {
    fs.readFile(this.list_path, 'utf8', (err, data) => {
      if (err) {
        throw err;
      }
      var lines = data.split(/\r?\n/);
      var fps: string[] = [];
      var fls: number[] = [];
      for (var i = 0; i < lines.length; i++) {
        var element = lines[i];
        if (element.length == 0) {
          break;
        }
        var [fp, fl] = element.split(' ');
        fps.push(fp);
        fls.push(Number(fl));
      }

      this.length = this.file_paths.length;

      if (this.shuffle) {
        // do Fisher-Yates shuffle
        var n = this.length;
        for (var i = n - 1; i >= 1; i--) {
          var j = Math.floor(Math.random() * (i + 1));// [0, i]
          var fptmp = fps[j];
          fps[j] = fps[i];
          fps[i] = fptmp;
          var fltmp = fls[j];
          fls[j] = fls[i];
          fls[i] = fltmp;
        }
      }

      this.file_paths = fps;
      this.file_labels = $M.jsa2mat(fls, false, 'int32');

      callback();
    });
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var range: $M.Matrix = bottoms[0];
    var range_min = (range.get(1) - 1) % this.length + 1;
    var range_size = range.get(2);
    var labels: $M.Matrix;
    var paths: string[] = [];
    if (range_min + range_size > this.length) {
      //tail and head
      labels = $M.horzcat(this.file_labels.get(1, $M.colon(range_min, null)),
        this.file_labels.get(1, $M.colon(null, range_size - this.length - range_min - 1)));
      for (var i = range_min - 1; i < this.length; i++) {
        paths.push(this.file_paths[i]);
      }
      for (var i = 0; i < range_size - this.length - range_min - 1; i++) {
        paths.push(this.file_paths[i]);
      }
    } else {
      labels = this.file_labels.get(1, $M.colon(range_min, range_min + range_size - 1));
      for (var i = range_min - 1; i < range_min + range_size - 1; i++) {
        paths.push(this.file_paths[i]);
      }
    }

    var img_bufs = [];
    var read_count = 0;
    var read_and_store = function (i, path) {
      fs.readFile(path, function (err, data) {
        if (err) {
          throw err;
        }
        process_loaded_data(i, data);
      });
    };

    var jpg_format = { format: this.grayscale ? jpg.FORMAT_GRAY : jpg.FORMAT_RGB };

    var process_loaded_data = function (i, data) {
      img_bufs[i] = jpg.decompressSync(data, jpg_format);
      read_count++;
      if (read_count == range_size) {
        generate_mat();
      }
    };

    var generate_mat = function () {
      var width = img_bufs[0].width;
      var height = img_bufs[0].height;
      var n_channel = this.grayscale ? 1 : 3;
      var data = new Float32Array(width * height * n_channel * range_size);//[ch, w, h, n]
      for (var i = 0; i < range_size; i++) {
        data.set(img_bufs[i].data, i * width * height * n_channel);
      }
      var mat_cwhn = $M.typedarray2mat([n_channel, width, height, range_size], 'single', data);
      var mat_hwcn = $M.permute(mat_cwhn, [3, 2, 1, 4]);//[h, w, ch, n]
      callback([mat_hwcn, labels]);
    };

    for (var i = 0; i < paths.length; i++) {
      read_and_store(i, paths[i]);
    }
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = ImageLoadLayer;
