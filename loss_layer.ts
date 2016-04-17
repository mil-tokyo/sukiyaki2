import Layer = require('./layer');

class LossLayer extends Layer {

  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: any[], callback: (tops: any[]) => void): void {
    //square loss
    var data: number[] = bottoms[0];
    var gt: number[] = bottoms[1];
    var output: number[] = [];
    var loss = 0.0;
    for (var i = 0; i < data.length; i++) {
      loss += 0.5 * Math.pow(data[i] - gt[i], 2.0);
    }
    output.push(loss);//scalar regardless of batch size

    setImmediate(function() {
      callback([output]);
    });
  }

  backward(bottoms: any[], top_deltas: any[], callback: (bottom_deltas: any[]) => void): void {
    //top_deltas[0] is usually 1.0
    var data: number[] = bottoms[0];
    var gt: number[] = bottoms[1];
    var top_delta: number = top_deltas[0];//scalar
    
    var bottom_delta: number[] = [];
    for (var i = 0 ; i < data.length; i++) {
      bottom_delta.push((data[i]-gt[i])*top_delta);
    }
    
    setImmediate(function(){
      callback([bottom_delta]);
    });
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = LossLayer;
