(function () {
  var $M = milsushi2;
  var Sukiyaki = milsukiyaki2;

  var start_threshold = 784 * 2000 + 16;//start when 2000 samples are loaded
  var data_prepared = false;
  var continue_training = true;

  function write_status(msg) {
    var msg_box = $("input[name='status-msg']");
    msg_box.val(msg);
  }

  var network_definition = [{ "params": { "random_crop": false, "random_flip": false, "scale": 0.00390625, "input_klass": "uint8", "out_shape": [28, 28] }, "type": "data_augmentation", "name": "aug_test", "outputs": ["augdata"], "inputs": ["data"] },
  { "params": { "out_size": 10, "stride": 1, "pad": 0, "in_size": 1, "ksize": 5 }, "type": "convolution_2d", "name": "conv1", "outputs": ["conv1"], "inputs": ["augdata"] },
  { "params": {}, "type": "relu", "name": "relu1", "outputs": ["relu1"], "inputs": ["conv1"] },
  { "params": { "stride": 2, "pad": 0, "type": "max", "ksize": 2 }, "type": "pooling_2d", "name": "pool1", "outputs": ["pool1"], "inputs": ["relu1"] },
  { "params": { "out_size": 12, "stride": 1, "pad": 0, "in_size": 10, "ksize": 5 }, "type": "convolution_2d", "name": "conv2", "outputs": ["conv2"], "inputs": ["pool1"] },
  { "params": {}, "type": "relu", "name": "relu2", "outputs": ["relu2"], "inputs": ["conv2"] },
  { "params": { "stride": 2, "pad": 0, "type": "max", "ksize": 2 }, "type": "pooling_2d", "name": "pool2", "outputs": ["pool2"], "inputs": ["relu2"] },
  { "params": { "out_size": 128, "in_shape": [4, 4, 12] }, "type": "linear", "name": "fc3", "outputs": ["fc3"], "inputs": ["pool2"] },
  { "params": {}, "type": "relu", "name": "relu3", "outputs": ["relu3"], "inputs": ["fc3"] },
  { "params": { "out_size": 10, "in_shape": [128] }, "type": "linear", "name": "fc4", "outputs": ["pred"], "inputs": ["relu3"] },
  { "params": {}, "type": "softmax_cross_entropy", "name": "l", "outputs": ["loss"], "inputs": ["pred", "label"] },
  { "inputs": ["pred", "label"], "name": "a", "outputs": ["accuracy"], "params": {}, "phase": ["test"], "type": "accuracy" }];

  var image_width = 28;
  var record_size = 28 * 28;
  var test_length = 1000;
  var train_length = 9000;
  var train_batch_size = 16;
  var test_batch_size = 1;
  var train_lr = 1e-2;
  var iter = 0;
  var time_begin = 0;
  var accuracy_history = [];
  var accuracy_history_sum = 0;
  var net = null;
  var optimizer = null;
  var speed_log_queue = [];//[[Date, total_trained_images]]
  var speed_log_queue_size = 100;
  function setup_training() {
    time_begin = Date.now();
    iter = 0;
    accuracy_history = [];
    accuracy_history_sum = 0;
    var netdef_json = network_definition;
    net = new Sukiyaki.Network(netdef_json);
    net.init(function () {
      update_speed_log();
      write_status('Training');
      optimizer = new Sukiyaki.Optimizers.OptimizerMomentumSGD(net, train_lr, 0.9);
      train_iteration();
    });
  }

  function update_speed_log(newly_trained_images) {
    var current_date = Date.now();
    if (newly_trained_images == null) {
      //reset
      speed_log_queue = [];
      speed_log_queue.push([current_date, 0]);
    } else {
      var last_trained_images = speed_log_queue[speed_log_queue.length - 1][1];
      last_trained_images += newly_trained_images;
      speed_log_queue.push([current_date, last_trained_images]);
    }

    if (speed_log_queue.length > speed_log_queue_size) {
      speed_log_queue.shift();
    }
    // calculate speed
    var first_item = speed_log_queue[0];
    var images_per_sec = (last_trained_images - first_item[1]) / (current_date - first_item[0] + 1) * 1000;//+1 to avoid zero division
    return images_per_sec;
  }

  function train_iteration() {
    net.phase = 'train';
    var train_batch = make_batch(iter, train_batch_size, 'train');
    if (!train_batch) {
      write_status('Waiting data...');
      setTimeout(train_iteration, 100);
    }
    console.log('iteration ' + iter + ' ' + (new Date()));
    optimizer.update(train_batch, function () {
      console.log('loss: ' + net.blobs_forward['loss']);
      optimizer.release();
      setTimeout(test_iteration, 0);
    });
  }

  function test_iteration() {
    net.phase = 'test';
    var test_batch = make_batch(iter, test_batch_size, 'test');
    net.forward(test_batch, function () {
      show_test_result(test_batch, net.blobs_forward['pred']);
      var cur_accuracy = net.blobs_forward['accuracy'].get();
      if (accuracy_history.length < 1000) {
        accuracy_history.push(cur_accuracy);
        accuracy_history_sum += cur_accuracy;
      } else {
        accuracy_history_sum -= accuracy_history[iter % 1000];
        accuracy_history[iter % 1000] = cur_accuracy;
        accuracy_history_sum += cur_accuracy;
      }
      var mean_accuracy = accuracy_history_sum / accuracy_history.length;
      var images_per_sec = update_speed_log(train_batch_size);
      $("#mean-accuracy").text((mean_accuracy * 100).toFixed(1));
      $("#iter-num").text('' + images_per_sec.toFixed(1) + ' images/sec, ' + (iter + 1) + ' updates');
      console.log('accuracy: ' + cur_accuracy);
      net.release();
      iter++;
      if (continue_training) {
        setTimeout(train_iteration, 0);
      }
    });
  }

  function show_test_result(test_batch, pred) {
    // show tested digit and its classification output
    var canvas = $("#recognize-in")[0];
    canvas_context = canvas.getContext('2d');
    var image_data = new Uint8ClampedArray(28 * 28 * 4);
    var d = test_batch.data.getdataref();
    for (var i = 0; i < 28 * 28; i++) {
      var px = d[i];
      image_data[i * 4 + 0] = px;
      image_data[i * 4 + 1] = px;
      image_data[i * 4 + 2] = px;
      image_data[i * 4 + 3] = 255;
    }
    var image = new ImageData(image_data, 28, 28);
    canvas_context.putImageData(image, 0, 0);

    var max_index = $M.argmax(pred).I.get();// get matrix index of highest score (1-origin)
    var predicted_number = max_index - 1;
    $("#pred-result").text('' + predicted_number);
  }

  function make_batch(iter, batch_size, phase) {
    var data_length = phase == 'train' ? train_length : test_length;
    var data_offset = phase == 'train' ? test_length : 0;
    var batch_size = phase == 'train' ? train_batch_size : test_batch_size;
    iter = iter % Math.floor(data_length / batch_size);

    // image
    var ta_data = new Uint8Array(batch_size * record_size);
    for (var batch_i = 0; batch_i < batch_size; batch_i++) {
      for (var j = 0; j < record_size; j++) {
        var ofs = 16 + (data_offset + iter * batch_size + batch_i) * record_size + j;
        if (ofs >= image_rawstr.length) {
          return null;
        }
        ta_data[batch_i * record_size + j] = image_rawstr.charCodeAt(ofs);//&0xFF
      }
    }

    // label
    var ta_label = new Int32Array(batch_size);
    for (var batch_i = 0; batch_i < batch_size; batch_i++) {
      ta_label[batch_i] = label_rawstr.charCodeAt(8 + (data_offset + iter * batch_size + batch_i) * 1) & 0xFF;
    }
    return { data: $M.typedarray2mat([28, 28, 1, batch_size], 'uint8', ta_data), label: $M.typedarray2mat([1, batch_size], 'int32', ta_label) };
  }

  var label_rawstr = null;
  var image_rawstr = null;
  function load_label() {
    var xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open("GET", "https://mil-tokyo.github.io/datasets/mnist/t10k-labels-idx1-ubyte.txt");
    xhr.responseType = 'text';

    xhr.onload = function (e) {
      label_rawstr = xhr.response;
      write_status('Waiting the images to be loaded');
      setTimeout(load_image, 1);
    };

    xhr.onerror = function (e) {
      write_status('Error while loading label data');
      console.log('XHR Error ' + e);
    };

    xhr.ontimeout = function (e) {
      write_status('Timeout while loading label data');
      console.log('XHR Timeout ' + e);
    };

    xhr.send();
  }

  function load_image() {
    var xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open("GET", "https://mil-tokyo.github.io/datasets/mnist/t10k-images-idx3-ubyte.txt");
    xhr.responseType = 'text';

    xhr.onprogress = function (e) {
      var progress_percent = e.loaded / e.total * 100;
      $("#load-progress").val(progress_percent);
      $("#load-progress-text").text('' + progress_percent + '%' + (progress_percent < 20 ? ' (20% required to start)' : ''));
      image_rawstr = xhr.response;
      start_training_if_possible();
    };

    xhr.onload = function (e) {
      $("#load-progress").val(100);
      image_rawstr = xhr.response;
      start_training_if_possible();
    };

    xhr.onerror = function (e) {
      write_status('Error while loading image data');
      console.log('XHR Error ' + e);
    };

    xhr.ontimeout = function (e) {
      write_status('Timeout while loading image data');
      console.log('XHR Timeout ' + e);
    };

    xhr.send();
  }

  function start_training_if_possible() {
    if (!data_prepared) {
      if (image_rawstr != null && image_rawstr.length >= start_threshold) {
        //start
        data_prepared = true;
        $("#stop-resume-training").prop('disabled', false);
        $("#change-network").prop('disabled', false);
        setup_training();
      }
    }
  }

  function main() {
    write_status('Waiting the metadata to be loaded');
    setTimeout(load_label, 1);
  }

  $(function () {
    $("#stop-resume-training").click(function (e) {
      if (continue_training) {
        // stop
        continue_training = false;
        write_status('Paused');
        $("#stop-resume-training").text('Resume');
      } else {
        // resume
        continue_training = true;
        write_status('Training');
        $("#stop-resume-training").text('Stop');
        update_speed_log();//reset speed
        setTimeout(train_iteration, 0);
      }
    });

    $("#learning-rate").change(function (e) {
      train_lr = Number($("#learning-rate").val());
      console.log('Learning rate changes to ' + train_lr);
      if (optimizer) {
        optimizer.lr = train_lr;
      }
    });

    main();
  })
})();
