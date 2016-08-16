import $M = require('milsushi2');
import Layer = require('./layer');
import ForwardConfiguration = require('../forward_configuration');

class DataAugmentationLayer extends Layer {
  out_shape: number[];
  data_mean: $M.Matrix;
  scale: number;
  random_crop: boolean;
  random_flip: boolean;
  input_klass: string;

  constructor(params: any) {
    super();
    this.need_update = false;
    this.out_shape = params.out_shape;//[h, w]
    this.scale = params.scale || 0.0;
    this.random_crop = Boolean(params.random_crop);
    this.random_flip = Boolean(params.random_flip);
    this.input_klass = params.input_klass || 'single';
    switch (this.input_klass) {
      case 'single':
      case 'uint8':
        break;
      default:
        throw new Error('Unsupported input_klass');
    }
    this.data_mean = null;
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  set_data_mean(data_mean: $M.Matrix): void {
    if (this.data_mean) {
      this.data_mean.destruct();
      this.data_mean = null;
    }

    if (data_mean) {// null means no subtraction
      this.data_mean = data_mean.copy('single');
    }
  }

  private _get_data_mean(devicetype: string): $M.Matrix {
    // data mean with proper devicetype
    var data_mean = this.data_mean;
    if (data_mean) {
      if ($M.devicetype(data_mean) != devicetype) {
        // change type
        var new_data_mean;
        if (devicetype == 'cl') {
          new_data_mean = $M.gpuArray(data_mean);
        } else {
          new_data_mean = $M.gather(data_mean);
        }
        data_mean.destruct();
        this.data_mean = new_data_mean;
        return new_data_mean;
      } else {
        return data_mean;
      }
    } else {
      return null;
    }
  }

  forward(bottoms: $M.Matrix[], config: ForwardConfiguration, callback: (tops: $M.Matrix[]) => void): void {
    // input: h, w, c, n
    var data: $M.Matrix = bottoms[0];
    var data_shape = $M.sizejsa(data);
    var in_h = data_shape[0];
    var in_w = data_shape[1];
    var c = data_shape[2] || 1;
    var n = data_shape[3] || 1;
    var [out_h, out_w] = this.out_shape;

    if ($M.klass(data) != this.input_klass) {
      throw new Error('klass mismatch between params.input_klass and actual input');
    }

    var top: $M.Matrix;
    if (config.devicetype == 'cl') {
      top = $M.zeros(out_h, out_w, c, n, 'gpuArray');
      var WebCL = $M.CL.WebCL;
      $M.CL.executeKernel(this.get_kernel(), [
        { access: WebCL.MEM_WRITE_ONLY, datum: top },
        { access: WebCL.MEM_READ_ONLY, datum: data },
        { access: WebCL.MEM_READ_ONLY, datum: this.data_mean || data },//dummy data for avoid null pointer
        { datum: this.data_mean ? 1 : 0, type: WebCL.type.INT },
        { datum: out_h, type: WebCL.type.INT },
        { datum: out_w, type: WebCL.type.INT },
        { datum: in_h, type: WebCL.type.INT },
        { datum: in_w, type: WebCL.type.INT },
        { datum: c, type: WebCL.type.INT },
        { datum: n, type: WebCL.type.INT },
        { datum: this.scale, type: WebCL.type.FLOAT },
        { datum: Math.random() * 2147483648 | 0, type: WebCL.type.UINT }
      ], out_h * out_w * c * n);
    } else {
      top = $M.zeros(out_h, out_w, c, n);
      var rnd = Math.random;
      var data_mean = this.data_mean;
      var scale = this.scale;
      var random_flip = this.random_flip;
      var random_crop = this.random_crop;

      for (var i = 1; i <= n; i++) {
        var crop_t: number;
        var crop_l: number;
        if (random_crop) {
          crop_t = ((in_h - out_h + 1) * rnd() | 0) + 1;// 1 to (in_h - out_h + 1)
          crop_l = ((in_w - out_w + 1) * rnd() | 0) + 1;
        } else {
          crop_t = ((in_h - out_h) / 2 | 0) + 1;
          crop_l = ((in_w - out_w) / 2 | 0) + 1;
        }
        var colon_x = (random_flip && rnd() > 0.5) ? $M.colon(crop_l + out_w - 1, -1, crop_l) : $M.colon(crop_l, crop_l + out_w - 1);//mirror
        $M.autodestruct(() => {
          var img = data.get($M.colon(), $M.colon(), $M.colon(), i);
          if (data_mean) {
            img = $M.minus(img, data_mean);
          }
          img = $M.times(img, scale);
          top.set($M.colon(), $M.colon(), $M.colon(), i, img.get($M.colon(crop_t, crop_t + out_h - 1), colon_x, $M.colon()));
        });
      }
    }

    setImmediate(function () {
      callback([top]);
    });
  }

  private augmentation_kernel: any;
  private get_kernel(): any {
    if (!this.augmentation_kernel) {
      var src_type: string;
      switch (this.input_klass) {
        case 'single':
          src_type = 'float';
          break;
        case 'uint8':
          src_type = 'uchar';
          break;
      }
      this.augmentation_kernel = $M.CL.createKernel([
        '#define RANDOM_CROP ' + Number(this.random_crop),
        '#define RANDOM_FLIP ' + Number(this.random_flip),
        '#define SRC_TYPE ' + src_type,
        '__kernel void kernel_func(__global float *dst, __global const SRC_TYPE *src, __global const float *mean, int minus_mean,',
        'int out_h, int out_w, int in_h, int in_w, int c, int n, float scale, uint randseed)',
        '{',
        'uint i = get_global_id(0);',
        'int out_y = i % out_h;',
        'int out_x = i / out_h % out_w;',
        'int out_c = i / (out_h * out_w) % c;',
        'int out_n = i / (out_h * out_w * c);',
        'if (out_n >= n) {return;}',
        'if (RANDOM_CROP || RANDOM_FLIP) {',
        // random for each n
        '  randseed += n;',
        '  randseed = randseed ^ (randseed << 13);',
        '  randseed = randseed ^ (randseed >> 17);',
        '  randseed = randseed ^ (randseed << 5);',
        '}',
        'int crop_y, crop_x;',
        'if (RANDOM_CROP) {',
        '  crop_y = randseed / 2 % (in_h - out_h + 1);',
        '  crop_x = randseed / 2 / (in_h - out_h + 1) % (in_w - out_w + 1);',
        '} else {',
        '  crop_y = (in_h - out_h) / 2;',
        '  crop_x = (in_w - out_w) / 2;',
        '}',
        'int sx = 1;',
        'if (RANDOM_FLIP) {',
        '  if (randseed % 2 == 0) {',
        '    sx = -1;',//invert stride
        '    crop_x = in_w - crop_x - 1;',
        '  }',
        '}',
        'int src_offset = crop_y + out_y + (crop_x + out_x * sx + (out_c + (out_n) * c) * in_w) * in_h;',
        'int mean_offset = crop_y + out_y + (crop_x + out_x * sx + (out_c) * in_w) * in_h;',
        'float dst_val = src[src_offset];',
        'if (minus_mean) {',
        '  dst_val -= mean[mean_offset];',
        '}',
        'dst_val *= scale;',
        'dst[i] = dst_val;',
        '}'
      ].join('\n'));
    }

    return this.augmentation_kernel;
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = DataAugmentationLayer;
