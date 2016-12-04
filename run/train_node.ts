// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import $M = require('milsushi2');
import Sukiyaki = require('../index');
import argparse = require('argparse');
var Network = Sukiyaki.Network;
var OptimizerSGD = Sukiyaki.Optimizers.OptimizerSGD;
var ArraySerializer = Sukiyaki.ArraySerializer;
import fs = require('fs');

function train_node(args) {//netdef: string, mean_file: string, lr: number, save_tmpl: string, initial_weight: string = null, cl: boolean = false) {
  var cl: boolean = args.cl;
  if (cl) {
    if ($M.initcl()) {
      console.log("OpenCL initialization succeeded");
    } else {
      console.error("OpenCL initialization failed");
      cl = false;
    }
  }
  var layers = JSON.parse(fs.readFileSync(args.net, 'utf8'));
  var net = new Network(layers);
  net.init(() => {
    if (cl) {
      net.to_cl();
    }
    net.layer_time = {};
    var batch_size = args.batch_size;
    var batch_division_count = args.batch_div;
    var val_batch_size = args.val_batch_size || batch_size;

    var opt = new Sukiyaki.Optimizers.OptimizerMomentumSGD(net, args.lr / batch_division_count, args.momentum);
    if (args.mean_file) {
      var data_mean = $M.permute($M.npyread(fs.readFileSync(args.mean_file)), [2, 3, 1]);//to h, w, c
      (<Sukiyaki.Layers.DataAugmentationLayer>net.layer_instances["aug_train"]).set_data_mean(data_mean);
      (<Sukiyaki.Layers.DataAugmentationLayer>net.layer_instances["aug_test"]).set_data_mean(data_mean);
    }
    if (args.initial_weight) {
      console.log('loading net');
      var buf = new Uint8Array(fs.readFileSync(args.initial_weight).buffer);
      ArraySerializer.load(buf, net);
    }

    var iter = 0;
    var max_iter = args.iter;
    var next_iter = () => {
      if (iter % 10 == 0) {
        console.log("iteration " + iter + ' ' + (new Date()));
        if (cl) {
          console.log("buffers: " + $M.CL.buffers);
        }
      }
      net.phase = "train";
      var range_bottom = iter * batch_size + 1;
      // var range_size = batch_size;
      // var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([range_bottom, range_size]) };
      // opt.update(input_vars, () => {
      //   if (iter % 10 == 0) {
      //     console.log('loss: ' + net.blobs_forward['loss']);
      //     for (var key in net.layer_time) {
      //       if (net.layer_time.hasOwnProperty(key)) {
      //         var element = net.layer_time[key];
      //         console.log(key + '\t' + element);
      //       }
      //     }
      //   }
      //   opt.release();
      //   if (iter < max_iter) {
      //     iter++;
      //     if (iter % 1000 == 0) {
      //       validation(true);
      //     } else {
      //       next_iter();
      //     }
      //   } else {
      //     console.log("optimization finished");
      //     validation(true);
      //   }
      // });
      var batch_division_size = Math.ceil(batch_size / batch_division_count);
      var divided_input_vars: { [index: string]: $M.Matrix }[] = [];
      for (var div_i = 0; div_i < batch_division_count; div_i++) {
        var div_range_bottom = range_bottom + div_i * batch_division_size;
        var div_range_size = Math.min(batch_division_size, batch_size - div_i * batch_division_size);
        divided_input_vars.push({ 'batch': $M.jsa2mat([div_range_bottom, div_range_size]) });
      }
      opt.update_divided(divided_input_vars, () => {
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
        if (!max_iter || (iter < max_iter)) {
          iter++;
          if (iter % args.val_cycle == 0) {
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
    var validation_n_batch = Math.floor((<Sukiyaki.Layers.BlobDataLayer>net.layer_instances["d_test"]).length / val_batch_size);
    if (args.val_iter_limit) {
      validation_n_batch = Math.min(validation_n_batch, args.val_iter_limit);
    }
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
      var range_bottom = validation_iter * val_batch_size + 1;
      var range_size = val_batch_size;
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
          console.log(JSON.stringify({ 'type': 'val', 'iter': iter, 'loss': val_mean_loss, 'accuracy': val_mean_accuracy }));
          console.log('saving net');
          var buf = ArraySerializer.dump(net);
          fs.writeFileSync(args.save_tmpl.replace('%d', iter.toString()), new Buffer(buf));
          if (!max_iter || (iter < max_iter)) {
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
  parser.addArgument(['--net'], { required: true });
  parser.addArgument(['--mean'], {});
  parser.addArgument(['--lr'], { defaultValue: 1e-2, type: Number });
  parser.addArgument(['--momentum'], { defaultValue: 0.9, type: Number });
  parser.addArgument(['--save_tmpl'], { required: true });
  parser.addArgument(['--initial_weight'], {});
  parser.addArgument(['--cl'], { action: 'storeTrue', defaultValue: false });
  parser.addArgument(['--batch_size'], { defaultValue: 128, type: Number });
  parser.addArgument(['--batch_div'], { defaultValue: 1, type: Number });
  parser.addArgument(['--val_batch_size'], { defaultValue: 128, type: Number });
  parser.addArgument(['--val_cycle'], { defaultValue: 1000, type: Number });
  parser.addArgument(['--val_iter_limit'], { defaultValue: 0, type: Number });
  parser.addArgument(['--iter'], { defaultValue: 0, type: Number });
  var args = parser.parseArgs();
  train_node(args);
}

main();
