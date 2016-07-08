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

def random_float32(shape):
    # chainer requires float32 array for parameters
    return np.random.random(shape).astype(np.float32)

def linear(n, out_ch, in_shape):
    from chainer.functions.connection.linear import LinearFunction
    f = LinearFunction()
    x = random_float32((n, ) + in_shape)
    W = random_float32((out_ch, np.prod(in_shape)))
    b = random_float32((out_ch, ))
    y, = f.forward((x, W, b))

    gy = random_float32(y.shape)
    gx, gW, gb = f.backward((x, W, b), (gy, ))

    x = np.moveaxis(x, 0, -1)#(in_shape, n)
    y = np.moveaxis(y, 0, -1)#(out_shape, n)
    gy = np.moveaxis(gy, 0, -1)#(out_shape, n)
    gx = np.moveaxis(gx, 0, -1)#(in_shape, n)

    layer_params = {"type":"linear", "params": {"in_shape": in_shape, "out_size": out_ch}}

    return {"layer_params":layer_params,
        "train_params":{"weight":W, "bias":b},
        "delta_params":{"delta_weight":gW, "delta_bias": gb},
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
    case_obj = linear(2, 3, (4,))
    save_case("linear_1d", case_obj)
