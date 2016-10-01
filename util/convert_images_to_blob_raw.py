#!/usr/bin/env python
# -*- coding:utf-8 -*-

"""
image list to raw image blob
IMAGE_RESIZE_SIZEx3xn
uint8
"""

import sys
import os
import numpy as np
from PIL import Image
import json

IMAGE_RESIZE_SIZE = (256, 256)

def read_image_list(path):
    image_path_list = []
    label_list = []
    with open(path) as f:
        for line in f:
            image_path, label_str = line.rstrip().split()
            image_path_list.append(image_path)
            label_list.append(int(label_str))
    return image_path_list, label_list

def read_augment_image(image_path):
    image = np.asarray(Image.open(image_path))
    assert image.shape[0:2] == IMAGE_RESIZE_SIZE
    if image.ndim == 3:
        image = np.asarray(image).transpose(2, 0, 1)#rgb, h, w
    else:
        image = np.array([image, image, image])
    image = image.astype(np.uint8)
    return image

def process(image_list_path, dst_prefix):
    image_path_list, label_list = read_image_list(image_list_path)
    with open(dst_prefix + ".bin", "wb") as f:
        for image_path in image_path_list:
            image_array = read_augment_image(image_path)
            image_array_cwh = image_array.transpose(0, 2, 1)#rgb, w, h
            image_array_cwh.tofile(f)#c-order, h-w-c viewed in f-order
    with open(dst_prefix + ".json", "wb") as f:
        json.dump(label_list, f)

if __name__ == '__main__':
    image_list_path = sys.argv[1]
    dst_prefix = sys.argv[2]
    process(image_list_path, dst_prefix)

