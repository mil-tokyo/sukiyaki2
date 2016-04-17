class Layer {
  train_params: string[];
  delta_params: string[];
  
  init(callback: () => void): void {
    setImmediate(callback);
  }

  forward(bottoms: any[], callback: (tops: any[]) => void): void {
    throw new Error('Not implemented');
  }

  backward(bottoms: any[], top_deltas: any[], callback: (bottom_deltas: any[]) => void): void {
    throw new Error('Not implemented');
  }

  release(): void {
    //release internal data for a batch
  }

  destruct(): void {
    //release data in the layer
  }
}

export = Layer;
