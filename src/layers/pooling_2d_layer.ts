// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');
import im2col = require('../utils/im2col');
import ArrayHelper = require('../utils/array_helper');

var max_pooling_backward_gpu_kernel: any = null;

class Pooling2DLayer extends Layer {
  pooling_type: string;
  ksize: number[];
  stride: number[];
  pad: number[];
  top_pos: $M.Matrix;
  // true if stride < ksize. If false, efficient backward kernel can be used.
  private _is_window_overlap: boolean;
  constructor(params: any) {
    super();

    this.pooling_type = params.type;
    this.ksize = ArrayHelper.repeat_scalar(params.ksize, 2);//kernel size [3,3]
    this.stride = ArrayHelper.repeat_scalar(params.stride, 2);
    this.pad = ArrayHelper.repeat_scalar(params.pad, 2);
    this._is_window_overlap = (this.stride[0] < this.ksize[0]) || (this.stride[1] < this.ksize[1]);
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
    var top: $M.Matrix, top_pos: $M.Matrix;
    try{
    if (config.devicetype == 'cl') {
      var t_tp = cl_max_forward(this, data);
      top = t_tp.top;
      top_pos = t_tp.top_pos;
    } else {
      [top, top_pos] = $M.autodestruct(() => {
        var col: $M.Matrix;
        col = im2col.im2col_cpu(data, this.ksize, this.stride, this.pad, -Infinity, true);
        col.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 3) * $M.size(col, 4), $M.size(col, 5), $M.size(col, 6));
        var amax = $M.argmax(col, null, 3);
        var output = amax.M;
        output.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 4), $M.size(col, 5));
        return [output, amax.I];
      });
    }
    this.top_pos = top_pos;
    }catch(ex){
      console.log('forward ', ex);
    }
    setImmediate(function () {
      callback([top]);
    });
  }

  forward_average(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];// (h, w, c, n)
    var n = $M.size(data, 4);
    var top = $M.autodestruct(() => {
      var col: $M.Matrix;
      if (config.devicetype == 'cl') {
        col = im2col.im2col_cl(data, this.ksize, this.stride, this.pad);
      } else {
        col = im2col.im2col_cpu(data, this.ksize, this.stride, this.pad);
      }
      col.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 3) * $M.size(col, 4), $M.size(col, 5), $M.size(col, 6));
      var avg = $M.mean(col, 3);
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

    var bottom_delta: $M.Matrix;
    try{
    if (config.devicetype == 'cl') {
      let h = $M.size(bottom, 1), w = $M.size(bottom, 2);
      bottom_delta = cl_max_backward_overlap(this, h, w, top_delta, this.top_pos);
    } else {
      bottom_delta = $M.autodestruct(() => {
        var top_pos = this.top_pos;
        var out_h = $M.size(top_pos, 1);
        var out_w = $M.size(top_pos, 2);
        var in_size = $M.size(bottom, 3);
        var n = $M.size(bottom, 4);
        var delta_col: $M.Matrix;
        var bottom_delta: $M.Matrix;
        delta_col = $M.zeros(out_h, out_w, this.ksize[0] * this.ksize[1], in_size, n);
        //very slow
        for (var y = 1; y <= out_h; y++) {
          for (var x = 1; x <= out_w; x++) {
            for (var c = 1; c <= in_size; c++) {
              for (var batch = 1; batch <= n; batch++) {
                delta_col.set(y, x, top_pos.get(y, x, 1, c, batch), c, batch,
                  top_delta.get(y, x, c, batch)
                );
              }
            }
          }
        }
        delta_col.reshape_inplace(out_h, out_w, this.ksize[0], this.ksize[1], in_size, n);
        bottom_delta = im2col.col2im_cpu(delta_col, this.stride, this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);

        return bottom_delta;
      });
    }
    }catch(ex){
      console.log('backward ', ex);
    }

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
      var bottom_delta: $M.Matrix;

      if (config.devicetype == 'cl') {
        bottom_delta = im2col.col2im_cl(delta_col, this.stride, this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
      } else {
        bottom_delta = im2col.col2im_cpu(delta_col, this.stride, this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
      }
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

var cl_max_forward_kernel: any = null;
function cl_max_forward(layer: Pooling2DLayer, bottom: $M.Matrix): { top: $M.Matrix, top_pos: $M.Matrix } {
  if (!cl_max_forward_kernel) {
    cl_max_forward_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *top, __global int *top_pos, __global float *img,',
      'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, uint length)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'int out_y = i % out_h;',
      'int out_x = i / out_h % out_w;',
      'int c = i / (out_h * out_w) % ch;',
      'int batch = i / (out_h * out_w * ch) % n;',
      'float max_val = -MAXFLOAT;',
      'int max_idx = 0;',
      'for (int kx = 0; kx < kw; kx++) {',
      'for (int ky = 0; ky < kh; ky++) {',
      'int iny = ky + out_y * sy - ph;',
      'int inx = kx + out_x * sx - pw;',
      'if (iny >= 0 && iny < h && inx >= 0 && inx < w) {',
      '    int src_idx = iny + (inx + (c + (batch) * ch) * w) * h;',
      '    float val = img[src_idx];',
      '    if (val > max_val) {',
      '      max_val = val;',
      '      max_idx = src_idx;',
      '    }',
      '}',
      '}',
      '}',
      'top[i] = max_val;',
      'top_pos[i] = max_idx;',
      '}'
    ].join('\n'));
  }

  var h: number, w: number, c: number, n: number;
  var img_size = $M.sizejsa(bottom);
  h = img_size[0];
  w = img_size[1];
  c = img_size[2] || 1;//maybe img_size.length < 4
  n = img_size[3] || 1;
  var [kh, kw] = layer.ksize;
  var [sy, sx] = layer.stride;
  var [ph, pw] = layer.pad;
  var out_h = im2col.conv_outsize(h, kh, sy, ph, true);
  var out_w = im2col.conv_outsize(w, kw, sx, pw, true);
  var WebCL = $M.CL.WebCL;
  var top = new $M.CL.MatrixCL([out_h, out_w, c, n], 'single');
  var top_pos = new $M.CL.MatrixCL([out_h, out_w, c, n], 'int32');
  $M.CL.executeKernel(cl_max_forward_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: top },
    { access: WebCL.MEM_WRITE_ONLY, datum: top_pos },
    { access: WebCL.MEM_READ_ONLY, datum: bottom },
    { datum: out_h, type: WebCL.type.INT },
    { datum: out_w, type: WebCL.type.INT },
    { datum: kh, type: WebCL.type.INT },
    { datum: kw, type: WebCL.type.INT },
    { datum: sy, type: WebCL.type.INT },
    { datum: sx, type: WebCL.type.INT },
    { datum: ph, type: WebCL.type.INT },
    { datum: pw, type: WebCL.type.INT },
    { datum: c, type: WebCL.type.INT },
    { datum: n, type: WebCL.type.INT },
    { datum: h, type: WebCL.type.INT },
    { datum: w, type: WebCL.type.INT },
    { datum: out_h * out_w * c * n, type: WebCL.type.UINT }
  ], out_h * out_w * c * n, 256);
  return { top: top, top_pos: top_pos };
}

var cl_max_backward_overlap_kernel: any = null;
function cl_max_backward_overlap(layer: Pooling2DLayer, h: number, w: number, top_delta: $M.Matrix, top_pos: $M.Matrix): $M.Matrix {
  if (!cl_max_backward_overlap_kernel) {
    cl_max_backward_overlap_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *bottom_delta, __global const float *top_delta, __global const int *top_pos,',
      'int out_area, uint length)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'uint ofs = i * out_area;',
      'for (int j = 0; j < out_area; j++) {',
      '  bottom_delta[top_pos[ofs+j]] += top_delta[ofs+j];',
      '}',
      '}'
    ].join('\n'));
  }

  var out_h: number, out_w: number, c: number, n: number;
  var img_size = $M.sizejsa(top_delta);
  out_h = img_size[0];
  out_w = img_size[1];
  c = img_size[2] || 1;//maybe img_size.length < 4
  n = img_size[3] || 1;
  var WebCL = $M.CL.WebCL;
  var bottom_delta = $M.zeros(h, w, c, n, 'gpuArray');
  $M.CL.executeKernel(cl_max_backward_overlap_kernel, [
    { access: WebCL.MEM_READ_WRITE, datum: bottom_delta },
    { access: WebCL.MEM_READ_ONLY, datum: top_delta },
    { access: WebCL.MEM_READ_ONLY, datum: top_pos },
    { datum: out_h * out_w, type: WebCL.type.INT },
    { datum: c * n, type: WebCL.type.UINT }
  ], c * n, 256);
  return bottom_delta;
}
