#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
MNIST dataset to training file format
"""

import sys
import os
import json
import argparse
import numpy as np

def load_images(path):
    with open(path, "rb") as f:
        d = f.read()
        images = np.fromstring(d[16:], dtype=np.uint8)
    images = images.reshape(-1, 28, 28)#sample, h, w
    return images

def load_labels(path):
    with open(path, "rb") as f:
        d = f.read()
        labels = np.fromstring(d[8:], dtype=np.uint8)
    return labels

def save_images(path, images):
    # convert to (h, w, sample) in fortran-order = (sample, w, h) in c-order
    images = np.transpose(images, (0, 2, 1))
    images.tofile(path)

def save_labels(path, labels):
    ary = map(int, labels)
    with open(path, "wt") as f:
        json.dump(ary, f)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("src")
    parser.add_argument("dst")
    parser.add_argument("--invert", action="store_true")
    args = parser.parse_args()
    src_dir = args.src
    dst_dir = args.dst
    if not os.path.exists(dst_dir):
        os.mkdir(dst_dir)
    for settype, srcprefix in [("train", "train"), ("test", "t10k")]:
        images = load_images(os.path.join(src_dir, srcprefix + "-images-idx3-ubyte"))
        labels = load_labels(os.path.join(src_dir, srcprefix + "-labels-idx1-ubyte"))
        if args.invert:
            images = 255 - images
        save_images(os.path.join(dst_dir, "mnist_" + settype + "_8bit.bin"), images)
        save_labels(os.path.join(dst_dir, "mnist_" + settype + "_8bit.json"), labels)
