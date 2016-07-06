#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
Generates layer test data using chainer (1.8)
"""

import sys
import os
import numpy as np
import chainer
import chainer.functions as F

DST_DIR = os.path.abspath(os.path.dirname(__file__)) + '/'

def linear(n, out_ch, in_shape):
    from chainer.functions.connection.linear import LinearFunction
    f = LinearFunction()
    x = np.random.random((n, ) + in_shape)
    W = np.random.random((out_ch, np.prod(in_shape)))
    b = np.random.random((out_ch, ))
    y, = f.forward((x, W, b))

    gy = np.random.random(y.shape)
    gx, gW, gb = f.backward((x, W, b), (gy, ))

    x = np.moveaxis(x, 0, -1)#(in_shape, n)
    y = np.moveaxis(y, 0, -1)#(out_shape, n)
    gy = np.moveaxis(gy, 0, -1)#(out_shape, n)
    gx = np.moveaxis(gx, 0, -1)#(in_shape, n)

    return {"train_params":{"weight":W, "bias":b},
    "delta_params":{"delta_weight":gW, "delta_bias": gb},
    "forward":{"bottoms":[x], "tops":[y]},
    "backward":{"bottoms":[x], "top_deltas":[gy], "bottom_deltas":[gx]}}

def save_blobs(name, blobs):
    np.save(DST_DIR + "train_params_weight.npy", blobs["train_params"]["weight"])
    np.save(DST_DIR + "train_params_bias.npy", blobs["train_params"]["bias"])
    np.save(DST_DIR + "forward_bottoms_0.npy", blobs["forward"]["bottoms"][0])
    np.save(DST_DIR + "forward_tops_0.npy", blobs["forward"]["tops"][0])
    np.save(DST_DIR + "backward_top_deltas_0.npy", blobs["backward"]["top_deltas"][0])
    np.save(DST_DIR + "backward_bottom_deltas_0.npy", blobs["backward"]["bottom_deltas"][0])
    np.save(DST_DIR + "delta_params_weight.npy", blobs["delta_params"]["delta_weight"])
    np.save(DST_DIR + "delta_params_bias.npy", blobs["delta_params"]["delta_bias"])

if __name__ == '__main__':
    blobs = linear(2, 3, (4,))
    save_blobs("linear", blobs)
