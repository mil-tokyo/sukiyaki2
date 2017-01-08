---
layout: default
---

# Setup of Sukiyaki2 and introduction of basic usage

Sukiyaki2 is a deep learning library for JavaScript.
Sukiyaki2 is designed to achive distributed training of Deep Neural Networks using ordinary personal
computers by implementing system in JavaScript, which can run on web browsers.
For training in single computer, it is recommeneded to use node.js environment
because it is faster and can access filesystem directly
(even in web browser, setting up a server to supply dataset is needed).

In this page, the way of setting up Sukiyaki2 on node.js environment and running basic example is described.

## Setup for node.js
Since this project is written in TypeScript, transpiling to JavaScript is necessary.

```bash
git clone https://github.com/mil-tokyo/sukiyaki2
cd sukiyaki2
npm install
npm run build
```

On `npm install`, it installs [node-opencl](https://github.com/mikeseven/node-opencl) package for GPU computing which allows dramatically faster computation.
In my environment (Ubuntu 14.04 + NVIDIA CUDA 7.5), installation with node-opencl requires additional environment variables.

```bash
CPLUS_INCLUDE_PATH=/usr/local/cuda/include LIBRARY_PATH=/usr/local/cuda/lib64 npm install
```

## Running MNIST digit recognition training
This example trains Deep Convolutional Neural Networks (DCNNs) using ["MNIST handwritten digit database"](http://yann.lecun.com/exdb/mnist/).

