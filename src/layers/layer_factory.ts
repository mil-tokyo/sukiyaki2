// (c) 2016 Machine Intelligence Laboratory (The University of Tokyo), MIT License.
import Layer = require('./layer');
import Layers = require('./index');

class LayerFactory {  
  static create(type: string, params: any): Layer {
    switch (type) {
      case 'data':
        return new Layers.DataLayer(params);
      case 'linear':
        return new Layers.LinearLayer(params);
      case 'branch':
        return new Layers.BranchLayer(params);
      case 'plus':
        return new Layers.PlusLayer(params);
      case 'loss':
        return new Layers.LossLayer(params);
      case 'mnist_data':
        return new Layers.MnistDataLayer(params);
      case 'blob_data':
        return new Layers.BlobDataLayer(params);
      case 'data_augmentation':
        return new Layers.DataAugmentationLayer(params);
      case 'softmax_cross_entropy':
        return new Layers.SoftmaxCrossEntropyLayer(params);
      case 'relu':
        return new Layers.ReluLayer(params);
      case 'accuracy':
        return new Layers.AccuracyLayer(params);
      case 'convolution_2d':
        return new Layers.Convolution2DLayer(params);
      case 'pooling_2d':
        return new Layers.Pooling2DLayer(params);
      case 'batch_normalization':
        return new Layers.BatchNormalizationLayer(params);
      case 'dropout':
        return new Layers.DropoutLayer(params);
      default:
        throw new Error('Unknown layer');
    }
  }
}

export = LayerFactory;
