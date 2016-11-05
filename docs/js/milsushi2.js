/*!
 Sushi2 library (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
 clBLAS library Copyright 2013 Advanced Micro Devices, Inc., Apache License Version 2.0.
*/

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.milsushi2 = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Sushi = require('./src/sushi');
module.exports = Sushi;

},{"./src/sushi":10}],2:[function(require,module,exports){
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
// colon object
// $M.colon(1,3,10) or $M.colon.fromstring('1:3:10');
"use strict";
var Colon = (function () {
    function Colon(start, stop_step, stop) {
        this.start = start;
        this.step = 1;
        if (this.start == null) {
            this.all = true;
        }
        else {
            if (stop != null) {
                // start:step:stop
                this.step = stop_step;
                this.stop = stop;
            }
            else {
                // start:1:stop
                this.stop = stop_step;
            }
        }
    }
    Colon.fromstring = function (s) {
        var elements = s.replace('end', '-1').split(':');
        var nums = [];
        for (var i = 0; i < elements.length; i++) {
            nums.push(eval(elements[i] || 'null'));
        }
        if (elements.length == 2) {
            return new Colon(nums[0], nums[1]);
        }
        else if (elements.length == 3) {
            return new Colon(nums[0], nums[1], nums[2]);
        }
        else {
            throw new Error('Invalid format');
        }
    };
    Colon.prototype.tojsa = function (size) {
        var start = this.start;
        var stop = this.stop;
        var step = this.step;
        if (this.all) {
            start = 1;
            stop = size;
            step = 1;
        }
        if (start < 0) {
            start += size + 1;
        }
        if (stop < 0) {
            stop += size + 1;
        }
        var jsa = [];
        if (step > 0) {
            for (var i = start; i <= stop; i += step) {
                jsa.push(i);
            }
        }
        else if (step < 0) {
            for (var i = start; i >= stop; i += step) {
                jsa.push(i);
            }
        } //step == 0 means length 0
        return jsa;
    };
    Colon.prototype.toString = function () {
        if (this.start == null) {
            return ':';
        }
        else {
            if (this.step == null) {
                return colonedge2str(this.start) + ':' + colonedge2str(this.stop);
            }
            else {
                return colonedge2str(this.start) + ':' + this.step + ':' + colonedge2str(this.stop);
            }
        }
    };
    return Colon;
}());
function colonedge2str(val) {
    if (val >= 0) {
        return '' + val;
    }
    else {
        if (val == 0) {
            return 'end';
        }
        return 'end-' + (-1 - val);
    }
}
module.exports = Colon;

},{}],3:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Colon = require('./colon');
function colon(start, stop_step, stop) {
    return new Colon(start, stop_step, stop);
}
var colon;
(function (colon) {
    colon.s = Colon.fromstring;
})(colon || (colon = {}));
module.exports = colon;

},{"./colon":2}],4:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Matrix = require('./matrix');
var util = require('./util');
function make_compare_func_all(operation) {
    var func_s_s = make_binary_arith_func(operation, false, false, 'logical');
    var func_s_m = make_binary_arith_func(operation, false, true, 'logical');
    var func_m_s = make_binary_arith_func(operation, true, false, 'logical');
    var func_m_m = make_binary_arith_func(operation, true, true, 'logical');
    return function (A, B) {
        A = util.force_cpu_scalar(A);
        B = util.force_cpu_scalar(B);
        if (A instanceof Matrix) {
            if (B instanceof Matrix) {
                return func_m_m(A, B);
            }
            else {
                return func_m_s(A, B);
            }
        }
        else {
            if (B instanceof Matrix) {
                return func_s_m(A, B);
            }
            else {
                return func_s_s(A, B);
            }
        }
    };
}
exports.make_compare_func_all = make_compare_func_all;
function make_binary_arith_func(operation, a_mat, b_mat, dst_klass) {
    var l_shape;
    var l_size_check = '';
    var l_def_adata = '';
    var l_def_bdata = '';
    var l_get_a;
    var l_get_b;
    if (a_mat) {
        l_shape = 'A._size';
        l_def_adata = 'var a_data = A._data;';
        l_get_a = 'a_data[i]';
        if (b_mat) {
            l_size_check = 'if (!e_util.jsaequal(A._size, B._size)) {throw new Error("Dimension mismatch");}';
        }
    }
    else {
        l_get_a = 'A';
        if (b_mat) {
            l_shape = 'B._size';
        }
        else {
            l_shape = '[1,1]';
        }
    }
    if (b_mat) {
        l_def_bdata = 'var b_data = B._data;';
        l_get_b = 'b_data[i]';
    }
    else {
        l_get_b = 'B';
    }
    var l_opr_formatted = operation.replace('%a', l_get_a).replace('%b', l_get_b);
    var f;
    var e_Matrix = Matrix;
    var e_util = util;
    eval([
        'f = function(A, B) {',
        'var shape = ' + l_shape + ';',
        l_size_check,
        l_def_adata,
        l_def_bdata,
        'var dst = new e_Matrix(shape, "' + dst_klass + '");',
        'var dst_data = dst._data;',
        'for (var i = 0, length = dst._numel; i < length; i++) {',
        '  dst_data[i] = ' + l_opr_formatted + ';',
        '}',
        'return dst;',
        '}'
    ].join('\n'));
    return f;
}
exports.make_binary_arith_func = make_binary_arith_func;
function make_binary_arith_func_all(operation) {
    var funcs = {};
    return function (A, B) {
        var dst_klass = util.commonklass(A, B);
        A = util.force_cpu_scalar(A);
        B = util.force_cpu_scalar(B);
        if (dst_klass == 'logical') {
            dst_klass = 'single';
        }
        var a_mat = A instanceof Matrix;
        var b_mat = B instanceof Matrix;
        var func_name = '' + a_mat + '_' + b_mat + '_' + dst_klass;
        var f = funcs[func_name];
        if (!f) {
            // compile (eval) function on first call
            f = make_binary_arith_func(operation, a_mat, b_mat, dst_klass);
            funcs[func_name] = f;
        }
        return f(A, B);
    };
}
exports.make_binary_arith_func_all = make_binary_arith_func_all;
function make_unary_arith_func(operation, a_mat, dst_klass) {
    var l_shape;
    var l_def_adata = '';
    var l_get_a;
    if (a_mat) {
        l_shape = 'A._size';
        l_def_adata = 'var a_data = A._data;';
        l_get_a = 'a_data[i]';
    }
    else {
        l_shape = '[1,1]';
        l_get_a = 'A';
    }
    var l_opr_formatted = operation.replace(/%a/g, l_get_a);
    var f;
    var e_Matrix = Matrix;
    var e_util = util;
    eval([
        'f = function(A) {',
        'var shape = ' + l_shape + ';',
        l_def_adata,
        'var dst = new e_Matrix(shape, "' + dst_klass + '");',
        'var dst_data = dst._data;',
        'for (var i = 0, length = dst._numel; i < length; i++) {',
        '  dst_data[i] = ' + l_opr_formatted + ';',
        '}',
        'return dst;',
        '}'
    ].join('\n'));
    return f;
}
exports.make_unary_arith_func = make_unary_arith_func;
function make_unary_arith_func_all(operation) {
    var funcs = {};
    return function (A) {
        var dst_klass;
        if (A instanceof Matrix) {
            dst_klass = A._klass;
            if (dst_klass == 'logical') {
                dst_klass = 'single';
            }
        }
        else {
            dst_klass = 'single';
        }
        A = util.force_cpu_scalar(A);
        var a_mat = A instanceof Matrix;
        var func_name = '' + a_mat + '_' + dst_klass;
        var f = funcs[func_name];
        if (!f) {
            // compile (eval) function on first call
            f = make_unary_arith_func(operation, a_mat, dst_klass);
            funcs[func_name] = f;
        }
        return f(A);
    };
}
exports.make_unary_arith_func_all = make_unary_arith_func_all;
function isequal_two(A, B) {
    A = A.to_cpu();
    B = B.to_cpu();
    if (!util.issamesize(A._size, B._size)) {
        return false;
    }
    //(1,1)=>true,(NaN,NaN)=>false,(NaN,1)=>false
    var a_data = A._data;
    var b_data = B._data;
    for (var i = 0, length = a_data.length; i < length; i++) {
        if (a_data[i] !== b_data[i]) {
            // NaN !== NaN
            return false;
        }
    }
    return true;
}
function isequal() {
    var As = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        As[_i - 0] = arguments[_i];
    }
    if (!(As[0] instanceof Matrix)) {
        return false;
    } //scalar is not allowed
    for (var i = 1; i < As.length; i++) {
        if (!(As[i] instanceof Matrix)) {
            return false;
        }
        if (!isequal_two(As[0], As[i])) {
            return false;
        }
    }
    return true;
}
exports.isequal = isequal;
function isequaln_two(A, B) {
    A = A.to_cpu();
    B = B.to_cpu();
    if (!util.issamesize(A._size, B._size)) {
        return false;
    }
    //(1,1)=>true,(NaN,NaN)=>true,(NaN,1)=>false
    var a_data = A._data;
    var b_data = B._data;
    for (var i = 0, length = a_data.length; i < length; i++) {
        var val_a = a_data[i], val_b = b_data[i];
        if (val_a !== val_b) {
            // NaN !== NaN
            if ((val_a === val_a) || (val_b === val_b)) {
                return false;
            }
        }
    }
    return true;
}
function isequaln() {
    var As = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        As[_i - 0] = arguments[_i];
    }
    if (!(As[0] instanceof Matrix)) {
        return false;
    } //scalar is not allowed
    for (var i = 1; i < As.length; i++) {
        if (!(As[i] instanceof Matrix)) {
            return false;
        }
        if (!isequaln_two(As[0], As[i])) {
            return false;
        }
    }
    return true;
}
exports.isequaln = isequaln;
function make_isclose_func_all() {
    var func_s_s = make_isclose_func(false, false);
    var func_s_m = make_isclose_func(false, true);
    var func_m_s = make_isclose_func(true, false);
    var func_m_m = make_isclose_func(true, true);
    return function (A, B, rtol, atol, equal_nan) {
        if (rtol === void 0) { rtol = 1e-5; }
        if (atol === void 0) { atol = 1e-8; }
        if (equal_nan === void 0) { equal_nan = false; }
        A = util.force_cpu_scalar(A);
        B = util.force_cpu_scalar(B);
        if (A instanceof Matrix) {
            if (B instanceof Matrix) {
                return func_m_m(A, B, rtol, atol, equal_nan);
            }
            else {
                return func_m_s(A, B, rtol, atol, equal_nan);
            }
        }
        else {
            if (B instanceof Matrix) {
                return func_s_m(A, B, rtol, atol, equal_nan);
            }
            else {
                return func_s_s(A, B, rtol, atol, equal_nan);
            }
        }
    };
}
function make_isclose_func(a_mat, b_mat) {
    var l_shape;
    var l_size_check = '';
    var l_def_adata = '';
    var l_def_bdata = '';
    var l_get_a;
    var l_get_b;
    if (a_mat) {
        l_shape = 'A._size';
        l_def_adata = 'var a_data = A._data;';
        l_get_a = 'a_data[i]';
        if (b_mat) {
            l_size_check = 'if (!e_util.jsaequal(A._size, B._size)) {throw new Error("Dimension mismatch");}';
        }
    }
    else {
        l_get_a = 'A';
        if (b_mat) {
            l_shape = 'B._size';
        }
        else {
            l_shape = '[1,1]';
        }
    }
    if (b_mat) {
        l_def_bdata = 'var b_data = B._data;';
        l_get_b = 'b_data[i]';
    }
    else {
        l_get_b = 'B';
    }
    var f;
    var e_Matrix = Matrix;
    var e_util = util;
    eval([
        'f = function(A, B, rtol, atol, equal_nan) {',
        'var shape = ' + l_shape + ';',
        l_size_check,
        l_def_adata,
        l_def_bdata,
        'var dst = new e_Matrix(shape, "logical");',
        'var dst_data = dst._data;',
        'if (equal_nan) {',
        '  for (var i = 0, length = dst._numel; i < length; i++) {',
        '    var val_a = ' + l_get_a + ';',
        '    var val_b = ' + l_get_b + ';',
        '    var absdiff = val_a - val_b;',
        '    if (absdiff < 0) {absdiff = -absdiff}',
        '    var ret = 0;',
        '    if (absdiff <= atol + rtol * ((val_b > 0) ? val_b : -val_b)) {',
        '      ret = 1;',
        '    }',
        '    if ((val_a !== val_a) && (val_b !== val_b)) {',
        '      ret = 1;',
        '    }',
        '    dst_data[i] = ret;',
        '  }',
        '} else {',
        '  for (var i = 0, length = dst._numel; i < length; i++) {',
        '    var val_a = ' + l_get_a + ';',
        '    var val_b = ' + l_get_b + ';',
        '    var absdiff = val_a - val_b;',
        '    if (absdiff < 0) {absdiff = -absdiff}',
        '    var ret = 0;',
        '    if (absdiff <= atol + rtol * ((val_b > 0) ? val_b : -val_b)) {',
        '      ret = 1;',
        '    }',
        '    dst_data[i] = ret;',
        '  }',
        '}',
        'return dst;',
        '}'
    ].join('\n'));
    return f;
}
exports.make_isclose_func = make_isclose_func;
exports.isclose = make_isclose_func_all();
function allclose(A, B, rtol, atol, equal_nan) {
    var isclose_result = exports.isclose(A, B, rtol, atol, equal_nan);
    var data = isclose_result.getdataref();
    var prod = 1;
    for (var i = 0; i < data.length; i++) {
        prod *= data[i];
    }
    return prod != 0;
}
exports.allclose = allclose;

},{"./matrix":6,"./util":11}],5:[function(require,module,exports){
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
// read/write numpy format matrix file
"use strict";
var Matrix = require('../matrix');
function parse_header(header_data) {
    //{'descr': '<i4', 'fortran_order': False, 'shape': (3, 1), }            \n
    var header_str = '';
    for (var i = 0; i < header_data.length; i++) {
        var element = header_data[i];
        header_str += String.fromCharCode(element);
    }
    var hobj = /^\{'descr': '(.*)', 'fortran_order': (True|False), 'shape': \(([0-9, ]+)\), \} *\n$/.exec(header_str);
    if (hobj == null) {
        throw Error('Failed to parse header string');
    }
    var typechars = hobj[1]; //"<i4"
    var little_endian = true;
    switch (typechars.substr(0, 1)) {
        case "<":
        case "|":
            little_endian = true;
            break;
        case ">":
            little_endian = false;
            break;
        default:
            throw Error('Unknown endian');
    }
    var descr_wo_endian = typechars.substr(1, 2);
    var fortran_order = hobj[2] == 'True';
    var shape_str = hobj[3].split(',');
    var shape;
    if (shape_str[1] == '') {
        //1-d array (3,) to column vector (3,1)
        shape = [Number(shape_str[0]), 1];
    }
    else {
        shape = shape_str.map(function (v) { return Number(v.trim()); });
    }
    return { descr_wo_endian: descr_wo_endian, fortran_order: fortran_order, shape: shape, little_endian: little_endian };
}
function is_little_endian() {
    /**
     * Check if this machine is little endian
     */
    var raw = new Uint8Array([0x1, 0x2, 0x3, 0x4]);
    var view = new Uint32Array(raw.buffer);
    if (view[0] == 0x01020304) {
        //big endian
        return false;
    }
    else {
        return true;
    }
}
var mat_klass_map = {
    'b1': 'logical',
    'u1': 'uint8',
    'i4': 'int32',
    'f4': 'single',
    'f8': 'single'
};
var view_accessor_map = {
    'b1': DataView.prototype.getUint8,
    'u1': DataView.prototype.getUint8,
    'i4': DataView.prototype.getInt32,
    'f4': DataView.prototype.getFloat32,
    'f8': DataView.prototype.getFloat64
};
var view_bytestep_map = { 'b1': 1, 'u1': 1, 'i4': 4, 'f4': 4, 'f8': 8 };
function npyread(data) {
    //for node: npyread(fs.readFileSync())
    var byteOffset = 0;
    if (ArrayBuffer.isView(data)) {
        //data is Uint8Array
        byteOffset = data.byteOffset;
        data = data.buffer;
    }
    var header_view = new Uint8Array(data, byteOffset);
    //check magic number
    var expect_header = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 0x01, 0x00]; //only format 1 supported
    for (var i = 0; i < expect_header.length; i++) {
        if (header_view[i] != expect_header[i]) {
            throw Error('Incompatible format header');
        }
    }
    var header_len = header_view[8] + header_view[9] * 256; //16bit little endian
    var data_type = parse_header(header_view.slice(10, 10 + header_len));
    var mat_klass = mat_klass_map[data_type.descr_wo_endian];
    if (mat_klass == null) {
        throw Error('Unsupported data type');
    }
    var data_view = new DataView(data, byteOffset + 10 + header_len);
    //b1 seems to have only 0/1, so no conversion needed
    var mat = new Matrix(data_type.shape, mat_klass);
    var mat_data = mat.getdataref();
    var view_accessor = view_accessor_map[data_type.descr_wo_endian];
    var view_bytestep = view_bytestep_map[data_type.descr_wo_endian];
    var numel = mat._numel;
    var view_little_endian = data_type.little_endian;
    if (data_type.fortran_order) {
        // sequentially copy
        for (var i = 0; i < numel; i++) {
            var val = view_accessor.call(data_view, view_bytestep * i, view_little_endian);
            mat_data[i] = val;
        }
    }
    else {
        //change order from c-order to fortran-order
        /*
        Size of matrix: (I, J, K)
        c-order strides: (J*K, K, 1)
        f-order strides: (1, I, I*J)
        when linear index in c-order is x:
        matrix index: (x / (J*K) % I * 1, x / K % J * I, x / 1 % K * I * J)
        that is: x / cstride[i] % size[i] * fstride[i] (i = 0,1,2)
        */
        var size = mat._size;
        var cstride = [];
        var fstride = [];
        var last_cstride = 1;
        var last_fstride = 1;
        for (var dim = 0; dim < size.length; dim++) {
            cstride.unshift(last_cstride);
            fstride.push(last_fstride);
            last_cstride *= size[size.length - 1 - dim];
            last_fstride *= size[dim];
        }
        for (var i = 0; i < numel; i++) {
            var val = view_accessor.call(data_view, view_bytestep * i, view_little_endian);
            var fidx = 0;
            for (var dim = 0; dim < size.length; dim++) {
                fidx += Math.floor(i / cstride[dim]) % size[dim] * fstride[dim];
            }
            mat_data[fidx] = val;
        }
    }
    return mat;
}
exports.npyread = npyread;
var save_klass_map = { 'logical': 'b1', 'uint8': 'u1', 'int32': 'i4', 'single': 'f4' };
var header_padding = '';
function npysave(A) {
    var klass = A._klass;
    var endian_char;
    switch (klass) {
        case 'logical':
        case 'uint8':
            endian_char = '|'; //not applicable
            break;
        default:
            endian_char = is_little_endian() ? '<' : '>';
            break;
    }
    var header_str = "{'descr': '" + endian_char + save_klass_map[klass] +
        "', 'fortran_order': True, 'shape': (" + A._size.join(', ') + "), }";
    //pad header_str to be (multiple of 16) - (magic 10 + last \n)
    var pad_len = 16 - (header_str.length + 11) % 16;
    header_str += '                '.substr(0, pad_len) + '\n';
    var header_len = header_str.length;
    var header_total_len = header_len + 10; //header with magic number
    var dst_size = A._numel * A._data_ctor.BYTES_PER_ELEMENT + header_total_len;
    var dst = new ArrayBuffer(dst_size);
    var dst_byte_offset = 0;
    var header_dst_view = new Uint8Array(dst, dst_byte_offset, header_total_len);
    var const_header = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 0x01, 0x00];
    for (var i = 0; i < const_header.length; i++) {
        header_dst_view[i] = const_header[i];
    }
    header_dst_view[8] = header_len % 256;
    header_dst_view[9] = Math.floor(header_len / 256);
    for (var i = 0; i < header_len; i++) {
        header_dst_view[10 + i] = header_str.charCodeAt(i);
    }
    var body_dst_view = new A._data_ctor(dst, dst_byte_offset + header_total_len, A._numel);
    body_dst_view.set(A.getdataref());
    return dst;
}
exports.npysave = npysave;

},{"../matrix":6}],6:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Colon = require('./colon');
var Matrix = (function () {
    function Matrix(size, klass, noalloc) {
        if (klass === void 0) { klass = 'single'; }
        if (noalloc === void 0) { noalloc = false; }
        var _size = Array.prototype.slice.call(size); //copy
        //verify size
        var tmpnumel = 1;
        var strides = [];
        var last_none_one_dim = 0;
        if (_size.length < 2) {
            throw new Error('matrix must have at least 2 dimensions');
        }
        for (var i = 0; i < _size.length; i++) {
            var dimsize = _size[i];
            if (typeof (dimsize) !== 'number' || dimsize < 0 || !Matrix._isinteger(dimsize)) {
                throw new Error('size is invalid');
            }
            if (dimsize != 1) {
                last_none_one_dim = i;
            }
            strides.push(tmpnumel);
            tmpnumel *= dimsize;
        }
        if (tmpnumel >= 2147483648) {
            // indexing with int32 value is impossible
            throw new Error('Matrix of equal to or more than 2G elements is not supported');
        }
        this._numel = tmpnumel;
        //remove tail dimensions with size 1 (retain minimum 2 dimensions)
        last_none_one_dim = Math.max(last_none_one_dim, 1) + 1;
        _size.splice(last_none_one_dim);
        strides.splice(last_none_one_dim);
        this._size = _size;
        this._ndims = _size.length;
        this._strides = strides;
        if (!Matrix._isvalidklass(klass)) {
            throw new Error('unknown klass');
        }
        this._klass = klass;
        this._data_ctor = Matrix.data_ctors[klass];
        if (!noalloc) {
            this._alloccpu();
        }
        if (Matrix._autodestruct_stack_top) {
            Matrix._autodestruct_stack_top.push(this);
        }
    }
    Matrix.autodestruct_push = function () {
        var array = [];
        Matrix._autodestruct_stack_top = array;
        Matrix._autodestruct_stack.push(array);
    };
    Matrix.autodestruct_pop = function () {
        if (Matrix._autodestruct_stack_top) {
            //destruct all in current list
            //console.log('Autodestruct: ' + Matrix._autodestruct_stack_top.length + ' mats');
            for (var i = 0; i < Matrix._autodestruct_stack_top.length; i++) {
                Matrix._autodestruct_stack_top[i].destruct();
            }
            Matrix._autodestruct_stack.pop();
            Matrix._autodestruct_stack_top = Matrix._autodestruct_stack[Matrix._autodestruct_stack.length - 1];
        }
    };
    Matrix.prototype.destruct = function () {
        //release memory
        this._data = null;
    };
    Matrix.prototype.inspect = function (depth) {
        var shape_str = this._size.join('x');
        if (this._numel <= 100) {
            return 'Matrix ' + shape_str + ' ' + this._klass + '\n' + this.toString();
        }
        else {
            return 'Matrix ' + shape_str + ' ' + this._klass;
        }
    };
    Matrix.typedarray2mat = function (size, klass, data) {
        if (klass === void 0) { klass = 'single'; }
        //type check
        if (!(data instanceof Matrix.data_ctors[klass])) {
            throw Error('klass and data type mismatch');
        }
        var m = new Matrix(size, klass, true);
        if (data.length < m._numel) {
            throw Error('The length of data is smaller than matrix size');
        }
        m._data = data;
        if (klass === 'logical') {
            //force values to 0/1
            for (var i = 0; i < m._numel; i++) {
                data[i] = Number(data[i] != 0);
            }
        }
        return m;
    };
    Matrix._isinteger = function (x) {
        return Math.round(x) == x;
    };
    Matrix._isvalidklass = function (klass) {
        return klass == 'single' || klass == 'int32' || klass == 'uint8' || klass == 'logical';
    };
    Matrix._logical_cast_required = function (klass_dst, klass_src) {
        return (klass_dst == 'logical' && klass_src != 'logical');
    };
    Matrix._logical_cast = function (val) {
        return Number(Boolean(val));
    };
    Matrix.prototype._alloccpu = function () {
        // allocate cpu buffer if not exist
        if (!this._data) {
            this._data = new this._data_ctor(this._numel);
        }
        return this._data;
    };
    Matrix.prototype.to_cpu = function () {
        return this;
    };
    Matrix.prototype._getdata = function () {
        //override in gpu
        //get copy of data in TypedArray
        return this._data;
    };
    Matrix.prototype.getdataref = function (src_offset, length) {
        if (src_offset === void 0) { src_offset = 0; }
        //get read-only view of array
        if (!src_offset && length == null) {
            return this._data;
        }
        else {
            if (length == null) {
                length = this._numel;
            }
            return new this._data_ctor(this._data.buffer, src_offset * this._data.BYTES_PER_ELEMENT, length);
        }
    };
    Matrix.prototype.getdatacopy = function (src_offset, length, dst) {
        if (src_offset === void 0) { src_offset = 0; }
        if (length == null) {
            length = this._numel - src_offset;
        }
        if (!dst) {
            dst = new this._data_ctor(length);
        }
        var range_view = new this._data_ctor(this._data.buffer, src_offset * this._data.BYTES_PER_ELEMENT, length);
        dst.set(range_view);
        return dst;
    };
    Matrix.prototype.setdata = function (src, dst_offset) {
        if (dst_offset === void 0) { dst_offset = 0; }
        //set raw data into buffer
        this._data.set(src, dst_offset);
    };
    Matrix.prototype._isvalidindex = function (inds) {
        if (this._numel == 0) {
            // if matrix have zero dimension, all index is invalid
            return false;
        }
        if (inds.length == 0) {
            return false;
        }
        else if (inds.length == 1) {
            return Matrix._isinteger(inds[0]) && ((inds[0] > 0 && inds[0] <= this._numel) || (inds[0] < 0 && (-inds[0]) <= this._numel));
        }
        else {
            if (inds.length < this._ndims) {
                // last index last index is regarded as linear index of remaining dimensions
                for (var dim = 0; dim < inds.length; dim++) {
                    var ind = inds[dim];
                    var dimsize;
                    if (dim == inds.length - 1) {
                        //last index
                        dimsize = 1;
                        for (var dimex = dim; dimex < this._ndims; dimex++) {
                            dimsize *= this._size[dimex];
                        }
                    }
                    else {
                        dimsize = this._size[dim];
                    }
                    if (Matrix._isinteger(ind) && ((ind > 0 && (ind <= dimsize) || (ind < 0 && -ind <= dimsize)))) {
                    }
                    else {
                        return false;
                    }
                }
            }
            else {
                for (var dim = 0; dim < inds.length; dim++) {
                    var ind = inds[dim];
                    var dimsize = this._size[dim] || 1;
                    // if dimensions of inds is more than matrix dimensions, only 1 is ok for the extra dimension
                    if (Matrix._isinteger(ind) && ((ind > 0 && (ind <= dimsize) || (ind < 0 && -ind <= dimsize)))) {
                    }
                    else {
                        return false;
                    }
                }
            }
        }
        return true;
    };
    Matrix.prototype._isvalidindexerr = function (inds) {
        if (!this._isvalidindex(inds)) {
            throw new Error('Invalid index');
        }
    };
    Matrix.prototype._getarrayindex = function (inds) {
        // assume inds is valid
        var idx = 0;
        if (inds.length == 1) {
            var ind = inds[0];
            if (ind < 0) {
                ind += this._numel + 1;
            }
            idx = ind - 1;
        }
        else {
            if (inds.length < this._ndims) {
                // last index last index is regarded as linear index of remaining dimensions
                for (var dim = 0; dim < inds.length; dim++) {
                    var ind = inds[dim];
                    if (ind < 0) {
                        var dimsize;
                        if (dim == inds.length - 1) {
                            //last index
                            dimsize = 1;
                            for (var dimex = dim; dimex < this._ndims; dimex++) {
                                dimsize *= this._size[dimex];
                            }
                        }
                        else {
                            dimsize = this._size[dim];
                        }
                        ind += dimsize + 1;
                    }
                    idx += (ind - 1) * (this._strides[dim] || 0); //trailing 1 does not affect
                }
            }
            else {
                for (var dim = 0; dim < inds.length; dim++) {
                    var ind = inds[dim];
                    if (ind < 0) {
                        ind += (this._size[dim] || 1) + 1;
                    }
                    idx += (ind - 1) * (this._strides[dim] || 0); //trailing 1 does not affect
                }
            }
        }
        return idx;
    };
    Matrix.numel = function (A) {
        return A._numel;
    };
    Matrix.size = function (X, dim) {
        if (dim == undefined) {
            return Matrix.jsa2mat([X._size]);
        }
        else {
            return X._size[dim - 1];
        }
    };
    Matrix.sizejsa = function (X) {
        return X._size;
    };
    Matrix.jsa2mat = function (ary, one_d_column, klass) {
        if (one_d_column === void 0) { one_d_column = false; }
        if (klass === void 0) { klass = 'single'; }
        // TODO: type inference (contains non-integer => single, contains boolean => logical)
        // get dimension
        var mat;
        if (typeof (ary) === 'number') {
            //1x1 matrix
            mat = new Matrix([1, 1], klass);
            mat.set_scalar(ary, [1]);
        }
        else if (ary instanceof Matrix) {
            //simply copy
            mat = ary.copy();
        }
        else if (!ary.length) {
            //0x0 matrix (length is undefined or 0)
            mat = new Matrix([0, 0], klass);
        }
        else {
            //n-d matrix
            //get shape
            var size = [];
            var cur_ary = ary;
            var numel = 1;
            while (cur_ary.length !== void 0) {
                size.push(cur_ary.length);
                numel *= cur_ary.length;
                cur_ary = cur_ary[0];
            }
            var ndims = size.length;
            var cstride = [];
            var fstride = [];
            var last_cstride = 1;
            var last_fstride = 1;
            for (var dim = 0; dim < size.length; dim++) {
                cstride.unshift(last_cstride);
                fstride.push(last_fstride);
                last_cstride *= size[size.length - 1 - dim];
                last_fstride *= size[dim];
            }
            //flatten data
            var data_ctor = Matrix.data_ctors[klass];
            var data = new data_ctor(numel);
            var flat_i = 0;
            var n = function (a, dim, fidx_ofs) {
                if (a.length != size[dim]) {
                    throw Error('Inconsistent size of n-d array');
                }
                if (dim == ndims - 1) {
                    // a contains numbers
                    for (var i = 0; i < size[dim]; i++) {
                        var val = a[i];
                        var fidx = fidx_ofs + Math.floor(flat_i / cstride[dim]) % size[dim] * fstride[dim];
                        data[fidx] = val;
                        flat_i++;
                    }
                }
                else {
                    for (var i = 0; i < size[dim]; i++) {
                        n(a[i], dim + 1, fidx_ofs + Math.floor(flat_i / cstride[dim]) % size[dim] * fstride[dim]);
                    }
                }
            };
            n(ary, 0, 0);
            if (ndims == 1) {
                if (one_d_column) {
                    size = [size[0], 1];
                }
                else {
                    size = [1, size[0]];
                }
            }
            mat = Matrix.typedarray2mat(size, klass, data);
        }
        return mat;
    };
    Matrix.prototype.mat2jsa = function (one_d_flatten) {
        if (one_d_flatten === void 0) { one_d_flatten = false; }
        //empty matrix will be [] not [[]]
        var ary = [];
        if (one_d_flatten && this._ndims == 2 && (this._size[0] == 1 || this._size[1] == 1)) {
            var data = this.getdataref();
            for (var i = 0; i < data.length; i++) {
                ary.push(data[i]);
            }
        }
        else {
            //n-d jagged array
            var size = this._size;
            var ndims = this._ndims;
            var data = this.getdataref();
            var cstride = [];
            var fstride = [];
            var last_cstride = 1;
            var last_fstride = 1;
            for (var dim = 0; dim < ndims; dim++) {
                cstride.unshift(last_cstride);
                fstride.push(last_fstride);
                last_cstride *= size[ndims - 1 - dim];
                last_fstride *= size[dim];
            }
            var flat_i = 0; //c-order
            var n = function (a, dim, fidx_ofs) {
                if (dim == ndims - 1) {
                    for (var i = 0; i < size[dim]; i++) {
                        var fidx = fidx_ofs + Math.floor(flat_i / cstride[dim]) % size[dim] * fstride[dim];
                        a.push(data[fidx]);
                        flat_i++;
                    }
                }
                else {
                    for (var i = 0; i < size[dim]; i++) {
                        var newa = [];
                        a.push(newa);
                        n(newa, dim + 1, fidx_ofs + Math.floor(flat_i / cstride[dim]) % size[dim] * fstride[dim]);
                    }
                }
            };
            n(ary, 0, 0);
        }
        return ary;
    };
    Matrix.prototype.get = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        if (this._numel == 0) {
            throw Error('Matrix with no element');
        }
        if (args.length == 0) {
            // get scalar
            return this._alloccpu()[0];
        }
        var all_number = args.every(function (v) { return typeof (v) === 'number'; });
        if (all_number) {
            return this.get_scalar(args);
        }
        else {
            return this.get_matrix_nd(args);
        }
    };
    // returns value of (1,1) or 0
    Matrix.prototype.valueOf = function () {
        if (this._numel > 0) {
            return this.get();
        }
        else {
            return 0;
        }
    };
    Matrix.prototype.copy = function (klass) {
        var clone = new Matrix(this._size, klass || this._klass);
        var clone_data = clone._getdata();
        var rawdata = this._alloccpu();
        if (Matrix._logical_cast_required(clone._klass, this._klass)) {
            for (var i = 0, length = clone_data.length; i < length; i++) {
                clone_data[i] = Matrix._logical_cast(rawdata[i]);
            }
        }
        else {
            clone_data.set(rawdata);
        }
        return clone;
    };
    Matrix.prototype.get_scalar = function (inds) {
        var rawdata = this._alloccpu();
        this._isvalidindexerr(inds);
        var arrayidx = this._getarrayindex(inds);
        return rawdata[arrayidx];
    };
    Matrix._get_ind_iterator = function (ind, dim_size) {
        // argument index is 0-origin
        // return index within valid range
        if (typeof (ind) === 'number') {
            var ind_positive = ind;
            if (ind_positive < 0) {
                ind_positive += dim_size + 1;
            }
            if (ind_positive <= 0 || ind_positive > dim_size) {
                throw Error('Index exceeds matrix dimension');
            }
            return {
                iter: function (index) {
                    return ind_positive;
                }, length: 1
            };
        }
        else if (ind instanceof Colon) {
            var start = ind.start;
            var stop = ind.stop;
            var step = ind.step;
            if (ind.all) {
                start = 1;
                stop = dim_size;
                step = 1;
            }
            if (start < 0) {
                start += dim_size + 1;
            }
            if (stop < 0) {
                stop += dim_size + 1;
            }
            var length = 0;
            if ((step > 0 && stop >= start) || (step < 0 && stop <= start)) {
                length = Math.floor((stop - start) / step) + 1;
                // check if in valid range
                var final_value = start + step * (length - 1);
                if ((start <= 0 || start > dim_size) || (final_value <= 0 || final_value > dim_size)) {
                    throw Error('Index exceeds matrix dimension');
                }
            }
            return {
                iter: function (index) {
                    return start + step * index;
                },
                length: length
            };
        }
        else if (ind instanceof Matrix) {
            var dataref = ind.getdataref();
            // check if in valid range
            for (var i = 0; i < dataref.length; i++) {
                var element = dataref[i];
                if (element == 0 || element > dim_size || element < -dim_size) {
                    throw Error('Index exceeds matrix dimension');
                }
            }
            return {
                iter: function (index) {
                    var val = dataref[index];
                    if (val < 0) {
                        val += dim_size;
                    }
                    return val;
                },
                length: dataref.length
            };
        }
    };
    Matrix.prototype.get_matrix_nd = function (inds) {
        var inds_ndim = inds.length;
        // replace logical matrix with vector
        for (var i = 0; i < inds_ndim; i++) {
            var ind = inds[i];
            if (ind instanceof Matrix) {
                if (ind._klass == 'logical') {
                    inds[i] = ind._find();
                }
            }
        }
        var virtual_input_shape = [];
        if (this._ndims <= inds_ndim) {
            // pad with 1
            virtual_input_shape = this._size.concat();
            while (virtual_input_shape.length < inds_ndim) {
                virtual_input_shape.push(1);
            }
        }
        else {
            // last dimension is like linear index
            var cur_prod = 1;
            for (var dim_1 = 0; dim_1 < inds_ndim - 1; dim_1++) {
                virtual_input_shape.push(this._size[dim_1]);
                cur_prod *= this._size[dim_1];
            }
            virtual_input_shape.push(this._numel / cur_prod);
        }
        var virtual_input_stride = [];
        var stride_tmp = 1;
        for (var dim = 0; dim < inds_ndim; dim++) {
            virtual_input_stride.push(stride_tmp);
            stride_tmp *= virtual_input_shape[dim];
        }
        var ind_iters = [];
        var dst_shape = [];
        var dst_stride = []; //not use dst._strides because tailing 1 dimension is omitted
        var dst_stride_tmp = 1;
        for (var dim = 0; dim < inds_ndim; dim++) {
            var iter_and_length = Matrix._get_ind_iterator(inds[dim], virtual_input_shape[dim]);
            ind_iters.push(iter_and_length.iter);
            dst_shape.push(iter_and_length.length);
            dst_stride.push(dst_stride_tmp);
            dst_stride_tmp *= iter_and_length.length;
        }
        var dst_reshape_shape = null;
        if (inds_ndim == 1) {
            // linear indexing case
            dst_shape.push(1); //avoid error on new Matrix()
            // if ind is logical matrix, regarded as vector in the following
            // colon is row vector
            // src and ind are both vectors => follows direction of src
            // otherwise: follows ind's shape
            var is_ind_vector = false;
            var only_ind = inds[0];
            if (only_ind instanceof Matrix) {
                if (only_ind._ndims == 2 && (only_ind._size[0] == 1 || only_ind._size[1] == 1)) {
                    is_ind_vector = true;
                }
            }
            else if (only_ind instanceof Colon) {
                is_ind_vector = true;
            }
            var is_src_vector = false;
            if (this._ndims == 2 && (this._size[0] == 1 || this._size[1] == 1)) {
                is_src_vector = true;
            }
            if (is_src_vector && is_ind_vector) {
                // follow direction of src
                if (this._size[0] == 1) {
                    // reshape to row vector
                    dst_reshape_shape = [1, dst_shape[0]];
                }
            }
            else {
                // follow ind's shape
                if (only_ind instanceof Matrix) {
                    dst_reshape_shape = only_ind._size;
                }
                else if (only_ind instanceof Colon) {
                    // reshape to row vector
                    dst_reshape_shape = [1, dst_shape[0]];
                }
            }
        }
        var dst = new Matrix(dst_shape, this._klass);
        var dst_data = dst._data;
        var src_data = this._data;
        var dst_numel = dst._numel;
        for (var dst_idx = 0; dst_idx < dst_numel; dst_idx++) {
            var input_linear_idx = 0;
            for (var dim = 0; dim < inds_ndim; dim++) {
                var dst_coord = Math.floor(dst_idx / dst_stride[dim]) % dst_shape[dim];
                var src_coord = ind_iters[dim](dst_coord) - 1;
                input_linear_idx += src_coord * virtual_input_stride[dim];
            }
            dst_data[dst_idx] = src_data[input_linear_idx];
        }
        if (dst_reshape_shape) {
            dst.reshape_inplace(dst_reshape_shape);
        }
        return dst;
    };
    Matrix.prototype.get_matrix_nd_old = function (inds) {
        //multidim indexing
        //convert index of each dimension into array
        var eachdimidx = [];
        var eachdimstride = [];
        var output_size = [];
        var output_length = 1;
        var inputdimctr = [];
        for (var dim = 0; dim < inds.length; dim++) {
            var dimind = inds[dim];
            var dimidx;
            if (dimind instanceof Colon) {
                dimidx = dimind.tojsa(this._size[dim] === void 0 ? 1 : this._size[dim]);
            }
            else if (dimind instanceof Matrix) {
                dimidx = dimind._getdata();
            }
            else {
                //number
                dimidx = [dimind];
            }
            //range check
            var dimsize;
            if (dim == inds.length - 1) {
                // last index is regarded as linear index of remaining dimensions
                dimsize = 1;
                for (var dimex = dim; dimex < this._ndims; dimex++) {
                    dimsize *= this._size[dimex];
                }
            }
            else {
                dimsize = this._size[dim] || 1; //exceed dimension must be [1,1,...]
            }
            for (var i = 0; i < dimidx.length; i++) {
                var dimval = dimidx[i];
                if (dimval < 0) {
                    dimval += dimsize + 1;
                    dimidx[i] = dimval;
                }
                if ((dimval > dimsize) || (dimval < 1)) {
                    throw new Error('Index exceeds matrix dimension');
                }
            }
            eachdimidx.push(dimidx);
            eachdimstride.push(this._strides[dim] || 0);
            output_size.push(dimidx.length);
            output_length *= dimidx.length;
            inputdimctr.push(0);
        }
        var output = new Matrix(output_size, this._klass);
        var output_data = output._data;
        var input_data = this._data;
        for (var i = 0; i < output_length; i++) {
            //calc input index
            var input_raw_idx = 0;
            for (var dim = 0; dim < eachdimidx.length; dim++) {
                input_raw_idx += (eachdimidx[dim][inputdimctr[dim]] - 1) * eachdimstride[dim];
            }
            output_data[i] = input_data[input_raw_idx];
            //increment input index
            for (var dim = 0; dim < inputdimctr.length; dim++) {
                var element = ++inputdimctr[dim];
                if (element >= eachdimidx[dim].length) {
                    //overflow to next dimension
                    inputdimctr[dim] = 0;
                }
                else {
                    break;
                }
            }
        }
        return output;
    };
    Matrix.prototype.get_matrix_single = function (singleind) {
        var single_idx_array;
        var output_size;
        if (singleind instanceof Colon) {
            single_idx_array = singleind.tojsa(this._numel);
            output_size = [1, single_idx_array.length]; //row vector
        }
        else if (singleind instanceof Matrix) {
            // returns matrix of same shape
            // value in matrix is used as linear index
            single_idx_array = singleind._data;
            output_size = singleind._size;
        }
        var output = new Matrix(output_size, this._klass);
        var output_data = output._data;
        var input_data = this._data;
        for (var i = 0, length = single_idx_array.length; i < length; i++) {
            output_data[i] = input_data[single_idx_array[i] - 1];
        }
        return output;
    };
    Matrix.prototype.get_matrix_logical = function (map) {
        // equivalent to this.get(find(map))
        var output_length = 0;
        var map_data = map._getdata();
        var max_i = -1;
        for (var i = 0, length = map_data.length; i < length; i++) {
            if (map_data[i]) {
                output_length++;
                max_i = i;
            }
        }
        if (this._numel <= max_i) {
            throw new Error('Index out of bounds');
        }
        var output = new Matrix([output_length, 1], this._klass);
        var output_data = output._data;
        var input_data = this._data;
        var ptr = 0;
        for (var i = 0, length = map_data.length; i < length; i++) {
            if (map_data[i]) {
                output_data[ptr++] = input_data[i];
            }
        }
        return output;
    };
    Matrix.prototype.set = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        //last argument is value, but subsequent function requires first argument to be value
        var val = args.pop();
        if (!(val instanceof Matrix) && val.length !== void 0) {
            // js array (or array-like)
            val = Matrix.jsa2mat(val, false, this._klass);
        }
        // scalar matrix converted to number
        if (val instanceof Matrix && val._numel == 1) {
            val = val.get_scalar([1]);
        }
        var all_number = args.every(function (v) { return typeof (v) === 'number'; });
        if (all_number) {
            this.set_scalar(val, args);
        }
        else {
            this.set_matrix_nd(val, args);
        }
    };
    Matrix.prototype.set_scalar = function (val, inds) {
        var rawdata = this._alloccpu();
        this._isvalidindexerr(inds);
        var arrayidx = this._getarrayindex(inds);
        var scalar_val;
        if (val instanceof Matrix) {
            if (val._numel != 1) {
                throw new Error('Value is not scalar');
            }
            scalar_val = val._getdata()[0];
        }
        else {
            scalar_val = val;
        }
        if (Matrix._logical_cast_required(this._klass)) {
            scalar_val = Matrix._logical_cast(scalar_val);
        }
        rawdata[arrayidx] = scalar_val;
    };
    Matrix.prototype.set_matrix_single = function (val, singleind) {
        var single_idx_array;
        var output_size;
        if (singleind instanceof Colon) {
            single_idx_array = singleind.tojsa(this._numel);
        }
        else if (singleind instanceof Matrix) {
            // value in matrix is used as linear index
            // used as flattened value array, regardless of shape
            single_idx_array = singleind.getdataref();
        }
        var rawdata = this._alloccpu();
        if (val instanceof Matrix) {
            if (single_idx_array.length != val._numel) {
                throw new Error('Dimension mismatch');
            }
            var val_data = val._getdata();
            // read over flattened val
            if (Matrix._logical_cast_required(this._klass, val._klass)) {
                rawdata[single_idx_array[i] - 1] = Matrix._logical_cast(val_data[i]);
            }
            else {
                for (var i = 0, length = single_idx_array.length; i < length; i++) {
                    rawdata[single_idx_array[i] - 1] = val_data[i];
                }
            }
        }
        else {
            var scalar_val;
            if (Matrix._logical_cast_required(this._klass)) {
                scalar_val = Matrix._logical_cast(val);
            }
            else {
                scalar_val = val;
            }
            for (var i = 0, length = single_idx_array.length; i < length; i++) {
                rawdata[single_idx_array[i] - 1] = scalar_val;
            }
        }
    };
    Matrix.prototype.set_matrix_nd = function (val, inds) {
        var inds_ndim = inds.length;
        // replace logical matrix with vector
        for (var i = 0; i < inds_ndim; i++) {
            var ind = inds[i];
            if (ind instanceof Matrix) {
                if (ind._klass == 'logical') {
                    inds[i] = ind._find();
                }
            }
        }
        var virtual_input_shape = [];
        if (this._ndims <= inds_ndim) {
            // pad with 1
            virtual_input_shape = this._size.concat();
            while (virtual_input_shape.length < inds_ndim) {
                virtual_input_shape.push(1);
            }
        }
        else {
            // last dimension is like linear index
            var cur_prod = 1;
            for (var dim_2 = 0; dim_2 < inds_ndim - 1; dim_2++) {
                virtual_input_shape.push(this._size[dim_2]);
                cur_prod *= this._size[dim_2];
            }
            virtual_input_shape.push(this._numel / cur_prod);
        }
        var virtual_input_stride = [];
        var stride_tmp = 1;
        for (var dim = 0; dim < inds_ndim; dim++) {
            virtual_input_stride.push(stride_tmp);
            stride_tmp *= virtual_input_shape[dim];
        }
        var ind_iters = [];
        var dst_shape = [];
        var dst_stride = []; //not use dst._strides because tailing 1 dimension is omitted
        var dst_stride_tmp = 1;
        for (var dim = 0; dim < inds_ndim; dim++) {
            var iter_and_length = Matrix._get_ind_iterator(inds[dim], virtual_input_shape[dim]);
            ind_iters.push(iter_and_length.iter);
            dst_shape.push(iter_and_length.length);
            dst_stride.push(dst_stride_tmp);
            dst_stride_tmp *= iter_and_length.length;
        }
        var dst_numel = dst_stride_tmp;
        var scalar_val = null;
        if (typeof (val) === 'number') {
            scalar_val = val;
        }
        else if (val instanceof Matrix) {
            if (val._numel === 1) {
                scalar_val = val.valueOf();
            }
        }
        if (scalar_val == null) {
            // set matrix
            // shape check; dimensions excluding value 1 must match
            var dst_shape_exclude_one = dst_shape.filter(function (v) { return v != 1; });
            var val_shape_exclude_one = val._size.filter(function (v) { return v != 1; });
            if (dst_shape_exclude_one.length != val_shape_exclude_one.length) {
                throw Error('Shape mismatch');
            }
            if (!dst_shape_exclude_one.every(function (v, i) { return v == val_shape_exclude_one[i]; })) {
                throw Error('Shape mismatch');
            }
            var dst_data = val.getdataref();
            var src_data = this._data;
            for (var dst_idx = 0; dst_idx < dst_numel; dst_idx++) {
                var input_linear_idx = 0;
                for (var dim = 0; dim < inds_ndim; dim++) {
                    var dst_coord = Math.floor(dst_idx / dst_stride[dim]) % dst_shape[dim];
                    var src_coord = ind_iters[dim](dst_coord) - 1;
                    input_linear_idx += src_coord * virtual_input_stride[dim];
                }
                src_data[input_linear_idx] = dst_data[dst_idx];
            }
        }
        else {
            // set scalar
            var src_data = this._data;
            for (var dst_idx = 0; dst_idx < dst_numel; dst_idx++) {
                var input_linear_idx = 0;
                for (var dim = 0; dim < inds_ndim; dim++) {
                    var dst_coord = Math.floor(dst_idx / dst_stride[dim]) % dst_shape[dim];
                    var src_coord = ind_iters[dim](dst_coord) - 1;
                    input_linear_idx += src_coord * virtual_input_stride[dim];
                }
                src_data[input_linear_idx] = scalar_val;
            }
        }
    };
    Matrix.prototype.set_matrix_nd_old = function (val, inds) {
        //multidim indexing
        //convert index of each dimension into array
        var eachdimidx = [];
        var eachdimstride = [];
        var output_size = [];
        var output_length = 1;
        var inputdimctr = [];
        for (var dim = 0; dim < inds.length; dim++) {
            var dimind = inds[dim];
            var dimidx;
            if (dimind instanceof Colon) {
                dimidx = dimind.tojsa(this._size[dim] || 1);
            }
            else if (dimind instanceof Matrix) {
                dimidx = dimind._getdata();
            }
            else {
                //number
                dimidx = [dimind];
            }
            //range check
            var dim_size = this._size[dim] || 1; //exceed dimension must be [1,1,...]
            for (var i = 0; i < dimidx.length; i++) {
                if ((dimidx[i] > dim_size) || (dimidx[i] < 1)) {
                    throw new Error('Index exceeds matrix dimension');
                }
            }
            eachdimidx.push(dimidx);
            eachdimstride.push(this._strides[dim] || 0);
            output_size.push(dimidx.length);
            output_length *= dimidx.length;
            inputdimctr.push(0);
        }
        var rawdata = this._alloccpu();
        if (val instanceof Matrix) {
            //val shape check
            var is_vector = output_size.filter(function (v) { return v != 1; }).length <= 1;
            if (is_vector) {
                // if shape is vector, only numel have to match
                if (val._numel != output_length) {
                    throw new Error('Dimensions mismatch');
                }
            }
            else {
                // shape must match (exclude tailing 1)
                for (var dim = 0; dim < Math.max(val._size.length, output_size.length); dim++) {
                    if ((val._size[dim] || 1) != (output_size[dim] || 1)) {
                        throw new Error('Dimensions mismatch');
                    }
                }
            }
            var val_data = val._getdata();
            if (Matrix._logical_cast_required(this._klass, val._klass)) {
                for (var i = 0; i < output_length; i++) {
                    //calc input index
                    var input_raw_idx = 0;
                    for (var dim = 0; dim < eachdimidx.length; dim++) {
                        input_raw_idx += (eachdimidx[dim][inputdimctr[dim]] - 1) * eachdimstride[dim];
                    }
                    rawdata[input_raw_idx] = Matrix._logical_cast(val_data[i]);
                    //increment input index
                    for (var dim = 0; dim < inputdimctr.length; dim++) {
                        var element = ++inputdimctr[dim];
                        if (element >= eachdimidx[dim].length) {
                            //overflow to next dimension
                            inputdimctr[dim] = 0;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
            else {
                for (var i = 0; i < output_length; i++) {
                    //calc input index
                    var input_raw_idx = 0;
                    for (var dim = 0; dim < eachdimidx.length; dim++) {
                        input_raw_idx += (eachdimidx[dim][inputdimctr[dim]] - 1) * eachdimstride[dim];
                    }
                    rawdata[input_raw_idx] = val_data[i];
                    //increment input index
                    for (var dim = 0; dim < inputdimctr.length; dim++) {
                        var element = ++inputdimctr[dim];
                        if (element >= eachdimidx[dim].length) {
                            //overflow to next dimension
                            inputdimctr[dim] = 0;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
        }
        else {
            //val is scalar
            var scalar_val;
            if (Matrix._logical_cast_required(this._klass)) {
                scalar_val = Matrix._logical_cast(val);
            }
            else {
                scalar_val = val;
            }
            for (var i = 0; i < output_length; i++) {
                //calc input index
                var input_raw_idx = 0;
                for (var dim = 0; dim < eachdimidx.length; dim++) {
                    input_raw_idx += (eachdimidx[dim][inputdimctr[dim]] - 1) * eachdimstride[dim];
                }
                rawdata[input_raw_idx] = scalar_val;
                //increment input index
                for (var dim = 0; dim < inputdimctr.length; dim++) {
                    var element = ++inputdimctr[dim];
                    if (element >= eachdimidx[dim].length) {
                        //overflow to next dimension
                        inputdimctr[dim] = 0;
                    }
                    else {
                        break;
                    }
                }
            }
        }
    };
    Matrix.prototype.set_matrix_logical = function (val, map) {
        // equivalent to this.set(val, find(map))
        var output_length = 0;
        var map_data = map._getdata();
        var max_i = -1;
        for (var i = 0, length = map_data.length; i < length; i++) {
            if (map_data[i]) {
                output_length++;
                max_i = i;
            }
        }
        if (this._numel < max_i) {
            throw new Error('Index out of bounds');
        }
        var rawdata = this._alloccpu();
        if (val instanceof Matrix) {
            var val_data = val._getdata();
            var ptr = 0;
            if (Matrix._logical_cast_required(this._klass, val._klass)) {
                for (var i = 0, length = map_data.length; i < length; i++) {
                    if (map_data[i]) {
                        rawdata[i] = Matrix._logical_cast(val_data[ptr++]);
                    }
                }
            }
            else {
                for (var i = 0, length = map_data.length; i < length; i++) {
                    if (map_data[i]) {
                        rawdata[i] = val_data[ptr++];
                    }
                }
            }
        }
        else {
            var ptr = 0;
            var scalar_val;
            if (Matrix._logical_cast_required(this._klass)) {
                scalar_val = Matrix._logical_cast(val);
            }
            else {
                scalar_val = val;
            }
            for (var i = 0, length = map_data.length; i < length; i++) {
                if (map_data[i]) {
                    rawdata[i] = scalar_val;
                }
            }
        }
    };
    Matrix.prototype.toString = function () {
        var s = '';
        var rows = this._size[0], cols = this._size[1];
        var rawdata = this.getdataref();
        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                s += rawdata[col * rows + row] + '\t';
            }
            s += '\n';
        }
        return s;
    };
    Matrix.prototype.disp = function (X) {
        var s = '';
        if (this !== void 0) {
            s = this.toString();
        }
        else {
            s = X.toString();
        }
        console.log(s);
    };
    Matrix.prototype.reshape_inplace = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var _size;
        var first_arg = args[0];
        //convert to Array
        if (first_arg instanceof Matrix) {
            var tarray = first_arg._getdata();
            _size = Array.prototype.slice.call(tarray);
        }
        else if (first_arg.length !== void 0) {
            _size = Array.prototype.slice.call(first_arg);
        }
        else {
            _size = Array.prototype.slice.call(args);
        }
        //type check
        var tmpnumel = 1;
        var strides = [];
        var last_none_one_dim = 0;
        if (_size.length < 2) {
            throw new Error('matrix must have at least 2 dimensions');
        }
        //substitute -1 to remaining value
        var minus_pos = -1;
        var remaining_prod = 1;
        for (var i = 0; i < _size.length; i++) {
            if (_size[i] < 0) {
                if (minus_pos >= 0) {
                    throw new Error('Only one free size is accepted');
                }
                minus_pos = i;
            }
            else {
                remaining_prod *= _size[i];
            }
        }
        if (minus_pos >= 0) {
            _size[minus_pos] = this._numel / remaining_prod;
        }
        for (var i = 0; i < _size.length; i++) {
            var dimsize = _size[i];
            if (typeof (dimsize) !== 'number' || dimsize < 0 || !Matrix._isinteger(dimsize)) {
                throw new Error('size is invalid');
            }
            if (dimsize != 1) {
                last_none_one_dim = i;
            }
            strides.push(tmpnumel);
            tmpnumel *= dimsize;
        }
        if (tmpnumel !== this._numel) {
            throw new Error('New shape must have same elements');
        }
        //remove tail dimensions with size 1 (retain minimum 2 dimensions)
        last_none_one_dim = Math.max(last_none_one_dim, 1) + 1;
        _size.splice(last_none_one_dim);
        strides.splice(last_none_one_dim);
        this._size = _size;
        this._numel = tmpnumel;
        this._ndims = _size.length;
        this._strides = strides;
    };
    Matrix.prototype.squeeze_inplace = function () {
        if (this._ndims == 2) {
            // keep [1,5] remained
            return;
        }
        var new_size = this._size.filter(function (v) { return v !== 1; });
        //append 1 to tail
        while (new_size.length < 2) {
            new_size.push(1);
        }
        var tmpnumel = 1;
        var strides = [];
        for (var dim = 0; dim < new_size.length; dim++) {
            var dimsize = new_size[dim];
            strides.push(tmpnumel);
            tmpnumel *= dimsize;
        }
        this._size = new_size;
        this._ndims = new_size.length;
        this._strides = strides;
    };
    Matrix.prototype._find = function () {
        // returns nonzero-element indices
        // if this is vector, direction (row/col) is kept.
        // otherwise, column vector is returned.
        var output_length = 0;
        var src_data = this.getdataref();
        for (var i = 0; i < src_data.length; i++) {
            if (src_data[i]) {
                output_length++;
            }
        }
        var dst = new Matrix([output_length, 1], 'int32');
        var dst_idx = 0;
        var dst_data = dst._data;
        for (var i = 0; dst_idx < output_length; i++) {
            if (src_data[i]) {
                dst_data[dst_idx++] = i + 1;
            }
        }
        if (this._size[1] == this._numel) {
            // row vector
            dst.reshape_inplace(this._size);
        }
        return dst;
    };
    Matrix._autodestruct_stack = [];
    Matrix._autodestruct_stack_top = null;
    Matrix.data_ctors = { 'single': Float32Array, 'int32': Int32Array, 'uint8': Uint8Array, 'logical': Uint8Array };
    return Matrix;
}());
module.exports = Matrix;

},{"./colon":2}],7:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Matrix = require('./matrix');
function mtimes(A, B) {
    if (A._ndims != 2 || B._ndims != 2) {
        throw new Error('Matrix must be two-dimensional');
    }
    if (A._size[1] != B._size[0]) {
        throw new Error('Shape mismatch');
    }
    if (A._klass != 'single' || B._klass != 'single') {
        throw new Error('Matrix klass must be single');
    }
    var m = A._size[0], n = B._size[1], k = A._size[1];
    var lda = A._strides[1];
    var ldb = B._strides[1];
    var data_a = A._data;
    var data_b = B._data;
    var dst = new Matrix([m, n], 'single');
    var ldc = dst._strides[1];
    var data_c = dst._data;
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var sum = 0;
            for (var r = 0; r < k; r++) {
                sum += data_a[i + r * lda] * data_b[r + j * ldb];
            }
            data_c[i + j * ldc] = sum;
        }
    }
    return dst;
}
exports.mtimes = mtimes;

},{"./matrix":6}],8:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Matrix = require('./matrix');
var util = require('./util');
var func_generator = require('./func_generator');
function max_along_axis_old(A, dim) {
    if (dim == null) {
        //select first non-1 axis
        dim = A._numel;
        for (var i = 0; i < A._size.length; i++) {
            var dimsize = A._size[i];
            if (dimsize !== 1) {
                dim = i + 1;
                break;
            }
        }
    }
    if (dim > A._ndims) {
        //max along axis with size 1
        return A.copy();
    }
    var dstsize = A._size.slice();
    if (dstsize[dim - 1] !== 0) {
        //size 0 dimension is preserved
        dstsize[dim - 1] = 1;
    }
    if ((A._numel === 0) || (A._size[dim - 1] === 1)) {
        //only change shape
        var dst_onlyreshape = A.copy();
        dst_onlyreshape.reshape_inplace(dstsize);
        return dst_onlyreshape;
    }
    //reduction actually needed
    var dst = new Matrix(dstsize, A._klass);
    var input_strides = A._strides;
    var output_strides = dst._strides.slice();
    while (output_strides.length <= input_strides.length) {
        output_strides.push(dst._numel);
    }
    var reduction_step = input_strides[dim - 1];
    var reduction_count = A._size[dim - 1];
    var a_data = A._data;
    var dst_data = dst._data;
    var dims = A._ndims;
    for (var dst_idx = 0, dst_numel = dst._numel; dst_idx < dst_numel; dst_idx++) {
        var src_idx = 0;
        for (var d = 0; d < dims; d++) {
            src_idx += Math.floor(dst_idx % output_strides[d + 1] / output_strides[d]) * input_strides[d];
        }
        var val = a_data[src_idx];
        var curret = val;
        for (var red = 1; red < reduction_count; red++) {
            src_idx += reduction_step;
            val = a_data[src_idx];
            if (val > curret) {
                curret = val;
            }
        }
        dst_data[dst_idx] = curret;
    }
    return dst;
}
function _argmax_ones_like(A) {
    var amax = new Matrix(A._size, 'int32');
    amax._data.fill(1);
    return { M: A, I: amax };
}
function make_reduction_along_axis(var_decl, var_update, result_assign, out_argmax) {
    var f;
    eval([
        "f = function(A, dim) {",
        "    if (dim == null) {",
        "        //select first non-1 axis",
        "        dim = A._numel;",
        "        for (var i = 0; i < A._size.length; i++) {",
        "            var dimsize = A._size[i];",
        "            if (dimsize !== 1) {",
        "                dim = i + 1;",
        "                break;",
        "            }",
        "        }",
        "    }",
        "    if (dim > A._ndims) {",
        "        //max along axis with size 1",
        out_argmax ? "return _argmax_ones_like(A.copy());" : "return A.copy();",
        "    }",
        "    var dstsize = A._size.slice();",
        "    if (dstsize[dim - 1] !== 0) {",
        "        //size 0 dimension is preserved",
        "        dstsize[dim - 1] = 1;",
        "    }",
        "    if (A._numel === 0) {",
        "        //only change shape",
        "        var dst_onlyreshape = A.copy();",
        "        dst_onlyreshape.reshape_inplace(dstsize);",
        out_argmax ? "return _argmax_ones_like(dst_onlyreshape);" : "return dst_onlyreshape;",
        "    }",
        "    //reduction actually needed",
        "    var dst = new Matrix(dstsize, A._klass);",
        out_argmax ? "var amax = new Matrix(dstsize, 'int32'); var amax_data = amax._data;" : "",
        "    var input_strides = A._strides;",
        "    var output_strides = dst._strides.slice();",
        "    while (output_strides.length <= input_strides.length) {",
        "        output_strides.push(dst._numel);",
        "    }",
        "    var reduction_step = input_strides[dim - 1];",
        "    var reduction_count = A._size[dim - 1];",
        "    var a_data = A._data;",
        "    var dst_data = dst._data;",
        "    var dims = A._ndims;",
        "    for (var dst_idx = 0, dst_numel = dst._numel; dst_idx < dst_numel; dst_idx++) {",
        "        var src_idx = 0;",
        "        for (var d = 0; d < dims; d++) {",
        "            src_idx += Math.floor(dst_idx % output_strides[d + 1] / output_strides[d]) * input_strides[d];",
        "        }",
        "        var val = a_data[src_idx];",
        //"        var curret = val;",
        var_decl,
        "        for (var red = 1; red < reduction_count; red++) {",
        "            src_idx += reduction_step;",
        "            val = a_data[src_idx];",
        //"            if (val > curret) {",
        //"                curret = val;",
        //"            }",
        var_update,
        "        }",
        //"        dst_data[dst_idx] = curret;",
        result_assign,
        "    }",
        out_argmax ? "return {M:dst,I:amax};" : "return dst;",
        "}",].join('\n'));
    return f;
}
function make_reduction_along_axis_stat(var_decl, var_update, result_assign) {
    var f;
    eval([
        "f = function(A, dim) {",
        "    if (dim == null) {",
        "        //select first non-1 axis",
        "        dim = A._numel;",
        "        for (var i = 0; i < A._size.length; i++) {",
        "            var dimsize = A._size[i];",
        "            if (dimsize !== 1) {",
        "                dim = i + 1;",
        "                break;",
        "            }",
        "        }",
        "    }",
        "    if (dim > A._ndims) {",
        "        //max along axis with size 1",
        "    }",
        "    var dstsize = A._size.slice();",
        "    if (dstsize[dim - 1] !== 0) {",
        "        //size 0 dimension is preserved",
        "        dstsize[dim - 1] = 1;",
        "    }",
        "    if (A._numel === 0) {",
        "        //only change shape",
        "        var dst_onlyreshape = A.copy();",
        "        dst_onlyreshape.reshape_inplace(dstsize);",
        "        return dst_onlyreshape;",
        "    }",
        "    //reduction actually needed",
        "    var dst = new Matrix(dstsize, 'single');",
        "    var input_strides = A._strides;",
        "    var output_strides = dst._strides.slice();",
        "    while (output_strides.length <= input_strides.length) {",
        "        output_strides.push(dst._numel);",
        "    }",
        "    var reduction_step = input_strides[dim - 1];",
        "    var reduction_count = A._size[dim - 1];",
        "    var a_data = A._data;",
        "    var dst_data = dst._data;",
        "    var dims = A._ndims;",
        "    for (var dst_idx = 0, dst_numel = dst._numel; dst_idx < dst_numel; dst_idx++) {",
        "        var src_idx = 0;",
        "        for (var d = 0; d < dims; d++) {",
        "            src_idx += Math.floor(dst_idx % output_strides[d + 1] / output_strides[d]) * input_strides[d];",
        "        }",
        "        var val = a_data[src_idx];",
        //"        var curret = val;",
        var_decl,
        "        for (var red = 1; red < reduction_count; red++) {",
        "            src_idx += reduction_step;",
        "            val = a_data[src_idx];",
        //"            if (val > curret) {",
        //"                curret = val;",
        //"            }",
        var_update,
        "        }",
        //"        dst_data[dst_idx] = curret;",
        result_assign,
        "    }",
        "return dst;",
        "}",].join('\n'));
    return f;
}
var max_along_axis = make_reduction_along_axis('var curret = val;', 'if(val>curret){curret=val;}', 'dst_data[dst_idx]=curret;', false);
var max_elementwise = func_generator.make_binary_arith_func_all('Math.max(%a,%b)');
var min_along_axis = make_reduction_along_axis('var curret = val;', 'if(val<curret){curret=val;}', 'dst_data[dst_idx]=curret;', false);
var min_elementwise = func_generator.make_binary_arith_func_all('Math.min(%a,%b)');
function max(A, B, dim) {
    if (B == null) {
        //max along axis
        return max_along_axis(util.as_mat(A), dim);
    }
    else {
        //elementwise max
        return max_elementwise(A, B);
    }
}
exports.max = max;
function min(A, B, dim) {
    if (B == null) {
        return min_along_axis(util.as_mat(A), dim);
    }
    else {
        return min_elementwise(A, B);
    }
}
exports.min = min;
var argmax_along_axis = make_reduction_along_axis('var curret = val, curamax = 0;', 'if(val>curret){curret=val;curamax=red;}', 'dst_data[dst_idx]=curret; amax_data[dst_idx]=curamax+1;', true);
function argmax(A, dummy, dim) {
    return argmax_along_axis(util.as_mat(A), dim);
}
exports.argmax = argmax;
var argmin_along_axis = make_reduction_along_axis('var curret = val, curamax = 0;', 'if(val<curret){curret=val;curamax=red;}', 'dst_data[dst_idx]=curret; amax_data[dst_idx]=curamax+1;', true);
function argmin(A, dummy, dim) {
    return argmin_along_axis(util.as_mat(A), dim);
}
exports.argmin = argmin;
function sum_mean(A, args, f) {
    var dim = undefined;
    var outtype = undefined;
    while (args.length > 0) {
        var arg = args.pop();
        if (typeof (arg) === 'string') {
            if (arg != 'native') {
                throw new Error('Outtype other than native is currently not supported');
            }
        }
        else if (typeof (arg) === 'number') {
            dim = arg;
        }
        else {
            throw new Error('Unknown argument ' + arg);
        }
    }
    return f(A, dim);
}
var sum_along_axis = make_reduction_along_axis_stat('var curret = val;', 'curret += val;', 'dst_data[dst_idx] = curret;');
function sum(A) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    return sum_mean(A, args, sum_along_axis);
}
exports.sum = sum;
var mean_along_axis = make_reduction_along_axis_stat('var curret = val;', 'curret += val;', 'dst_data[dst_idx] = curret / reduction_count;');
function mean(A) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    return sum_mean(A, args, mean_along_axis);
}
exports.mean = mean;
var prod_along_axis = make_reduction_along_axis_stat('var curret = val;', 'curret *= val;', 'dst_data[dst_idx] = curret;');
function prod(A) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    return sum_mean(A, args, prod_along_axis);
}
exports.prod = prod;
//w=0: normalize by N-1
var variance_along_axis_w0 = make_reduction_along_axis_stat('var normalsum = val; var sqsum = val * val;', 'normalsum += val; sqsum += val * val;', 'dst_data[dst_idx] = (sqsum - normalsum * normalsum / reduction_count) / Math.max(reduction_count - 1, 1);');
//w=1: normalize by N
var variance_along_axis_w1 = make_reduction_along_axis_stat('var normalsum = val; var sqsum = val * val;', 'normalsum += val; sqsum += val * val;', 'dst_data[dst_idx] = (sqsum - normalsum * normalsum / reduction_count) / reduction_count;');
function variance(A, w, dim) {
    if (w === void 0) { w = 0; }
    if (w == 0) {
        return variance_along_axis_w0(A, dim);
    }
    else if (w == 1) {
        return variance_along_axis_w1(A, dim);
    }
    else {
        throw new Error('w must be 0 or 1');
    }
}
exports.variance = variance;
//w=0: normalize by N-1
var std_along_axis_w0 = make_reduction_along_axis_stat('var normalsum = val; var sqsum = val * val;', 'normalsum += val; sqsum += val * val;', 'dst_data[dst_idx] = Math.sqrt((sqsum - normalsum * normalsum / reduction_count) / Math.max(reduction_count - 1, 1));');
//w=1: normalize by N
var std_along_axis_w1 = make_reduction_along_axis_stat('var normalsum = val; var sqsum = val * val;', 'normalsum += val; sqsum += val * val;', 'dst_data[dst_idx] = Math.sqrt((sqsum - normalsum * normalsum / reduction_count) / reduction_count);');
function std(A, w, dim) {
    if (w === void 0) { w = 0; }
    if (w == 0) {
        return std_along_axis_w0(A, dim);
    }
    else if (w == 1) {
        return std_along_axis_w1(A, dim);
    }
    else {
        throw new Error('w must be 0 or 1');
    }
}
exports.std = std;

},{"./func_generator":4,"./matrix":6,"./util":11}],9:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Matrix = require('./matrix');
var colon = require('./colonwrap');
function transpose(A) {
    if (A._ndims != 2) {
        throw new Error('Matrix must be two-dimensional');
    }
    A = A.to_cpu();
    var _a = A._size, dst_cols = _a[0], dst_rows = _a[1];
    var dst = new Matrix([dst_rows, dst_cols], A._klass);
    var a_data = A._data;
    var dst_data = dst._data;
    var i = 0;
    for (var dst_col = 0; dst_col < dst_cols; dst_col++) {
        for (var dst_row = 0; dst_row < dst_rows; dst_row++) {
            dst_data[i] = a_data[dst_row * dst_cols + dst_col];
            i++;
        }
    }
    return dst;
}
exports.transpose = transpose;
function repmat(A) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    A = A.to_cpu();
    //convert to Array
    var _rs; //number of repetion for each dim
    var first_arg = args[0];
    if (first_arg instanceof Matrix) {
        var tarray = first_arg._getdata();
        _rs = Array.prototype.slice.call(tarray);
    }
    else if (first_arg.length !== void 0) {
        _rs = Array.prototype.slice.call(first_arg);
    }
    else {
        _rs = Array.prototype.slice.call(args);
    }
    if (_rs.length === 1) {
        //[2] => [2,2]
        _rs.push(_rs[0]);
    }
    while (_rs.length < A._ndims) {
        _rs.push(1);
    }
    // remove tailing 1
    while ((_rs.length > A._ndims) && (_rs[_rs.length - 1] == 1)) {
        _rs.pop();
    }
    var newdims = _rs.length;
    var newsize = [];
    var input_strides = [];
    var output_strides = [];
    var tmp_in_stride = 1;
    var tmp_out_stride = 1;
    var n_copy = 1;
    var rs_strides = [];
    for (var dim = 0; dim < newdims; dim++) {
        var indimsize = A._ndims > dim ? A._size[dim] : 1;
        var outdimsize = indimsize * _rs[dim];
        rs_strides.push(n_copy);
        n_copy *= _rs[dim];
        newsize.push(outdimsize);
        input_strides.push(tmp_in_stride);
        output_strides.push(tmp_out_stride);
        tmp_in_stride *= indimsize;
        tmp_out_stride *= outdimsize;
    }
    input_strides.push(tmp_in_stride); //dummy
    rs_strides.push(n_copy); //dummy
    var output_steps = [];
    for (var i = 0; i < n_copy; i++) {
        var out_offset = 0;
        for (var dim = 0; dim < newdims; dim++) {
            out_offset += Math.floor(i % rs_strides[dim + 1] / rs_strides[dim]) * output_strides[dim] * (A._size[dim] || 1);
        }
        output_steps.push(out_offset);
    }
    var dst = new Matrix(newsize, A._klass);
    var a_data = A._data;
    var dst_data = dst._data;
    for (var i = 0, i_length = A._numel; i < i_length; i++) {
        var a_i = a_data[i];
        var out_offset = 0;
        for (var dim = 0; dim < newdims; dim++) {
            out_offset += Math.floor(i % input_strides[dim + 1] / input_strides[dim]) * output_strides[dim];
        }
        for (var j = 0; j < n_copy; j++) {
            var out_idx = out_offset + output_steps[j];
            dst_data[out_idx] = a_i;
        }
    }
    return dst;
}
exports.repmat = repmat;
function cat(dim) {
    var As = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        As[_i - 1] = arguments[_i];
    }
    //dimension other than concatenating dimension must be same
    var dst_size = As[0]._size.concat();
    // if dim == 4, [2, 3] => [2, 3, 1, 1]
    while (dst_size.length < dim) {
        dst_size.push(1);
    }
    var concat_offsets = [1];
    for (var i = 1; i < As.length; i++) {
        var A = As[i];
        if (A._numel == 0) {
            concat_offsets.push(0); //not used
            continue;
        }
        var a_size = A._size;
        if (a_size.length > dst_size.length) {
            throw Error('Dimension mismatch');
        }
        for (var d = 0; d < dst_size.length; d++) {
            var a_dim = a_size[d] || 1;
            if (d == dim - 1) {
                // dimension to concat
                concat_offsets.push(dst_size[d] + 1);
                dst_size[d] += a_dim;
            }
            else {
                if (a_dim != dst_size[d]) {
                    throw Error('Dimension mismatch');
                }
            }
        }
    }
    var dst = new Matrix(dst_size, As[0]._klass);
    for (var i = 0; i < As.length; i++) {
        var A = As[i];
        if (A._numel == 0) {
            continue;
        }
        var args = [];
        for (var d = 0; d < dst_size.length; d++) {
            var element = A._size[d] || 1;
            if (d == dim - 1) {
                args.push(colon(concat_offsets[i], concat_offsets[i] + element - 1));
            }
            else {
                args.push(colon());
            }
        }
        args.push(A);
        dst.set.apply(dst, args);
    }
    return dst;
}
exports.cat = cat;
function horzcat() {
    var As = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        As[_i - 0] = arguments[_i];
    }
    return cat.apply(void 0, [2].concat(As));
}
exports.horzcat = horzcat;
function vertcat() {
    var As = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        As[_i - 0] = arguments[_i];
    }
    return cat.apply(void 0, [1].concat(As));
}
exports.vertcat = vertcat;
function permute(A, order) {
    var src_size = A._size.concat();
    var numel = A._numel;
    if (order.length < src_size.length) {
        throw Error('order must include at least input dimension');
    }
    var ndim = order.length;
    var src_strides = A._strides.concat();
    while (src_size.length < ndim) {
        //append dimension of 1
        src_size.push(1);
        src_strides.push(numel);
    }
    var dst_size = [];
    for (var d = 0; d < ndim; d++) {
        var element = order[d] - 1; //order start from 1
        dst_size.push(src_size[element]);
    }
    var dst = new Matrix(dst_size, A._klass);
    var dst_strides = dst._strides.concat();
    while (dst_strides.length < ndim) {
        // occur when last dimensions are 1
        dst_strides.push(numel);
    }
    var dst_strides_perm = [];
    order.forEach(function (o, i) { return dst_strides_perm[o - 1] = dst_strides[i]; });
    var src_data = A.getdataref();
    var dst_data = dst._data;
    for (var i = 0; i < numel; i++) {
        var dst_idx = 0;
        for (var d = 0; d < ndim; d++) {
            dst_idx += Math.floor(i / src_strides[d]) % src_size[d] * dst_strides_perm[d];
        }
        dst_data[dst_idx] = src_data[i];
    }
    return dst;
}
exports.permute = permute;
function ipermute(A, order) {
    // reverse order
    var rev_order = order.concat(); //have same elements
    for (var d = 0; d < order.length; d++) {
        rev_order[order[d] - 1] = d + 1;
    }
    return permute(A, rev_order);
}
exports.ipermute = ipermute;

},{"./colonwrap":3,"./matrix":6}],10:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
exports.Matrix = require('./matrix');
exports.Colon = require('./colon');
exports.colon = require('./colonwrap');
var util = require('./util');
var func_generator = require('./func_generator');
var shape_converter = require('./shape_converter');
var reduction = require('./reduction');
var mul = require('./mul');
var npy = require('./io/npy');
//export import MatrixCL = require('./cl/matrix_cl');
exports.CL = null; // for webcl
exports.end = -1;
var initcl_result = null;
function initcl() {
    if (initcl_result != null) {
        return initcl_result;
    }
    try {
        var dummy = require('../src/cl/handwrittenjs/sushi_cl');
        initcl_result = true;
    }
    catch (ex) {
        console.error(ex);
        initcl_result = false;
    }
    return initcl_result;
}
exports.initcl = initcl;
function devicetype(A) {
    if (A instanceof exports.Matrix) {
        return 'cpu';
    }
    return null;
}
exports.devicetype = devicetype;
function autodestruct(f) {
    exports.Matrix.autodestruct_push();
    var mats_to_save = [];
    try {
        mats_to_save = f();
    }
    finally {
        if (typeof (mats_to_save) === 'object') {
            var mats_list;
            if (mats_to_save instanceof exports.Matrix) {
                // single matrix return
                mats_list = [mats_to_save];
            }
            else if (mats_to_save.length !== undefined) {
                //array-like
                mats_list = mats_to_save.filter(function (v) { return (v instanceof exports.Matrix); });
            }
            else {
                //dictionary
                mats_list = [];
                for (var k in mats_to_save) {
                    if (mats_to_save[k] instanceof exports.Matrix) {
                        mats_list.push(mats_to_save[k]);
                    }
                }
            }
            var stack_top = exports.Matrix._autodestruct_stack_top;
            var stack_second_top = exports.Matrix._autodestruct_stack[exports.Matrix._autodestruct_stack.length - 2];
            for (var i = 0; i < mats_list.length; i++) {
                var mat = mats_list[i];
                var delete_idx = stack_top.indexOf(mat);
                if (delete_idx >= 0) {
                    stack_top.splice(delete_idx, 1);
                    if (stack_second_top) {
                        stack_second_top.push(mat); //maybe destructed in nested autodestruct
                    }
                }
            }
        }
        exports.Matrix.autodestruct_pop();
    }
    return mats_to_save;
}
exports.autodestruct = autodestruct;
exports.typedarray2mat = exports.Matrix.typedarray2mat;
function zeros() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    var format = util.calc_zeros_size(args);
    return new exports.Matrix(format.size, format.klass);
}
exports.zeros = zeros;
function ones() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    var mat = zeros.apply(void 0, args);
    mat._data.fill(1);
    return mat;
}
exports.ones = ones;
function rand() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    var mat = zeros.apply(void 0, args);
    var data = mat._data;
    for (var i = 0, length = data.length; i < length; i++) {
        data[i] = Math.random();
    }
    return mat;
}
exports.rand = rand;
function randi(imax) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    //first argument: imax or [imin, imax]
    var _imin = 1, _imax = 1;
    if (imax.length != null) {
        if (imax.length === 2) {
            _imin = imax[0];
            _imax = imax[1];
        }
        else {
            throw new Error('Invalid imax');
        }
    }
    else {
        _imax = imax;
    }
    var mat = zeros.apply(void 0, args);
    var data = mat._data;
    for (var i = 0, length = data.length; i < length; i++) {
        data[i] = Math.floor(Math.random() * (_imax - _imin + 1)) + _imin;
    }
    return mat;
}
exports.randi = randi;
function randn() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    var mat = zeros.apply(void 0, args);
    var data = mat._data;
    for (var i = 0, length = data.length; i < length; i++) {
        var alpha = Math.random();
        var beta = Math.random();
        data[i] = Math.sqrt(-2 * Math.log(alpha)) * Math.sin(2 * Math.PI * beta);
    }
    return mat;
}
exports.randn = randn;
function eye() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    var mat = zeros.apply(void 0, args);
    var min_dim = Math.min(mat._size[0], mat._size[1]);
    for (var i = 1; i <= min_dim; i++) {
        mat.set(i, i, 1);
    }
    return mat;
}
exports.eye = eye;
function size(X, dim) {
    if (dim === void 0) {
        // return as row vector
        return jsa2mat([X._size], false, 'int32'); //int32 to represent value > 8M accurately
    }
    else {
        if (dim <= 0 || !exports.Matrix._isinteger(dim)) {
            throw new Error('Invalid dimension');
        }
        return X._size[dim - 1] || 1;
    }
}
exports.size = size;
function sizejsa(X) {
    return X._size;
}
exports.sizejsa = sizejsa;
function jsa2mat(A, one_d_column, klass) {
    return exports.Matrix.jsa2mat(A, one_d_column, klass);
}
exports.jsa2mat = jsa2mat;
function mat2jsa(A, one_d_flatten) {
    if (one_d_flatten === void 0) { one_d_flatten = false; }
    return A.mat2jsa(one_d_flatten);
}
exports.mat2jsa = mat2jsa;
function length(X) {
    return Math.max.apply(null, X._size);
}
exports.length = length;
function ndims(X) {
    return X._ndims;
}
exports.ndims = ndims;
function numel(X) {
    return X._numel;
}
exports.numel = numel;
function iscolumn(A) {
    return A._ndims == 2 && A._size[1] == 1;
}
exports.iscolumn = iscolumn;
function isrow(A) {
    return A._ndims == 2 && A._size[0] == 1;
}
exports.isrow = isrow;
function isvector(A) {
    return A._ndims == 2 && (A._size[0] == 1 || A._size[1] == 1);
}
exports.isvector = isvector;
function isempty(A) {
    return A._numel == 0;
}
exports.isempty = isempty;
function ismatrix(A) {
    return A._ndims == 2;
}
exports.ismatrix = ismatrix;
function isscalar(A) {
    // currently, number is not supported
    return A._numel == 1;
}
exports.isscalar = isscalar;
function klass(object) {
    return object._klass;
}
exports.klass = klass;
function gpuArray(A) {
    //overriden by sushi_cl
    return util.as_mat(A).copy();
}
exports.gpuArray = gpuArray;
function gather(A) {
    //overriden by sushi_cl
    return A.copy();
}
exports.gather = gather;
function jsaequal(a, b) {
    if (a.length != b.length) {
        return false;
    }
    for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}
// If input is 1x1 matrix, returns number
function _singlemat2number(A) {
    if ((A instanceof exports.Matrix) && isscalar(A)) {
        return A.get_scalar([1]);
    }
    return A;
}
//equality http://jp.mathworks.com/help/matlab/relational-operators.html
exports.eq = func_generator.make_compare_func_all('Number(%a == %b)');
exports.ge = func_generator.make_compare_func_all('Number(%a >= %b)');
exports.gt = func_generator.make_compare_func_all('Number(%a > %b)');
exports.le = func_generator.make_compare_func_all('Number(%a <= %b)');
exports.lt = func_generator.make_compare_func_all('Number(%a < %b)');
exports.ne = func_generator.make_compare_func_all('Number(%a != %b)');
exports.isequal = func_generator.isequal;
exports.isequaln = func_generator.isequaln;
exports.isclose = func_generator.isclose;
exports.allclose = func_generator.allclose;
exports.plus = func_generator.make_binary_arith_func_all('%a + %b');
exports.minus = func_generator.make_binary_arith_func_all('%a - %b');
exports.times = func_generator.make_binary_arith_func_all('%a * %b');
exports.rdivide = func_generator.make_binary_arith_func_all('%a / %b');
exports.ldivide = func_generator.make_binary_arith_func_all('%b / %a');
exports.power = func_generator.make_binary_arith_func_all('Math.pow(%a,%b)');
exports.floor = func_generator.make_unary_arith_func_all('Math.floor(%a)');
exports.fix = func_generator.make_unary_arith_func_all('(%a > 0 ? Math.floor(%a) : Math.ceil(%a))');
exports.ceil = func_generator.make_unary_arith_func_all('Math.ceil(%a)');
exports.uplus = func_generator.make_unary_arith_func_all('+%a');
exports.uminus = func_generator.make_unary_arith_func_all('-%a');
exports.exp = func_generator.make_unary_arith_func_all('Math.exp(%a)');
exports.log = func_generator.make_unary_arith_func_all('Math.log(%a)');
exports.max = reduction.max;
exports.min = reduction.min;
exports.argmax = reduction.argmax;
exports.argmin = reduction.argmin;
exports.sum = reduction.sum;
exports.mean = reduction.mean;
exports.prod = reduction.prod;
exports.std = reduction.std;
exports.variance = reduction.variance;
exports.mtimes = mul.mtimes;
function reshape(A) {
    var sz = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sz[_i - 1] = arguments[_i];
    }
    var dst = A.copy();
    try {
        dst.reshape_inplace.apply(dst, sz);
        return dst;
    }
    catch (error) {
        dst.destruct();
        throw error;
    }
}
exports.reshape = reshape;
function squeeze(A) {
    var dst = A.copy();
    dst.squeeze_inplace();
    return dst;
}
exports.squeeze = squeeze;
exports.transpose = shape_converter.transpose;
exports.t = exports.transpose; //alias
exports.repmat = shape_converter.repmat;
exports.cat = shape_converter.cat;
exports.horzcat = shape_converter.horzcat;
exports.vertcat = shape_converter.vertcat;
exports.permute = shape_converter.permute;
exports.ipermute = shape_converter.ipermute;
exports.npyread = npy.npyread;
exports.npysave = npy.npysave;
//indexing
//TODO:test
function sub2ind(matrixSize) {
    var dimSub = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        dimSub[_i - 1] = arguments[_i];
    }
    //note: 'end' cannot be used in matlab sub2ind; only positive index is valid
    var msizejsa;
    if (matrixSize instanceof exports.Matrix) {
        if (!isrow(matrixSize) || matrixSize._numel < 2) {
            throw new Error('matrixSize must be row vector');
        }
        msizejsa = matrixSize.mat2jsa(true);
    }
    else {
        msizejsa = matrixSize;
    }
    var stride = 1;
    var idx = 1;
    for (var i = 0; i < msizejsa.length; i++) {
        idx += ((dimSub[i] || 1) - 1) * stride;
        stride *= msizejsa[i];
    }
    return idx;
}
exports.sub2ind = sub2ind;
function colonvec(start, stop_step, stop, klass) {
    if (klass === void 0) { klass = 'single'; }
    // make row vector by i:j:k
    var step;
    if (stop == null) {
        stop = stop_step;
        step = 1;
    }
    else {
        step = stop_step;
    }
    var n_item = Math.max(Math.floor((stop - start) / step) + 1, 0);
    var vec = new exports.Matrix([1, n_item], klass);
    var vec_data = vec._data;
    for (var i = 0; i < n_item; i++) {
        vec_data[i] = start + step * i;
    }
    return vec;
}
exports.colonvec = colonvec;

},{"../src/cl/handwrittenjs/sushi_cl":"/src/cl/handwrittenjs/sushi_cl.js","./colon":2,"./colonwrap":3,"./func_generator":4,"./io/npy":5,"./matrix":6,"./mul":7,"./reduction":8,"./shape_converter":9,"./util":11}],11:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var Matrix = require('./matrix');
/**
 * Convert array-like to Matrix, number to 1x1 Matrix
 */
function as_mat(A) {
    if (A instanceof Matrix) {
        return A;
    }
    else {
        //array to matrix
        //number to 1x1 matrix
        return Matrix.jsa2mat(A);
    }
}
exports.as_mat = as_mat;
/**
 * Convert array-like to Matrix, preserving other type
 */
function as_mat_or_scalar(A) {
    if (A instanceof Matrix) {
        return A;
    }
    else if (typeof (A) === 'object' && A.length != null) {
        //array-like to Matrix
        return Matrix.jsa2mat(A);
    }
    else {
        return A; //preserve number
    }
}
exports.as_mat_or_scalar = as_mat_or_scalar;
//finds common output class for matrices
function commonklassstr() {
    var klasses = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        klasses[_i - 0] = arguments[_i];
    }
    // single > int32 > uint8 > logical
    var klass_order = ['single', 'int32', 'uint8', 'logical'];
    if (klasses.length == 0) {
        return klass_order[0];
    }
    var best_klass = 3;
    for (var i = 0; i < klasses.length; i++) {
        var element = klasses[i];
        var score = klass_order.indexOf(element);
        if (score < 0) {
            throw new Error('Unknown klass');
        }
        best_klass = Math.min(score, best_klass);
    }
    return klass_order[best_klass];
}
exports.commonklassstr = commonklassstr;
function commonklass() {
    var mats = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        mats[_i - 0] = arguments[_i];
    }
    //number not affects class decision
    var klasses = [];
    for (var i = 0; i < mats.length; i++) {
        var element = mats[i];
        if (element instanceof Matrix) {
            klasses.push(element._klass);
        }
    }
    return commonklassstr.apply(void 0, klasses);
}
exports.commonklass = commonklass;
function issamesize(sizea, sizeb) {
    for (var i = 0; i < sizea.length; i++) {
        if (sizea[i] != sizeb[i]) {
            return false;
        }
    }
    return true;
}
exports.issamesize = issamesize;
function force_cpu(A) {
    if (A instanceof Matrix) {
        return A.to_cpu();
    }
    else {
        return A;
    }
}
exports.force_cpu = force_cpu;
function force_cpu_scalar(A) {
    if (A instanceof Matrix) {
        if (A._numel == 1) {
            return A.get();
        }
        else {
            return A.to_cpu();
        }
    }
    else {
        return A;
    }
}
exports.force_cpu_scalar = force_cpu_scalar;
function jsaequal(a, b) {
    if (a.length != b.length) {
        return false;
    }
    for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}
exports.jsaequal = jsaequal;
function calc_zeros_size(args) {
    var size;
    var klass = 'single';
    if (args.length >= 1 && typeof (args[args.length - 1]) === 'string') {
        //zeros(_,typename)
        klass = args[args.length - 1];
        args.pop();
    }
    else if (args.length >= 2 && args[args.length - 2] == 'like') {
        //zeros('like', mat)
        klass = args[args.length - 1]._klass;
        args.pop();
        args.pop();
    }
    if (args.length == 0) {
        // return 1x1 matrix
        size = [1, 1];
    }
    else {
        if (args.length == 1) {
            if (typeof (args[0]) === 'number') {
                // nxn matrix
                size = [args[0], args[0]];
            }
            else if (args[0] instanceof Matrix) {
                // size given as matrix
                var sizemat = args[0];
                if (sizemat._size.length == 2 && sizemat._size[0] == 1 && sizemat._size[1] >= 1) {
                    size = Array.prototype.slice.call(sizemat._getdata());
                }
                else {
                    throw new Error('matrix size is not valid row vector');
                }
            }
            else {
                throw new Error('Unknown data type of argument 0');
            }
        }
        else {
            size = args;
        }
    }
    return { size: size, klass: klass };
}
exports.calc_zeros_size = calc_zeros_size;

},{"./matrix":6}]},{},[1])(1)
});