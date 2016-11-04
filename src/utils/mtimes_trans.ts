// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');

export function mtimes_trans(A: $M.Matrix, B: $M.Matrix, trans_a: boolean, trans_b: boolean): $M.Matrix {
  var devicetype = $M.devicetype(A);
  if (devicetype !== $M.devicetype(B)) {
    throw new Error('devicetype mismatch');
  }
  if (devicetype == 'cl') {
    return mtimes_trans_cl(A, B, trans_a, trans_b);
  } else {
    if (trans_a) {
      A = $M.t(A);
    }
    if (trans_b) {
      B = $M.t(B);
    }
    var C = $M.mtimes(A, B);
    if (trans_a) {
      A.destruct();
    }
    if (trans_b) {
      B.destruct();
    }
    return C;
  }
}

export function mtimes_trans_cl(A: $M.Matrix, B: $M.Matrix, trans_a: boolean, trans_b: boolean): $M.Matrix {
  if (A._ndims != 2 || B._ndims != 2) {
    throw new Error('Matrix must be two-dimensional');
  }
  if (A._klass != 'single' || B._klass != 'single') {
    throw new Error('Matrix klass must be single');
  }
  var m: number, n: number, k: number;
  var lda: number, ldb: number, ldc: number;
  var trans_a_char = 'N', trans_b_char = 'N';
  if (trans_a) {
    m = A._size[1];
    k = A._size[0];
    trans_a_char = 'T';
  } else {
    m = A._size[0];
    k = A._size[1];
  }
  var size_mismatch = false;
  if (trans_b) {
    n = B._size[0];
    if (k != B._size[1]) {
      size_mismatch = true;
    }
    trans_b_char = 'T';
  } else {
    n = B._size[1];
    if (k != B._size[0]) {
      size_mismatch = true;
    }
  }

  var C = new $M.CL.MatrixCL([m, n], 'single');
  lda = A._strides[1];
  ldb = B._strides[1];
  ldc = C._strides[1];
  $M.CL.sgemm(trans_a_char, trans_b_char, m, n, k, 1.0, A, lda, B, ldb, 0.0, C, ldc);
  return C;
}


export function mtimes_atrans_largek(A: $M.Matrix, B: $M.Matrix): $M.Matrix {
  // A^T * B
  var devicetype = $M.devicetype(A);
  if (devicetype !== $M.devicetype(B)) {
    throw new Error('devicetype mismatch');
  }
  if (devicetype == 'cl') {
    return mtimes_largek_cl(A, B);
  } else {
    var At = $M.t(A);
    var C = $M.mtimes(At, B);
    At.destruct();
    return C;
  }
}

var mtimes_largek_cl_kernel = null;
function mtimes_largek_cl(A: $M.Matrix, B: $M.Matrix) {
  // A^T * B
  var m: number, k: number, n: number;

  k = A._size[0];
  m = A._size[1];
  n = B._size[1];
  var C = new $M.CL.MatrixCL([m, n], 'single');

  var group_size = 256;
  if (!mtimes_largek_cl_kernel) {
    mtimes_largek_cl_kernel = $M.CL.createKernel([
      '#define GROUP_SIZE ' + group_size,
      '__kernel void kernel_func(__global float *C, __global const float *A, __global const float *B, uint m, uint n, uint k)',
      '{',
      'uint i = get_group_id(0);',
      'uint j = get_group_id(1);',
      'uint l = get_local_id(0);',
      '__local float local_sums[GROUP_SIZE];',
      'float local_sum = 0.0F;',
      'for (uint s = l; s < k; s+=GROUP_SIZE) {',
      '  local_sum += A[s+k*i]*B[s+k*j];',
      '}',
      'local_sums[l] = local_sum;',
      'barrier(CLK_LOCAL_MEM_FENCE);',
      'if (l == 0) {',
      'for (uint g = 1; g < GROUP_SIZE; g++) {',
      '  local_sum += local_sums[g];',
      '}',
      'C[i+m*j]=local_sum;',
      '}',
      '}'
    ].join('\n'));
  }

  var WebCL = $M.CL.WebCL;
  $M.CL.executeKernel(mtimes_largek_cl_kernel, [
    { access: WebCL.MEM_WRITE_ONLY, datum: C },
    { access: WebCL.MEM_READ_ONLY, datum: A },
    { access: WebCL.MEM_READ_ONLY, datum: B },
    { datum: m, type: WebCL.type.UINT },
    { datum: n, type: WebCL.type.UINT },
    { datum: k, type: WebCL.type.UINT }
  ], [m * group_size, n], [group_size, 1]);

  return C;
}
