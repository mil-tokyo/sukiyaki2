/*!
 Sukiyaki2 library (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
*/

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.milsukiyaki2 = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var Sukiyaki = require('./src/sukiyaki');
module.exports = Sukiyaki;

},{"./src/sukiyaki":32}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = byteOffset; i < arrLength; ++i) {
    if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }

  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":4,"ieee754":5,"isarray":6}],4:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],5:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],6:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],7:[function(require,module,exports){
(function (global){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var ArraySerializer = (function () {
    function ArraySerializer() {
    }
    ArraySerializer.dump = function (net, gradient) {
        if (gradient === void 0) { gradient = false; }
        // temporary format
        // header: json indicating offset and size of each variable
        // assuming all weights are Float32Array
        var header_obj;
        var max_header_size = 1024;
        var offset;
        var header_str;
        while (true) {
            header_obj = {};
            offset = max_header_size;
            // get size
            for (var layer_name in net.layer_instances) {
                if (net.layer_instances.hasOwnProperty(layer_name)) {
                    var layer_inst = net.layer_instances[layer_name];
                    if (!layer_inst.train_params) {
                        continue;
                    }
                    var params_names = gradient ? layer_inst.delta_params : layer_inst.train_params;
                    for (var i = 0; i < params_names.length; i++) {
                        var train_param_name = params_names[i];
                        var weight = layer_inst[train_param_name];
                        if ($M.klass(weight) != 'single') {
                            throw new Error('Only matrix of klass single is supported');
                        }
                        var weight_size = $M.numel(weight) * 4;
                        header_obj[layer_name + '/' + train_param_name] = { offset: offset, size: weight_size };
                        offset += weight_size;
                    }
                }
            }
            header_str = JSON.stringify(header_obj);
            if (header_str.length < max_header_size) {
                //ok
                break;
            }
            max_header_size = Math.ceil(header_str.length / 1024) * 1024 + 1024; //increase header size and retry
        }
        var buf = new Uint8Array(offset);
        //write header as binary
        for (var i = 0; i < header_str.length; i++) {
            buf[i] = header_str.charCodeAt(i);
        }
        //console.log(header_str);
        //write body
        for (var obj_name in header_obj) {
            if (header_obj.hasOwnProperty(obj_name)) {
                var offset_size = header_obj[obj_name];
                var _a = obj_name.split('/'), layer_name = _a[0], train_param_name = _a[1];
                var weight = net.layer_instances[layer_name][train_param_name];
                var bin_view = new Float32Array(buf.buffer, offset_size.offset, offset_size.size / 4);
                weight.getdatacopy(null, null, bin_view);
            }
        }
        return buf;
    };
    ArraySerializer.load = function (buf, net) {
        //parse header
        var header_str = '';
        for (var i = 0; i < 32768; i++) {
            if (buf[i] == 0) {
                break;
            }
            header_str += String.fromCharCode(buf[i]);
        }
        //console.log(header_str);
        var header_obj = JSON.parse(header_str);
        //copy body to each layer weight
        for (var obj_name in header_obj) {
            if (header_obj.hasOwnProperty(obj_name)) {
                var offset_size = header_obj[obj_name];
                var _a = obj_name.split('/'), layer_name = _a[0], train_param_name = _a[1];
                //console.log(layer_name);
                var weight = net.layer_instances[layer_name][train_param_name];
                var bin_view = new Float32Array(buf.buffer, offset_size.offset, offset_size.size / 4);
                if (weight) {
                    weight.setdata(bin_view);
                }
            }
        }
    };
    return ArraySerializer;
}());
module.exports = ArraySerializer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],8:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var ForwardConfiguration = (function () {
    function ForwardConfiguration() {
    }
    return ForwardConfiguration;
}());
module.exports = ForwardConfiguration;

},{}],9:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var AccuracyLayer = (function (_super) {
    __extends(AccuracyLayer, _super);
    function AccuracyLayer(params) {
        _super.call(this);
    }
    AccuracyLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    AccuracyLayer.prototype.forward = function (bottoms, config, callback) {
        //softmax cross entropy
        var data = bottoms[0];
        var gtlabel = bottoms[1]; //label: 0 to nlabel-1
        var accuracy = $M.autodestruct(function () {
            var predlabel = $M.argmax(data, 0, 1).I; //1 to nlabel
            predlabel = $M.minus(predlabel, 1);
            var match = $M.eq(gtlabel, predlabel);
            var accuracy = $M.sum(match).get() / $M.numel(match);
            return accuracy;
        });
        setImmediate(function () {
            callback([$M.jsa2mat([accuracy])]);
        });
    };
    AccuracyLayer.prototype.release = function () {
    };
    AccuracyLayer.prototype.destruct = function () {
    };
    return AccuracyLayer;
}(Layer));
module.exports = AccuracyLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],10:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var bn_forward_kernel = null;
var bn_backward_kernel = null;
function get_bn_forward_kernel() {
    if (!bn_forward_kernel) {
        bn_forward_kernel = $M.CL.createKernel([
            '#define MAX_WORK_SIZE 256',
            '__kernel void kernel_func(__global float *top, __global float *x_normalized, __global float *inv_std,',
            '__global const float *data, __global const float *gamma, __global const float *beta,',
            'uint left_size, uint channel_size, uint right_size, float eps)',
            '{',
            'uint ch = get_group_id(0);',
            'uint i = get_local_id(0);',
            'uint work_size = get_local_size(0);',
            '__local float node_sum[MAX_WORK_SIZE];',
            '__local float node_sqsum[MAX_WORK_SIZE];',
            //get sum and squared sum
            'float local_sum = 0.0F, local_sqsum = 0.0F;',
            'for (int j = i; j < left_size * right_size; j += work_size) {',
            '  float val = data[(j % left_size) + (ch + j / left_size * channel_size) * left_size];',
            '  local_sum += val;',
            '  local_sqsum += val * val;',
            '}',
            'node_sum[i] = local_sum;',
            'node_sqsum[i] = local_sqsum;',
            'barrier(CLK_LOCAL_MEM_FENCE);',
            // calculate mean, std by node i==0
            'float mean = 0.0F, variance = 0.0F, inv_stdev = 0.0F;',
            'if (i == 0) {',
            '  for (int j = 1; j < work_size; j++) {',
            '    local_sum += node_sum[j];',
            '    local_sqsum += node_sqsum[j];',
            '  }',
            '  mean = local_sum / (left_size * right_size);',
            '  variance = local_sqsum / (left_size * right_size) - mean * mean;',
            '  inv_stdev = 1.0F / sqrt(variance + eps);',
            '  node_sum[0] = mean;',
            '  node_sqsum[0] = inv_stdev;',
            '  inv_std[ch] = inv_stdev;',
            '}',
            'barrier(CLK_LOCAL_MEM_FENCE);',
            // normalize variables
            'mean = node_sum[0];',
            'inv_stdev = node_sqsum[0];',
            'float ch_gamma = gamma[ch], ch_beta = beta[ch];',
            'for (int j = i; j < left_size * right_size; j += work_size) {',
            '  int idx = (j % left_size) + (ch + j / left_size * channel_size) * left_size;',
            '  float val = data[idx];',
            '  val = (val - mean) * inv_stdev;',
            '  x_normalized[idx] = val;',
            '  val = val * ch_gamma + ch_beta;',
            '  top[idx] = val;',
            '}',
            '}'].join('\n'));
    }
    return bn_forward_kernel;
}
function get_bn_backward_kernel() {
    if (!bn_backward_kernel) {
        bn_backward_kernel = $M.CL.createKernel([
            '#define MAX_WORK_SIZE 256',
            '__kernel void kernel_func(__global float *bottom_delta, __global float *new_delta_gamma, __global float *new_delta_beta,',
            '__global const float *top_delta, __global const float *tmp_x_normalized, __global const float *tmp_inv_std,',
            '__global const float *gamma, __global const float *delta_gamma, __global const float *delta_beta,',
            'uint left_size, uint channel_size, uint right_size)',
            '{',
            'uint ch = get_group_id(0);',
            'uint i = get_local_id(0);',
            'uint work_size = get_local_size(0);',
            '__local float node_top_delta_sum[MAX_WORK_SIZE];',
            '__local float node_top_delta_x_norm_sum[MAX_WORK_SIZE];',
            //get sum and squared sum
            'float local_top_delta_sum = 0.0F, local_top_delta_x_norm_sum = 0.0F;',
            'for (int j = i; j < left_size * right_size; j += work_size) {',
            '  int idx = (j % left_size) + (ch + j / left_size * channel_size) * left_size;',
            '  float val_delta = top_delta[idx];',
            '  float val_txnorm = tmp_x_normalized[idx];',
            '  local_top_delta_sum += val_delta;',
            '  local_top_delta_x_norm_sum += val_delta * val_txnorm;',
            '}',
            'node_top_delta_sum[i] = local_top_delta_sum;',
            'node_top_delta_x_norm_sum[i] = local_top_delta_x_norm_sum;',
            'barrier(CLK_LOCAL_MEM_FENCE);',
            // calculate mean, std by node i==0
            'float cur_delta_beta = 0.0F, cur_delta_gamma = 0.0F;',
            'if (i == 0) {',
            '  for (int j = 1; j < work_size; j++) {',
            '    local_top_delta_sum += node_top_delta_sum[j];',
            '    local_top_delta_x_norm_sum += node_top_delta_x_norm_sum[j];',
            '  }',
            '  cur_delta_beta = local_top_delta_sum;',
            '  cur_delta_gamma = local_top_delta_x_norm_sum;',
            '  node_top_delta_sum[0] = cur_delta_beta;',
            '  node_top_delta_x_norm_sum[0] = cur_delta_gamma;',
            '  new_delta_gamma[ch] = cur_delta_gamma + delta_gamma[ch];',
            '  new_delta_beta[ch] = cur_delta_beta + delta_beta[ch];',
            '}',
            'barrier(CLK_LOCAL_MEM_FENCE);',
            // normalize variables
            'cur_delta_beta = node_top_delta_sum[0];',
            'cur_delta_gamma = node_top_delta_x_norm_sum[0];',
            'float gds = gamma[ch] * tmp_inv_std[ch];',
            'float coef1 = cur_delta_gamma / (left_size * right_size);',
            'float coef2 = cur_delta_beta / (left_size * right_size);',
            'for (int j = i; j < left_size * right_size; j += work_size) {',
            '  int idx = (j % left_size) + (ch + j / left_size * channel_size) * left_size;',
            '  bottom_delta[idx] = (top_delta[idx] - tmp_x_normalized[idx] * coef1 - coef2) * gds;',
            '}',
            '}'].join('\n'));
    }
    return bn_backward_kernel;
}
var BatchNormalizationLayer = (function (_super) {
    __extends(BatchNormalizationLayer, _super);
    function BatchNormalizationLayer(params) {
        _super.call(this);
        this.need_update = true;
        this.eps = params.eps || 1e-5;
        this.target_dim = params.target_dim || 1;
        this.in_size = params.in_size;
        this.gamma = $M.ones(this.in_size, 1);
        this.beta = $M.zeros(this.in_size, 1);
        this.delta_gamma = null;
        this.delta_beta = null;
        this.train_params = ['gamma', 'beta'];
        this.delta_params = ['delta_gamma', 'delta_beta'];
    }
    BatchNormalizationLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    BatchNormalizationLayer.prototype.forward = function (bottoms, config, callback) {
        var _this = this;
        //TODO: use saved mean / var when testing
        var data = bottoms[0];
        if (config.devicetype == 'cl') {
            var data_size = $M.sizejsa(data);
            var data_size_mat = $M.size(data);
            // divide matrix dimensions to left of channel, channel, right of channel
            var left_size = 1;
            var channel_size = 1;
            var right_size = 1;
            for (var dim = 0; dim < data_size.length; dim++) {
                var dim_size = data_size[dim];
                if (dim + 1 < this.target_dim) {
                    left_size *= dim_size;
                }
                else if (dim + 1 == this.target_dim) {
                    channel_size = dim_size;
                }
                else {
                    right_size *= dim_size;
                }
            }
            var top = $M.zeros(data_size_mat, 'gpuArray');
            var x_normalized = $M.zeros(data_size_mat, 'gpuArray');
            var inv_std = $M.zeros(channel_size, 1, 'gpuArray');
            var WebCL = $M.CL.WebCL;
            var group_size = 256;
            $M.CL.executeKernel(get_bn_forward_kernel(), [
                { access: WebCL.MEM_WRITE_ONLY, datum: top },
                { access: WebCL.MEM_WRITE_ONLY, datum: x_normalized },
                { access: WebCL.MEM_WRITE_ONLY, datum: inv_std },
                { access: WebCL.MEM_READ_ONLY, datum: data },
                { access: WebCL.MEM_READ_ONLY, datum: this.gamma },
                { access: WebCL.MEM_READ_ONLY, datum: this.beta },
                { datum: left_size, type: WebCL.type.UINT },
                { datum: channel_size, type: WebCL.type.UINT },
                { datum: right_size, type: WebCL.type.UINT },
                { datum: this.eps, type: WebCL.type.FLOAT }
            ], [group_size * channel_size], [group_size]);
        }
        else {
            var _a = $M.autodestruct(function () {
                // move dimension to be normalized into first dim
                var ndim = $M.ndims(data);
                var perm = [_this.target_dim];
                for (var i = 1; i <= ndim; i++) {
                    if (i != _this.target_dim) {
                        perm.push(i);
                    }
                }
                var perm_data = $M.permute(data, perm);
                var perm_data_origsize = $M.size(perm_data);
                perm_data.reshape_inplace(_this.in_size, -1); //(c, n) or (c, h*w*n)
                var n = $M.size(perm_data, 2);
                var mean = $M.mean(perm_data, 2);
                var variance = $M.variance(perm_data, 1, 2); //w=1 to correspond to chainer
                variance = $M.plus(variance, _this.eps);
                var inv_std = $M.power(variance, -0.5); //TODO: use sqrt
                var tmp = $M.minus(perm_data, $M.repmat(mean, 1, n));
                var normalized = $M.times(tmp, $M.repmat(inv_std, 1, n));
                tmp = $M.times(normalized, $M.repmat(_this.gamma, 1, n));
                tmp = $M.plus(tmp, $M.repmat(_this.beta, 1, n));
                tmp.reshape_inplace(perm_data_origsize);
                var output = $M.ipermute(tmp, perm);
                return [output, normalized, inv_std];
            }), top = _a[0], x_normalized = _a[1], inv_std = _a[2];
        }
        this.tmp_x_normalized = x_normalized; //cl: data_shape, cpu: (c, h*w*n)
        this.tmp_inv_std = inv_std;
        this.calc_update_called = false;
        setImmediate(function () {
            callback([top]);
        });
    };
    BatchNormalizationLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        if (!this.calc_update_called) {
            throw Error('calculateUpdateParams have to be called before backward');
        }
        var bottom_delta = this.tmp_bottom_delta;
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    BatchNormalizationLayer.prototype.calculateUpdateParams = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        // for efficiency, bottom_delta is computed here
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var new_delta_gamma;
        var new_delta_beta;
        var bottom_delta;
        if (config.devicetype == 'cl') {
            var data_size = $M.sizejsa(top_delta);
            var data_size_mat = $M.size(top_delta);
            // divide matrix dimensions to left of channel, channel, right of channel
            var left_size = 1;
            var channel_size = 1;
            var right_size = 1;
            for (var dim = 0; dim < data_size.length; dim++) {
                var dim_size = data_size[dim];
                if (dim + 1 < this.target_dim) {
                    left_size *= dim_size;
                }
                else if (dim + 1 == this.target_dim) {
                    channel_size = dim_size;
                }
                else {
                    right_size *= dim_size;
                }
            }
            bottom_delta = $M.zeros(data_size_mat, 'gpuArray');
            new_delta_gamma = $M.zeros(channel_size, 1, 'gpuArray');
            new_delta_beta = $M.zeros(channel_size, 1, 'gpuArray');
            var WebCL = $M.CL.WebCL;
            var group_size = 256;
            $M.CL.executeKernel(get_bn_backward_kernel(), [
                { access: WebCL.MEM_WRITE_ONLY, datum: bottom_delta },
                { access: WebCL.MEM_WRITE_ONLY, datum: new_delta_gamma },
                { access: WebCL.MEM_WRITE_ONLY, datum: new_delta_beta },
                { access: WebCL.MEM_READ_ONLY, datum: top_delta },
                { access: WebCL.MEM_READ_ONLY, datum: this.tmp_x_normalized },
                { access: WebCL.MEM_READ_ONLY, datum: this.tmp_inv_std },
                { access: WebCL.MEM_READ_ONLY, datum: this.gamma },
                { access: WebCL.MEM_READ_ONLY, datum: this.delta_gamma },
                { access: WebCL.MEM_READ_ONLY, datum: this.delta_beta },
                { datum: left_size, type: WebCL.type.UINT },
                { datum: channel_size, type: WebCL.type.UINT },
                { datum: right_size, type: WebCL.type.UINT }
            ], [group_size * channel_size], [group_size]);
        }
        else {
            var _a = $M.autodestruct(function () {
                // move dimension to be normalized into first dim
                var ndim = $M.ndims(data);
                var perm = [_this.target_dim];
                for (var i = 1; i <= ndim; i++) {
                    if (i != _this.target_dim) {
                        perm.push(i);
                    }
                }
                var perm_delta = $M.permute(top_delta, perm);
                var perm_delta_origsize = $M.size(perm_delta);
                perm_delta.reshape_inplace(_this.in_size, -1); //(c, n) or (c, h*w*n)
                var n = $M.size(perm_delta, 2);
                var delta_beta = $M.sum(perm_delta, 2);
                var delta_gamma = $M.sum($M.times(perm_delta, _this.tmp_x_normalized), 2);
                var new_delta_gamma = $M.plus(_this.delta_gamma, delta_gamma);
                var new_delta_beta = $M.plus(_this.delta_beta, delta_beta);
                var gamma_div_std = $M.times(_this.gamma, _this.tmp_inv_std);
                var tmp = $M.plus($M.times(_this.tmp_x_normalized, $M.repmat(delta_gamma, 1, n)), $M.repmat(delta_beta, 1, n));
                tmp = $M.times(tmp, 1 / n);
                var perm_bottom_delta = $M.times($M.repmat(gamma_div_std, 1, n), $M.minus(perm_delta, tmp));
                perm_bottom_delta.reshape_inplace(perm_delta_origsize);
                var bottom_delta = $M.ipermute(perm_bottom_delta, perm);
                return [new_delta_gamma, new_delta_beta, bottom_delta];
            }), new_delta_gamma = _a[0], new_delta_beta = _a[1], bottom_delta = _a[2];
        }
        this.delta_gamma.destruct();
        this.delta_gamma = new_delta_gamma;
        this.delta_beta.destruct();
        this.delta_beta = new_delta_beta;
        this.tmp_bottom_delta = bottom_delta;
        this.calc_update_called = true;
        setImmediate(function () {
            callback();
        });
    };
    BatchNormalizationLayer.prototype.release = function () {
        if (this.tmp_x_normalized) {
            this.tmp_x_normalized.destruct();
            this.tmp_x_normalized = null;
        }
        if (this.tmp_inv_std) {
            this.tmp_inv_std.destruct();
            this.tmp_inv_std = null;
        }
    };
    BatchNormalizationLayer.prototype.destruct = function () {
    };
    return BatchNormalizationLayer;
}(Layer));
module.exports = BatchNormalizationLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],11:[function(require,module,exports){
(function (global,Buffer){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var fs = require('fs');
var BlobDataLayer = (function (_super) {
    __extends(BlobDataLayer, _super);
    function BlobDataLayer(params) {
        _super.call(this);
        this.params = params;
        this.file_prefix = params.file_prefix;
        this.data_shape = params.data_shape;
        this.data_klass = params.data_klass || 'uint8';
        switch (this.data_klass) {
            case 'single':
                this.data_klass_size = 4;
                break;
            case 'uint8':
                this.data_klass_size = 1;
                break;
            default:
                throw new Error('Unsupported data_klass');
        }
        this.record_size = this.data_shape.reduce(function (pv, cv) { return pv * cv; }, 1) * this.data_klass_size;
    }
    BlobDataLayer.prototype.init = function (callback) {
        var label_ary = new Int32Array(JSON.parse(fs.readFileSync(this.file_prefix + '.json', 'utf8')));
        this.label = $M.typedarray2mat([1, label_ary.length], 'int32', label_ary);
        this.length = label_ary.length;
        this.data_file = fs.openSync(this.file_prefix + '.bin', 'r');
        console.log('Data length set to ' + this.length);
        setImmediate(callback);
    };
    BlobDataLayer.prototype.forward = function (bottoms, config, callback) {
        var _this = this;
        var range = bottoms[0]; //[from, to]
        var range_min = range.get(1); //1 to length
        var range_size = range.get(2);
        range_min = (range_min - 1) % this.length + 1;
        if (range_min + range_size - 1 > this.length) {
            range_min = 1;
        }
        var range_max = range_min + range_size - 1;
        var batch_label = this.label.get($M.colon(), $M.colon(range_min, range_max));
        var buffer = new Buffer(this.record_size * range_size);
        fs.read(this.data_file, buffer, 0, this.record_size * range_size, this.record_size * (range_min - 1), function (err, bytesRead, _buffer) {
            var rawimgs;
            switch (_this.data_klass) {
                case 'single':
                    rawimgs = new Float32Array(buffer.buffer);
                    break;
                case 'uint8':
                    rawimgs = new Uint8Array(buffer.buffer);
                    break;
            }
            var batch_data = $M.typedarray2mat(_this.data_shape.concat(range_size), _this.data_klass, rawimgs);
            if (config.devicetype == 'cl') {
                var batch_data2 = batch_data;
                batch_data = $M.gpuArray(batch_data2);
                batch_data2.destruct();
                var batch_label2 = batch_label;
                batch_label = $M.gpuArray(batch_label2);
                batch_label2.destruct();
            }
            buffer = null;
            // pseudo read ahead (to disk cache)
            var buffer_dummy = new Buffer(_this.record_size * range_size);
            fs.read(_this.data_file, buffer_dummy, 0, _this.record_size * range_size, _this.record_size * (range_max), function (err, bytesRead, _buffer) { });
            callback([batch_data, batch_label]);
        });
    };
    BlobDataLayer.prototype.release = function () {
    };
    BlobDataLayer.prototype.destruct = function () {
        fs.closeSync(this.data_file);
    };
    return BlobDataLayer;
}(Layer));
module.exports = BlobDataLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./layer":18,"buffer":3,"fs":2}],12:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var BranchLayer = (function (_super) {
    __extends(BranchLayer, _super);
    function BranchLayer(params) {
        _super.call(this);
        if (!(params.n_output >= 1)) {
            throw Error('n_output must be positive integer');
        }
        this.n_output = params.n_output;
    }
    BranchLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    BranchLayer.prototype.forward = function (bottoms, config, callback) {
        //copy inputs
        var data = bottoms[0];
        var outputs = [];
        for (var i = 0; i < this.n_output; i++) {
            outputs.push(data.copy());
        }
        setImmediate(function () {
            callback(outputs);
        });
    };
    BranchLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        //sum all deltas
        var top_delta = top_deltas[0];
        var bottom_delta;
        if (this.n_output == 1) {
            bottom_delta = top_deltas[0].copy();
        }
        else {
            bottom_delta = $M.plus(top_deltas[0], top_deltas[1]);
            for (var i = 2; i < this.n_output; i++) {
                var new_bottom_delta = $M.plus(bottom_delta, top_deltas[i]);
                bottom_delta.destruct();
                bottom_delta = new_bottom_delta;
            }
        }
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    BranchLayer.prototype.release = function () {
    };
    BranchLayer.prototype.destruct = function () {
    };
    return BranchLayer;
}(Layer));
module.exports = BranchLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],13:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var im2col = require('../utils/im2col');
var mtimes_trans = require('../utils/mtimes_trans');
var ArrayHelper = require('../utils/array_helper');
var Convolution2DLayer = (function (_super) {
    __extends(Convolution2DLayer, _super);
    function Convolution2DLayer(params) {
        _super.call(this);
        this.need_update = true;
        this.in_size = params.in_size;
        this.out_size = params.out_size;
        this.group = params.group || 1;
        this.in_size_group = this.in_size / this.group;
        this.out_size_group = this.out_size / this.group;
        this.use_bias = params.bias == null ? true : Boolean(params.bias);
        this.ksize = ArrayHelper.repeat_scalar(params.ksize, 2); //kernel size [3,3]
        this.stride = ArrayHelper.repeat_scalar(params.stride, 2);
        this.pad = ArrayHelper.repeat_scalar(params.pad, 2);
        this.weight = $M.times($M.randn(this.ksize[0], this.ksize[1], this.in_size_group, this.out_size), 1.0 / Math.sqrt(this.ksize[0] * this.ksize[1] * this.in_size_group));
        this.delta_weight = null; //$M.zeros(in_size, out_size);
        this.delta_bias = null; //$M.zeros(out_size, 1);
        if (this.use_bias) {
            this.bias = $M.zeros(this.out_size, 1);
            this.train_params = ['weight', 'bias'];
            this.delta_params = ['delta_weight', 'delta_bias'];
        }
        else {
            this.bias = null;
            this.train_params = ['weight'];
            this.delta_params = ['delta_weight'];
        }
        if (this.group > 1) {
            this.forward = this.forward_group;
            this.backward = this.backward_group;
            this.calculateUpdateParams = this.calculateUpdateParams_group;
        }
        else {
            this.forward = this.forward_single;
            this.backward = this.backward_single;
            this.calculateUpdateParams = this.calculateUpdateParams_single;
        }
        this.timer_enable = false;
    }
    Convolution2DLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    Convolution2DLayer.prototype._start_timer = function (name) {
        if (this.timer_enable) {
            if (this.timer_begin) {
                this._stop_timer();
            }
            else {
                $M.CL.finish();
            }
            this.timer_name = name;
            this.timer_begin = Date.now();
        }
    };
    Convolution2DLayer.prototype._stop_timer = function () {
        if (this.timer_enable) {
            $M.CL.finish();
            var end_time = Date.now();
            var time_ms = end_time - this.timer_begin;
            this.timer_vals[this.timer_name] = (this.timer_vals[this.timer_name] || 0) + time_ms;
            this.timer_begin = null;
        }
    };
    Convolution2DLayer.prototype._show_timer = function (name) {
        if (this.timer_enable) {
            console.log('time for ' + name);
            for (var key in this.timer_vals) {
                if (this.timer_vals.hasOwnProperty(key)) {
                    var element = this.timer_vals[key];
                    console.log('' + key + ': ' + element);
                }
            }
        }
    };
    Convolution2DLayer.prototype.forward_single = function (bottoms, config, callback) {
        var _this = this;
        var data = bottoms[0]; // (h, w, c, n)
        var n = $M.size(data, 4);
        this.weight.reshape_inplace(this.ksize[0] * this.ksize[1] * this.in_size, this.out_size);
        this.timer_vals = {};
        var top = $M.autodestruct(function () {
            var out_h, out_w;
            var output = null;
            if (config.devicetype == 'cl') {
                _this._start_timer('im2col_perm');
                var col_permute = im2col.im2col_cl_perm(data, _this.ksize, _this.stride, _this.pad);
                var col_shape = $M.sizejsa(col_permute);
                out_h = col_shape[0];
                out_w = col_shape[1];
                col_permute.reshape_inplace(out_h * out_w * n, -1);
                _this._start_timer('mtimes');
                var output_b = $M.mtimes(col_permute, _this.weight);
                output_b.reshape_inplace(out_h * out_w, n, -1);
                _this._start_timer('permute_output');
                var output = $M.permute(output_b, [1, 3, 2]);
                output.reshape_inplace(out_h, out_w, _this.out_size, n);
                if (_this.use_bias) {
                    _this._start_timer('plus_bias');
                    var WebCL = $M.CL.WebCL;
                    $M.CL.executeKernel(get_forward_bias_kernel(), [
                        { access: WebCL.MEM_READ_WRITE, datum: output },
                        { access: WebCL.MEM_READ_ONLY, datum: _this.bias },
                        { datum: out_h, type: WebCL.type.INT },
                        { datum: out_w, type: WebCL.type.INT },
                        { datum: _this.out_size, type: WebCL.type.INT },
                        { datum: n, type: WebCL.type.INT }
                    ], output._numel);
                }
                _this._stop_timer();
                _this._show_timer('conv forward');
            }
            else {
                var input_data = data.getdataref();
                var _a = _this.ksize, k_h = _a[0], k_w = _a[1];
                var _b = _this.stride, s_y = _b[0], s_x = _b[1];
                var _c = _this.pad, p_h = _c[0], p_w = _c[1];
                var in_h = $M.size(data, 1);
                var in_w = $M.size(data, 2);
                var out_h = im2col.conv_outsize(in_h, k_h, s_x, p_h, false);
                var out_w = im2col.conv_outsize(in_w, k_w, s_y, p_w, false);
                var out_c = _this.out_size;
                var in_c = _this.in_size;
                output = $M.zeros(out_h, out_w, out_c, n);
                var output_data = output.getdataref();
                var w_data = _this.weight.getdataref();
                var b_data;
                if (_this.use_bias) {
                    b_data = _this.bias.getdataref();
                }
                for (var out_x = 0; out_x < out_w; out_x++) {
                    for (var out_y = 0; out_y < out_h; out_y++) {
                        for (var b = 0; b < n; b++) {
                            for (var out_d = 0; out_d < out_c; out_d++) {
                                var b_val = _this.use_bias ? b_data[out_d] : 0.0;
                                var cum = b_val;
                                for (var in_d = 0; in_d < in_c; in_d++) {
                                    for (var k_x = 0; k_x < k_w; k_x++) {
                                        var in_x = out_x * s_x + k_x - p_w;
                                        if (in_x < 0 || in_x >= in_w) {
                                            continue;
                                        }
                                        for (var k_y = 0; k_y < k_h; k_y++) {
                                            var in_y = out_y * s_y + k_y - p_h;
                                            if (in_y < 0 || in_y >= in_h) {
                                                continue;
                                            }
                                            cum += input_data[(((b * in_c) + in_d) * in_w + in_x) * in_h + in_y] * w_data[(((out_d * in_c) + in_d) * k_w + k_x) * k_h + k_y];
                                        }
                                    }
                                }
                                output_data[(((b * out_c) + out_d) * out_w + out_x) * out_h + out_y] = cum;
                            }
                        }
                    }
                }
            }
            return output;
        });
        this.weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);
        setImmediate(function () {
            callback([top]);
        });
    };
    Convolution2DLayer.prototype.backward_single = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var data_orig_shape = $M.size(data);
        this.timer_vals = {};
        var bottom_delta = $M.autodestruct(function () {
            var output;
            var n = $M.size(data, 4);
            var weight_origsize_jsa = $M.sizejsa(_this.weight);
            _this.weight.reshape_inplace(-1, _this.out_size);
            if (config.devicetype == 'cl') {
                _this._start_timer('transpose_weight');
                var top_delta_shape = $M.sizejsa(top_delta);
                var out_h = top_delta_shape[0];
                var out_w = top_delta_shape[1];
                top_delta.reshape_inplace(out_h * out_w, -1, n);
                _this._start_timer('permute_top_delta');
                var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
                top_delta.reshape_inplace(top_delta_shape);
                top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
                _this._start_timer('mtimes');
                //var delta_col_perm = $M.mtimes(top_delta_perm, weight_t);
                var delta_col_perm = mtimes_trans.mtimes_trans(top_delta_perm, _this.weight, false, true);
                delta_col_perm.reshape_inplace(out_h, out_w, n, _this.ksize[0], _this.ksize[1], _this.in_size);
                _this._start_timer('col2im_perm');
                var output = im2col.col2im_cl_perm(delta_col_perm, _this.stride, _this.pad, [$M.size(data, 1), $M.size(data, 2)]);
                _this._stop_timer();
                _this._show_timer('conv backward');
            }
            else {
                var top_delta_data = top_delta.getdataref();
                var _a = _this.ksize, k_h = _a[0], k_w = _a[1];
                var _b = _this.stride, s_y = _b[0], s_x = _b[1];
                var _c = _this.pad, p_h = _c[0], p_w = _c[1];
                var in_h = $M.size(data, 1);
                var in_w = $M.size(data, 2);
                var out_h = $M.size(top_delta, 1);
                var out_w = $M.size(top_delta, 2);
                var out_c = _this.out_size;
                var in_c = _this.in_size;
                var output = $M.zeros(in_h, in_w, in_c, n);
                var output_data = output.getdataref();
                var w_data = _this.weight.getdataref();
                if (s_x === 1 && s_y === 1) {
                    for (var in_d = 0; in_d < in_c; in_d++) {
                        for (var in_x = 0; in_x < in_w; in_x++) {
                            for (var in_y = 0; in_y < in_h; in_y++) {
                                for (var b = 0; b < n; b++) {
                                    var cum = 0.0;
                                    for (var out_d = 0; out_d < out_c; out_d++) {
                                        for (var k_x = 0; k_x < k_w; k_x++) {
                                            var out_x = in_x - k_x + p_w;
                                            if (out_x < 0 || out_x >= out_w) {
                                                continue;
                                            }
                                            for (var k_y = 0; k_y < k_h; k_y++) {
                                                var out_y = in_y - k_y + p_h;
                                                if (out_y < 0 || out_y >= out_h) {
                                                    continue;
                                                }
                                                cum += top_delta_data[(((b * out_c) + out_d) * out_w + out_x) * out_h + out_y] * w_data[(((out_d * in_c) + in_d) * k_w + k_x) * k_h + k_y];
                                            }
                                        }
                                    }
                                    output_data[(((b * in_c) + in_d) * in_w + in_x) * in_h + in_y] = cum;
                                }
                            }
                        }
                    }
                }
                else {
                    for (var in_d = 0; in_d < in_c; in_d++) {
                        for (var in_x = 0; in_x < in_w; in_x++) {
                            for (var in_y = 0; in_y < in_h; in_y++) {
                                for (var b = 0; b < n; b++) {
                                    var cum = 0.0;
                                    for (var out_d = 0; out_d < out_c; out_d++) {
                                        for (var k_x = 0; k_x < k_w; k_x++) {
                                            if ((in_x - k_x + p_w) % s_x !== 0) {
                                                continue;
                                            }
                                            var out_x = ((in_x - k_x + p_w) / s_x) | 0;
                                            if (out_x < 0 || out_x >= out_w) {
                                                continue;
                                            }
                                            for (var k_y = 0; k_y < k_h; k_y++) {
                                                if ((in_y - k_y + p_h) % s_y !== 0) {
                                                    continue;
                                                }
                                                var out_y = ((in_y - k_y + p_h) / s_y) | 0;
                                                if (out_y < 0 || out_y >= out_h) {
                                                    continue;
                                                }
                                                cum += top_delta_data[(((b * out_c) + out_d) * out_w + out_x) * out_h + out_y] * w_data[(((out_d * in_c) + in_d) * k_w + k_x) * k_h + k_y];
                                            }
                                        }
                                    }
                                    output_data[(((b * in_c) + in_d) * in_w + in_x) * in_h + in_y] = cum;
                                }
                            }
                        }
                    }
                }
            }
            _this.weight.reshape_inplace(weight_origsize_jsa);
            return output;
        });
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    Convolution2DLayer.prototype.calculateUpdateParams_single = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var top_delta_shape = $M.sizejsa(top_delta);
        this.timer_vals = {};
        var n = $M.size(data, 4);
        var new_delta_weight;
        if (config.devicetype == 'cl') {
            this._start_timer('im2col_perm');
            var col_permute = im2col.im2col_cl_perm(data, this.ksize, this.stride, this.pad);
            var col_shape = $M.sizejsa(col_permute);
            var out_h = col_shape[0];
            var out_w = col_shape[1];
            col_permute.reshape_inplace(out_h * out_w * n, -1);
            this._start_timer('permute_col_t ' + $M.sizejsa(col_permute));
            //var col_permute_t = $M.t(col_permute);
            var out_h = top_delta_shape[0];
            var out_w = top_delta_shape[1];
            top_delta.reshape_inplace(out_h * out_w, -1, n);
            this._start_timer('permute_top_delta');
            var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
            top_delta.reshape_inplace(top_delta_shape);
            top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
            this._start_timer('mtimes');
            //output = $M.mtimes(col_permute_t, top_delta_perm);
            if ($M.size(col_permute, 2) * $M.size(top_delta_perm, 2) >= 64 * 64) {
                new_delta_weight = mtimes_trans.mtimes_trans_cl(col_permute, top_delta_perm, true, false);
            }
            else {
                new_delta_weight = mtimes_trans.mtimes_atrans_largek(col_permute, top_delta_perm);
            }
            this._start_timer('destruct');
            var issue_destruct = Date.now();
            col_permute.destruct();
            top_delta_perm.destruct();
            this._stop_timer();
            new_delta_weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);
        }
        else {
            new_delta_weight = $M.autodestruct(function () {
                var input_data = data.getdataref();
                var top_delta_data = top_delta.getdataref();
                var _a = _this.ksize, k_h = _a[0], k_w = _a[1];
                var _b = _this.stride, s_y = _b[0], s_x = _b[1];
                var _c = _this.pad, p_h = _c[0], p_w = _c[1];
                var in_h = $M.size(data, 1) | 0;
                var in_w = $M.size(data, 2) | 0;
                var out_h = $M.size(top_delta, 1) | 0;
                var out_w = $M.size(top_delta, 2) | 0;
                var out_c = _this.out_size | 0;
                var in_c = _this.in_size | 0;
                var output = $M.zeros($M.size(_this.weight));
                var output_data = output.getdataref();
                for (var out_d = 0; out_d < out_c; out_d++) {
                    for (var in_d = 0; in_d < in_c; in_d++) {
                        for (var k_x = 0; k_x < k_w; k_x++) {
                            for (var k_y = 0; k_y < k_h; k_y++) {
                                var cum = 0.0;
                                for (var b = 0; b < n; b++) {
                                    for (var out_x = 0; out_x < out_w; out_x++) {
                                        var in_x = out_x * s_x + k_x - p_w;
                                        if (in_x < 0 || in_x >= in_w) {
                                            continue;
                                        }
                                        for (var out_y = 0; out_y < out_h; out_y++) {
                                            var in_y = out_y * s_y + k_y - p_h;
                                            if (in_y < 0 || in_y >= in_h) {
                                                continue;
                                            }
                                            cum += input_data[(((b * in_c) + in_d) * in_w + in_x) * in_h + in_y] * top_delta_data[(((b * out_c) + out_d) * out_w + out_x) * out_h + out_y];
                                        }
                                    }
                                }
                                output_data[(((out_d * in_c) + in_d) * k_w + k_x) * k_h + k_y] = cum;
                            }
                        }
                    }
                }
                // var output: $M.Matrix = null;
                // for (var batch = 1; batch <= n; batch++) {
                //   var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
                //   var col: $M.Matrix;
                //   col = im2col.im2col_cpu(img, this.ksize, this.stride, this.pad);
                //   var col_shape = $M.sizejsa(col);
                //   var out_h = col_shape[0];
                //   var out_w = col_shape[1];
                //   col.reshape_inplace(out_h * out_w, -1);
                //   var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
                //   top_delta_batch.reshape_inplace(out_h * out_w, -1);
                //   var delta_weight_b = $M.mtimes($M.t(col), top_delta_batch);
                //   if (batch == 1) {
                //     output = delta_weight_b;
                //   } else {
                //     var old_output = output;
                //     output = $M.plus(old_output, delta_weight_b);
                //     old_output.destruct();
                //     delta_weight_b.destruct();
                //   }
                // }
                // output.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size, this.out_size);
                return output;
            });
        }
        this._start_timer('add_delta');
        var old_delta_weight = this.delta_weight;
        this.delta_weight = $M.plus(old_delta_weight, new_delta_weight);
        old_delta_weight.destruct();
        new_delta_weight.destruct();
        this._stop_timer();
        if (this.use_bias) {
            if (config.devicetype == 'cl') {
                this._start_timer('bias');
                var WebCL = $M.CL.WebCL;
                var group_size = 256;
                $M.CL.executeKernel(get_update_bias_kernel(), [
                    { access: WebCL.MEM_READ_WRITE, datum: this.delta_bias },
                    { access: WebCL.MEM_READ_ONLY, datum: top_delta },
                    { datum: top_delta_shape[0] * top_delta_shape[1], type: WebCL.type.UINT },
                    { datum: top_delta_shape[2], type: WebCL.type.UINT },
                    { datum: top_delta_shape[3], type: WebCL.type.UINT }
                ], [group_size * top_delta_shape[2]], [group_size]);
                this._stop_timer();
            }
            else {
                // var td_permuted = $M.permute(top_delta, [3, 1, 2, 4]);
                // td_permuted.reshape_inplace($M.size(td_permuted, 1), -1);
                // var delta_bias = $M.sum(td_permuted, 2);
                // td_permuted.destruct();
                //var delta_bias = $M.zeros($M.size(this.delta_bias));
                var delta_bias_data = this.delta_bias.getdataref();
                var top_delta_data = top_delta.getdataref();
                var out_h = $M.size(top_delta, 1) | 0;
                var out_w = $M.size(top_delta, 2) | 0;
                var out_c = this.out_size | 0;
                var in_c = this.in_size | 0;
                var out_hw = out_h * out_w;
                for (var out_d = 0; out_d < out_c; out_d++) {
                    var cum = 0.0;
                    for (var b = 0; b < n; b++) {
                        for (var out_yx = 0; out_yx < out_hw; out_yx++) {
                            cum += top_delta_data[((b * out_c) + out_d) * out_hw + out_yx];
                        }
                    }
                    delta_bias_data[out_d] += cum;
                }
            }
        }
        this._show_timer('conv update');
        setImmediate(function () {
            callback();
        });
    };
    Convolution2DLayer.prototype.forward_group = function (bottoms, config, callback) {
        var _this = this;
        var data = bottoms[0]; // (h, w, c, n)
        var n = $M.size(data, 4);
        this.weight.reshape_inplace(this.ksize[0] * this.ksize[1] * this.in_size_group, this.out_size);
        this.timer_vals = {};
        var top = $M.autodestruct(function () {
            var out_h, out_w;
            var output = null;
            if (config.devicetype == 'cl') {
                _this._start_timer('im2col_perm');
                var output_b;
                for (var g = 0; g < _this.group; g++) {
                    var data_group = data.get($M.colon(), $M.colon(), $M.colon(_this.in_size_group * g + 1, _this.in_size_group * (g + 1)), $M.colon());
                    var col_permute = im2col.im2col_cl_perm(data_group, _this.ksize, _this.stride, _this.pad);
                    var col_shape = $M.sizejsa(col_permute);
                    out_h = col_shape[0];
                    out_w = col_shape[1];
                    col_permute.reshape_inplace(out_h * out_w * n, -1);
                    _this._start_timer('mtimes');
                    var weight_group = _this.weight.get($M.colon(), $M.colon(_this.out_size_group * g + 1, _this.out_size_group * (g + 1)));
                    var output_b_group = $M.mtimes(col_permute, weight_group);
                    col_permute.destruct();
                    output_b_group.reshape_inplace(out_h * out_w, n, -1);
                    if (g == 0) {
                        output_b = $M.zeros(out_h * out_w, n, _this.out_size, 'gpuArray');
                    }
                    output_b.set($M.colon(), $M.colon(), $M.colon(_this.out_size_group * g + 1, _this.out_size_group * (g + 1)), output_b_group);
                    output_b_group.destruct();
                }
                _this._start_timer('permute_output');
                var output = $M.permute(output_b, [1, 3, 2]);
                output.reshape_inplace(out_h, out_w, _this.out_size, n);
                if (_this.use_bias) {
                    _this._start_timer('plus_bias');
                    var WebCL = $M.CL.WebCL;
                    $M.CL.executeKernel(get_forward_bias_kernel(), [
                        { access: WebCL.MEM_READ_WRITE, datum: output },
                        { access: WebCL.MEM_READ_ONLY, datum: _this.bias },
                        { datum: out_h, type: WebCL.type.INT },
                        { datum: out_w, type: WebCL.type.INT },
                        { datum: _this.out_size, type: WebCL.type.INT },
                        { datum: n, type: WebCL.type.INT }
                    ], output._numel);
                }
                _this._stop_timer();
                _this._show_timer('conv forward');
            }
            else {
                for (var batch = 1; batch <= n; batch++) {
                    var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
                    var col;
                    col = im2col.im2col_cpu(img, _this.ksize, _this.stride, _this.pad);
                    img.destruct();
                    var col_shape = $M.sizejsa(col);
                    out_h = col_shape[0];
                    out_w = col_shape[1];
                    col.reshape_inplace(out_h * out_w, -1);
                    var output_b = $M.mtimes(col, _this.weight); //[out_h*out_w, out_size]
                    col.destruct();
                    if (_this.use_bias) {
                        var output_b_with_bias = $M.plus(output_b, $M.repmat($M.t(_this.bias), $M.sizejsa(output_b)[0], 1));
                        output_b.destruct();
                    }
                    else {
                        var output_b_with_bias = output_b;
                    }
                    if (batch == 1) {
                        output = $M.zeros(out_h * out_w, _this.out_size, n);
                    }
                    output.set($M.colon(), $M.colon(), batch, output_b_with_bias);
                    output_b_with_bias.destruct();
                }
                output.reshape_inplace(out_h, out_w, _this.out_size, n);
            }
            return output;
        });
        this.weight.reshape_inplace(this.ksize[0], this.ksize[1], this.in_size_group, this.out_size);
        setImmediate(function () {
            callback([top]);
        });
    };
    Convolution2DLayer.prototype.backward_group = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var data_orig_shape = $M.size(data);
        this.timer_vals = {};
        try {
            var bottom_delta = $M.autodestruct(function () {
                var output;
                var n = $M.size(data, 4);
                var weight_origsize_jsa = $M.sizejsa(_this.weight);
                _this.weight.reshape_inplace(-1, _this.out_size);
                if (config.devicetype == 'cl') {
                    _this._start_timer('transpose_weight');
                    var top_delta_shape = $M.sizejsa(top_delta);
                    var out_h = top_delta_shape[0];
                    var out_w = top_delta_shape[1];
                    top_delta.reshape_inplace(out_h * out_w, -1, n);
                    _this._start_timer('permute_top_delta');
                    var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
                    top_delta.reshape_inplace(top_delta_shape);
                    top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
                    output = $M.zeros(data_orig_shape, 'gpuArray');
                    for (var g = 0; g < _this.group; g++) {
                        var top_delta_perm_group = top_delta_perm.get($M.colon(), $M.colon(_this.out_size_group * g + 1, _this.out_size_group * (g + 1)));
                        _this._start_timer('mtimes');
                        //var delta_col_perm = $M.mtimes(top_delta_perm, weight_t);
                        var weight_group = _this.weight.get($M.colon(), $M.colon(_this.out_size_group * g + 1, _this.out_size_group * (g + 1)));
                        var delta_col_perm = mtimes_trans.mtimes_trans(top_delta_perm_group, weight_group, false, true);
                        delta_col_perm.reshape_inplace(out_h, out_w, n, _this.ksize[0], _this.ksize[1], _this.in_size_group);
                        _this._start_timer('col2im_perm');
                        var output_group = im2col.col2im_cl_perm(delta_col_perm, _this.stride, _this.pad, [$M.size(data, 1), $M.size(data, 2)]);
                        output.set($M.colon(), $M.colon(), $M.colon(_this.in_size_group * g + 1, _this.in_size_group * (g + 1)), $M.colon(), output_group);
                    }
                    _this._stop_timer();
                    _this._show_timer('conv backward');
                }
                else {
                    var weight_t = $M.t(_this.weight);
                    for (var batch = 1; batch <= n; batch++) {
                        var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
                        var top_delta_shape = $M.sizejsa(top_delta_batch);
                        var out_h = top_delta_shape[0];
                        var out_w = top_delta_shape[1];
                        top_delta_batch.reshape_inplace(out_h * out_w, -1);
                        var delta_col_batch = $M.mtimes(top_delta_batch, weight_t);
                        top_delta_batch.destruct();
                        if (batch == 1) {
                            output = $M.zeros($M.size(data));
                        }
                        delta_col_batch.reshape_inplace(out_h, out_w, _this.ksize[0], _this.ksize[1], _this.in_size, 1);
                        var bottom_delta_col;
                        bottom_delta_col = im2col.col2im_cpu(delta_col_batch, _this.stride, _this.pad, [$M.size(data, 1), $M.size(data, 2)]);
                        delta_col_batch.destruct();
                        output.set($M.colon(), $M.colon(), $M.colon(), batch, bottom_delta_col);
                        bottom_delta_col.destruct();
                    }
                    weight_t.destruct();
                }
                _this.weight.reshape_inplace(weight_origsize_jsa);
                return output;
            });
        }
        catch (ex) {
            console.log(ex.stack);
        }
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    Convolution2DLayer.prototype.calculateUpdateParams_group = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var top_delta_shape = $M.sizejsa(top_delta);
        try {
            this.timer_vals = {};
            var n = $M.size(data, 4);
            var new_delta_weight = $M.autodestruct(function () {
                var output = null;
                var out_h = top_delta_shape[0];
                var out_w = top_delta_shape[1];
                if (config.devicetype == 'cl') {
                    top_delta.reshape_inplace(out_h * out_w, -1, n);
                    _this._start_timer('permute_top_delta');
                    var top_delta_perm = $M.permute(top_delta, [1, 3, 2]);
                    top_delta.reshape_inplace(top_delta_shape);
                    top_delta_perm.reshape_inplace(out_h * out_w * n, -1);
                    output = $M.zeros(_this.ksize[0] * _this.ksize[1] * _this.in_size_group, _this.out_size, 'gpuArray');
                    for (var g = 0; g < _this.group; g++) {
                        var data_group = data.get($M.colon(), $M.colon(), $M.colon(_this.in_size_group * g + 1, _this.in_size_group * (g + 1)), $M.colon());
                        _this._start_timer('im2col_perm');
                        var col_permute = im2col.im2col_cl_perm(data_group, _this.ksize, _this.stride, _this.pad);
                        var col_shape = $M.sizejsa(col_permute);
                        col_permute.reshape_inplace(out_h * out_w * n, -1);
                        _this._start_timer('permute_col_t ' + $M.sizejsa(col_permute));
                        //var col_permute_t = $M.t(col_permute);
                        _this._start_timer('mtimes');
                        //output = $M.mtimes(col_permute_t, top_delta_perm);
                        var top_delta_perm_group = top_delta_perm.get($M.colon(), $M.colon(_this.out_size_group * g + 1, _this.out_size_group * (g + 1)));
                        var output_group = mtimes_trans.mtimes_trans(col_permute, top_delta_perm_group, true, false);
                        output.set($M.colon(), $M.colon(_this.out_size_group * g + 1, _this.out_size_group * (g + 1)), output_group);
                        output_group.destruct();
                    }
                    _this._stop_timer();
                    output.reshape_inplace(_this.ksize[0], _this.ksize[1], _this.in_size_group, _this.out_size);
                }
                else {
                    for (var batch = 1; batch <= n; batch++) {
                        var img = data.get($M.colon(), $M.colon(), $M.colon(), batch);
                        var col;
                        col = im2col.im2col_cpu(img, _this.ksize, _this.stride, _this.pad);
                        var col_shape = $M.sizejsa(col);
                        var out_h = col_shape[0];
                        var out_w = col_shape[1];
                        col.reshape_inplace(out_h * out_w, -1);
                        var top_delta_batch = top_delta.get($M.colon(), $M.colon(), $M.colon(), batch);
                        top_delta_batch.reshape_inplace(out_h * out_w, -1);
                        var delta_weight_b = $M.mtimes($M.t(col), top_delta_batch);
                        if (batch == 1) {
                            output = delta_weight_b;
                        }
                        else {
                            var old_output = output;
                            output = $M.plus(old_output, delta_weight_b);
                            old_output.destruct();
                            delta_weight_b.destruct();
                        }
                    }
                    output.reshape_inplace(_this.ksize[0], _this.ksize[1], _this.in_size, _this.out_size);
                }
                return output;
            });
            var old_delta_weight = this.delta_weight;
            this.delta_weight = $M.plus(old_delta_weight, new_delta_weight);
            old_delta_weight.destruct();
            new_delta_weight.destruct();
            if (this.use_bias) {
                if (config.devicetype == 'cl') {
                    this._start_timer('bias');
                    var WebCL = $M.CL.WebCL;
                    var group_size = 256;
                    $M.CL.executeKernel(get_update_bias_kernel(), [
                        { access: WebCL.MEM_READ_WRITE, datum: this.delta_bias },
                        { access: WebCL.MEM_READ_ONLY, datum: top_delta },
                        { datum: top_delta_shape[0] * top_delta_shape[1], type: WebCL.type.UINT },
                        { datum: top_delta_shape[2], type: WebCL.type.UINT },
                        { datum: top_delta_shape[3], type: WebCL.type.UINT }
                    ], [group_size * top_delta_shape[2]], [group_size]);
                    this._stop_timer();
                }
                else {
                    var td_permuted = $M.permute(top_delta, [3, 1, 2, 4]);
                    td_permuted.reshape_inplace($M.size(td_permuted, 1), -1);
                    var delta_bias = $M.sum(td_permuted, 2);
                    td_permuted.destruct();
                    var new_delta_bias = $M.plus(this.delta_bias, delta_bias);
                    delta_bias.destruct();
                    this.delta_bias.destruct();
                    this.delta_bias = new_delta_bias;
                }
            }
            this._show_timer('conv update');
        }
        catch (ex) {
            console.log(ex.stack);
        }
        setImmediate(function () {
            callback();
        });
    };
    Convolution2DLayer.prototype.release = function () {
    };
    Convolution2DLayer.prototype.destruct = function () {
    };
    return Convolution2DLayer;
}(Layer));
var forward_bias_kernel = null; //in-place modification kernel
function get_forward_bias_kernel() {
    if (!forward_bias_kernel) {
        forward_bias_kernel = $M.CL.createKernel([
            '__kernel void kernel_func(__global float *dst, __global const float *bias, int out_h, int out_w, int ch, int n)',
            '{',
            'uint i = get_global_id(0);',
            'int c = i / (out_h * out_w) % ch;',
            'float b = bias[c];',
            'dst[i] += b;',
            '}'
        ].join('\n'));
    }
    return forward_bias_kernel;
}
var update_bias_kernel = null; //in-place modification kernel
function get_update_bias_kernel() {
    if (!update_bias_kernel) {
        // similar to batch normalization
        update_bias_kernel = $M.CL.createKernel([
            '#define MAX_WORK_SIZE 256',
            '__kernel void kernel_func(__global float *delta_bias, __global const float *top_delta,',
            'uint left_size, uint channel_size, uint right_size)',
            '{',
            'uint ch = get_group_id(0);',
            'uint i = get_local_id(0);',
            'uint work_size = get_local_size(0);',
            '__local float node_sum[MAX_WORK_SIZE];',
            //get sum and squared sum
            'float local_sum = 0.0F;',
            'for (int j = i; j < left_size * right_size; j += work_size) {',
            '  float val = top_delta[(j % left_size) + (ch + j / left_size * channel_size) * left_size];',
            '  local_sum += val;',
            '}',
            'node_sum[i] = local_sum;',
            'barrier(CLK_LOCAL_MEM_FENCE);',
            // calculate sum by node i==0
            'if (i == 0) {',
            '  for (int j = 1; j < work_size; j++) {',
            '    local_sum += node_sum[j];',
            '  }',
            '  delta_bias[ch] += local_sum;',
            '}',
            '}'].join('\n'));
    }
    return update_bias_kernel;
}
module.exports = Convolution2DLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils/array_helper":33,"../utils/im2col":35,"../utils/mtimes_trans":36,"./layer":18}],14:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var DataAugmentationLayer = (function (_super) {
    __extends(DataAugmentationLayer, _super);
    function DataAugmentationLayer(params) {
        _super.call(this);
        this.need_update = false;
        this.out_shape = params.out_shape; //[h, w]
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
    DataAugmentationLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    DataAugmentationLayer.prototype.set_data_mean = function (data_mean) {
        if (this.data_mean) {
            this.data_mean.destruct();
            this.data_mean = null;
        }
        if (data_mean) {
            this.data_mean = data_mean.copy('single');
        }
    };
    DataAugmentationLayer.prototype._get_data_mean = function (devicetype) {
        // data mean with proper devicetype
        var data_mean = this.data_mean;
        if (data_mean) {
            if ($M.devicetype(data_mean) != devicetype) {
                // change type
                var new_data_mean;
                if (devicetype == 'cl') {
                    new_data_mean = $M.gpuArray(data_mean);
                }
                else {
                    new_data_mean = $M.gather(data_mean);
                }
                data_mean.destruct();
                this.data_mean = new_data_mean;
                return new_data_mean;
            }
            else {
                return data_mean;
            }
        }
        else {
            return null;
        }
    };
    DataAugmentationLayer.prototype.forward = function (bottoms, config, callback) {
        var _this = this;
        // input: h, w, c, n
        var data = bottoms[0];
        var data_shape = $M.sizejsa(data);
        var in_h = data_shape[0];
        var in_w = data_shape[1];
        var c = data_shape[2] || 1;
        var n = data_shape[3] || 1;
        var _a = this.out_shape, out_h = _a[0], out_w = _a[1];
        if ($M.klass(data) != this.input_klass) {
            throw new Error('klass mismatch between params.input_klass and actual input');
        }
        var top;
        if (config.devicetype == 'cl') {
            top = $M.zeros(out_h, out_w, c, n, 'gpuArray');
            var WebCL = $M.CL.WebCL;
            $M.CL.executeKernel(this.get_kernel(), [
                { access: WebCL.MEM_WRITE_ONLY, datum: top },
                { access: WebCL.MEM_READ_ONLY, datum: data },
                { access: WebCL.MEM_READ_ONLY, datum: this._get_data_mean('cl') || data },
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
        }
        else {
            if ($M.klass(data) != 'single') {
                data = data.copy('single');
            }
            top = $M.zeros(out_h, out_w, c, n);
            var rnd = Math.random;
            var data_mean = this.data_mean;
            var scale = this.scale;
            var random_flip = this.random_flip;
            var random_crop = this.random_crop;
            for (var i = 1; i <= n; i++) {
                var crop_t;
                var crop_l;
                if (random_crop) {
                    crop_t = ((in_h - out_h + 1) * rnd() | 0) + 1; // 1 to (in_h - out_h + 1)
                    crop_l = ((in_w - out_w + 1) * rnd() | 0) + 1;
                }
                else {
                    crop_t = ((in_h - out_h) / 2 | 0) + 1;
                    crop_l = ((in_w - out_w) / 2 | 0) + 1;
                }
                var colon_x = (random_flip && rnd() > 0.5) ? $M.colon(crop_l + out_w - 1, -1, crop_l) : $M.colon(crop_l, crop_l + out_w - 1); //mirror
                $M.autodestruct(function () {
                    var img = data.get($M.colon(), $M.colon(), $M.colon(), i);
                    if (data_mean) {
                        img = $M.minus(img, _this._get_data_mean('cpu'));
                    }
                    img = $M.times(img, scale);
                    top.set($M.colon(), $M.colon(), $M.colon(), i, img.get($M.colon(crop_t, crop_t + out_h - 1), colon_x, $M.colon()));
                });
            }
        }
        setImmediate(function () {
            callback([top]);
        });
    };
    DataAugmentationLayer.prototype.get_kernel = function () {
        if (!this.augmentation_kernel) {
            var src_type;
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
                '    sx = -1;',
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
    };
    DataAugmentationLayer.prototype.release = function () {
    };
    DataAugmentationLayer.prototype.destruct = function () {
    };
    return DataAugmentationLayer;
}(Layer));
module.exports = DataAugmentationLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],15:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var DataLayer = (function (_super) {
    __extends(DataLayer, _super);
    function DataLayer(params) {
        _super.call(this);
    }
    DataLayer.prototype.init = function (callback) {
        this.length = 100;
        console.log('Data length set');
        setImmediate(callback);
    };
    DataLayer.prototype.forward = function (bottoms, config, callback) {
        var range = bottoms[0]; //[from, to]
        var model_weight = $M.jsa2mat([[1, 2, 3], [4, 5, 6]]);
        var data = $M.rand(3, 5);
        var labels = $M.mtimes(model_weight, data);
        setTimeout(function () {
            callback([data, labels]);
        }, 1);
    };
    DataLayer.prototype.release = function () {
    };
    DataLayer.prototype.destruct = function () {
    };
    return DataLayer;
}(Layer));
module.exports = DataLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],16:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var DropoutLayer = (function (_super) {
    __extends(DropoutLayer, _super);
    function DropoutLayer(params) {
        _super.call(this);
        this.dropout_ratio = params.dropout_ratio;
        if (!(this.dropout_ratio >= 0.0 && this.dropout_ratio < 1.0)) {
            throw Error('dropout_ratio must be 0 <= dropout_ratio < 1');
        }
    }
    DropoutLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    DropoutLayer.prototype.forward = function (bottoms, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var output;
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
            }
            else {
                var _a = $M.autodestruct(function () {
                    // mask = Bernoulli distribution * scale
                    var mask = $M.rand($M.size(data));
                    mask = $M.ge(mask, _this.dropout_ratio);
                    mask = $M.times(mask, 1.0 / (1.0 - _this.dropout_ratio));
                    var out = $M.times(mask, data);
                    return [mask, out];
                }), m = _a[0], o = _a[1];
                this.mask = m;
                output = o;
            }
        }
        else {
            output = data.copy();
        }
        setImmediate(function () {
            callback([output]);
        });
    };
    DropoutLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var bottom_delta;
        if (config.phase == 'train') {
            bottom_delta = $M.times(top_delta, this.mask);
        }
        else {
            bottom_delta = top_delta.copy();
        }
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    DropoutLayer.prototype.release = function () {
        if (this.mask) {
            this.mask.destruct();
            this.mask = null;
        }
    };
    DropoutLayer.prototype.destruct = function () {
        if (this.rndcache) {
            this.rndcache.destruct();
            this.rndcache = null;
        }
    };
    return DropoutLayer;
}(Layer));
var cl_init_random_kernel = null;
function cl_init_random(sizejsa) {
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
        { datum: Math.random() * 2147483648 | 0, type: WebCL.type.UINT },
        { datum: Math.random() * 2147483648 | 0, type: WebCL.type.UINT }
    ], 32, 32);
    return rnd;
}
var cl_update_random_kernel = null;
function cl_update_random(rnd, dropout_ratio) {
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
module.exports = DropoutLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],17:[function(require,module,exports){
"use strict";
exports.LinearLayer = require('./linear_layer');
exports.BranchLayer = require('./branch_layer');
exports.PlusLayer = require('./plus_layer');
exports.DataLayer = require('./data_layer');
exports.LossLayer = require('./loss_layer');
exports.MnistDataLayer = require('./mnist_data_layer');
exports.BlobDataLayer = require('./blob_data_layer');
exports.DataAugmentationLayer = require('./data_augmentation_layer');
exports.SoftmaxCrossEntropyLayer = require('./softmax_cross_entropy_layer');
exports.ReluLayer = require('./relu_layer');
exports.AccuracyLayer = require('./accuracy_layer');
exports.Convolution2DLayer = require('./convolution_2d_layer');
exports.Pooling2DLayer = require('./pooling_2d_layer');
exports.BatchNormalizationLayer = require('./batch_normalization_layer');
exports.DropoutLayer = require('./dropout_layer');

},{"./accuracy_layer":9,"./batch_normalization_layer":10,"./blob_data_layer":11,"./branch_layer":12,"./convolution_2d_layer":13,"./data_augmentation_layer":14,"./data_layer":15,"./dropout_layer":16,"./linear_layer":20,"./loss_layer":21,"./mnist_data_layer":22,"./plus_layer":23,"./pooling_2d_layer":24,"./relu_layer":25,"./softmax_cross_entropy_layer":26}],18:[function(require,module,exports){
(function (global){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = (function () {
    function Layer() {
        this.need_update = false;
    }
    Layer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    Layer.prototype.forward = function (bottoms, config, callback) {
        throw new Error('Not implemented');
    };
    Layer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        throw new Error('Not implemented');
    };
    Layer.prototype.calculateUpdateParams = function (bottoms, top_deltas, config, callback) {
        setImmediate(function () {
            callback();
        });
    };
    Layer.prototype.to_cpu = function () {
        if (this.train_params) {
            for (var i = 0; i < this.train_params.length; i++) {
                var param_name = this.train_params[i];
                var m = this[param_name];
                if ($M.devicetype(m) == 'cl') {
                    var cpum = $M.gather(m);
                    this[param_name] = cpum;
                    m.destruct();
                }
            }
        }
    };
    Layer.prototype.to_cl = function () {
        if (this.train_params) {
            for (var i = 0; i < this.train_params.length; i++) {
                var param_name = this.train_params[i];
                var m = this[param_name];
                if ($M.devicetype(m) == 'cpu') {
                    var clm = $M.gpuArray(m);
                    this[param_name] = clm;
                    m.destruct();
                }
            }
        }
    };
    Layer.prototype.release = function () {
        //release internal data for a batch
    };
    Layer.prototype.destruct = function () {
        //release data in the layer
    };
    return Layer;
}());
module.exports = Layer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],19:[function(require,module,exports){
"use strict";
var Layers = require('./index');
var LayerFactory = (function () {
    function LayerFactory() {
    }
    LayerFactory.create = function (type, params) {
        switch (type) {
            case 'data':
                return new Layers.DataLayer(params);
            case 'linear':
                return new Layers.LinearLayer(params);
            case 'branch':
                return new Layers.BranchLayer(params);
            case 'plus':
                return new Layers.PlusLayer(params);
            case 'loss':
                return new Layers.LossLayer(params);
            case 'mnist_data':
                return new Layers.MnistDataLayer(params);
            case 'blob_data':
                return new Layers.BlobDataLayer(params);
            case 'data_augmentation':
                return new Layers.DataAugmentationLayer(params);
            case 'softmax_cross_entropy':
                return new Layers.SoftmaxCrossEntropyLayer(params);
            case 'relu':
                return new Layers.ReluLayer(params);
            case 'accuracy':
                return new Layers.AccuracyLayer(params);
            case 'convolution_2d':
                return new Layers.Convolution2DLayer(params);
            case 'pooling_2d':
                return new Layers.Pooling2DLayer(params);
            case 'batch_normalization':
                return new Layers.BatchNormalizationLayer(params);
            case 'dropout':
                return new Layers.DropoutLayer(params);
            default:
                throw new Error('Unknown layer');
        }
    };
    return LayerFactory;
}());
module.exports = LayerFactory;

},{"./index":17}],20:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var mtimes_trans = require('../utils/mtimes_trans');
var LinearLayer = (function (_super) {
    __extends(LinearLayer, _super);
    function LinearLayer(params) {
        _super.call(this);
        this.need_update = true;
        // scalar (1-dim) or size array (output shape from conv layer)
        if (params.in_shape) {
            this.in_shape = params.in_shape;
        }
        else {
            this.in_shape = [params.in_size];
        }
        this.in_size = this.in_shape.reduce(function (prev, cur) { return prev * cur; }, 1);
        this.out_size = params.out_size;
        this.weight = $M.times($M.randn(this.in_size, this.out_size), 1.0 / Math.sqrt(this.in_size));
        this.bias = $M.zeros(this.out_size, 1);
        this.delta_weight = null; //$M.zeros(in_size, out_size);
        this.delta_bias = null; //$M.zeros(out_size, 1);
        this.train_params = ['weight', 'bias'];
        this.delta_params = ['delta_weight', 'delta_bias'];
    }
    LinearLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    LinearLayer.prototype.forward = function (bottoms, config, callback) {
        var _this = this;
        //multiply input by weight
        var data = bottoms[0];
        var data_orig_shape = $M.size(data);
        // convert to 2d with keeping batch length (flatten in fortran-order)
        data.reshape_inplace(-1, $M.size(data, this.in_shape.length + 1));
        //batch: [dim, sample]
        var top = $M.autodestruct(function () {
            var output = mtimes_trans.mtimes_trans(_this.weight, data, true, false);
            var output_with_bias = $M.plus(output, $M.repmat(_this.bias, 1, $M.sizejsa(data)[1]));
            return output_with_bias;
        });
        data.reshape_inplace(data_orig_shape);
        setImmediate(function () {
            callback([top]);
        });
    };
    LinearLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var data_orig_shape = $M.size(data);
        var bottom_delta = $M.autodestruct(function () {
            var result = $M.mtimes(_this.weight, top_delta);
            result.reshape_inplace(data_orig_shape);
            return result;
        });
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    LinearLayer.prototype.calculateUpdateParams = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        // convert to 2d with keeping batch length
        var data_orig_shape = $M.size(data);
        data.reshape_inplace(-1, $M.size(data, this.in_shape.length + 1));
        var delta_weight = mtimes_trans.mtimes_trans(data, top_delta, false, true);
        var new_delta_weight = $M.plus(this.delta_weight, delta_weight);
        delta_weight.destruct();
        this.delta_weight.destruct();
        this.delta_weight = new_delta_weight;
        var new_delta_bias = $M.autodestruct(function () {
            var delta_bias = $M.sum(top_delta, 2);
            return $M.plus(_this.delta_bias, delta_bias);
        });
        this.delta_bias.destruct();
        this.delta_bias = new_delta_bias;
        data.reshape_inplace(data_orig_shape);
        setImmediate(function () {
            callback();
        });
    };
    LinearLayer.prototype.release = function () {
    };
    LinearLayer.prototype.destruct = function () {
    };
    return LinearLayer;
}(Layer));
module.exports = LinearLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils/mtimes_trans":36,"./layer":18}],21:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var LossLayer = (function (_super) {
    __extends(LossLayer, _super);
    function LossLayer(params) {
        _super.call(this);
    }
    LossLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    LossLayer.prototype.forward = function (bottoms, config, callback) {
        //square loss
        var data = bottoms[0];
        var gt = bottoms[1];
        var loss = $M.autodestruct(function () { return $M.times($M.sum($M.sum($M.power($M.minus(data, gt), 2.0))), 1.0 / $M.numel(data)); });
        setImmediate(function () {
            callback([loss]);
        });
    };
    LossLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        //top_deltas[0] is usually 1.0
        var data = bottoms[0];
        var gt = bottoms[1];
        var top_delta = top_deltas[0]; //scalar
        var bottom_delta = $M.autodestruct(function () { return $M.times($M.minus(data, gt), $M.times(top_delta, 1.0 / $M.numel(data))); });
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    LossLayer.prototype.release = function () {
    };
    LossLayer.prototype.destruct = function () {
    };
    return LossLayer;
}(Layer));
module.exports = LossLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],22:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var fs = require('fs');
var MnistDataLayer = (function (_super) {
    __extends(MnistDataLayer, _super);
    function MnistDataLayer(params) {
        _super.call(this);
        this.params = params;
        this.data_shape = [28, 28, 1];
    }
    MnistDataLayer.prototype.init = function (callback) {
        var _this = this;
        var label_ary = new Uint8Array(fs.readFileSync(this.params.label).buffer);
        fs.readFile(this.params.data, function (err, data) {
            var data_ary = new Float32Array(data.buffer);
            _this.label = $M.typedarray2mat([1, label_ary.length], 'uint8', label_ary);
            _this.length = label_ary.length;
            console.log('Data length set to ' + _this.length);
            _this.data = $M.typedarray2mat(_this.data_shape.concat([_this.length]), 'single', data_ary);
            callback();
        });
    };
    MnistDataLayer.prototype.forward = function (bottoms, config, callback) {
        var range = bottoms[0]; //[from, to]
        var range_min = range.get(1);
        var range_size = range.get(2);
        range_min = range_min % this.length;
        var range_max = range_min + range_size - 1;
        var batch_data = this.data.get($M.colon(), $M.colon(), $M.colon(), $M.colon(range_min, range_max));
        var batch_label = this.label.get($M.colon(), $M.colon(range_min, range_max));
        if (config.devicetype == 'cl') {
            var batch_data2 = batch_data;
            batch_data = $M.gpuArray(batch_data2);
            batch_data2.destruct();
            var batch_label2 = batch_label;
            batch_label = $M.gpuArray(batch_label2);
            batch_label2.destruct();
        }
        setTimeout(function () {
            callback([batch_data, batch_label]);
        }, 1);
    };
    MnistDataLayer.prototype.release = function () {
    };
    MnistDataLayer.prototype.destruct = function () {
    };
    return MnistDataLayer;
}(Layer));
module.exports = MnistDataLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18,"fs":2}],23:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var PlusLayer = (function (_super) {
    __extends(PlusLayer, _super);
    function PlusLayer(params) {
        _super.call(this);
        if (!(params.n_input >= 1)) {
            throw Error('n_input must be positive integer');
        }
        this.n_input = params.n_input;
    }
    PlusLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    PlusLayer.prototype.forward = function (bottoms, config, callback) {
        //sum up inputs
        var top;
        if (this.n_input == 1) {
            top = bottoms[0].copy();
        }
        else {
            top = $M.plus(bottoms[0], bottoms[1]);
            for (var i = 2; i < this.n_input; i++) {
                var new_top = $M.plus(top, bottoms[i]);
                top.destruct();
                top = new_top;
            }
        }
        setImmediate(function () {
            callback([top]);
        });
    };
    PlusLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        //copy deltas
        var data = top_deltas[0];
        var outputs = [];
        for (var i = 0; i < this.n_input; i++) {
            outputs.push(data.copy());
        }
        setImmediate(function () {
            callback(outputs);
        });
    };
    PlusLayer.prototype.release = function () {
    };
    PlusLayer.prototype.destruct = function () {
    };
    return PlusLayer;
}(Layer));
module.exports = PlusLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],24:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var im2col = require('../utils/im2col');
var ArrayHelper = require('../utils/array_helper');
var max_pooling_backward_gpu_kernel = null;
var Pooling2DLayer = (function (_super) {
    __extends(Pooling2DLayer, _super);
    function Pooling2DLayer(params) {
        _super.call(this);
        this.pooling_type = params.type;
        this.ksize = ArrayHelper.repeat_scalar(params.ksize, 2); //kernel size [3,3]
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
    Pooling2DLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    Pooling2DLayer.prototype.forward = function (bottoms, config, callback) {
    };
    Pooling2DLayer.prototype.forward_max = function (bottoms, config, callback) {
        var _this = this;
        var data = bottoms[0]; // (h, w, c, n)
        var n = $M.size(data, 4);
        var top, top_pos;
        try {
            if (config.devicetype == 'cl') {
                var t_tp = cl_max_forward(this, data);
                top = t_tp.top;
                top_pos = t_tp.top_pos;
            }
            else {
                _a = $M.autodestruct(function () {
                    var col;
                    col = im2col.im2col_cpu(data, _this.ksize, _this.stride, _this.pad, -Infinity, true);
                    col.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 3) * $M.size(col, 4), $M.size(col, 5), $M.size(col, 6));
                    var amax = $M.argmax(col, null, 3);
                    var output = amax.M;
                    output.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 4), $M.size(col, 5));
                    return [output, amax.I];
                }), top = _a[0], top_pos = _a[1];
            }
            this.top_pos = top_pos;
        }
        catch (ex) {
            console.log('forward ', ex);
        }
        setImmediate(function () {
            callback([top]);
        });
        var _a;
    };
    Pooling2DLayer.prototype.forward_average = function (bottoms, config, callback) {
        var _this = this;
        var data = bottoms[0]; // (h, w, c, n)
        var n = $M.size(data, 4);
        var top = $M.autodestruct(function () {
            var col;
            if (config.devicetype == 'cl') {
                col = im2col.im2col_cl(data, _this.ksize, _this.stride, _this.pad);
            }
            else {
                col = im2col.im2col_cpu(data, _this.ksize, _this.stride, _this.pad);
            }
            col.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 3) * $M.size(col, 4), $M.size(col, 5), $M.size(col, 6));
            var avg = $M.mean(col, 3);
            avg.reshape_inplace($M.size(col, 1), $M.size(col, 2), $M.size(col, 4), $M.size(col, 5));
            return avg;
        });
        setImmediate(function () {
            callback([top]);
        });
    };
    Pooling2DLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
    };
    Pooling2DLayer.prototype.backward_max = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var top_delta = top_deltas[0];
        var bottom = bottoms[0];
        var bottom_delta;
        try {
            if (config.devicetype == 'cl') {
                var h = $M.size(bottom, 1), w = $M.size(bottom, 2);
                bottom_delta = cl_max_backward_overlap(this, h, w, top_delta, this.top_pos);
            }
            else {
                bottom_delta = $M.autodestruct(function () {
                    var top_pos = _this.top_pos;
                    var out_h = $M.size(top_pos, 1);
                    var out_w = $M.size(top_pos, 2);
                    var in_size = $M.size(bottom, 3);
                    var n = $M.size(bottom, 4);
                    var delta_col;
                    var bottom_delta;
                    delta_col = $M.zeros(out_h, out_w, _this.ksize[0] * _this.ksize[1], in_size, n);
                    //very slow
                    for (var y = 1; y <= out_h; y++) {
                        for (var x = 1; x <= out_w; x++) {
                            for (var c = 1; c <= in_size; c++) {
                                for (var batch = 1; batch <= n; batch++) {
                                    delta_col.set(y, x, top_pos.get(y, x, 1, c, batch), c, batch, top_delta.get(y, x, c, batch));
                                }
                            }
                        }
                    }
                    delta_col.reshape_inplace(out_h, out_w, _this.ksize[0], _this.ksize[1], in_size, n);
                    bottom_delta = im2col.col2im_cpu(delta_col, _this.stride, _this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
                    return bottom_delta;
                });
            }
        }
        catch (ex) {
            console.log('backward ', ex);
        }
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    Pooling2DLayer.prototype.backward_average = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        var top_delta = top_deltas[0];
        var bottom = bottoms[0];
        var bottom_delta = $M.autodestruct(function () {
            var out_h = $M.size(top_delta, 1);
            var out_w = $M.size(top_delta, 2);
            var in_size = $M.size(bottom, 3);
            var n = $M.size(bottom, 4);
            var top_delta_origsize = $M.size(top_delta);
            top_delta.reshape_inplace(out_h, out_w, 1, 1, in_size, n);
            var delta_col = $M.repmat(top_delta, 1, 1, _this.ksize[0], _this.ksize[1], 1, 1);
            top_delta.reshape_inplace(top_delta_origsize);
            var bottom_delta;
            if (config.devicetype == 'cl') {
                bottom_delta = im2col.col2im_cl(delta_col, _this.stride, _this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
            }
            else {
                bottom_delta = im2col.col2im_cpu(delta_col, _this.stride, _this.pad, [$M.size(bottom, 1), $M.size(bottom, 2)]);
            }
            bottom_delta = $M.times(bottom_delta, 1 / (_this.ksize[0] * _this.ksize[1]));
            return bottom_delta;
        });
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    Pooling2DLayer.prototype.release = function () {
        if (this.top_pos) {
            this.top_pos.destruct();
            this.top_pos = null;
        }
    };
    Pooling2DLayer.prototype.destruct = function () {
    };
    return Pooling2DLayer;
}(Layer));
var cl_max_forward_kernel = null;
function cl_max_forward(layer, bottom) {
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
    var h, w, c, n;
    var img_size = $M.sizejsa(bottom);
    h = img_size[0];
    w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
    n = img_size[3] || 1;
    var _a = layer.ksize, kh = _a[0], kw = _a[1];
    var _b = layer.stride, sy = _b[0], sx = _b[1];
    var _c = layer.pad, ph = _c[0], pw = _c[1];
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
var cl_max_backward_overlap_kernel = null;
function cl_max_backward_overlap(layer, h, w, top_delta, top_pos) {
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
    var out_h, out_w, c, n;
    var img_size = $M.sizejsa(top_delta);
    out_h = img_size[0];
    out_w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
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
module.exports = Pooling2DLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils/array_helper":33,"../utils/im2col":35,"./layer":18}],25:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var ReluLayer = (function (_super) {
    __extends(ReluLayer, _super);
    function ReluLayer(params) {
        _super.call(this);
    }
    ReluLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    ReluLayer.prototype.forward = function (bottoms, config, callback) {
        //multiply input by weight
        var data = bottoms[0];
        //batch: [dim, sample]
        var output = $M.max(data, 0);
        setImmediate(function () {
            callback([output]);
        });
    };
    ReluLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        var data = bottoms[0];
        var top_delta = top_deltas[0];
        var bottom_delta = $M.autodestruct(function () {
            var bottom_delta = $M.times(top_delta, $M.gt(data, 0));
            return bottom_delta;
        });
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    ReluLayer.prototype.release = function () {
    };
    ReluLayer.prototype.destruct = function () {
    };
    return ReluLayer;
}(Layer));
module.exports = ReluLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],26:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Layer = require('./layer');
var SoftmaxCrossEntropyLayer = (function (_super) {
    __extends(SoftmaxCrossEntropyLayer, _super);
    function SoftmaxCrossEntropyLayer(params) {
        _super.call(this);
    }
    SoftmaxCrossEntropyLayer.prototype.init = function (callback) {
        setImmediate(callback);
    };
    SoftmaxCrossEntropyLayer.prototype.forward = function (bottoms, config, callback) {
        //softmax cross entropy
        var data = bottoms[0];
        var gtlabel = bottoms[1];
        var loss;
        var data_softmax;
        if (config.devicetype == 'cl') {
            var c = $M.size(data, 1);
            var n = $M.size(data, 2);
            var data_softmax_log = new $M.CL.MatrixCL([1, n], 'single');
            data_softmax = new $M.CL.MatrixCL([c, n], 'single');
            var WebCL = $M.CL.WebCL;
            $M.CL.executeKernel(get_cl_forward_kernel(), [
                { access: WebCL.MEM_WRITE_ONLY, datum: data_softmax_log },
                { access: WebCL.MEM_WRITE_ONLY, datum: data_softmax },
                { access: WebCL.MEM_READ_ONLY, datum: data },
                { access: WebCL.MEM_READ_ONLY, datum: gtlabel },
                { datum: c, type: WebCL.type.UINT },
                { datum: n, type: WebCL.type.UINT }
            ], n, 32);
            loss = $M.sum(data_softmax_log);
            data_softmax_log.destruct();
        }
        else {
            _a = $M.autodestruct(function () {
                var gt = $M.zeros($M.size(data));
                var batch_size = $M.sizejsa(gtlabel)[1]; //number of column
                var data_exp = $M.exp(data);
                var data_exp_sum = $M.repmat($M.sum(data_exp, 1), $M.sizejsa(data)[0], 1);
                var data_softmax = $M.rdivide(data_exp, data_exp_sum);
                var data_softmax_log = $M.log(data_softmax);
                var loss = $M.zeros(1);
                for (var sample = 1; sample <= batch_size; sample++) {
                    var label = gtlabel.get(sample) + 1;
                    loss = $M.minus(loss, data_softmax_log.get(label, sample) / batch_size);
                }
                return [loss, data_softmax];
            }), loss = _a[0], data_softmax = _a[1];
        }
        this.data_softmax = data_softmax;
        setImmediate(function () {
            callback([loss]);
        });
        var _a;
    };
    SoftmaxCrossEntropyLayer.prototype.backward = function (bottoms, top_deltas, config, callback) {
        var _this = this;
        //top_deltas[0] is usually 1.0
        var data = bottoms[0];
        var gtlabel = bottoms[1];
        var top_delta = top_deltas[0]; //scalar
        var bottom_delta;
        if (config.devicetype == 'cl') {
            bottom_delta = $M.times(this.data_softmax, top_delta);
        }
        else {
            bottom_delta = $M.autodestruct(function () {
                var bottom_delta = _this.data_softmax.copy();
                var batch_size = $M.sizejsa(gtlabel)[1]; //number of column
                for (var sample = 1; sample <= batch_size; sample++) {
                    var label = gtlabel.get(sample) + 1;
                    bottom_delta.set(label, sample, bottom_delta.get(label, sample) - 1);
                }
                bottom_delta = $M.times(bottom_delta, $M.times(top_delta, 1.0 / batch_size));
                return bottom_delta;
            });
        }
        setImmediate(function () {
            callback([bottom_delta]);
        });
    };
    SoftmaxCrossEntropyLayer.prototype.release = function () {
        if (this.data_softmax != null) {
            this.data_softmax.destruct();
            this.data_softmax = null;
        }
    };
    SoftmaxCrossEntropyLayer.prototype.destruct = function () {
    };
    return SoftmaxCrossEntropyLayer;
}(Layer));
var cl_forward_kernel = null;
function get_cl_forward_kernel() {
    if (!cl_forward_kernel) {
        cl_forward_kernel = $M.CL.createKernel([
            '__kernel void kernel_func(__global float *softmax_log, __global float *softmax, __global const float *score, __global const int *label, uint c, uint n)',
            '{',
            'uint batch = get_global_id(0);',
            'if (batch >= n) {return;}',
            'float sample_max = score[batch * c];',
            'for (int i = 1; i < c; i++) {',
            '  float cur_score = score[batch * c + i];',
            '  if (cur_score > sample_max) {',
            '    sample_max = cur_score;',
            '  }',
            '}',
            'float exp_sum = 0.0F;',
            'for (int i = 0; i < c; i++) {',
            '  float cur_score = score[batch * c + i];',
            '  float cur_score_exp = exp(cur_score - sample_max);',
            '  softmax[batch * c + i] = cur_score_exp;',
            '  exp_sum += cur_score_exp;',
            '}',
            'for (int i = 0; i < c; i++) {',
            '  softmax[batch * c + i] /= exp_sum;',
            '}',
            'softmax_log[batch] = -log(softmax[batch * c + label[batch]]) / (float)n;',
            'softmax[batch * c + label[batch]] -= 1.0F;',
            'for (int i = 0; i < c; i++) {',
            '  softmax[batch * c + i] /= n;',
            '}',
            '}'
        ].join('\n'));
    }
    return cl_forward_kernel;
}
module.exports = SoftmaxCrossEntropyLayer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layer":18}],27:[function(require,module,exports){
(function (global){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var LayerFactory = require('./layers/layer_factory');
var ForwardConfiguration = require('./forward_configuration');
var Network = (function () {
    function Network(layers) {
        this.phase = 'test';
        this.devicetype = 'cpu';
        this.layers = layers;
        this.layer_instances = {};
        //construct layers
        for (var i = 0; i < this.layers.length; i++) {
            var element = this.layers[i];
            var inst = LayerFactory.create(element.type, element.params);
            this.layer_instances[element.name] = inst;
        }
        this.timer_enable = false;
    }
    Network.prototype.init = function (callback) {
        var _this = this;
        var layer_index = 0;
        var init_next_layer = function () {
            if (layer_index >= _this.layers.length) {
                callback();
            }
            else {
                var layer_name = _this.layers[layer_index].name;
                var inst = _this.layer_instances[layer_name];
                inst.init(init_next_layer);
                layer_index++;
            }
        };
        init_next_layer();
    };
    Network.prototype.to_cpu = function () {
        if (this.devicetype == 'cpu') {
            return;
        }
        for (var key in this.layer_instances) {
            if (this.layer_instances.hasOwnProperty(key)) {
                var inst = this.layer_instances[key];
                inst.to_cpu();
            }
        }
        this.devicetype = 'cpu';
    };
    Network.prototype.to_cl = function () {
        if (this.devicetype == 'cl') {
            return;
        }
        for (var key in this.layer_instances) {
            if (this.layer_instances.hasOwnProperty(key)) {
                var inst = this.layer_instances[key];
                inst.to_cl();
            }
        }
        this.devicetype = 'cl';
    };
    Network.prototype._start_timer = function (name) {
        if (this.timer_enable) {
            this.timer_name = name;
            if (this.devicetype == 'cl') {
                $M.CL.finish();
            }
            this.timer_val = Date.now();
        }
    };
    Network.prototype._stop_timer = function () {
        if (this.timer_enable) {
            if (this.layer_time) {
                if (this.devicetype == 'cl') {
                    $M.CL.finish();
                }
                var end_time = Date.now();
                var time_ms = end_time - this.timer_val;
                this.layer_time[this.timer_name] = time_ms;
            }
        }
    };
    Network.prototype.forward = function (input_vars, callback) {
        var _this = this;
        this.blobs_forward = {};
        this.blobs_backward = {};
        for (var key in input_vars) {
            if (input_vars.hasOwnProperty(key)) {
                this.blobs_forward[key] = input_vars[key];
            }
        }
        var layer_index = 0;
        var target_layers = this.layers.filter(function (item) { return (item.phase == null) || (item.phase.indexOf(_this.phase) >= 0); });
        var forward_config = new ForwardConfiguration();
        forward_config.phase = this.phase;
        forward_config.devicetype = this.devicetype;
        var forward_next = function () {
            var layer_prop = target_layers[layer_index];
            var layer_instance = _this.layer_instances[layer_prop.name];
            // prepare bottom vars
            var bottom_vars = [];
            for (var index = 0; index < layer_prop.inputs.length; index++) {
                var var_name = layer_prop.inputs[index];
                bottom_vars.push(_this.blobs_forward[var_name]);
            }
            //console.log('forward ' + layer_prop.name);
            _this._start_timer(layer_prop.name + '.forward');
            layer_instance.forward(bottom_vars, forward_config, function (tops) {
                _this._stop_timer();
                // save top vars
                for (var index = 0; index < tops.length; index++) {
                    var top_var = tops[index];
                    var top_var_name = layer_prop.outputs[index];
                    _this.blobs_forward[top_var_name] = top_var;
                }
                layer_index++;
                if (layer_index < target_layers.length) {
                    forward_next();
                }
                else {
                    // forward of all layers has been called
                    callback();
                }
            });
        };
        forward_next();
    };
    Network.prototype.backward = function (callback) {
        var _this = this;
        var target_layers = this.layers.filter(function (item) { return (item.phase == null) || (item.phase.indexOf(_this.phase) >= 0); });
        var layer_index = target_layers.length - 1;
        var update_until = layer_index;
        //find most bottom layer which requires update
        for (var index = 0; index < target_layers.length; index++) {
            var layer_prop = target_layers[index];
            var layer_instance = this.layer_instances[layer_prop.name];
            if (layer_instance.need_update) {
                update_until = index;
                break;
            }
        }
        var forward_config = new ForwardConfiguration();
        forward_config.phase = this.phase;
        forward_config.devicetype = this.devicetype;
        var backward_next = function () {
            var layer_prop = target_layers[layer_index];
            var layer_instance = _this.layer_instances[layer_prop.name];
            // prepare bottom vars
            var bottom_vars = [];
            for (var index = 0; index < layer_prop.inputs.length; index++) {
                var var_name = layer_prop.inputs[index];
                bottom_vars.push(_this.blobs_forward[var_name]);
            }
            // prepare top_delta vars
            var top_deltas = [];
            for (var index = 0; index < layer_prop.outputs.length; index++) {
                var var_name = layer_prop.outputs[index];
                var top_delta = null;
                if (_this.blobs_backward[var_name] == null) {
                    //give matrix of 1 with same shape of forward variable
                    var top_forward = _this.blobs_forward[var_name];
                    var ones;
                    if (_this.devicetype == 'cl') {
                        ones = $M.ones($M.size(top_forward), 'gpuArray');
                    }
                    else {
                        ones = $M.ones($M.size(top_forward));
                    }
                    _this.blobs_backward[var_name] = ones;
                }
                top_deltas.push(_this.blobs_backward[var_name]);
            }
            //console.log('calculateUpdateParams ' + layer_prop.name);
            _this._start_timer(layer_prop.name + '.calcUpdate');
            layer_instance.calculateUpdateParams(bottom_vars, top_deltas, forward_config, function () {
                _this._stop_timer();
                if (update_until < layer_index) {
                    // backward needed
                    //console.log('backward ' + layer_prop.name);
                    _this._start_timer(layer_prop.name + '.backward');
                    layer_instance.backward(bottom_vars, top_deltas, forward_config, function (bottom_deltas) {
                        _this._stop_timer();
                        // save bottom_delta vars
                        for (var index = 0; index < bottom_deltas.length; index++) {
                            var bottom_delta = bottom_deltas[index];
                            var bottom_name = layer_prop.inputs[index];
                            _this.blobs_backward[bottom_name] = bottom_delta;
                        }
                        layer_index--;
                        backward_next();
                    });
                }
                else {
                    //backward finish
                    callback();
                }
            });
        };
        backward_next();
    };
    Network.prototype.release = function () {
        if (this.blobs_forward != null) {
            for (var key in this.blobs_forward) {
                if (this.blobs_forward.hasOwnProperty(key)) {
                    var element = this.blobs_forward[key];
                    element.destruct();
                }
            }
            this.blobs_forward = null;
        }
        if (this.blobs_backward != null) {
            for (var key in this.blobs_backward) {
                if (this.blobs_backward.hasOwnProperty(key)) {
                    var element = this.blobs_backward[key];
                    element.destruct();
                }
            }
            this.blobs_backward = null;
        }
        for (var key in this.layer_instances) {
            if (this.layer_instances.hasOwnProperty(key)) {
                var layer_instance = this.layer_instances[key];
                layer_instance.release();
            }
        }
    };
    return Network;
}());
module.exports = Network;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./forward_configuration":8,"./layers/layer_factory":19}],28:[function(require,module,exports){
(function (global){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Optimizer = (function () {
    function Optimizer(net) {
        this.net = net;
    }
    Optimizer.prototype.zero_grads = function () {
        //zero clear gradients
        for (var key in this.net.layer_instances) {
            if (this.net.layer_instances.hasOwnProperty(key)) {
                var layer_instance = this.net.layer_instances[key];
                if (layer_instance.train_params == null) {
                    continue;
                }
                for (var index = 0; index < layer_instance.train_params.length; index++) {
                    var train_param_name = layer_instance.train_params[index];
                    var delta_param_name = layer_instance.delta_params[index];
                    if (this.net.devicetype == 'cl') {
                        layer_instance[delta_param_name] = $M.zeros($M.size(layer_instance[train_param_name]), 'gpuArray');
                    }
                    else {
                        layer_instance[delta_param_name] = $M.zeros($M.size(layer_instance[train_param_name]));
                    }
                }
            }
        }
    };
    Optimizer.prototype.update = function (input_vars, callback) {
        var _this = this;
        this.zero_grads();
        this.net.forward(input_vars, function () {
            _this.net.backward(function () {
                _this.do_update();
                callback();
            });
        });
    };
    Optimizer.prototype.update_divided = function (divided_input_vars, callback) {
        var _this = this;
        this.zero_grads();
        var div_i = 0;
        var div_count = divided_input_vars.length;
        var update_once = function () {
            _this.net.forward(divided_input_vars[div_i], function () {
                _this.net.backward(function () {
                    div_i++;
                    if (div_i >= div_count) {
                        _this.do_update();
                        callback();
                    }
                    else {
                        _this.net.release();
                        update_once();
                    }
                });
            });
        };
        update_once();
    };
    Optimizer.prototype.release = function () {
        //release gradients
        for (var key in this.net.layer_instances) {
            if (this.net.layer_instances.hasOwnProperty(key)) {
                var layer_instance = this.net.layer_instances[key];
                if (layer_instance.train_params == null) {
                    continue;
                }
                for (var index = 0; index < layer_instance.train_params.length; index++) {
                    var delta_param_name = layer_instance.delta_params[index];
                    if (layer_instance[delta_param_name] != null) {
                        layer_instance[delta_param_name].destruct();
                        layer_instance[delta_param_name] = null;
                    }
                }
            }
        }
        this.net.release();
    };
    Optimizer.prototype.destruct = function () {
        //release all matrices
    };
    return Optimizer;
}());
module.exports = Optimizer;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],29:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
exports.OptimizerSGD = require('./optimizer_sgd');
exports.OptimizerMomentumSGD = require('./optimizer_momentum_sgd');

},{"./optimizer_momentum_sgd":30,"./optimizer_sgd":31}],30:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Optimizer = require('../optimizer');
var OptimizerSGD = (function (_super) {
    __extends(OptimizerSGD, _super);
    function OptimizerSGD(net, lr, momentum) {
        if (lr === void 0) { lr = 0.01; }
        if (momentum === void 0) { momentum = 0.9; }
        _super.call(this, net);
        this.lr = lr;
        this.momentum = momentum;
        this.last_deltas = {};
    }
    OptimizerSGD.prototype.do_update = function () {
        var _this = this;
        // update params
        for (var key in this.net.layer_instances) {
            if (this.net.layer_instances.hasOwnProperty(key)) {
                var layer_instance = this.net.layer_instances[key];
                if (layer_instance.train_params == null) {
                    continue;
                }
                for (var index = 0; index < layer_instance.train_params.length; index++) {
                    var train_param_name = layer_instance.train_params[index];
                    var delta_param_name = layer_instance.delta_params[index];
                    var cur_weight = layer_instance[train_param_name];
                    var cur_grad = layer_instance[delta_param_name];
                    var param_global_name = key + '/' + train_param_name;
                    var last_delta = this.last_deltas[param_global_name];
                    var new_weight, new_last_delta;
                    $M.autodestruct(function () {
                        if (last_delta) {
                            new_last_delta = $M.times(last_delta, _this.momentum);
                            new_last_delta = $M.plus(new_last_delta, $M.times(cur_grad, -_this.lr));
                        }
                        else {
                            new_last_delta = $M.times(cur_grad, -_this.lr);
                        }
                        new_weight = $M.plus(cur_weight, new_last_delta);
                        return [new_weight, new_last_delta];
                    });
                    cur_weight.destruct();
                    layer_instance[train_param_name] = new_weight;
                    if (last_delta) {
                        last_delta.destruct();
                    }
                    this.last_deltas[param_global_name] = new_last_delta;
                }
            }
        }
    };
    OptimizerSGD.prototype.release = function () {
        _super.prototype.release.call(this);
    };
    OptimizerSGD.prototype.destruct = function () {
        _super.prototype.destruct.call(this);
        for (var key in this.last_deltas) {
            if (this.last_deltas.hasOwnProperty(key)) {
                var last_delta = this.last_deltas[key];
                last_delta.destruct();
            }
        }
        this.last_deltas = {};
    };
    return OptimizerSGD;
}(Optimizer));
module.exports = OptimizerSGD;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../optimizer":28}],31:[function(require,module,exports){
(function (global){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var Optimizer = require('../optimizer');
var OptimizerSGD = (function (_super) {
    __extends(OptimizerSGD, _super);
    function OptimizerSGD(net, lr) {
        if (lr === void 0) { lr = 0.01; }
        _super.call(this, net);
        this.lr = lr;
    }
    OptimizerSGD.prototype.do_update = function () {
        var _this = this;
        // update params
        for (var key in this.net.layer_instances) {
            if (this.net.layer_instances.hasOwnProperty(key)) {
                var layer_instance = this.net.layer_instances[key];
                if (layer_instance.train_params == null) {
                    continue;
                }
                for (var index = 0; index < layer_instance.train_params.length; index++) {
                    var train_param_name = layer_instance.train_params[index];
                    var delta_param_name = layer_instance.delta_params[index];
                    var cur_weight = layer_instance[train_param_name];
                    var cur_grad = layer_instance[delta_param_name];
                    var new_weight = $M.autodestruct(function () { return $M.plus(cur_weight, $M.times(cur_grad, -_this.lr)); });
                    cur_weight.destruct();
                    layer_instance[train_param_name] = new_weight;
                }
            }
        }
    };
    OptimizerSGD.prototype.release = function () {
        _super.prototype.release.call(this);
    };
    return OptimizerSGD;
}(Optimizer));
module.exports = OptimizerSGD;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../optimizer":28}],32:[function(require,module,exports){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
exports.Network = require('./network');
exports.Optimizers = require('./optimizers');
exports.ArraySerializer = require('./array_serializer');
exports.Layer = require('./layers/layer');
exports.Layers = require('./layers');
exports.LayerFactory = require('./layers/layer_factory');
exports.ForwardConfiguration = require('./forward_configuration');
exports.DettmersWeightCompression = require('./utils/dettmers_weight_compression');

},{"./array_serializer":7,"./forward_configuration":8,"./layers":17,"./layers/layer":18,"./layers/layer_factory":19,"./network":27,"./optimizers":29,"./utils/dettmers_weight_compression":34}],33:[function(require,module,exports){
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
// Helper functions of Array
"use strict";
function repeat_scalar(val, length) {
    if (val.length !== void 0) {
        //val is array
        if (val.length !== length) {
            throw Error('val is not length ' + length);
        }
        return val;
    }
    else {
        //val is scalar
        var array = [];
        for (var i = 0; i < length; i++) {
            array.push(val);
        }
        return array;
    }
}
exports.repeat_scalar = repeat_scalar;

},{}],34:[function(require,module,exports){
(function (global){
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
// implements weight / gradient compression in "8-Bit Approximations for Parallelism in Deep Learning" by Tom Dettmers (ICLR 2016)
"use strict";
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
var constant_table = null;
function get_constant_table() {
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
var find_max_kernel_first = null;
var find_max_kernel_second = null;
var compress_kernel = null;
var decompress_kernel = null;
function compress_8bit(weight_mat, dst_buf, dst_offset, dst_size) {
    var buf_view = new Uint8Array(dst_buf, dst_offset, dst_size);
    if (!compress_kernel) {
        find_max_kernel_first = $M.CL.createKernel([
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
        find_max_kernel_second = $M.CL.createKernel([
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
exports.compress_8bit = compress_8bit;
function decompress_8bit(weight_mat, src_buf, src_offset, src_size) {
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
exports.decompress_8bit = decompress_8bit;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],35:[function(require,module,exports){
(function (global){
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
// utility for convolution / pooling of 2d image
// based on chainer's conv.py implementation
"use strict";
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
function conv_outsize(size, k, s, p, cover_all) {
    if (cover_all) {
        return Math.floor((size + p * 2 - k + s - 1) / s) + 1;
    }
    else {
        return Math.floor((size + p * 2 - k) / s) + 1;
    }
}
exports.conv_outsize = conv_outsize;
function im2col_cpu(img, ksize, stride, pad, pad_val, cover_all) {
    if (pad_val === void 0) { pad_val = 0; }
    if (cover_all === void 0) { cover_all = false; }
    var h, w, c, n;
    var img_size = $M.sizejsa(img);
    h = img_size[0];
    w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
    n = img_size[3] || 1;
    var kh = ksize[0], kw = ksize[1];
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
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
exports.im2col_cpu = im2col_cpu;
var im2col_gpu_kernel = null;
function im2col_cl(img, ksize, stride, pad, pad_val, cover_all) {
    if (pad_val === void 0) { pad_val = 0; }
    if (cover_all === void 0) { cover_all = false; }
    var h, w, c, n;
    var img_size = $M.sizejsa(img);
    h = img_size[0];
    w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
    n = img_size[3] || 1;
    var kh = ksize[0], kw = ksize[1];
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
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
    ], out_h * out_w * kh * kw, out_h);
    return col;
}
exports.im2col_cl = im2col_cl;
var im2col_perm_gpu_kernel = null;
function im2col_cl_perm2(img, ksize, stride, pad, pad_val, cover_all) {
    if (pad_val === void 0) { pad_val = 0; }
    if (cover_all === void 0) { cover_all = false; }
    var h, w, c, n;
    var img_size = $M.sizejsa(img);
    h = img_size[0];
    w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
    n = img_size[3] || 1;
    var kh = ksize[0], kw = ksize[1];
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
    var out_h = conv_outsize(h, kh, sy, ph, cover_all);
    var out_w = conv_outsize(w, kw, sx, pw, cover_all);
    var col = new $M.CL.MatrixCL([out_h, out_w, n, kh, kw, c], 'single');
    //var col = $M.zeros(out_h, out_w, n, kh, kw, c, 'gpuArray');
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
            'int c = i / (out_h * out_w * kh * kw) % ch;',
            'int iny = ky + out_y * sy - ph;',
            'int inx = kx + out_x * sx - pw;',
            'if (iny < 0 || iny >= h || inx < 0 || inx >= w) {',
            //'for (int c = 0; c < ch; c++) {',
            '  for (int batch = 0; batch < n; batch++) {',
            '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = pad_val;',
            '  }',
            //'}',
            '} else {',
            //'for (int c = 0; c < ch; c++) {',
            '  for (int batch = 0; batch < n; batch++) {',
            '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = img[iny + (inx + (c + (batch) * ch) * w) * h];',
            '  }',
            '}',
            //'}',
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
        { datum: out_h * out_w * kh * kw * c, type: WebCL.type.UINT }
    ], out_h * out_w * kh * kw * c, out_h);
    return col;
}
exports.im2col_cl_perm2 = im2col_cl_perm2;
function im2col_cl_perm(img, ksize, stride, pad, pad_val, cover_all) {
    if (pad_val === void 0) { pad_val = 0; }
    if (cover_all === void 0) { cover_all = false; }
    var h, w, c, n;
    var img_size = $M.sizejsa(img);
    h = img_size[0];
    w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
    n = img_size[3] || 1;
    var kh = ksize[0], kw = ksize[1];
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
    var out_h = conv_outsize(h, kh, sy, ph, cover_all);
    var out_w = conv_outsize(w, kw, sx, pw, cover_all);
    var col = new $M.CL.MatrixCL([out_h, out_w, n, kh, kw, c], 'single');
    //var col = $M.zeros(out_h, out_w, n, kh, kw, c, 'gpuArray');
    if (!im2col_perm_gpu_kernel) {
        im2col_perm_gpu_kernel = $M.CL.createKernel([
            '__kernel void kernel_func(__global float *col, __global float *img,',
            'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, float pad_val, uint length)',
            '{',
            'uint i = get_global_id(0);',
            'if (i >= length) {return;}',
            'int out_y = i % out_h;',
            'int out_x = i / out_h % out_w;',
            //'int ky = i / (out_h * out_w) % kh;',
            //'int kx = i / (out_h * out_w * kh) % kw;',
            'int c = i / (out_h * out_w) % ch;',
            'int batch = i / (out_h * out_w * ch) % n;',
            'for (int kx = 0; kx < kw; kx++) {',
            'for (int ky = 0; ky < kh; ky++) {',
            'int iny = ky + out_y * sy - ph;',
            'int inx = kx + out_x * sx - pw;',
            'if (iny < 0 || iny >= h || inx < 0 || inx >= w) {',
            //'for (int c = 0; c < ch; c++) {',
            //'  for (int batch = 0; batch < n; batch++) {',
            '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = pad_val;',
            //'  }',
            //'}',
            '} else {',
            //'for (int c = 0; c < ch; c++) {',
            //'  for (int batch = 0; batch < n; batch++) {',
            '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = img[iny + (inx + (c + (batch) * ch) * w) * h];',
            //'  }',
            '}',
            '}',
            '}',
            //'}',
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
        { datum: out_h * out_w * c * n, type: WebCL.type.UINT }
    ], out_h * out_w * c * n, 256);
    return col;
}
exports.im2col_cl_perm = im2col_cl_perm;
function im2col_cl_permx(img, ksize, stride, pad, pad_val, cover_all) {
    if (pad_val === void 0) { pad_val = 0; }
    if (cover_all === void 0) { cover_all = false; }
    var h, w, c, n;
    var img_size = $M.sizejsa(img);
    h = img_size[0];
    w = img_size[1];
    c = img_size[2] || 1; //maybe img_size.length < 4
    n = img_size[3] || 1;
    var kh = ksize[0], kw = ksize[1];
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
    var out_h = conv_outsize(h, kh, sy, ph, cover_all);
    var out_w = conv_outsize(w, kw, sx, pw, cover_all);
    //var col = new $M.CL.MatrixCL([out_h, out_w, n, kh, kw, c], 'single');
    var col = $M.zeros(out_h, out_w, n, kh, kw, c, 'gpuArray');
    if (!im2col_perm_gpu_kernel) {
        im2col_perm_gpu_kernel = $M.CL.createKernel([
            '__kernel void kernel_func(__global float *col, __global float *img,',
            'int out_h, int out_w, int kh, int kw, int sy, int sx, int ph, int pw, int ch, int n, int h, int w, float pad_val, uint length)',
            '{',
            'uint i = get_global_id(0);',
            'if (i >= length) {return;}',
            'int iny = i % h;',
            'int inx = i / h % w;',
            //'int ky = i / (out_h * out_w) % kh;',
            //'int kx = i / (out_h * out_w * kh) % kw;',
            'int c = i / (h * w) % ch;',
            'int batch = i / (h * w * ch) % n;',
            'for (int kx = 0; kx < kw; kx++) {',
            'int out_x = kx - pw - inx;',
            'if (out_x % sx) {continue;}',
            'out_x /= sx;',
            'if (out_x < 0 || out_x >= out_w) {continue;}',
            'for (int ky = 0; ky < kh; ky++) {',
            'int out_y = ky - ph - iny;',
            'if (out_y % sy) {continue;}',
            'out_y /= sy;',
            'if (out_y < 0 || out_y >= out_h) {continue;}',
            '    col[out_y + (out_x + (batch + (ky + (kx + (c) * kw) * kh) * n) * out_w) * out_h] = img[i];',
            '}',
            '}',
            //'}',
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
        { datum: h * w * c * n, type: WebCL.type.UINT }
    ], h * w * c * n, h);
    return col;
}
exports.im2col_cl_permx = im2col_cl_permx;
function col2im_cpu(col, stride, pad, size) {
    var h, w;
    h = size[0];
    w = size[1];
    var out_h, out_w, kh, kw, c, n;
    var col_shape = $M.sizejsa(col);
    out_h = col_shape[0];
    out_w = col_shape[1];
    kh = col_shape[2] || 1;
    kw = col_shape[3] || 1;
    c = col_shape[4] || 1;
    n = col_shape[5] || 1;
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
    var padded_img = $M.zeros(h + 2 * ph + sy - 1, w + 2 * pw + sx - 1, c, n);
    for (var i = 1; i <= kw; i++) {
        var i_lim = i + sx * out_w - 1;
        for (var j = 1; j <= kh; j++) {
            var j_lim = j + sy * out_h - 1;
            var col_view = col.get($M.colon(), $M.colon(), j, i, $M.colon(), $M.colon());
            col_view.reshape_inplace(out_h, out_w, c, n);
            var pad_view = padded_img.get($M.colon(j, sy, j_lim), $M.colon(i, sx, i_lim), $M.colon(), $M.colon());
            padded_img.set($M.colon(j, sy, j_lim), $M.colon(i, sx, i_lim), $M.colon(), $M.colon(), $M.plus(col_view, pad_view));
            col_view.destruct();
            pad_view.destruct();
        }
    }
    var img = padded_img.get($M.colon(ph + 1, ph + h), $M.colon(pw + 1, pw + w), $M.colon(), $M.colon());
    padded_img.destruct();
    return img;
}
exports.col2im_cpu = col2im_cpu;
var col2im_gpu_kernel = null;
function col2im_cl(col, stride, pad, size) {
    var h, w;
    h = size[0];
    w = size[1];
    var out_h, out_w, kh, kw, c, n;
    var col_shape = $M.sizejsa(col);
    out_h = col_shape[0];
    out_w = col_shape[1];
    kh = col_shape[2] || 1;
    kw = col_shape[3] || 1;
    c = col_shape[4] || 1;
    n = col_shape[5] || 1;
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
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
exports.col2im_cl = col2im_cl;
var col2im_perm_gpu_kernel = null;
function col2im_cl_perm(col, stride, pad, size) {
    var h, w;
    h = size[0];
    w = size[1];
    var out_h, out_w, kh, kw, c, n;
    var col_shape = $M.sizejsa(col);
    out_h = col_shape[0];
    out_w = col_shape[1];
    n = col_shape[2] || 1;
    kh = col_shape[3] || 1;
    kw = col_shape[4] || 1;
    c = col_shape[5] || 1;
    var sy = stride[0], sx = stride[1];
    var ph = pad[0], pw = pad[1];
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
exports.col2im_cl_perm = col2im_cl_perm;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],36:[function(require,module,exports){
(function (global){
"use strict";
// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
var $M = (typeof window !== "undefined" ? window['milsushi2'] : typeof global !== "undefined" ? global['milsushi2'] : null);
function mtimes_trans(A, B, trans_a, trans_b) {
    var devicetype = $M.devicetype(A);
    if (devicetype !== $M.devicetype(B)) {
        throw new Error('devicetype mismatch');
    }
    if (devicetype == 'cl') {
        return mtimes_trans_cl(A, B, trans_a, trans_b);
    }
    else {
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
exports.mtimes_trans = mtimes_trans;
function mtimes_trans_cl(A, B, trans_a, trans_b) {
    if (A._ndims != 2 || B._ndims != 2) {
        throw new Error('Matrix must be two-dimensional');
    }
    if (A._klass != 'single' || B._klass != 'single') {
        throw new Error('Matrix klass must be single');
    }
    var m, n, k;
    var lda, ldb, ldc;
    var trans_a_char = 'N', trans_b_char = 'N';
    if (trans_a) {
        m = A._size[1];
        k = A._size[0];
        trans_a_char = 'T';
    }
    else {
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
    }
    else {
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
exports.mtimes_trans_cl = mtimes_trans_cl;
function mtimes_atrans_largek(A, B) {
    // A^T * B
    var devicetype = $M.devicetype(A);
    if (devicetype !== $M.devicetype(B)) {
        throw new Error('devicetype mismatch');
    }
    if (devicetype == 'cl') {
        return mtimes_largek_cl(A, B);
    }
    else {
        var At = $M.t(A);
        var C = $M.mtimes(At, B);
        At.destruct();
        return C;
    }
}
exports.mtimes_atrans_largek = mtimes_atrans_largek;
var mtimes_largek_cl_kernel = null;
function mtimes_largek_cl(A, B) {
    // A^T * B
    var m, k, n;
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])(1)
});