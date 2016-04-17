import Layer = require('./layer');
import CalcLayer = require('./calc_layer');
import DataLayer = require('./data_layer');
import LossLayer = require('./loss_layer');

class LayerFactory {
  static create(name: string, params: any): Layer {
    switch (name) {
      case 'data':
      return new DataLayer(params);
      case 'calc':
      return new CalcLayer(params);
      case 'loss':
      return new LossLayer(params);
      default:
      throw new Error('Unknown layer');
    }
  }
}

export = LayerFactory;
