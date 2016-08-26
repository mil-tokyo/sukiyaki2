import $M = require('milsushi2');
import ForwardConfiguration = require('../forward_configuration');
import Layer = require('./layer');

class DropoutLayer extends Layer {
  dropout_ratio: number;
  private mask: $M.Matrix;
  private rndcache: $M.Matrix;

  constructor(params: any) {
    super();
    this.dropout_ratio = params.dropout_ratio;
    if (!(this.dropout_ratio >= 0.0 && this.dropout_ratio < 1.0)) {
      throw Error('dropout_ratio must be 0 <= dropout_ratio < 1');
    }
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var output: $M.Matrix;
    if (config.phase == 'train') {
      if (config.devicetype == 'cl') {
        if (this.rndcache && $M.numel(this.rndcache) != $M.numel(data)) {
          //discard cache
          this.rndcache.destruct();
          this.rndcache = null;
        }

        if (!this.rndcache) {
          //initialize random value
          this.rndcache = cl_init_random($M.sizejsa(data));
        }

        // update random value and make mask
        this.mask = cl_update_random(this.rndcache, this.dropout_ratio);
        output = $M.times(data, this.mask);
      } else {
        var [m, o] = $M.autodestruct(() => {
          // mask = Bernoulli distribution * scale
          var mask = $M.rand($M.size(data));
          mask = $M.ge(mask, this.dropout_ratio);
          mask = $M.times(mask, 1.0 / (1.0 - this.dropout_ratio));
          var out = $M.times(mask, data);
          return [mask, out];
        });
        this.mask = m;
        output = o;
      }
    } else {
      output = data.copy();
    }
    setImmediate(function () {
      callback([output]);
    });
  }

  backward(bottoms: $M.Matrix[], top_deltas: $M.Matrix[], config: ForwardConfiguration, callback: (bottom_deltas: $M.Matrix[]) => void): void {
    var data: $M.Matrix = bottoms[0];
    var top_delta: $M.Matrix = top_deltas[0];

    let bottom_delta: $M.Matrix;
    if (config.phase == 'train') {
      bottom_delta = $M.times(top_delta, this.mask);
    } else {
      bottom_delta = top_delta.copy();
    }


    setImmediate(function () {
      callback([bottom_delta]);
    });
  }

  release(): void {
    if (this.mask) {
      this.mask.destruct();
      this.mask = null;
    }
  }

  destruct(): void {
    if (this.rndcache) {
      this.rndcache.destruct();
      this.rndcache = null;
    }
  }
}

export = DropoutLayer;

var cl_init_random_kernel: any = null;
function cl_init_random(sizejsa: number[]): $M.Matrix {
  if (!cl_init_random_kernel) {
    //single thread xorshift96
    cl_init_random_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global int *rnd, uint length, uint x, uint y, uint z)',
      '{',
      'uint i = get_global_id(0);',
      'if (i > 0) {return;}',
      'uint t;',
      'for (uint j = 0; j < length; j++) {',
      '  t = (x ^ (x << 3)) ^ (y ^ (y >> 19)) ^ (z ^ (z << 6));',
      '  x = y; y = z; z = t;',
      '  rnd[j] = (int)t;',
      '}',
      '}'].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  var rnd = new $M.CL.MatrixCL(sizejsa, 'int32');
  $M.CL.executeKernel(cl_init_random_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: rnd },
    { datum: $M.numel(rnd), type: WebCL.type.UINT },
    { datum: Math.random() * 2147483648 | 0, type: WebCL.type.UINT },
    { datum: Math.random() * 2147483648 | 0, type: WebCL.type.UINT },//channels
    { datum: Math.random() * 2147483648 | 0, type: WebCL.type.UINT }
  ], 32, 32);
  return rnd;
}

var cl_update_random_kernel: any = null;
function cl_update_random(rnd: $M.Matrix, dropout_ratio: number): $M.Matrix {
  if (!cl_update_random_kernel) {
    //multi thread xorshift32
    cl_update_random_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *mask, __global int *rnd, uint length, float dropout_ratio)',
      '{',
      'uint i = get_global_id(0);',
      'if (i >= length) {return;}',
      'uint y = (uint)rnd[i];',
      'y = y ^ (y << 13); y = y ^ (y >> 17); y = y ^ (y << 5);',
      'rnd[i] = (int)y;',
      'if ((float)y > dropout_ratio * 4294967296.0F) {',
      '  mask[i] = 1.0F / (1.0F - dropout_ratio);',
      '} else {',
      '  mask[i] = 0.0F;',
      '}',
      '}'].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  var mask = new $M.CL.MatrixCL($M.sizejsa(rnd), 'single');
  var numel = $M.numel(mask);
  $M.CL.executeKernel(cl_update_random_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: mask },
    { access: WebCL.MEM_READ_WRITE, datum: rnd },
    { datum: numel, type: WebCL.type.UINT },
    { datum: dropout_ratio, type: WebCL.type.FLOAT }
  ], numel);
  return mask;
}
