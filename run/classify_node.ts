import $M = require('milsushi2');
import Sukiyaki = require('../index');
import argparse = require('argparse');
var Network = Sukiyaki.Network;
var OptimizerSGD = Sukiyaki.Optimizers.OptimizerSGD;
var ArraySerializer = Sukiyaki.ArraySerializer;
import fs = require('fs');

function classify_node(netdef: string, mean_file: string, weight: string, dst: string, cl: boolean = false) {
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
    if (mean_file) {
      var data_mean = $M.permute($M.npyread(fs.readFileSync(mean_file)), [2, 3, 1]);//to h, w, c
      (<Sukiyaki.Layers.DataAugmentationLayer>net.layer_instances["aug_test"]).set_data_mean(data_mean);
    }
    var batch_size = 8;

    console.log('loading net');
    var buf = new Uint8Array(fs.readFileSync(weight).buffer);
    ArraySerializer.load(buf, net);

    var validation_iter = 0;
    var validation_length = (<Sukiyaki.Layers.BlobDataLayer>net.layer_instances["d_test"]).length;
    var validation_n_batch = Math.ceil(validation_length / batch_size);
    var validation_sum_accuracy = 0;
    var validation_sum_loss = 0;
    var final_fc_list = [];
    var validation = (start_val: boolean = false) => {
      if (start_val) {
        validation_iter = 0;
        validation_sum_accuracy = 0;
        validation_sum_loss = 0;
        net.phase = "test";
      }
      console.log(validation_iter);
      var range_bottom = validation_iter * batch_size + 1;
      var range_size = Math.min(batch_size, validation_length - range_bottom + 1);
      var input_vars: { [index: string]: $M.Matrix } = { 'batch': $M.jsa2mat([range_bottom, range_size]) };
      net.forward(input_vars, () => {
        final_fc_list.push(net.blobs_forward['fc8'].copy());//[labels,range_size]
        var val_a = net.blobs_forward['accuracy'].get();
        var val_l = net.blobs_forward['loss'].get();
        validation_sum_accuracy += val_a * range_size;
        validation_sum_loss += val_l * range_size;
        net.release();
        validation_iter++;
        if (validation_iter == validation_n_batch) {
          // end of validation
          var val_mean_accuracy = validation_sum_accuracy / validation_length;
          var val_mean_loss = validation_sum_loss / validation_length;
          console.log(JSON.stringify({'type': 'val', 'loss': val_mean_loss, 'accuracy': val_mean_accuracy}));
          var final_fc = $M.horzcat(...final_fc_list);
          fs.writeFileSync(dst, new Buffer($M.npysave(final_fc)));
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
  //classify_node(netdef: string, mean_file: string, weight: string, dst: string, cl: boolean = false)
  var parser = new argparse.ArgumentParser();
  parser.addArgument(['--net'], {required:true});
  parser.addArgument(['--mean'], {});
  parser.addArgument(['--dst'],{required:true});
  parser.addArgument(['--weight'],{required:true});
  parser.addArgument(['--cl'],{defaultValue:false,type:Boolean});
  var args = parser.parseArgs();
  classify_node(args.net, args.mean, args.weight, args.dst, args.cl);
}

main();
