/// <reference path="./node_modules/milsushi2/index.d.ts"/>
import $M = require('milsushi2');
import Network = require('./network');
import OptimizerSGD = require('./optimizer_sgd');

function main() {
  var layers = [
    { name: "d", type: "data", params: {}, inputs: ["batch"], outputs: ["data", "label"] },
    { name: "c", type: "calc", params: {}, inputs: ["data"], outputs: ["pred"] },
    { name: "l", type: "loss", params: {}, inputs: ["pred", "label"], outputs: ["loss"] }
  ];

  var net = new Network(layers);
  var opt = new OptimizerSGD(net, 0.01);

  var iter = 0;
  var next_iter = () => {
    console.log("iteration " + iter);
    var range_bottom = Math.random() * 5 | 0;
    var range_top = range_bottom + 3;
    var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([0, 1]) };
    opt.update(input_vars, () => {
      console.log('loss: ' + net.blobs_forward['loss']);
      if (iter < 1000) {
        iter++;
        next_iter();
      } else {
        console.log("optimization finished");
        console.log("predicted weight: " + net.layer_instances['c']['weight'].toString());
      }
    });

  };

  next_iter();
  return opt;
}

function train_mnist() {
  var layers = [
    { name: "d", type: "mnist_data", params: {}, inputs: ["batch"], outputs: ["data", "label"] },
    { name: "c", type: "calc", params: {}, inputs: ["data"], outputs: ["pred"] },
    { name: "l", type: "softmax_cross_entropy", params: {}, inputs: ["pred", "label"], outputs: ["loss"] }
  ];

  var net = new Network(layers);
  net.init(() => {
    var opt = new OptimizerSGD(net, 1e-3);
    var batch_size = 10;

    var iter = 0;
    var next_iter = () => {
      console.log("iteration " + iter);
      var range_bottom = iter * batch_size + 1;
      var range_top = (iter + 1) * batch_size;
      var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([range_bottom, range_top]) };
      opt.update(input_vars, () => {
        console.log('loss: ' + net.blobs_forward['loss']);
        if (iter < 1000) {
          iter++;
          next_iter();
        } else {
          console.log("optimization finished");
        }
      });

    };

    next_iter();

  });
  
  return net;
}

export = train_mnist;
