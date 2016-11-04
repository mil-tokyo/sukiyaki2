import $M = require('milsushi2');

class BenchBase {
  name: string;
  setup(): any[] {
    return [];
  }

  run(callback: any, ...args: any[]): void {
    throw Error('Not implemented');
  }
}

export = BenchBase;
