(function($) {
// you can call ddd this way:
//   $('#my_element').ddd();
// or this way:
//   $.ddd('#my_element');
$.fn.ddd = $.ddd = function(selector) {
  if (selector && typeof selector === 'string') {
    return new DDD(selector);
  }
  return new DDD(this);
}

var DDD = function(selector) {
  if (selector && typeof selector !== 'function') {
    this.$ = $(selector);
  }
  return this;
}

function get_transform_object(/* args */) {
  var transform = {};
  var args = Array.prototype.slice.call(arguments);
  if (args.length >= 2) { // expecting [10, 'x'] format
    ['x', 'y', 'z'].forEach(function(axis, index, array) {
      var regex = new RegExp(axis);
      if (regex.test(args[1])) {
        transform[axis] = args[0];
      }
    });
  } else { // expecting { 'x': 20, 'y': 10 } format
    transform = $.extend(transform, args[0]);
  }

  return transform;
}

// all transform methods get passed through this function
// args can be array of [int/string, string] or [object]
DDD.prototype.transform = function(transform_func, args) {
  // check for bullshit, fail gracefully
  if (!arguments.length) { return this; }
  var transform = get_transform_object.apply(this, args);
  if (!transform) { return this; }
  var css_matrix = this.$.css('transform');
  if (!css_matrix) { return this; }

  console.log('css_matrix', css_matrix);

  var matrix = DDD.prototype.parseMatrix(css_matrix);
  if (!matrix) { // if there's no current matrix, use the default
    matrix = DDD.prototype.identity_matrix;
  }

  console.log('parsed matrix', matrix);

  // apply the given transform function
  var new_matrix = transform_func.call(this, matrix, transform);

  console.log('new matrix', new_matrix);

  // apply the new transform css
  DDD.prototype.applyMatrix.call(this, new_matrix);

  return this;
}

// scaling matrix:
// | x 0 0 0 | matrix_map[0]
// | 0 y 0 0 | matrix_map[5]
// | 0 0 1 0 |
// | 0 0 0 z | matrix_map[15]
DDD.prototype.scale_map = { 'x': 0, 'y': 5, 'z': 15 };
DDD.prototype.scale_func = function(matrix, transform) {
  var matrix_map = DDD.prototype.scale_map;

  // scaling Z doesn't quite make sense in 3d environment comprising only 2d shapes
  ['x', 'y'].forEach($.proxy(function(axis, index, array) {
    if (transform[axis] === undefined) { return; }
    var transform_value = +(String(transform[axis]).replace(/[^0-9.-]/g, ''));

    var transform_ratio = matrix[matrix_map[axis]];
    if (/%$/.test(String(transform[axis]))) { // scale by percent
      if (this.transform_type === 'to') {
        matrix[matrix_map[axis]] *= (transform_value * 0.01);
      } else {
        matrix[matrix_map[axis]] += (matrix[matrix_map[axis]] * (transform_value * 0.01));
      }
    } else { // scale by pixels
      var size;
      switch (axis) {
        case 'x': size = this.$.width()  * transform_ratio;
        break;
        case 'y': size = this.$.height() * transform_ratio;
        break;
      }
      if (!size) { size = 1; } // prevent division by 0

      if (this.transform_type === 'to') {
        matrix[matrix_map[axis]] = (transform_value / size) * transform_ratio;
      } else {
        matrix[matrix_map[axis]] = (size + transform_value) * (transform_ratio / size);
      }
    }
  }, this));
  
  return matrix;
}

// translation matrix:
// | 1 0 0 0 |
// | 0 1 0 0 |
// | 0 0 1 0 |
// | x y z 1 | matrix_map[12, 13, 14]
DDD.prototype.translate_map = { 'x': 12, 'y': 13, 'z': 14 };
DDD.prototype.translate_func = function(matrix, transform) {
  var matrix_map = DDD.prototype.translate_map;

  ['x', 'y', 'z'].forEach($.proxy(function(axis, index, array) {
    if (transform[axis] === undefined) { return; }
    var transform_value = +(String(transform[axis]).replace(/[^0-9.-]/g, ''));

    var transform_ratio = matrix[matrix_map[axis]];
    if (/%$/.test(String(transform[axis]))) { // scale by percent
      if (this.transform_type === 'to') {
        matrix[matrix_map[axis]] *= (transform_value * 0.01);
      } else {
        matrix[matrix_map[axis]] += (matrix[matrix_map[axis]] * (transform_value * 0.01));
      }
    } else { // scale by pixels
      if (this.transform_type === 'to') {
        matrix[matrix_map[axis]] = transform_value;
      } else {
        matrix[matrix_map[axis]] += transform_value;
      }
    }
  }, this));
  
  return matrix;
}

// rotation is a complex equation
// and doesn't use a 1:1 matrix_map
// see the 3D rotation matrix spec here:
// http://www.w3.org/TR/css3-transforms/#MatrixDefined
DDD.prototype.rotate_func = function(matrix, transform) {
  // ['x', 'y', 'z'].forEach(function(axis, index, array) {
  //   if (transform[axis] === undefined) {
  //     transform[axis] = 0;
  //   } else {
  //     transform[axis] = +(String(transform[axis]).replace(/[^0-9-\.]/g, ''));
  //   }
  // });

  var a; // alpha
  var rotation_matrices = [];
  ['x', 'y', 'z'].forEach(function(axis, index, array) {
    if (transform[axis] === undefined) { return; }
    a = transform[axis] = +(String(transform[axis]).replace(/[^0-9-\.]/g, ''));

    switch (axis) {
      case 'x': rotation_matrices.push([ 1 , 0           , 0                , 0 ,
                                         0 , Math.cos(a) , Math.sin(a * -1) , 0 ,
                                         0 , Math.sin(a) , Math.cos(a)      , 0 ,
                                         0 , 0           , 0                , 1 ]);
      break;
      case 'y': rotation_matrices.push([ Math.cos(a)      , 0 , Math.sin(a), 0 ,
                                         0                , 1 , 0          , 0 ,
                                         Math.sin(a * -1) , 0 , Math.cos(a), 0 ,
                                         0                , 0 , 0          , 1 ]);
      break;
      case 'z': rotation_matrices.push([ Math.cos(a) , Math.sin(a * -1) , 0 , 0 ,
                                         Math.sin(a) , Math.cos(a)      , 0 , 0 ,
                                         0           , 0                , 1 , 0 ,
                                         0           , 0                , 0 , 1 ]);
    }
  });

  // var new_matrix = DDD.prototype.identity_matrix;
  new_matrix = matrix;
  rotation_matrices.forEach(function(rot_matrix, index, array) {
    new_matrix = DDD.prototype.matrixMultiply(new_matrix, rot_matrix);
  });

  // rotationXMatrix = $M([
  //   [1,0,0,0],
  //   [0,Math.cos(a), Math.sin(-a), 0],
  //   [0,Math.sin(a), Math.cos( a), 0],
  //   [0,0,0,1]
  // ])

  // rotationYMatrix = $M([
  //   [Math.cos( b), 0, Math.sin(b),0],
  //   [0,1,0,0],
  //   [Math.sin(-b), 0, Math.cos(b), 0],
  //   [0,0,0,1]
  // ])

  // rotationZMatrix = $M([
  //   [Math.cos(c), Math.sin(-c), 0, 0],
  //   [Math.sin(c), Math.cos( c), 0, 0],
  //   [0,0,1,0],
  //   [0,0,0,1]
  // ])

  // var alpha = Math.min(transform['x'], transform['y'], transform['z']) || 1;
  // var x = (transform['x'] / alpha);
  // var y = (transform['y'] / alpha);
  // var z = (transform['z'] / alpha);

  // alpha *= (Math.PI / 180) * -1; // convert deg to radians - negative to match rotate3d()
  // var sc = Math.sin(alpha / 2) * Math.cos(alpha / 2);
  // var sq = Math.pow(Math.sin(alpha / 2), 2);

  // var new_matrix = [
  //    1 - (2 * (Math.pow(y, 2) + Math.pow(z, 2)) * sq)
  //   ,2 * ((x * y * sq) - (z * sc))
  //   ,2 * ((x * z * sq) + (y * sc))
  //   ,0
  //   ,2 * ((x * y * sq) + (z * sc))
  //   ,1 - (2 * (Math.pow(x, 2) + Math.pow(z, 2)) * sq)
  //   ,2 * ((y * z * sq) - (x * sc))
  //   ,0
  //   ,2 * ((x * z * sq) - (y * sc))
  //   ,2 * ((y * z * sq) + (x * sc))
  //   ,1 - (2 * (Math.pow(x, 2) + Math.pow(y, 2)) * sq)
  //   ,0
  //   ,0
  //   ,0
  //   ,0
  //   ,1
  // ];

  // if (this.transform_type === 'by') {
  //   new_matrix = DDD.prototype.matrixMultiply(matrix, new_matrix);
  // }

  return new_matrix;
}

DDD.prototype.scaleBy = function(/* args */) {
  this.transform_type = 'by';
  return DDD.prototype.transform.call(this, DDD.prototype.scale_func, arguments);
}
DDD.prototype.scaleTo = function(/* args */) {
  this.transform_type = 'to';
  return DDD.prototype.transform.call(this, DDD.prototype.scale_func, arguments);
}
DDD.prototype.translateBy = function(/* args */) {
  this.transform_type = 'by';
  return DDD.prototype.transform.call(this, DDD.prototype.translate_func, arguments);
}
DDD.prototype.translateTo = function(/* args */) {
  this.transform_type = 'to';
  return DDD.prototype.transform.call(this, DDD.prototype.translate_func, arguments);
}
DDD.prototype.rotateBy = function(/* args */) {
  this.transform_type = 'by';
  return DDD.prototype.transform.call(this, DDD.prototype.rotate_func, arguments);
}
DDD.prototype.rotateTo = function(/* args */) {
  this.transform_type = 'to';
  return DDD.prototype.transform.call(this, DDD.prototype.rotate_func, arguments);
}

// parse a matrix3d() css string into a 16 length array
DDD.prototype.parseMatrix = function(matrix) {
  if (!matrix || typeof matrix !== 'string') {
    return null;
  }

  var matrix_array = matrix.match(/(-*[0-9]+\.*[0-9]*)[,\)]/g);
  if (!matrix_array || $.isArray(matrix_array) === -1) {
    return null;
  }

  console.log('parseMatrix length', matrix_array.length);

  if (matrix_array.length < 16) {
    if (matrix_array.length === 6) {
      // DOM decided to give us a matrix() which is 2d
      // luckily, it can be mapped to a proper matrix3d()
      var matrix_dd = matrix_array;

      console.warn('mapping 2d to 3d matrix');
      console.log('2d matrix', matrix_dd);

      matrix_array = DDD.prototype.identity_matrix;
      // matrix_array[0] = matrix_dd[0];
      // matrix_array[1] = matrix_dd[1];
      // matrix_array[3] = matrix_dd[2];
      // matrix_array[4] = matrix_dd[3];
      // matrix_array[5] = matrix_dd[4];
      // matrix_array[6] = matrix_dd[5];

      matrix_array[0]  = matrix_dd[0];
      matrix_array[1]  = matrix_dd[1];
      matrix_array[4]  = matrix_dd[2];
      matrix_array[5]  = matrix_dd[3];
      matrix_array[12] = matrix_dd[4];
      matrix_array[13] = matrix_dd[5];

      console.log('resulting 3d matrix', matrix_array);
    } else {
      return null;
    }
  }

  matrix_array.forEach(function(element, index, array) {
    matrix_array[index] = +(String(element).replace(/[,\)]$/, ''));
  });

  console.log('parsed 3d matrix', matrix_array);

  return matrix_array;
}

// takes the matrix array constructed by parseMatrix,
// and applies it to the ddd element's CSS
DDD.prototype.applyMatrix = function(matrix) {
  var new_css = 'matrix3d(';
  matrix.forEach(function(element, index, array) {
    if (index !== 0) { new_css += ', '; }
    new_css += element;
  });
  new_css += ')';

  this.$.css({
    '-webkit-transform': new_css,
       '-moz-transform': new_css,
        '-ms-transform': new_css,
         '-o-transform': new_css,
            'transform': new_css
  });
}

// this is a fast and dirty version of matrix multiplication
// that only works for 4x4 matrices
DDD.prototype.matrixMultiply = function(matrix_a, matrix_b) {
  var quotient_matrix = [];
  var a_start, b_start;
  for (var i = 0; i < 16; i++) {
    a_start = (i < 4)  ? 0
            : (i < 8)  ? 4
            : (i < 12) ? 8
            :            12;

    b_start = 0 + (i % 4);

    quotient_matrix[i] = (matrix_a[a_start]   * matrix_b[b_start]     )
                       + (matrix_a[++a_start] * matrix_b[b_start += 4])
                       + (matrix_a[++a_start] * matrix_b[b_start += 4])
                       + (matrix_a[++a_start] * matrix_b[b_start += 4]);

    console.log('element ' +i+ ' set to', quotient_matrix[i]);
  }

  console.log('quotient_matrix', quotient_matrix);
  return quotient_matrix;
}

DDD.prototype.identity_matrix = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];

// convenient for using DDD in a chained call
//  i.e. $('#my_object').ddd().scaleBy('10%', 'xy').end()
//                      .addClass('buffed')
DDD.prototype.end = function() {
  return this.$;
}

})(jQuery);