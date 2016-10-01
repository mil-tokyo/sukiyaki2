import $M = require('milsushi2');
import Sukiyaki = require('../index');
import argparse = require('argparse');
var Network = Sukiyaki.Network;
var OptimizerSGD = Sukiyaki.Optimizers.OptimizerSGD;
var ArraySerializer = Sukiyaki.ArraySerializer;
import fs = require('fs');

function train_node(netdef: string, mean_file: string, lr: number, save_tmpl: string, initial_weight: string = null, cl: boolean = false) {
  if (cl) {
    $M.initcl();
  }
  var layers = JSON.parse(fs.readFileSync(netdef, 'utf8'));
  var net = new Network(layers);
  net.init(() => {
    if (cl) {
      net.to_cl();
    }
    net.layer_time = {};
    var opt = new Sukiyaki.Optimizers.OptimizerMomentumSGD(net, lr, 0.9);
    if (mean_file) {
      var data_mean = $M.permute($M.npyread(fs.readFileSync(mean_file)), [2, 3, 1]);//to h, w, c
      (<Sukiyaki.Layers.DataAugmentationLayer>net.layer_instances["aug_train"]).set_data_mean(data_mean);
      (<Sukiyaki.Layers.DataAugmentationLayer>net.layer_instances["aug_test"]).set_data_mean(data_mean);
    }
    var batch_size = 128;

    if (initial_weight) {
      console.log('loading net');
      var buf = new Uint8Array(fs.readFileSync(initial_weight).buffer);
      ArraySerializer.load(buf, net);
    }

    var iter = 0;
    var max_iter = 200000;
    var next_iter = () => {
      if (iter % 10 == 0) {
        console.log("iteration " + iter + ' ' + (new Date()));
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
          if (iter % 1000 == 0) {
            validation(true);
          } else {
            next_iter();
          }
        } else {
          console.log("optimization finished");
          validation(true);
        }
      });

    };

    var validation_iter = 0;
    var validation_n_batch = Math.floor((<Sukiyaki.Layers.BlobDataLayer>net.layer_instances["d_test"]).length / batch_size);
    var validation_sum_accuracy = 0;
    var validation_sum_loss = 0;
    var validation = (start_val: boolean = false) => {
      if (start_val) {
        validation_iter = 0;
        validation_sum_accuracy = 0;
        validation_sum_loss = 0;
        console.log("validation at iteration " + iter);
        net.phase = "test";
      }
      var range_bottom = validation_iter * batch_size + 1;
      var range_size = batch_size;
      var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([range_bottom, range_size]) };
      net.forward(input_vars, () => {
        var val_a = net.blobs_forward['accuracy'].get();
        var val_l = net.blobs_forward['loss'].get();
        validation_sum_accuracy += val_a;
        validation_sum_loss += val_l;
        net.release();
        validation_iter++;
        if (validation_iter == validation_n_batch) {
          // end of validation
          var val_mean_accuracy = validation_sum_accuracy / validation_n_batch;
          var val_mean_loss = validation_sum_loss / validation_n_batch;
          console.log(JSON.stringify({'type': 'val', 'iter': iter, 'loss': val_mean_loss, 'accuracy': val_mean_accuracy}));
          console.log('saving net');
          var buf = ArraySerializer.dump(net);
          fs.writeFileSync(save_tmpl.replace('%d', iter.toString()), new Buffer(buf));
          if (iter < max_iter) {
            next_iter();
          } else {
            console.log('end of optimization');
          }
        } else {
          //next iteration of validation
          validation(false);
        }
      });
    };

    validation(true);

  });

  return net;
}

function main() {
  //netdef: string, mean_file: string, lr: number, save_tmpl: string, initial_weight: string = null, cl: boolean = false
  var parser = new argparse.ArgumentParser();
  parser.addArgument(['--net'], {required:true});
  parser.addArgument(['--mean'], {});
  parser.addArgument(['--lr'], {defaultValue: 1e-2, type:Number});
  parser.addArgument(['--save_tmpl'],{required:true});
  parser.addArgument(['--initial_weight'],{});
  parser.addArgument(['--cl'],{defaultValue:false,type:Boolean});
  var args = parser.parseArgs();
  train_node(args.net, args.mean, args.lr, args.save_tmpl, args.initial_weight, args.cl);
}

main();
