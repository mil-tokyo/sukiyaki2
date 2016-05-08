import Layer = require('./layer');
import LinearLayer = require('./linear_layer');
import DataLayer = require('./data_layer');
import LossLayer = require('./loss_layer');
import MnistDataLayer = require('./mnist_data_layer');
import SoftmaxCrossEntropyLayer = require('./softmax_cross_entropy_layer');
import ReluLayer = require('./relu_layer');

class LayerFactory {
  static create(type: string, params: any): Layer {
    switch (type) {
      case 'data':
        return new DataLayer(params);
      case 'linear':
        return new LinearLayer(params);
      case 'loss':
        return new LossLayer(params);
      case 'mnist_data':
        return new MnistDataLayer(params);
      case 'softmax_cross_entropy':
        return new SoftmaxCrossEntropyLayer(params);
      case 'relu':
        return new ReluLayer(params);
      default:
        throw new Error('Unknown layer');
    }
  }
}

export = LayerFactory;
