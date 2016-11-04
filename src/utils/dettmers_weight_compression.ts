// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
// implements weight / gradient compression in "8-Bit Approximations for Parallelism in Deep Learning" by Tom Dettmers (ICLR 2016)

import $M = require('milsushi2');

var constant_table: $M.Matrix = null;
function get_constant_table(): $M.Matrix {
  if (constant_table != null) {
    return constant_table;
  }
  var const_array = [2.750000021e-06, 7.249999726e-06, 1.875000089e-05, 3.624999954e-05, 5.874999624e-05, 8.624999464e-05, 1.437500032e-04, 2.312500001e-04, 3.187500115e-04, 4.062500084e-04, 5.187499919e-04, 6.562499912e-04, 7.937499322e-04, 9.312499315e-04, 1.218750025e-03, 1.656249980e-03,
  2.093750052e-03, 2.531250007e-03, 2.968749963e-03, 3.406249918e-03, 3.843750106e-03, 4.281249829e-03, 4.843750037e-03, 5.531250034e-03, 6.218749564e-03, 6.906249560e-03, 7.593749557e-03, 8.281249553e-03, 8.968749084e-03, 9.656248614e-03, 1.109374966e-02, 1.328125037e-02, 1.546875015e-02,
  1.765624993e-02, 1.984374970e-02, 2.203124948e-02, 2.421874925e-02, 2.640625089e-02, 2.859375067e-02, 3.078125045e-02, 3.296874836e-02, 3.515625000e-02, 3.734375164e-02, 3.953124955e-02, 4.171875119e-02, 4.390624911e-02, 4.671875015e-02, 5.015625060e-02, 5.359374732e-02, 5.703124776e-02,
  6.046874821e-02, 6.390624493e-02, 6.734374911e-02, 7.078124583e-02, 7.421874255e-02, 7.765624672e-02, 8.109374344e-02, 8.453124017e-02, 8.796874434e-02, 9.140624106e-02, 9.484373778e-02, 9.828124195e-02, 1.054687500e-01, 1.164062470e-01, 1.273437440e-01, 1.382812560e-01, 1.492187530e-01,
  1.601562500e-01, 1.710937470e-01, 1.820312440e-01, 1.929687560e-01, 2.039062530e-01, 2.148437500e-01, 2.257812470e-01, 2.367187440e-01, 2.476562560e-01, 2.585937381e-01, 2.695312500e-01, 2.804687619e-01, 2.914062440e-01, 3.023437560e-01, 3.132812381e-01, 3.242187500e-01, 3.351562619e-01,
  3.460937440e-01, 3.570312560e-01, 3.679687381e-01, 3.789062500e-01, 3.898437619e-01, 4.007812440e-01, 4.117187560e-01, 4.226562381e-01, 4.335937500e-01, 4.445312619e-01, 4.585937560e-01, 4.757812321e-01, 4.929687381e-01, 5.101562142e-01, 5.273437500e-01, 5.445312262e-01, 5.617187023e-01,
  5.789062381e-01, 5.960937142e-01, 6.132812500e-01, 6.304687262e-01, 6.476562023e-01, 6.648437381e-01, 6.820312142e-01, 6.992186904e-01, 7.164062262e-01, 7.335937023e-01, 7.507811785e-01, 7.679687142e-01, 7.851561904e-01, 8.023436666e-01, 8.195312023e-01, 8.367186785e-01, 8.539061546e-01,
  8.710936904e-01, 8.882811666e-01, 9.054686427e-01, 9.226561785e-01, 9.398436546e-01, 9.570311308e-01, 9.742186666e-01, 9.914061427e-01];
  var const_typedarray = new Float32Array(const_array);
  var table_cpu = $M.typedarray2mat([126, 1], 'single', const_typedarray);
  constant_table = $M.gpuArray(table_cpu);
  return constant_table;
}

var find_max_kernel_first: any = null;
var find_max_kernel_second: any = null;
var compress_kernel: any = null;
var decompress_kernel: any = null;
export function compress_8bit(weight_mat: $M.Matrix, dst_buf: ArrayBuffer, dst_offset: number, dst_size: number): void {
  var buf_view = new Uint8Array(dst_buf, dst_offset, dst_size);
  if (!compress_kernel) {
    find_max_kernel_first = $M.CL.createKernel([//get maximum in work group
      '__kernel void kernel_func(const __global float *weight_raw, __global float *wg_max, uint reduction_per_item, uint length)',
      '{',
      'uint group_id = get_group_id(0);',
      'uint local_id = get_local_id(0);',
      'uint local_size = get_local_size(0);',
      '__local float max_each_item[256];',
      'uint idx_top = (group_id + 1) * local_size * reduction_per_item;',
      'if (idx_top > length) {idx_top = length;}',
      'float item_max = 0.0F;',
      'for (uint idx = group_id * local_size * reduction_per_item + local_id; idx < idx_top; idx += local_size) {',
      '  float val = fabs(weight_raw[idx]);',
      '  if (val > item_max) {item_max = val;}',
      '}',
      'max_each_item[local_id] = item_max;',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      'if (local_id == 0) {',
      '  for (uint i = 1; i < local_size; i++) {',
      '    if (item_max < max_each_item[i]) {',
      '      item_max = max_each_item[i];',
      '    }',
      '  }',
      '  wg_max[group_id] = item_max;',
      '}',
      '}'].join('\n'));
    find_max_kernel_second = $M.CL.createKernel([//get global maximum and write to scale factor in weight_packed
      '__kernel void kernel_func(__global uchar *weight_packed, const __global float *wg_max, uint wg_length, uint weight_packed_offset)',
      '{',
      'uint i = get_global_id(0);',
      'if (i > 0) {return;}',
      'float item_max = 1e-20F;',
      'for (int wg_i = 0; wg_i < wg_length; wg_i++) {',
      '  if (wg_max[wg_i] > item_max) {item_max = wg_max[wg_i];}',
      '}',
      'uchar *item_max_view = (uchar*)&item_max;',
      'weight_packed[weight_packed_offset+0]=item_max_view[0];',
      'weight_packed[weight_packed_offset+1]=item_max_view[1];',
      'weight_packed[weight_packed_offset+2]=item_max_view[2];',
      'weight_packed[weight_packed_offset+3]=item_max_view[3];',
      '}'].join('\n'));
    compress_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global uchar *weight_packed, const __global float *weight_raw, const __global float *tbl_floats_global, uint size_per_item, uint length)',
      '{',
      'const float thres_low = 1.5e-6F, thres_high = 0.995703F;',
      '__local float tbl_floats[127];',
      'uint group_id = get_group_id(0);',
      'uint local_id = get_local_id(0);',
      'uint local_size = get_local_size(0);',
      'float maxval;',
      'if (local_id < 126) {tbl_floats[local_id] = tbl_floats_global[local_id];}',
      'else if (local_id == 126) {',
      '  uchar *item_max_view = (uchar*)&maxval;',
      '  item_max_view[0]=weight_packed[length+0];',
      '  item_max_view[1]=weight_packed[length+1];',
      '  item_max_view[2]=weight_packed[length+2];',
      '  item_max_view[3]=weight_packed[length+3];',
      '  tbl_floats[126] = maxval;',
      '}',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      'maxval = tbl_floats[126];',
      'uint idx_top = (group_id + 1) * local_size * size_per_item;',
      'if (idx_top > length) {idx_top = length;}',
      'for (uint idx = group_id * local_size * size_per_item + local_id; idx < idx_top; idx += local_size) {',
      '  float val = weight_raw[idx];',
      '  uchar signval;',
      '  float absnumber;',
      '  if (val >= 0.0F) {signval = 0; absnumber = val / maxval;} else {signval = 128; absnumber = -val / maxval;}',
      '  uchar code = 0;',
      '  if (absnumber < thres_low) {',
      '    code = 126;',
      '  } else if (absnumber > thres_high) {',
      '    code = 127;',
      '  } else {',
      '    int pivot = 63;',
      '    int upper_pivot = 125;',
      '    int lower_pivot = 0;',
      '    for(int j = 32; j > 0; j>>=1)',
      '    {',
      '      if(absnumber > tbl_floats[pivot])',
      '      {',
      '        lower_pivot = pivot;',
      '        pivot+=j;',
      '      }',
      '      else',
      '      {',
      '        upper_pivot = pivot;',
      '        pivot-=j;',
      '      }',
      '    }',
      '    if(lower_pivot == pivot){',
      '      if(fabs(tbl_floats[pivot]-absnumber) < (tbl_floats[upper_pivot]-absnumber))',
      '      {code = pivot;}',
      '      else',
      '      {code=upper_pivot;}',
      '    }else{',
      '      if((tbl_floats[pivot]-absnumber) < fabs(tbl_floats[lower_pivot]-absnumber))',
      '      {code=pivot;}',
      '      else',
      '      {code=lower_pivot;}',
      '    }',
      '  }',
      '  weight_packed[idx] = code + signval;',
      '}',
      '}'].join('\n'));
  }

  var data_count = $M.numel(weight_mat);
  var local_work_size = 256;
  var size_per_item = 256;
  var num_groups = Math.ceil(data_count / (local_work_size * size_per_item));
  var WebCL = $M.CL.WebCL;
  var tmp_wg_max = new $M.CL.MatrixCL([num_groups, 1], 'single');
  var weight_packed = new $M.CL.MatrixCL([data_count + 4, 1], 'uint8');
  $M.CL.executeKernel(find_max_kernel_first, [
    { access: WebCL.MEM_READ_ONLY, datum: weight_mat },
    { access: WebCL.MEM_WRITE_ONLY, datum: tmp_wg_max },
    { datum: size_per_item, type: WebCL.type.UINT },
    { datum: data_count, type: WebCL.type.UINT }
  ], [num_groups * local_work_size], [local_work_size]);
  $M.CL.executeKernel(find_max_kernel_second, [
    { access: WebCL.MEM_WRITE_ONLY, datum: weight_packed },
    { access: WebCL.MEM_READ_ONLY, datum: tmp_wg_max },
    { datum: num_groups, type: WebCL.type.UINT },
    { datum: data_count, type: WebCL.type.UINT }
  ], [1], [1]);
  $M.CL.executeKernel(compress_kernel, [
    { access: WebCL.MEM_READ_WRITE, datum: weight_packed },
    { access: WebCL.MEM_READ_ONLY, datum: weight_mat },
    { access: WebCL.MEM_READ_ONLY, datum: get_constant_table() },
    { datum: size_per_item, type: WebCL.type.UINT },
    { datum: data_count, type: WebCL.type.UINT }
  ], [num_groups * local_work_size], [local_work_size]);
  weight_packed.getdatacopy(null, null, buf_view);
  weight_packed.destruct();
  tmp_wg_max.destruct();
}

export function decompress_8bit(weight_mat: $M.Matrix, src_buf: ArrayBuffer, src_offset: number, src_size: number): void {
  var buf_view = new Uint8Array(src_buf, src_offset, src_size);
  if (!decompress_kernel) {
    decompress_kernel = $M.CL.createKernel([
      '__kernel void kernel_func(__global float *weight_raw, __global uchar *weight_packed, const __global float *tbl_floats_global, uint size_per_item, uint length)',
      '{',
      '__local float tbl_floats_local[256];',
      'uint group_id = get_group_id(0);',
      'uint local_id = get_local_id(0);',
      'uint local_size = get_local_size(0);',
      'float maxval;',
      'if (local_id == 0) {',
      '  uchar *item_max_view = (uchar*)&maxval;',
      '  item_max_view[0]=weight_packed[length+0];',
      '  item_max_view[1]=weight_packed[length+1];',
      '  item_max_view[2]=weight_packed[length+2];',
      '  item_max_view[3]=weight_packed[length+3];',
      '  tbl_floats_local[0] = maxval;',
      '}',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      'maxval = tbl_floats_local[0];',
      'if (local_id < 126) {',
      '  tbl_floats_local[local_id] = tbl_floats_global[local_id] * maxval;',
      '  tbl_floats_local[local_id+128] = -tbl_floats_local[local_id];',
      '}',
      'else if (local_id == 126) {',
      '  tbl_floats_local[126]=0.0F;',
      '  tbl_floats_local[127]=maxval;',
      '  tbl_floats_local[126+128]=0.0F;',
      '  tbl_floats_local[127+128]=-maxval;',
      '}',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      'uint idx_top = (group_id + 1) * local_size * size_per_item;',
      'if (idx_top > length) {idx_top = length;}',
      'for (uint idx = group_id * local_size * size_per_item + local_id; idx < idx_top; idx += local_size) {',
      '  weight_raw[idx] = tbl_floats_local[weight_packed[idx]];',
      '}',
      '}'].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  var weight_packed = new $M.CL.MatrixCL([src_size, 1], 'uint8');
  weight_packed.setdata(buf_view);
  var data_count = src_size - 4;
  var local_work_size = 256;
  var size_per_item = 256;
  var num_groups = Math.ceil(data_count / (local_work_size * size_per_item));
  $M.CL.executeKernel(decompress_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: weight_mat },
    { access: WebCL.MEM_READ_ONLY, datum: weight_packed },
    { access: WebCL.MEM_READ_ONLY, datum: get_constant_table() },
    { datum: size_per_item, type: WebCL.type.UINT },
    { datum: data_count, type: WebCL.type.UINT }
  ], [num_groups * local_work_size], [local_work_size]);

  weight_packed.destruct();
}
