import $M = require('milsushi2');

declare var require;
declare var process;
declare var Buffer;
var os = require('os');
var fs = require('fs');
var child_process = require('child_process');
var cl_enabled = Boolean(Number(process.env['TEST_CL']));
console.log('OpenCL ' + cl_enabled);
var MatrixCL = null;
if (cl_enabled) {
  $M.initcl();
}

import BenchBase = require('./bench_base');
import conv = require('./conv');
import mtimes = require('./mtimes');

function time(f: BenchBase, n_run: number = 3, callback: any) {
  var elapsed = 0;
  var args = f.setup();
  if (!args) {
    args = [];
  }
  console.log(f.name);
  var runtimes = [];
  var run_measure = () => {
    var time_begin = Date.now();
    f.run(() => {
      if (cl_enabled) {
        $M.CL.finish();
      }
      var time_end = Date.now();
      var current_elapsed = time_end - time_begin;
      runtimes.push(current_elapsed);
      if (runtimes.length >= n_run + 1) {
        //get min-running time
        elapsed = Math.min.apply(null, runtimes);
        console.log('' + f.name + ': ' + elapsed + 'ms');
        callback();
      } else {
        run_measure();
      }
    }, ...args);
  }

  run_measure();
}

function time_all(f_array: BenchBase[], n_run?: number) {
  var call_next = () => {
    var f = f_array.shift();
    if (f != null) {
      time(f, n_run, call_next);
    } else {
      console.log('finished all function');
    }
  }

  call_next();
}

function main() {
  time_all([new conv({in_size: 20, out_size: 50, ksize: 5, stride: 1, pad: 0}, [12, 12, 20, 64]),
  new mtimes(8*8*64, 50, 5*5*20)]);
}

main();
