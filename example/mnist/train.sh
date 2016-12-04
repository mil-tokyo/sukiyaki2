#!/bin/bash

if [ ! -e "run/train_node.js" ]
then
echo "run/train_node.js not found. Build the project and run this script at project root directory."
exit 1
fi

echo "Models and log will be saved on example/mnist/model"

CL_OPTION=""
VAL_ITER_LIMIT="10"
VAL_CYCLE="50"

if [ "$1" == "cl" ]
then
echo "OpenCL mode"
CL_OPTION="--cl"
VAL_ITER_LIMIT="0"
VAL_CYCLE="500"
else
echo "No OpenCL mode; training will slow.
$ train.sh cl
for enable OpenCL."
fi

node run/train_node --net example/mnist/lenet.json --save_tmpl example/mnist/model/lenet_iter_%d.model $CL_OPTION --iter 2000 --batch_size 32 --val_cycle $VAL_CYCLE --val_iter_limit $VAL_ITER_LIMIT | tee example/mnist/model/train.log
