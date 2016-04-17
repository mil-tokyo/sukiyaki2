import Layer = require('./layer');

class DataLayer extends Layer {
  length: number;
  constructor(params: any) {
    super();
  }

  init(callback: () => void): void {
    this.length = 100;
    console.log('Data length set');
    setImmediate(callback);
  }

  forward(bottoms: any[], callback: (tops: any[]) => void): void {
    var range: number[] = bottoms[0];//[from, to]
    var data = [];
    var labels = [];
    for (var i = range[0]; i < range[1]; i++) {
      data.push(i);
      labels.push(i * 10);
    }

    setTimeout(function() {
      callback([data, labels]);
    }, 1);
  }

  release(): void {

  }

  destruct(): void {

  }
}

export = DataLayer;
