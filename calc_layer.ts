import Layer = require('./layer');

class CalcLayer extends Layer {
  weight: number;
  delta_weight: number;

  constructor(params: any) {
    super();
    this.weight = 2.0;
    this.delta_weight = 0.0;
    this.train_params = ['weight'];
    this.delta_params = ['delta_weight'];
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: any[], callback: (tops: any[]) => void): void {
    //multiply input by weight
    var data: number[] = bottoms[0];
    var output: number[] = [];
    for (var i = 0; i < data.length; i++) {
      var element = data[i];
      output.push(element);
    }

    setImmediate(function() {
      callback([element]);
    });
  }

  backward(bottoms: any[], top_deltas: any[], callback: (bottom_deltas: any[]) => void): void {
    var data: number[] = bottoms[0];
    var top_delta: number[] = top_deltas[0];
    
    var bottom_delta: number[] = [];
    
    for (var i = 0; i < data.length; i++) {
      bottom_delta[i] = top_delta[i] * this.weight;
    }
    
    setImmediate(function(){
      callback([bottom_delta]);
    });
  }
  
  calculateUpdateParams(bottoms: any[], top_deltas: any[], callback: () => void): void {
    var data: number[] = bottoms[0];
    var top_delta: number[] = top_deltas[0];
    var delta_weight = 0.0;
    
    for (var i = 0; i < data.length; i++) {
      delta_weight += top_delta[i] * data[i];
    }
    
    this.delta_weight = delta_weight;
    
    setImmediate(function(){
      callback();
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = CalcLayer;
