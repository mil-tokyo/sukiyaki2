# Sukiyaki2 library
Deep Learning Library for JavaScript

Documents are under preparation.
Currently, example of training MNIST digit recognition for node.js environment is provided.
Code for distributed computing using web browser clients will be uploaded in near future. 

github.io page [Sukiyaki2](https://mil-tokyo.github.io/sukiyaki2/) [MILJS](https://mil-tokyo.github.io/miljs.html)

# Build for use in node.js
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

# Example in node.js
## MNIST digit recognition training
Run on root directory

```bash
./example/mnist/prepare.py
./example/mnist/train.sh
```

By default, GPU is not used. To try fast computation,

```bash
./example/mnist/train.sh cl
```

# Example in web browser
They are in `docs/example` directory.

Access to online demo from https://mil-tokyo.github.io/sukiyaki2/
