import $M = require('milsushi2');
import Sukiyaki = require('./index');
var Network = Sukiyaki.Network;
var OptimizerSGD = Sukiyaki.Optimizers.OptimizerSGD;
var ArraySerializer = Sukiyaki.ArraySerializer;
import fs = require('fs');

function train_imagenet(load_weight: boolean = false, cl: boolean = false) {
  if (cl) {
    $M.initcl();
  }
  // AlexNet + BN
  var layers = [
    { name: "d_train", type: "blob_data", params: { "file_prefix": "imagenet/train_100k", "data_shape": [227, 227, 3] }, inputs: ["batch"], outputs: ["data", "label"], phase: ["train"] },
    { name: "d_test", type: "blob_data", params: { "file_prefix": "imagenet/val", "data_shape": [227, 227, 3] }, inputs: ["batch"], outputs: ["data", "label"], phase: ["test"] },

    { name: "conv1", type: "convolution_2d", params: { in_size: 3, out_size: 96, ksize: [11, 11], stride: [4, 4], pad: [0, 0] }, inputs: ["data"], outputs: ["conv1"] },
    { name: "bn1", type: "batch_normalization", params: { in_size: 96, target_dim: 3 }, inputs: ["conv1"], outputs: ["bn1"] },
    { name: "relu1", type: "relu", params: {}, inputs: ["bn1"], outputs: ["relu1"] },
    { name: "pool1", type: "pooling_2d", params: { type: "max", ksize: [3, 3], stride: [2, 2], pad: [0, 0] }, inputs: ["relu1"], outputs: ["pool1"] },

    { name: "conv2", type: "convolution_2d", params: { in_size: 96, out_size: 256, ksize: [5, 5], stride: [1, 1], pad: [2, 2] }, inputs: ["pool1"], outputs: ["conv2"] },
    { name: "bn2", type: "batch_normalization", params: { in_size: 256, target_dim: 3 }, inputs: ["conv2"], outputs: ["bn2"] },
    { name: "relu2", type: "relu", params: {}, inputs: ["bn2"], outputs: ["relu2"] },
    { name: "pool2", type: "pooling_2d", params: { type: "max", ksize: [3, 3], stride: [2, 2], pad: [0, 0] }, inputs: ["relu2"], outputs: ["pool2"] },

    { name: "conv3", type: "convolution_2d", params: { in_size: 256, out_size: 384, ksize: [3, 3], stride: [1, 1], pad: [1, 1] }, inputs: ["pool2"], outputs: ["conv3"] },
    { name: "relu3", type: "relu", params: {}, inputs: ["conv3"], outputs: ["relu3"] },

    { name: "conv4", type: "convolution_2d", params: { in_size: 384, out_size: 384, ksize: [3, 3], stride: [1, 1], pad: [1, 1] }, inputs: ["relu3"], outputs: ["conv4"] },
    { name: "relu4", type: "relu", params: {}, inputs: ["conv4"], outputs: ["relu4"] },

    { name: "conv5", type: "convolution_2d", params: { in_size: 384, out_size: 256, ksize: [3, 3], stride: [1, 1], pad: [1, 1] }, inputs: ["relu4"], outputs: ["conv5"] },
    { name: "relu5", type: "relu", params: {}, inputs: ["conv5"], outputs: ["relu5"] },
    { name: "pool5", type: "pooling_2d", params: { type: "max", ksize: [3, 3], stride: [2, 2], pad: [0, 0] }, inputs: ["relu5"], outputs: ["pool5"] },

    { name: "fc6", type: "linear", params: { in_shape: [6, 6, 256], out_size: 4096 }, inputs: ["pool5"], outputs: ["fc6"] },
    { name: "relu6", type: "relu", params: {}, inputs: ["fc6"], outputs: ["relu6"] },
    { name: "dropout6", type: "dropout", params: { dropout_ratio: 0.5 }, inputs: ["relu6"], outputs: ["dropout6"] },

    { name: "fc7", type: "linear", params: { in_shape: [4096], out_size: 4096 }, inputs: ["dropout6"], outputs: ["fc7"] },
    { name: "relu7", type: "relu", params: {}, inputs: ["fc7"], outputs: ["relu7"] },
    { name: "dropout7", type: "dropout", params: { dropout_ratio: 0.5 }, inputs: ["relu7"], outputs: ["dropout7"] },

    { name: "fc8", type: "linear", params: { in_shape: [4096], out_size: 1000 }, inputs: ["dropout7"], outputs: ["pred"] },

    { name: "l", type: "softmax_cross_entropy", params: {}, inputs: ["pred", "label"], outputs: ["loss"] },
    { name: "a", type: "accuracy", params: {}, inputs: ["pred", "label"], outputs: ["accuracy"], phase: ["test"] }
  ];
  var net = new Network(layers);
  net.init(() => {
    if (cl) {
      net.to_cl();
    }
    net.layer_time = {};
    var opt = new OptimizerSGD(net, 1e-3);
    var batch_size = 128;

    if (load_weight) {
      console.log('loading net');
      var buf = new Uint8Array(fs.readFileSync('/tmp/sukiyaki_weight.bin').buffer);
      ArraySerializer.load(buf, net);
    }

    var iter = 0;
    var max_iter = 10000;
    var next_iter = () => {
      if (iter % 10 == 0) {
        console.log("iteration " + iter);
        if (cl) {
          console.log("buffers: " + $M.CL.buffers);
        }
      }
      net.phase = "train";
      var range_bottom = iter * batch_size + 1;
      var range_size = batch_size;
      var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([range_bottom, range_size]) };
      opt.update(input_vars, () => {
        if (iter % 10 == 0) {
          console.log('loss: ' + net.blobs_forward['loss']);
          for (var key in net.layer_time) {
            if (net.layer_time.hasOwnProperty(key)) {
              var element = net.layer_time[key];
              console.log(key + '\t' + element);
            }
          }
        }
        opt.release();
        if (iter < max_iter) {
          iter++;
          if (iter % 100 == 0) {
            validation();
          } else {
            next_iter();
          }
        } else {
          console.log("optimization finished");
          validation();
        }
      });

    };

    var validation = () => {
      console.log("validation at iteration " + iter);
      net.phase = "test";
      var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([1, 100]) };
      net.forward(input_vars, () => {
        var acc = net.blobs_forward['accuracy'].get();
        console.log('accuracy ' + acc);
        net.release();
        console.log('saving net');
        var buf = ArraySerializer.dump(net);
        fs.writeFileSync('/tmp/sukiyaki_weight.bin', new Buffer(buf));
        if (iter < max_iter) {
          next_iter();
        }
      });
    };

    validation();

  });

  return net;
}

export = train_imagenet;
train_imagenet(false, true);
