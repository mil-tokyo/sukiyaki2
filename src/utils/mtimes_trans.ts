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
