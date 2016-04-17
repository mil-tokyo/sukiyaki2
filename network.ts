import Layer = require('./layer');
import LayerFactory = require('./layer_factory');

class Network {
  layers: {name: string, params: any, inputs: string[], outputs: string[]}[];
  layer_instances: {[index: string]: Layer};
  
  constructor(layers: {name: string, params: any, inputs: string[], outputs: string[]}[]) {
    this.layers = layers;
    //construct layers
    for (var i = 0; i < this.layers.length; i++) {
      var element = this.layers[i];
      var inst = LayerFactory.create(element.name, element.params);
      this.layer_instances[element.name] = inst;
    }
  }
  
  forward(input_vars: {[index:string]:number[]}, target_var: string, callback: () => void): void {
    
  }
  
  backward(): void {
    
  }
}
