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

DST_DIR = os.path.abspath(os.path.dirname(__file__)) + '/'

# utilities
def random_float32(shape):
    # chainer requires float32 array for parameters
    return np.random.standard_normal(shape).astype(np.float32)

def reverse_order(*mats):
    # reverse order of axis (for supporting c-order and f-order change)
    rets = []
    for x in mats:
        perm_from = list(range(x.ndim))
        perm_to = list(range(x.ndim))
        perm_to.reverse()
        rets.append(np.moveaxis(x, perm_from, perm_to))
    return rets

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
    x, y, gy, gx = reverse_order(x, y, gy, gx)#(n, in_shape) to (reversed(in_shape), n)

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
