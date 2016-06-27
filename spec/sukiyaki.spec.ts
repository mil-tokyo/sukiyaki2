/// <reference path="../node_modules/definitely-typed-jasmine/jasmine.d.ts" />
import $M = require('milsushi2');
import Sukiyaki = require('../index');

describe('Sukiyaki module', function () {
  it('has network class', function () {
    expect(Sukiyaki.Network).toBeDefined();
  })
});
