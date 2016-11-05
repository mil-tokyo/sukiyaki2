'use strict';

var $M = milsushi2;
var Sukiyaki = milsukiyaki2;
var net;
var stop_recognition = false;

function write_status(msg) {
  var msg_box = $("input[name='status-msg']");
  msg_box.val(msg);
}

$(function () {
  $("#stop-resume-recognition").click(stop_resume_recognition);

  write_status('Waiting the network weight to be loaded (3.4MB)');
  setTimeout(wait_network_load, 100);
});

function wait_network_load() {
  // network weight is loaded with defer tag, so wait until it is loaded
  if (typeof window.lenet_weight === 'undefined') {
    setTimeout(wait_network_load, 100);
    return;
  }

  write_status('Setting up network');
  setTimeout(setup_network, 1);
}

function setup_network() {
  var netdef_json = [{ "params": { "random_crop": false, "random_flip": false, "scale": 0.00390625, "input_klass": "uint8", "out_shape": [28, 28] }, "type": "data_augmentation", "name": "aug_test", "outputs": ["augdata"], "inputs": ["data"] }, { "params": { "out_size": 20, "stride": 1, "pad": 0, "in_size": 1, "ksize": 5 }, "type": "convolution_2d", "name": "conv1", "outputs": ["conv1"], "inputs": ["augdata"] }, { "params": { "stride": 2, "pad": 0, "type": "max", "ksize": 2 }, "type": "pooling_2d", "name": "pool1", "outputs": ["pool1"], "inputs": ["conv1"] }, { "params": { "out_size": 50, "stride": 1, "pad": 0, "in_size": 20, "ksize": 5 }, "type": "convolution_2d", "name": "conv2", "outputs": ["conv2"], "inputs": ["pool1"] }, { "params": { "stride": 2, "pad": 0, "type": "max", "ksize": 2 }, "type": "pooling_2d", "name": "pool2", "outputs": ["pool2"], "inputs": ["conv2"] }, { "params": { "out_size": 500, "in_shape": [4, 4, 50] }, "type": "linear", "name": "fc3", "outputs": ["fc3"], "inputs": ["pool2"] }, { "params": {}, "type": "relu", "name": "relu3", "outputs": ["relu3"], "inputs": ["fc3"] }, { "params": { "out_size": 10, "in_shape": [500] }, "type": "linear", "name": "fc4", "outputs": ["pred"], "inputs": ["relu3"] }];
  net = new Sukiyaki.Network(netdef_json);
  net.init(function () {
    Sukiyaki.ArraySerializer.load(lenet_weight["weight_packed"], net);
    write_status('Network loaded');
    setup_camera();
  });
}

function setup_camera() {
  write_status('Initializing video input device');
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;
  var wURL = window.URL || window.webkitURL;
  var video = $("#camera-in")[0];
  navigator.getUserMedia({ video: { facingMode: 'environment' }, audio: false },
    function (stream) {
      video.src = wURL.createObjectURL(stream);
      write_status('Video initialization succeeded');
      start_recognize();
    },
    function (err) {
      write_status('Video initialization failed: ' + err.name);
    });
}

var dom_video;
var canvas_context;
function start_recognize() {
  dom_video = $("#camera-in")[0];
  var canvas = $("#recognize-in")[0];
  canvas_context = canvas.getContext('2d');
  write_status('Recognizing');
  setTimeout(do_recognize, 100);
}

function do_recognize() {
  canvas_context.drawImage(dom_video, 0, 0, 28, 28);// copy captured video to canvas
  var imagedata = canvas_context.getImageData(0, 0, 28, 28);// get pixel data from canvas
  var image = $M.typedarray2mat([4, 28, 28], 'uint8', new Uint8Array(imagedata.data));// channel, width, height (in fortran-order)
  image = image.get(1, $M.colon(), $M.colon());// extract single color channel
  image = $M.permute(image, [3, 2, 1]);// transpose to height, width, channel
  var recog_begin = Date.now();
  net.forward({ 'data': image }, function () {// forward propagation
    var recog_end = Date.now();
    var pred = net.blobs_forward['pred'];// prediction layer output
    var max_index = $M.argmax(pred).I.get();// get matrix index of highest score (1-origin)
    var predicted_number = max_index - 1;
    document.getElementById('result').textContent = predicted_number.toString();
    net.release();
    write_status('Recognition: ' + (recog_end - recog_begin) + 'ms');

    if (!stop_recognition) {
      setTimeout(do_recognize, 100);
    }
  });
}

function stop_resume_recognition() {
  if (stop_recognition) {
    // resume
    stop_recognition = false;
    $("#stop-resume-recognition").text("Stop");
    setTimeout(do_recognize, 100);
  } else {
    // stop
    $("#stop-resume-recognition").text("Resume");
    stop_recognition = true;
  }
}