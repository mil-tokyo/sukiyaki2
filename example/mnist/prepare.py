#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
Downloads MNIST dataset and convert it to training dataset
"""

import os
import sys
from six.moves import urllib
import gzip
import json

import numpy as np

def download_mnist():
    sys.stderr.write("Downloading MNIST dataset (12MB)... ")
    urls = [("http://yann.lecun.com/exdb/mnist/train-images-idx3-ubyte.gz", "train-images-idx3-ubyte.gz"),
    ("http://yann.lecun.com/exdb/mnist/train-labels-idx1-ubyte.gz", "train-labels-idx1-ubyte.gz"),
    ("http://yann.lecun.com/exdb/mnist/t10k-images-idx3-ubyte.gz", "t10k-images-idx3-ubyte.gz"),
    ("http://yann.lecun.com/exdb/mnist/t10k-labels-idx1-ubyte.gz", "t10k-labels-idx1-ubyte.gz")]
    for url, filename in urls:
        if not os.path.exists(filename):
            urllib.request.urlretrieve(url, filename)
    sys.stderr.write("done.\n")

def convert_images(src_path_gz, dst_path):
    with gzip.open(src_path_gz, "rb") as f:
        d = f.read()
        images = np.fromstring(d[16:], dtype=np.uint8)
    images = images.reshape(-1, 28, 28)#sample, h, w

    # convert to (h, w, sample) in fortran-order = (sample, w, h) in c-order
    trans_images = np.transpose(images, (0, 2, 1))
    trans_images.tofile(dst_path)

def convert_labels(src_path_gz, dst_path):
    with gzip.open(src_path_gz, "rb") as f:
        d = f.read()
        labels = np.fromstring(d[8:], dtype=np.uint8)
    labels_list = labels.tolist()
    with open(dst_path, "wb") as f:
        json.dump(labels_list, f)

def main():
    data_dir = os.path.dirname(__file__) + "/data"
    if not os.path.exists(data_dir):
        os.mkdir(data_dir)
    os.chdir(data_dir)#current directory to data directory for simplify file path
    download_mnist()
    sys.stderr.write("Converting images and labels... ")
    for src_path_gz, dst_path in [("train-images-idx3-ubyte.gz", "mnist_train.bin"),
                                    ("t10k-images-idx3-ubyte.gz", "mnist_test.bin")]:
        convert_images(src_path_gz, dst_path)
    for src_path_gz, dst_path in [("train-labels-idx1-ubyte.gz", "mnist_train.json"),
                                    ("t10k-labels-idx1-ubyte.gz", "mnist_test.json")]:
        convert_labels(src_path_gz, dst_path)
    sys.stderr.write("done.\n")

if __name__ == '__main__':
    main()
