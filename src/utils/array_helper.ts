// Helper functions of Array

export function repeat_scalar(val: number | number[], length: number): number[] {
  if ((<number[]>val).length !== void 0) {
    //val is array
    if ((<number[]>val).length !== length) {
      throw Error('val is not length ' + length);
    }
    return (<number[]>val);
  } else {
    //val is scalar
    var array = [];
    for (var i = 0; i < length; i++) {
      array.push(val);
    }
    return array;
  }
}
