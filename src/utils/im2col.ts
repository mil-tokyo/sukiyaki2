// utility for convolution / pooling of 2d image
// based on chainer's conv.py implementation

import $M = require('milsushi2');

export function conv_outsize(size: number, k: number, s: number, p: number, cover_all: boolean): number {
  if (cover_all) {
    return Math.floor((size + p * 2 - k + s - 1) / s) + 1
  } else {
    return Math.floor((size + p * 2 - k) / s) + 1
  }
}

export function im2col_cpu(img: $M.Matrix, ksize: number[], stride: number[], pad: number[], pad_val: number = 0, cover_all: boolean = false): $M.Matrix {
  var h: number, w: number, c: number, n: number;
  var img_size = $M.sizejsa(img);
  h = img_size[0];
  w = img_size[1];
  c = img_size[2] || 1;//maybe img_size.length < 4
  n = img_size[3] || 1;

  var [kh, kw] = ksize;
  var [sy, sx] = stride;
  var [ph, pw] = pad;

  var out_h = conv_outsize(h, kh, sy, ph, cover_all);
  var out_w = conv_outsize(w, kw, sx, pw, cover_all);

  var col = $M.zeros(out_h, out_w, kh, kw, c, n);

  var padded_img = $M.zeros(h + ph * 2 + sy - 1, w + pw * 2 + sx - 1, c, n);
  if (pad_val) {
    padded_img.set($M.colon(), pad_val);
  }
  padded_img.set($M.colon(ph + 1, ph + h), $M.colon(pw + 1, pw + w), $M.colon(), $M.colon(), img);
  for (var i = 1; i <= kw; i++) {
    var i_lim = i + sx * out_w - 1;
    for (var j = 1; j <= kh; j++) {
      var j_lim = j + sy * out_h - 1;
      var kern_view = padded_img.get($M.colon(j, sy, j_lim), $M.colon(i, sx, i_lim), $M.colon(), $M.colon());
      kern_view.reshape_inplace(out_h, out_w, 1, 1, c, n);
      col.set($M.colon(), $M.colon(), j, i, $M.colon(), $M.colon(), kern_view);
      kern_view.destruct();
    }
  }
  padded_img.destruct();
  return col;
}

var im2col_gpu_kernel: any = null;

export function im2col_cl(img: $M.Matrix, ksize: number[], stride: number[], pad: number[], pad_val: number = 0, cover_all: boolean = false): $M.Matrix {
  var h: number, w: number, c: number, n: number;
  var img_size = $M.sizejsa(img);
  h = img_size[0];
  w = img_size[1];
  c = img_size[2] || 1;//maybe img_size.length < 4
  n = img_size[3] || 1;

  var [kh, kw] = ksize;
  var [sy, sx] = stride;
  var [ph, pw] = pad;

  var out_h = conv_outsize(h, kh, sy, ph, cover_all);
  var out_w = conv_outsize(w, kw, sx, pw, cover_all);

  var col = $M.zeros(out_h, out_w, kh, kw, c, n, 'gpuArray');

  if (!im2col_gpu_kernel) {
    im2col_gpu_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *col, __global float *img,',
      'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, float pad_val, uint length)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'int out_y = i % out_h;',
      'int out_x = i / out_h % out_w;',
      'int ky = i / (out_h * out_w) % kh;',
      'int kx = i / (out_h * out_w * kh) % kw;',
      'int iny = ky + out_y * sy - ph;',
      'int inx = kx + out_x * sx - pw;',
      'if (iny < 0 || iny >= h || inx < 0 || inx >= w) {',
      'for (int c = 0; c < ch; c++) {',
      '  for (int batch = 0; batch < n; batch++) {',
      '    col[i + (c + (batch) * ch) * out_h * out_w * kh * kw] = pad_val;',
      '  }',
      '}',
      '} else {',
      'for (int c = 0; c < ch; c++) {',
      '  for (int batch = 0; batch < n; batch++) {',
      '    col[i + (c + (batch) * ch) * out_h * out_w * kh * kw] = img[iny + (inx + (c + (batch) * ch) * w) * h];',
      '  }',
      '}',
      '}',
      '}'
    ].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  $M.CL.executeKernel(im2col_gpu_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: col },
    { access: WebCL.MEM_READ_ONLY, datum: img },
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
    { datum: pad_val, type: WebCL.type.FLOAT },
    { datum: out_h * out_w * kh * kw, type: WebCL.type.UINT }
  ], out_h * out_w * kh * kw);

  return col;
}

var im2col_perm_gpu_kernel: any = null;

export function im2col_cl_perm(img: $M.Matrix, ksize: number[], stride: number[], pad: number[], pad_val: number = 0, cover_all: boolean = false): $M.Matrix {
  var h: number, w: number, c: number, n: number;
  var img_size = $M.sizejsa(img);
  h = img_size[0];
  w = img_size[1];
  c = img_size[2] || 1;//maybe img_size.length < 4
  n = img_size[3] || 1;

  var [kh, kw] = ksize;
  var [sy, sx] = stride;
  var [ph, pw] = pad;

  var out_h = conv_outsize(h, kh, sy, ph, cover_all);
  var out_w = conv_outsize(w, kw, sx, pw, cover_all);

  var col = $M.zeros(out_h, out_w, n, kh, kw, c, 'gpuArray');

  if (!im2col_perm_gpu_kernel) {
    im2col_perm_gpu_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *col, __global float *img,',
      'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, float pad_val, uint length)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'int out_y = i % out_h;',
      'int out_x = i / out_h % out_w;',
      'int ky = i / (out_h * out_w) % kh;',
      'int kx = i / (out_h * out_w * kh) % kw;',
      'int iny = ky + out_y * sy - ph;',
      'int inx = kx + out_x * sx - pw;',
      'if (iny < 0 || iny >= h || inx < 0 || inx >= w) {',
      'for (int c = 0; c < ch; c++) {',
      '  for (int batch = 0; batch < n; batch++) {',
      '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = pad_val;',
      '  }',
      '}',
      '} else {',
      'for (int c = 0; c < ch; c++) {',
      '  for (int batch = 0; batch < n; batch++) {',
      '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = img[iny + (inx + (c + (batch) * ch) * w) * h];',
      '  }',
      '}',
      '}',
      '}'
    ].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  $M.CL.executeKernel(im2col_perm_gpu_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: col },
    { access: WebCL.MEM_READ_ONLY, datum: img },
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
    { datum: pad_val, type: WebCL.type.FLOAT },
    { datum: out_h * out_w * kh * kw, type: WebCL.type.UINT }
  ], out_h * out_w * kh * kw);

  return col;
}

export function col2im_cpu(col: $M.Matrix, stride: number[], pad: number[], size: number[]): $M.Matrix {
  var h: number, w: number;
  h = size[0];
  w = size[1];
  var out_h: number, out_w: number, kh: number, kw: number, c: number, n: number;
  var col_shape = $M.sizejsa(col);
  out_h = col_shape[0];
  out_w = col_shape[1];
  kh = col_shape[2] || 1;
  kw = col_shape[3] || 1;
  c = col_shape[4] || 1;
  n = col_shape[5] || 1;
  var [sy, sx] = stride;
  var [ph, pw] = pad;

  var padded_img = $M.zeros(h + 2 * ph + sy - 1, w + 2 * pw + sx - 1, c, n);
  for (var i = 1; i <= kw; i++) {
    var i_lim = i + sx * out_w - 1;
    for (var j = 1; j <= kh; j++) {
      var j_lim = j + sy * out_h - 1;
      var col_view = col.get($M.colon(), $M.colon(), j, i, $M.colon(), $M.colon());
      col_view.reshape_inplace(out_h, out_w, c, n);
      var pad_view = padded_img.get($M.colon(j, sy, j_lim), $M.colon(i, sx, i_lim), $M.colon(), $M.colon());
      padded_img.set($M.colon(j, sy, j_lim), $M.colon(i, sx, i_lim), $M.colon(), $M.colon(),
        $M.plus(col_view, pad_view));
      col_view.destruct();
      pad_view.destruct();
    }
  }
  var img = padded_img.get($M.colon(ph + 1, ph + h), $M.colon(pw + 1, pw + w), $M.colon(), $M.colon());
  padded_img.destruct();
  return img;
}

var col2im_gpu_kernel: any = null;

export function col2im_cl(col: $M.Matrix, stride: number[], pad: number[], size: number[]): $M.Matrix {
  var h: number, w: number;
  h = size[0];
  w = size[1];
  var out_h: number, out_w: number, kh: number, kw: number, c: number, n: number;
  var col_shape = $M.sizejsa(col);
  out_h = col_shape[0];
  out_w = col_shape[1];
  kh = col_shape[2] || 1;
  kw = col_shape[3] || 1;
  c = col_shape[4] || 1;
  n = col_shape[5] || 1;
  var [sy, sx] = stride;
  var [ph, pw] = pad;

  var img = $M.zeros(h, w, c, n, 'gpuArray');
  if (!col2im_gpu_kernel) {
    col2im_gpu_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *col, __global float *img,',
      'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, uint length)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'int iny = i % h;',
      'int inx = i / h % w;',
      'int c = i / (h * w) % ch;',
      'int batch = i / (h * w * ch) % n;',
      'float sum = 0.0F;',
      'for (int j = 0; j < kh; j++) {',
      '  int out_y = iny + ph - j;',
      '  if (out_y % sy != 0) { continue; }',
      '  out_y /= sy;',
      '  if (out_y < 0 || out_y >= out_h) { continue; }',
      '  for (int i = 0; i < kw; i++) {',
      '    int out_x = inx + pw - i;',
      '    if (out_x % sx != 0) { continue; }',
      '    out_x /= sx;',
      '    if (out_x < 0 || out_x >= out_w) { continue; }',
      '    sum += col[out_y + (out_x + (j + (i + (c + (batch) * ch) * kw) * kh) * out_w) * out_h];',
      '  }',
      '}',
      'img[i] = sum;',
      '}'
    ].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  $M.CL.executeKernel(col2im_gpu_kernel, [
    { access: WebCL.MEM_READ_ONLY, datum: col },
    { access: WebCL.MEM_WRITE_ONLY, datum: img },
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
    { datum: h * w * c * n, type: WebCL.type.UINT }
  ], h * w * c * n);
  return img;
}

var col2im_perm_gpu_kernel: any = null;

export function col2im_cl_perm(col: $M.Matrix, stride: number[], pad: number[], size: number[]): $M.Matrix {
  var h: number, w: number;
  h = size[0];
  w = size[1];
  var out_h: number, out_w: number, kh: number, kw: number, c: number, n: number;
  var col_shape = $M.sizejsa(col);
  out_h = col_shape[0];
  out_w = col_shape[1];
  n = col_shape[2] || 1;
  kh = col_shape[3] || 1;
  kw = col_shape[4] || 1;
  c = col_shape[5] || 1;
  var [sy, sx] = stride;
  var [ph, pw] = pad;

  var img = $M.zeros(h, w, c, n, 'gpuArray');
  if (!col2im_perm_gpu_kernel) {
    col2im_perm_gpu_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *col, __global float *img,',
      'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, uint length)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'int iny = i % h;',
      'int inx = i / h % w;',
      'int c = i / (h * w) % ch;',
      'int batch = i / (h * w * ch) % n;',
      'float sum = 0.0F;',
      'for (int j = 0; j < kh; j++) {',
      '  int out_y = iny + ph - j;',
      '  if (out_y % sy != 0) { continue; }',
      '  out_y /= sy;',
      '  if (out_y < 0 || out_y >= out_h) { continue; }',
      '  for (int i = 0; i < kw; i++) {',
      '    int out_x = inx + pw - i;',
      '    if (out_x % sx != 0) { continue; }',
      '    out_x /= sx;',
      '    if (out_x < 0 || out_x >= out_w) { continue; }',
      '    sum += col[out_y + (out_x + (batch + (j + (i + (c) * kw) * kh) * n) * out_w) * out_h];',
      '  }',
      '}',
      'img[i] = sum;',
      '}'
    ].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  $M.CL.executeKernel(col2im_perm_gpu_kernel, [
    { access: WebCL.MEM_READ_ONLY, datum: col },
    { access: WebCL.MEM_WRITE_ONLY, datum: img },
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
    { datum: h * w * c * n, type: WebCL.type.UINT }
  ], h * w * c * n);
  return img;
}
