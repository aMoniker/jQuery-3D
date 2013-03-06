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
  this.$ = $(selector);
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

// args can be array of [int/string, string] or [object]
DDD.prototype.transform = function(transform_func, args) {
  // check for bullshit, fail gracefully
  if (!arguments.length) { return this; }
  var transform = get_transform_object.apply(this, args);
  if (!transform) { return this; }
  var css_matrix = this.$.css('transform');
  if (!css_matrix) { return this; }
  var matrix = DDD.prototype.parseMatrix(css_matrix);
  if (!matrix) { return this; }

  // apply the given transform function
  transform_func.call(this, matrix, transform);

  // apply the new transform css
  DDD.prototype.applyMatrix.call(this, matrix);

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
      var size;
      switch (axis) {
        case 'x': size = this.$.width()  * transform_ratio;
        break;
        case 'y': size = this.$.height() * transform_ratio;
        break;
        case 'z': size = 1 * transform_ratio;
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

// parse a matrix3d() css string into a 16 length array
DDD.prototype.parseMatrix = function(matrix) {
  if (!matrix || typeof matrix !== 'string') {
    return null;
  }

  var matrix_array = matrix.match(/(-*[0-9]+\.*[0-9]*)[,\)]/g);
  if (!matrix_array || $.isArray(matrix_array) === -1 || matrix_array.length < 16) {
    return null;
  }

  matrix_array.forEach(function(element, index, array) {
    matrix_array[index] = +(element.replace(/[,\)]$/, ''));
  });

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

// convenient for using DDD in a chained call
//  i.e. $('#my_object').ddd().scaleBy('10%', 'xy').end()
//                      .addClass('buffed')
DDD.prototype.end = function() {
  return this.$;
}

})(jQuery);