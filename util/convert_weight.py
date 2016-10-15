#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
Learned weight converter (sukiyaki <=> chainer)
"""

import sys
import os
import json
import argparse
import re
import numpy as np

def sukiyaki_unpack(binary):
    """
    load key-flatarray pairs
    """
    eoh = binary.find('\0')
    header_str = binary[:eoh]
    header = json.loads(header_str)
    pairs = {}
    for key, pos in header.items():
        pairs[key] = np.fromstring(binary[pos["offset"]:pos["offset"]+pos["size"]], dtype=np.float32)
    return pairs

def sukiyaki_pack(pairs):
    """
    key-flatarray pairs to serialized byte string
    """
    header_size = 65536
    while True:
        header = {}
        offset = header_size
        elements = []
        for key, ary in pairs.items():
            assert ary.dtype == np.float32
            ary_size = ary.size * 4
            header[key] = {"offset":offset, "size":ary_size}
            elements.append(ary.tobytes(order="C"))
            offset += ary_size
        header_str = json.dumps(header)
        if len(header_str) < header_size:
            break
        header_size *= 2
    nullstr = "\0" * (header_size - len(header_str))
    elements.insert(0, nullstr)
    elements.insert(0, header_str)
    return "".join(elements)

def key_chainer2sukiyaki(array_key):
    """
    "conv1/W" to "conv1/weight"
    "conv1/b" to "conv1/bias"
    """
    m = re.match("([0-9A-Za-z_]+)/(W|b)", array_key)
    if m is None:
        raise ValueError("Unexpected array_key " + array_key)
    weight_name = {"W":"weight", "b":"bias"}
    sukiyaki_key = "{}/{}".format(m.group(1), weight_name[m.group(2)])
    return sukiyaki_key

def key_sukiyaki2chainer(array_key):
    """
    "conv1/weight" to "conv1/W"
    "conv1/bias" to "conv1/b"
    """
    m = re.match("([0-9A-Za-z_]+)/(weight|bias)", array_key)
    if m is None:
        raise ValueError("Unexpected array_key " + array_key)
    weight_name = {"weight":"W", "bias":"b"}
    chainer_key = "{}/{}".format(m.group(1), weight_name[m.group(2)])
    return chainer_key

def weight_chainer2sukiyaki(ary):
    """
    if ary.ndim == 4, convert out,in,h,w to out,in,w,h
    otherwise, do nothing
    """
    if ary.ndim == 4:
        ary = np.transpose(ary, (0, 1, 3, 2))
    return ary

def weight_chainer2sukiyaki_vgg_fc6(ary):
    """
    special handling for conv-fc connection; out,in_ch,h,w to out,in_ch,w,h
    """
    ary = ary.reshape((ary.shape[0], 512, 7, 7))
    ary = np.transpose(ary, (0, 1, 3, 2))
    return ary

def weight_sukiyaki2chainer(ary, chainer_shape):
    """
    reshape flat array to specified shape in chainer
    if ary.ndim == 4, convert out,in,w,h to out,in,h,w
    otherwise, do nothing
    """
    if ary.ndim == 4:
        ary = ary.reshape((chainer_shape[0], chainer_shape[1], chainer_shape[3], chainer_shape[2]))
        ary = np.transpose(ary, (0, 1, 3, 2))
    else:
        ary = ary.reshape(chainer_shape)
    return ary

def chainer2sukiyaki(in_path, out_path):
    c_model = np.load(in_path)
    keys = c_model.keys()
    pairs = {}
    for c_key in keys:
        c_weight = c_model[c_key]
        if c_key == "fc6/W":
            print("special handling of vgg fc6")
            s_weight = weight_chainer2sukiyaki_vgg_fc6(c_weight)
        else:
            s_weight = weight_chainer2sukiyaki(c_weight)
        s_key = key_chainer2sukiyaki(c_key)
        pairs[s_key] = s_weight
    del c_model
    s_data = sukiyaki_pack(pairs)
    with open(out_path, "wb") as f:
        f.write(s_data)

def sukiyaki2chainer(in_path, out_path, tmpl_path):
    with open(in_path, "rb") as f:
        s_pairs = sukiyaki_unpack(f.read())
    tmpl_model = np.load(tmpl_path)
    c_shapes = {}
    for c_key in tmpl_model.keys():
        c_shapes[c_key] = tmpl_model[c_key].shape
    del tmpl_model

    pairs = {}
    for s_key, s_ary in s_pairs.items():
        c_key = key_sukiyaki2chainer(s_key)
        if c_key not in c_shapes:
            raise ValueError("key {} not found in template, so cannot determine shape".format(c_key))
        c_ary = weight_sukiyaki2chainer(s_ary, c_shapes[c_key])
        pairs[c_key] = c_ary
    del s_pairs
    np.savez(out_path, **pairs)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("direction", help="c2s: chainer to sukiyaki, s2c: sukiyaki to chainer")
    parser.add_argument("src")
    parser.add_argument("dst")
    parser.add_argument("--tmpl", "-t", help="template chainer model")
    args = parser.parse_args()
    if args.direction == "c2s":
        chainer2sukiyaki(args.src, args.dst)
    elif args.direction == "s2c":
        sukiyaki2chainer(args.src, args.dst, args.tmpl)
        

