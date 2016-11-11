(function () {
  var $M = milsushi2;
  var Sukiyaki = milsukiyaki2;

  function write_status(msg) {
    var msg_box = $("input[name='status-msg']");
    msg_box.val(msg);
  }

  function wait_until_dataset_loaded() {
    if (typeof mnist_data === 'undefined') {
      setTimeout(wait_until_dataset_loaded, 100);
      return;
    }

    write_status('Dataset loaded');
    $("#start-training").click(setup_training).prop('disabled', false);
  }

  var image_width = 28;
  var record_size = 28 * 28;
  var train_batch_size = 16;
  var test_batch_size = 1;
  var train_lr = 1e-2;
  var iter = 0;
  var net = null;
  var optimizer = null;
  function setup_training() {
    var netdef_json = JSON.parse($("textarea[name='netdef']").val());
    net = new Sukiyaki.Network(netdef_json);
    net.init(function () {
      write_status('Network loaded');
      optimizer = new Sukiyaki.Optimizers.OptimizerMomentumSGD(net, train_lr, 0.9);
      train_iteration();
    });
  }

  function train_iteration() {
    net.phase = 'train';
    var train_batch = make_batch(iter, train_batch_size, 'train');
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
      console.log('accuracy: ' + net.blobs_forward['accuracy']);
      net.release();
      iter++;
      setTimeout(train_iteration, 0);
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
    var data_length = mnist_data[phase + '_label'].length;
    var length_div_iter = Math.floor(data_length / batch_size);
    iter = iter % length_div_iter;
    var ta_label_u8 = new Uint8Array(mnist_data[phase + '_label'].buffer, iter * batch_size, batch_size);
    var ta_label = new Int32Array(ta_label_u8);
    var ta_data = new Uint8Array(mnist_data[phase + '_data'].buffer, iter * batch_size * record_size, batch_size * record_size);
    return {data:$M.typedarray2mat([28, 28, 1, batch_size], 'uint8', ta_data), label:$M.typedarray2mat([1, batch_size], 'int32', ta_label)};
  }

  function main() {
    write_status('Waiting the dataset to be loaded');
    setTimeout(wait_until_dataset_loaded, 1);
  }

  main();
})();
