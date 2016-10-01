#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
generates ResNet network definition for Sukiyaki
based on "Identity Mappings in Deep Residual Networks" [Kaimin+ 2016]
"""

import sys
import json

def bn_and_conv(name_suffix, bn_input, conv_params):
    #name_suffix: "3a_branch2b"
    layers = []
    bn_output = "bn" + name_suffix
    layers.append({"name": bn_output,
        "type": "batch_normalization", "inputs": [bn_input],
        "outputs": [bn_output],
        "params": {"in_size": conv_params["in_size"], "target_dim": 3}})
    relu_output = "res" + name_suffix + "_relu"
    layers.append({"name": relu_output,
        "type": "relu", "inputs": [bn_output],
        "outputs": [relu_output],
        "params": {}})
    conv_output = "res" + name_suffix
    layers.append({"name": conv_output,
        "type": "convolution_2d", "inputs": [relu_output],
        "outputs": [conv_output],
        "params": conv_params
        })
    block_output = conv_output
    return layers, block_output

def data_layer():
    layers = [
        { "name": "d_train", "type": "blob_data", "params": { "file_prefix": "imagenetraw/train_shuffle", "data_shape": [256, 256, 3] }, "inputs": ["batch"], "outputs": ["rawdata", "label"], "phase": ["train"] },
        { "name": "d_test", "type": "blob_data", "params": { "file_prefix": "imagenetraw/val", "data_shape": [256, 256, 3] }, "inputs": ["batch"], "outputs": ["rawdata", "label"], "phase": ["test"] },
        { "name": "aug_train", "type": "data_augmentation", "params": { "out_shape": [224, 224], "scale": 1.0, "random_crop": True, "random_flip": True, "input_klass": "uint8" }, "inputs": ["rawdata"], "outputs": ["data"], "phase": ["train"] },
        { "name": "aug_test", "type": "data_augmentation", "params": { "out_shape": [224, 224], "scale": 1.0, "random_crop": False, "random_flip": False, "input_klass": "uint8" }, "inputs": ["rawdata"], "outputs": ["data"], "phase": ["test"] },
    ]
    return layers


def conv1():
    layers = []
    conv_params = {"in_size": 3, "out_size": 64, "ksize": 7, "stride": 2, "pad": 3, "bias": False }
    conv_output = "conv1"
    layers.append({"name": conv_output,
        "type": "convolution_2d", "inputs": ["data"],
        "outputs": [conv_output],
        "params": conv_params
        })
    bn_output = "bn_conv1"
    layers.append({"name": bn_output,
        "type": "batch_normalization", "inputs": [conv_output],
        "outputs": [bn_output],
        "params": {"in_size": conv_params["out_size"], "target_dim": 3}})
    relu_output = "conv1_relu"
    layers.append({"name": relu_output,
        "type": "relu", "inputs": [bn_output],
        "outputs": [relu_output],
        "params": {}})
    pool_output = "pool1"
    layers.append({"name": pool_output,
        "type": "pooling_2d", "inputs": [relu_output],
        "outputs": [pool_output],
        "params": {"type":"max","ksize":3,"stride":2,"pad":0}})
    return layers

def block_a(in_name, out_name, block_name, in_channels, out_channels, internal_channels, stride):
    layers = []
    #branch, convolution, add, relu
    layers.append({"name": "branch" + block_name,
        "type": "branch", "inputs": [in_name],
        "outputs": ["branch" + block_name + "_branch1", "branch" + block_name + "_branch2"],
        "params": { "n_output": 2 } })
    layers_block, branch1_output = bn_and_conv(block_name + "_branch1", "branch" + block_name + "_branch1",
    { "in_size": in_channels, "out_size": out_channels, "ksize": 1, "stride": stride, "pad": 0, "bias": False })
    layers.extend(layers_block)

    layers_block, internal_output = bn_and_conv(block_name + "_branch2a", "branch" + block_name + "_branch2",
    { "in_size": in_channels, "out_size": internal_channels, "ksize": 1, "stride": stride, "pad": 0, "bias": False })
    layers.extend(layers_block)

    layers_block, internal_output = bn_and_conv(block_name + "_branch2b", internal_output,
    { "in_size": internal_channels, "out_size": internal_channels, "ksize": 3, "stride": 1, "pad": 1, "bias": False })
    layers.extend(layers_block)

    layers_block, branch2_output = bn_and_conv(block_name + "_branch2c", internal_output,
    { "in_size": internal_channels, "out_size": out_channels, "ksize": 1, "stride": 1, "pad": 0, "bias": False })
    layers.extend(layers_block)

    layers.append({"name": "res" + block_name,
        "type": "plus", "inputs": [branch1_output, branch2_output],
        "outputs": [out_name],
        "params": { "n_input": 2 } })
    
    return layers

def block_b(in_name, out_name, block_name, in_channels, out_channels, internal_channels, stride):
    layers = []
    #branch, convolution, add, relu
    layers.append({"name": "branch" + block_name,
        "type": "branch", "inputs": [in_name],
        "outputs": ["branch" + block_name + "_branch1", "branch" + block_name + "_branch2"],
        "params": { "n_output": 2 } })
    branch1_output = "branch" + block_name + "_branch1"

    layers_block, internal_output = bn_and_conv(block_name + "_branch2a", "branch" + block_name + "_branch2",
    { "in_size": in_channels, "out_size": internal_channels, "ksize": 1, "stride": stride, "pad": 0, "bias": False })
    layers.extend(layers_block)

    layers_block, internal_output = bn_and_conv(block_name + "_branch2b", internal_output,
    { "in_size": internal_channels, "out_size": internal_channels, "ksize": 3, "stride": 1, "pad": 1, "bias": False })
    layers.extend(layers_block)

    layers_block, branch2_output = bn_and_conv(block_name + "_branch2c", internal_output,
    { "in_size": internal_channels, "out_size": out_channels, "ksize": 1, "stride": 1, "pad": 0, "bias": False })
    layers.extend(layers_block)

    layers.append({"name": "res" + block_name,
        "type": "plus", "inputs": [branch1_output, branch2_output],
        "outputs": [out_name],
        "params": { "n_input": 2 } })
    
    return layers

def pool5_prediction(in_name, in_channels):
    layers = []
    layers.append({"name": "pool5_bn",
        "type": "batch_normalization", "inputs": [in_name],
        "outputs": ["pool5_bn"],
        "params": {"in_size": in_channels, "target_dim": 3}})
    layers.append({"name": "pool5_relu",
        "type": "relu", "inputs": ["pool5_bn"],
        "outputs": ["pool5_relu"],
        "params": {}})
    layers.append({"name": "pool5",
        "type": "pooling_2d", "inputs": ["pool5_relu"],
        "outputs": ["pool5"],
        "params": {"type":"average","ksize":7,"stride":1,"pad":0}})
    layers.append({"name": "fc1000",
        "type": "linear", "inputs": ["pool5"],
        "outputs": ["fc1000"],
        "params": {"in_shape": [1, 1, in_channels], "out_size": 1000}})
    layers.append({ "name": "loss", "type": "softmax_cross_entropy", "params": {},
        "inputs": ["fc1000", "label"], "outputs": ["loss"] })
    layers.append({ "name": "accuracy", "type": "accuracy", "params": {},
        "inputs": ["fc1000", "label"], "outputs": ["accuracy"], "phase": ["test"] })
    return layers

def main(n):
    layers = []
    layers.extend(data_layer())
    layers.extend(conv1())
    layers.extend(block_a("pool1", "res2a_relu", "2a", 64, 256, 64, 1))
    last_block_output = "res2a_relu"

    if n == 50 or n == 101 or n == 152:
        block_list = [("res2b_relu", "2b"), ("res2c_relu", "2c")]
    elif n == 308:
        block_list = [("res2"+c+"_relu", "2"+c) for c in "bcdef"]
    for output_name, block_name in block_list:
        layers.extend(block_b(last_block_output, output_name, block_name, 256, 256, 64, 1))
        last_block_output = output_name

    layers.extend(block_a(last_block_output, "res3a_plus", "3a", 256, 512, 128, 2))
    last_block_output = "res3a_plus"
    if n == 50:
        block_list = [("res3b_plus", "3b"), ("res3c_plus", "3c")]
    elif n == 101:
        block_list = [("res3b"+c+"_plus", "3b"+c) for c in "123"]
    elif n == 152:
        block_list = [("res3b"+c+"_plus", "3b"+c) for c in "1234567"]
    elif n == 308:
        block_list = [("res3b"+str(c)+"_plus", "3b"+str(c)) for c in range(1,18)]
    for output_name, block_name in block_list:
        layers.extend(block_b(last_block_output, output_name, block_name, 512, 512, 128, 1))
        last_block_output = output_name

    layers.extend(block_a(last_block_output, "res4a_plus", "4a", 512, 1024, 256, 2))
    last_block_output = "res4a_plus"
    if n == 50:
        block_list = [("res4"+c+"_plus", "4"+c) for c in "bcdef"]
    elif n == 101:
        block_list = [("res4b"+str(c)+"_plus", "4b"+str(c)) for c in range(1, 23)]#1 to 22
    elif n == 152:
        block_list = [("res4b"+str(c)+"_plus", "4b"+str(c)) for c in range(1, 36)]#1 to 35
    elif n == 308:
        block_list = [("res4b"+str(c)+"_plus", "4b"+str(c)) for c in range(1, 72)]#1 to 71
    for output_name, block_name in block_list:
        layers.extend(block_b(last_block_output, output_name, block_name, 1024, 1024, 256, 1))
        last_block_output = output_name

    layers.extend(block_a(last_block_output, "res5a_plus", "5a", 1024, 2048, 512, 2))
    last_block_output = "res5a_plus"
    if n == 50 or n == 101 or n == 152:
        block_list = [("res5"+c+"_plus", "5"+c) for c in "bc"]
    elif n == 308:
        block_list = [("res5"+c+"_plus", "5"+c) for c in "bcdef"]
    for output_name, block_name in block_list:
        layers.extend(block_b(last_block_output, output_name, block_name, 2048, 2048, 512, 1))
        last_block_output = output_name

    layers.extend(pool5_prediction(last_block_output, 2048))
    with open("resnet"+str(n)+"_identity.json", "wb") as f:
        json.dump(layers, f, indent = 2)

main(50)
main(101)
main(152)
main(308)
