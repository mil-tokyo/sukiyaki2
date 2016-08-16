# -*- coding:utf-8 -*-

import numpy as np

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

def reorder_nchw_hwcn(*mats):
    # order from (n, c, h, w) to (h, w, c, n)
    rets = []
    nchw = (0, 1, 2, 3)
    hwcn = (3, 2, 0, 1)
    for x in mats:
        rets.append(np.moveaxis(x, nchw, hwcn))
    return rets
