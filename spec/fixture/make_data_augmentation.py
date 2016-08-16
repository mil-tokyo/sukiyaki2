#!/usr/bin/env python
# -*- coding:utf-8 -*-

import sys
import os
import json
from collections import defaultdict
import itertools
import numpy as np
from fixture_helper import random_float32, reverse_order, reorder_nchw_hwcn

DST_DIR = os.path.abspath(os.path.dirname(__file__)) + '/data_augmentation/'

def make_data(n, c, in_h, in_w, out_h, out_w, scale):
    mean = random_float32((1, c, in_h, in_w))
    bottom = np.zeros((n, c, in_h, in_w), dtype = np.float32)
    for in_n, in_c, y, x in itertools.product(range(n), range(c), range(in_h), range(in_w)):
        bottom[in_n, in_c, y, x] = in_n * 10 + in_c * 3 + y * 2 + x * 1
    bottom += mean
    crop_y = (in_h - out_h) // 2
    crop_x = (in_w - out_w) // 2
    top = ((bottom - mean)[:, :, crop_y:crop_y+out_h, crop_x:crop_x+out_w]) * scale
    mean, bottom, top = reorder_nchw_hwcn(mean, bottom, top)
    return mean, bottom, top

if __name__ == '__main__':
    mean, bottom, top = make_data(3, 2, 10, 9, 6, 7, 0.5)
    np.save(DST_DIR + 'mean', mean)
    np.save(DST_DIR + 'bottom', bottom)
    np.save(DST_DIR + 'top', top)
