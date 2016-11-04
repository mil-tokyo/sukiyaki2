#!/bin/bash

browserify index.js -o browser/milsukiyaki2.js -s milsukiyaki2 -p \[ browserify-header --file browser/header.js \] --external milsushi2
