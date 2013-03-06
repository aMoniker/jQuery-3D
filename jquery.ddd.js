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

// parse a matrix3d() css string into a 16 length array
DDD.prototype.parseMatrix = function(matrix) {
  if (!matrix || typeof matrix !== 'string') {
    return false;
  }

  var matrix_array = matrix.match(/(-*[0-9]+\.*[0-9]*)[,\)]/g);
  if (!matrix_array || $.isArray(matrix_array) === -1 || matrix_array.length < 16) {
    return false;
  }

  matrix_array.forEach(function(element, index, array) {
    matrix_array[index] = +(element.replace(/[,\)]$/, ''));
  });

  return matrix_array;
}

// args can be [ int/string, string ]
// or [ object ]
DDD.prototype.scaleBy = function(/* args */) {
  // check for bullshit, fail gracefully
  if (!arguments.length) { return this; }
  var transform = get_transform_object.apply(this, arguments);
  if (!transform) { return this; }
  var css_matrix = this.$.css('transform');
  if (!css_matrix) { return this; }
  var matrix = DDD.prototype.parseMatrix(css_matrix);
  if (!matrix) { return this; }

  console.warn('transformation', transform);

  // scaling transformation matrix:
  // | x 0 0 0 | matrix[0]
  // | 0 y 0 0 | matrix[5]
  // | 0 0 1 0 |
  // | 0 0 0 z | matrix[15]
  var matrix_map = { 'x': 0, 'y': 5, 'z': 15 };

  // scale relevant dimensions
  ['x', 'y', 'z'].forEach($.proxy(function(axis, index, array) {
    if (transform[axis] === undefined) { return; }
    var scale_by = +(String(transform[axis]).replace(/[^0-9.-]/g, ''));
    if (!scale_by) { return; }

    var transform_ratio = matrix[matrix_map[axis]];
    if (/%$/.test(String(transform[axis]))) { // scale by percent
      matrix[matrix_map[axis]] *= (scale_num * 0.01);
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

      var new_ratio = (size + scale_by) * (transform_ratio / size)
      matrix[matrix_map[axis]] = new_ratio;
    }
  }, this));


  // apply the matrix array to the current css
  var new_transform = 'matrix3d(';
  matrix.forEach(function(element, index, array) {
    if (index !== 0) { new_transform += ', '; }
    new_transform += element;
  });
  new_transform += ')';

  this.$.css({
    '-webkit-transform': new_transform,
       '-moz-transform': new_transform,
        '-ms-transform': new_transform,
         '-o-transform': new_transform,
            'transform': new_transform
  });
}

DDD.prototype.scaleTo = function(/* args */) {

}

DDD.prototype.end = function() {
  return this.$;
}

})(jQuery);