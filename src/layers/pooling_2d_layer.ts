import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');
import im2col = require('../utils/im2col');

class Pooling2DLayer extends Layer {
  pooling_type: string;
  ksize: number[];
  stride: number[];
  pad: number[];
  top_pos: $M.Matrix;
  constructor(params: any) {
    super();

    this.pooling_type = params.type;
    this.ksize = params.ksize;//kernel size [3,3]
    this.stride = params.stride;
    this.pad = params.pad;
    switch (this.pooling_type) {
      case 'max':
        this.forward = this.forward_max;
        this.backward = this.backward_max;
        break;
      case 'average':
        this.forward = this.forward_average;
        this.backward = this.backward_average;
        break;
      default:
        throw Error('Unknown pooling_type');
        break;
    }
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
  }

  forward_max(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    var n = $M.size(data, 4);
    var [top, top_pos] = $M.autodestruct(() => {
      var col = im2col.im2col_cpu(data, this.ksize, this.stride, this.pad, -Infinity, true);
      col.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 3) * $M.size(col, 4), $M.size(col, 5), $M.size(col, 6));
      var amax = $M.argmax(col, null, 3);
      var output = amax.M;
      output.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 4), $M.size(col, 5));
      return [output, amax.I];
    });
    this.top_pos = top_pos;

    setImmediate(function () {
      callback([top]);
    });
  }

  forward_average(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    var n = $M.size(data, 4);
    var top = $M.autodestruct(() => {
      var col = im2col.im2col_cpu(data, this.ksize, this.stride, this.pad);
      col.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 3) * $M.size(col, 4), $M.size(col, 5), $M.size(col, 6));
      var sum = $M.sum(col, 3);//TODO: use mean function
      var avg = $M.times(sum, 1 / (this.ksize[0] * this.ksize[1]));
      avg.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 4), $M.size(col, 5));
      return avg;
    });

    setImmediate(function () {
      callback([top]);
    });
  }


  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
  }

  backward_max(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var top_delta = top_deltas[0];
    var bottom = bottoms[0];
    var bottom_delta = $M.autodestruct(() => {
      var top_pos = this.top_pos;
      var out_h = $M.size(top_pos, 1);
      var out_w = $M.size(top_pos, 2);
      var in_size = $M.size(bottom, 3);
      var n = $M.size(bottom, 4);
      var delta_col = $M.zeros(out_h, out_w, this.ksize[0] * this.ksize[1], in_size, n);
      //very slow
      for (var y = 1; y <= out_h; y++) {
        for (var x = 1; x <= out_w; x++) {
          for (var c = 1; c <= in_size; c++) {
            for (var batch = 1; batch <= n; batch++) {
              delta_col.set(y, x, top_pos.get(y, x, 1, c, batch), c, batch,
                top_delta.get(y, x, c, batch)
              )

            }
          }
        }
      }
      delta_col.reshape_inplace(out_h, out_w, this.ksize[0], this.ksize[1], in_size, n);
      var bottom_delta = im2col.col2im_cpu(delta_col, this.stride, this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
      return bottom_delta;
    });

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  backward_average(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var top_delta = top_deltas[0];
    var bottom = bottoms[0];
    var bottom_delta = $M.autodestruct(() => {
      var out_h = $M.size(top_delta, 1);
      var out_w = $M.size(top_delta, 2);
      var in_size = $M.size(bottom, 3);
      var n = $M.size(bottom, 4);
      var top_delta_origsize = $M.size(top_delta);
      top_delta.reshape_inplace(out_h, out_w, 1, 1, in_size, n);
      var delta_col = $M.repmat(top_delta, 1, 1, this.ksize[0], this.ksize[1], 1, 1);
      top_delta.reshape_inplace(top_delta_origsize);
      var bottom_delta = im2col.col2im_cpu(delta_col, this.stride, this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
      bottom_delta = $M.times(bottom_delta, 1 / (this.ksize[0] * this.ksize[1]));
      return bottom_delta;
    });

    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  release(): void {
    if (this.top_pos) {
      this.top_pos.destruct();
      this.top_pos = null;
    }
  }

  destruct(): void {

  }
}

export = Pooling2DLayer;
