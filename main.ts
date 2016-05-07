import Network = require('./network');
import OptimizerSGD = require('./optimizer_sgd');

function main() {
  var layers = [
    {name: "d", type: "data", params: {}, inputs: ["batch"], outputs: ["data","label"]},
    {name: "c", type: "calc", params: {}, inputs: ["data"], outputs: ["pred"]},
    {name: "l", type: "loss", params: {}, inputs: ["pred","label"], outputs: ["loss"]}
  ];
  
  var net = new Network(layers);
  var opt = new OptimizerSGD(net, 0.01);
  
  var iter = 0;
  var next_iter = () => {
    console.log("iteration " + iter);
    var range_bottom = Math.random() * 5 | 0;
    var range_top = range_bottom + 3;
    var input_vars: {[index:string]:number[]} = {'batch':[range_bottom,range_top]};
    opt.update(input_vars, () => {
      console.log('loss: ' + net.blobs_forward['loss']);
      if (iter < 10) {
        iter++;
        next_iter();
      } else {
        console.log("optimization finished");
        console.log("predicted weight: " + net.layer_instances['c']['weight']);
      }
    });
    
  };
  
  next_iter();  
  return opt;
}

export = main;
