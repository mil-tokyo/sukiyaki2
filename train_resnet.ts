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
  var layers = JSON.parse(fs.readFileSync('netdef/resnet50.json', 'utf8'));
  var net = new Network(layers);
  net.init(() => {
    if (cl) {
      net.to_cl();
    }
    net.layer_time = {};
    var opt = new OptimizerSGD(net, 1e-3);
    var batch_size = 16;

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
