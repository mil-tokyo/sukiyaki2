#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
Generates layer test data using chainer (1.8)
"""

import sys
import os
import json
from collections import defaultdict
import numpy as np
import chainer
import chainer.functions as F
from fixture_helper import random_float32, reverse_order, reorder_nchw_hwcn

DST_DIR = os.path.abspath(os.path.dirname(__file__)) + '/layer/'

def linear(n, out_ch, in_shape):
    from chainer.functions.connection.linear import LinearFunction
    f = LinearFunction()
    x = random_float32((n, ) + in_shape)
    W = random_float32((out_ch, np.prod(in_shape)))
    b = random_float32((out_ch, ))
    y, = f.forward((x, W, b))

    gy = random_float32(y.shape)
    gx, gW, gb = f.backward((x, W, b), (gy, ))

    # flattening in sukiyaki uses fortran-order, in contrast to chainer c-order
    x, y, gy, gx, W, b, gW, gb = reverse_order(x, y, gy, gx, W, b, gW, gb)#(n, in_shape) to (reversed(in_shape), n)

    in_shape_forder = list(in_shape)
    in_shape_forder.reverse()
    layer_params = {"type":"linear", "params": {"in_shape": in_shape_forder, "out_size": out_ch}}

    return {"layer_params":layer_params,
        "train_params":{"weight":W, "bias":b},
        "delta_params":{"delta_weight":gW, "delta_bias": gb},
        "forward":{"bottoms":[x], "tops":[y]},
        "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def relu(n, in_shape):
    from chainer.functions.activation.relu import ReLU
    f = ReLU()
    x = random_float32((n, ) + in_shape)
    gy = random_float32((n, ) + in_shape)

    y, = f.forward((x, ))
    gx, = f.backward((x, ), (gy, ))

    x, y, gy, gx = reverse_order(x, y, gy, gx)

    layer_params = {"type":"relu", "params": {}}

    return {"layer_params": layer_params,
        "forward":{"bottoms":[x], "tops":[y]},
        "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def convolution_2d(n, in_size, out_size, in_shape, ksize, stride, pad):
    from chainer.functions.connection.convolution_2d import Convolution2DFunction
    f = Convolution2DFunction(stride = stride, pad = pad)
    x = random_float32((n, in_size) + in_shape)
    W = random_float32((out_size, in_size) + ksize)
    b = random_float32((out_size,))
    y, = f.forward((x, W, b))
    gy = random_float32(y.shape)
    gx, gW, gb = f.backward((x, W, b), (gy,))

    # change order from (n, c, h, w) to (h, w, c, n), (out,in,h,w) to (h, w, in, out)
    x, W, y, gy, gx, gW = reorder_nchw_hwcn(x, W, y, gy, gx, gW)

    layer_params = {"type":"convolution_2d", "params": {"in_size":in_size, "out_size":out_size, "ksize":ksize, "stride":stride, "pad":pad}}

    return {"layer_params":layer_params,
        "train_params":{"weight":W, "bias":b},
        "delta_params":{"delta_weight":gW, "delta_bias": gb},
        "forward":{"bottoms":[x], "tops":[y]},
        "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def convolution_2d_group(n, in_size, out_size, in_shape, ksize, stride, pad, groups):
    from chainer.functions.connection.convolution_2d import Convolution2DFunction
    f = Convolution2DFunction(stride = stride, pad = pad)
    x = random_float32((n, in_size) + in_shape)
    in_group_size = in_size // groups
    out_group_size = out_size // groups
    W = random_float32((out_size, in_group_size) + ksize)
    b = random_float32((out_size,))
    ys = []
    gys = []
    gxs = []
    gWs = []
    gbs = []
    for g in range(groups):
        xg = x[:, g*in_group_size:(g+1)*in_group_size, :, :]
        Wg = W[g*out_group_size:(g+1)*out_group_size, :, :, :]
        bg = b[g*out_group_size:(g+1)*out_group_size]
        yg, = f.forward((xg, Wg, bg))
        gyg = random_float32(yg.shape)
        gxg, gWg, gbg = f.backward((xg, Wg, bg), (gyg,))
        ys.append(yg)
        gys.append(gyg)
        gxs.append(gxg)
        gWs.append(gWg)
        gbs.append(gbg)

    y = np.concatenate(ys, axis = 1)
    gy = np.concatenate(gys, axis = 1)
    gx = np.concatenate(gxs, axis = 1)
    gW = np.concatenate(gWs, axis = 0)
    gb = np.concatenate(gbs, axis = 0)
    # change order from (n, c, h, w) to (h, w, c, n), (out,in,h,w) to (h, w, in, out)
    x, W, y, gy, gx, gW = reorder_nchw_hwcn(x, W, y, gy, gx, gW)

    layer_params = {"type":"convolution_2d", "params": {"in_size":in_size, "out_size":out_size, "ksize":ksize, "stride":stride, "pad":pad, "group": groups}}

    return {"layer_params":layer_params,
        "train_params":{"weight":W, "bias":b},
        "delta_params":{"delta_weight":gW, "delta_bias": gb},
        "forward":{"bottoms":[x], "tops":[y]},
        "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def pooling_2d(type, n, in_size, in_shape, ksize, stride, pad):
    from chainer.functions.pooling.max_pooling_2d import MaxPooling2D
    from chainer.functions.pooling.average_pooling_2d import AveragePooling2D
    if type == 'max':
        f = MaxPooling2D(stride = stride, pad = pad, ksize = ksize)
    elif type == 'average':
        f = AveragePooling2D(stride = stride, pad = pad, ksize = ksize)
    
    x = random_float32((n, in_size) + in_shape)
    y, = f.forward((x, ))
    gy = random_float32(y.shape)
    gx, = f.backward((x, ), (gy, ))

    x, y, gy, gx = reorder_nchw_hwcn(x, y, gy, gx)

    layer_params = {"type":"pooling_2d", "params": {"ksize":ksize, "stride":stride, "pad":pad, "type": type}}

    return {"layer_params":layer_params,
        "forward":{"bottoms":[x], "tops":[y]},
        "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def batch_normalization(in_shape, eps = 1e-5):
    from chainer.functions.normalization.batch_normalization import BatchNormalizationFunction
    f = BatchNormalizationFunction(eps = eps)
    # assumes (n, c) or (n, c, h, w); c is dimension to be normalized
    # in sukiyaki, shape is (c, n) and (h, w, c, n)
    c = in_shape[1]
    gamma = random_float32((c, ))
    beta = random_float32((c, ))
    x = random_float32(in_shape)
    y, = f.forward((x, gamma, beta))

    gy = random_float32(in_shape)
    gx, ggamma, gbeta = f.backward((x, gamma, beta), (gy, ))

    shape_4d = len(in_shape) == 4
    if shape_4d:
        target_dim = 3
        x, y, gy, gx = reorder_nchw_hwcn(x, y, gy, gx)
    else:
        target_dim = 1
        x, y, gy, gx = reverse_order(x, y, gy, gx)

    layer_params = {"type":"batch_normalization", "params": {"target_dim": target_dim, "in_size": c, "eps": eps}}
    return {"layer_params":layer_params,
        "train_params":{"gamma":gamma, "beta":beta},
        "delta_params":{"delta_gamma":ggamma, "delta_beta": gbeta},
        "forward":{"bottoms":[x], "tops":[y]},
        "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def save_case(case_name, case_obj):
    #saves test case
    case_dir = DST_DIR + case_name
    if os.path.exists(case_dir):
        print("Case {} already saved".format(case_name))
        return
    os.mkdir(case_dir)
    #gather arrays
    arrays = {}
    params_dict = {}
    for param_type in ["train_params", "delta_params"]:
        params_dict[param_type] = list()
        for param_name, param_array in case_obj.get(param_type, {}).items():
            arrays[param_type + "." + param_name] = param_array
            params_dict[param_type].append(param_name)

    for param_type in ["forward", "backward"]:
        params_dict[param_type] = dict()
        for param_name, param_array_list in case_obj.get(param_type, {}).items():
            for i, param_array in enumerate(param_array_list):
                arrays[param_type + "." + param_name + "." + str(i)] = param_array
            params_dict[param_type][param_name] = len(param_array_list)#save the number of params
    
    for param_name, param_array in arrays.items():
        np.save("{}/{}.npy".format(case_dir, param_name), param_array)

    case_metadata = {"layer_params": case_obj["layer_params"]}
    case_metadata["blobs"] = params_dict
    with open(case_dir + "/case.json", "w") as f:
        json.dump(case_metadata, f)

if __name__ == '__main__':
    save_case("linear_1d", linear(2, 3, (4,)))
    save_case("linear_3d", linear(2, 3, (4, 2, 2)))
    save_case("relu", relu(2, (3, 4, 5)))
    save_case("convolution_2d", convolution_2d(2, 3, 4, (5,5), (3,3),(1,1),(0,0)))
    save_case("convolution_2d_stride_pad", convolution_2d(2, 3, 4, (6, 7), (3, 5),(2, 3),(1, 2)))
    save_case("convolution_2d_1x1", convolution_2d(4, 2, 3, (7, 6), (1, 1),(1, 1),(0,0)))
    save_case("convolution_2d_group", convolution_2d_group(2, 6, 8, (6, 7), (3, 5),(2, 3),(1, 2), 2))
    save_case("max_pooling_2d", pooling_2d('max', 2, 3, (6, 7), (3, 5), (2, 3), (1, 2)))
    save_case("average_pooling_2d", pooling_2d('average', 2, 3, (6, 7), (3, 5), (2, 3), (1, 2)))
    save_case("batch_normalization_2d", batch_normalization((4, 5), eps = 1e-5))
    save_case("batch_normalization_4d", batch_normalization((4, 5, 6, 7), eps = 1e-3))

    # actual size
    save_case("alexnet_conv1", convolution_2d(32, 3, 96, (227, 227), (11, 11), (4, 4), (0, 0)))
    save_case("resnet_bn1", batch_normalization((32, 64, 56, 56), eps = 1e-3))
