import Layer = require('./layer');
import LinearLayer = require('./linear_layer');
import BranchLayer = require('./branch_layer');
import PlusLayer = require('./plus_layer');
import DataLayer = require('./data_layer');
import LossLayer = require('./loss_layer');
import MnistDataLayer = require('./mnist_data_layer');
import BlobDataLayer = require('./blob_data_layer');
import SoftmaxCrossEntropyLayer = require('./softmax_cross_entropy_layer');
import ReluLayer = require('./relu_layer');
import AccuracyLayer = require('./accuracy_layer');
import Convolution2DLayer = require('./convolution_2d_layer');
import Pooling2DLayer = require('./pooling_2d_layer');
import BatchNormalizationLayer = require('./batch_normalization_layer');

class LayerFactory {  
  static create(type: string, params: any): Layer {
    switch (type) {
      case 'data':
        return new DataLayer(params);
      case 'linear':
        return new LinearLayer(params);
      case 'branch':
        return new BranchLayer(params);
      case 'plus':
        return new PlusLayer(params);
      case 'loss':
        return new LossLayer(params);
      case 'mnist_data':
        return new MnistDataLayer(params);
      case 'blob_data':
        return new BlobDataLayer(params);
      case 'softmax_cross_entropy':
        return new SoftmaxCrossEntropyLayer(params);
      case 'relu':
        return new ReluLayer(params);
      case 'accuracy':
        return new AccuracyLayer(params);
      case 'convolution_2d':
        return new Convolution2DLayer(params);
      case 'pooling_2d':
        return new Pooling2DLayer(params);
      case 'batch_normalization':
        return new BatchNormalizationLayer(params);
      default:
        throw new Error('Unknown layer');
    }
  }
}

export = LayerFactory;
