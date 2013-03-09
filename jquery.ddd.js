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

// all normal transform methods get routed through this function
// args can be array of [int/string, string] or [object]
// or in the case of rotate functions, an array of objects
DDD.prototype.transform = function(transform_func, args) {
  // check for bullshit, fail gracefully
  if (!arguments.length) { return this; }
  var transform = get_transform_object.apply(this, args);
  if (!transform) { return this; }

  // get the current matrix
  var matrix = ddd.getMatrix.call(this);

  // get the components of a matrix (scale, skew, transform, etc.)
  var components = ddd.decomposeMatrix(matrix);
  if (!components) { return this; }

  // apply the given transform function to to the 3d components
  var modified_components = transform_func.call(this, components, transform);
  if (!modified_components) { return this; }

  // reconstitute a matrix from the updated components
  var recomposed_matrix = ddd.recomposeMatrix(modified_components);
  if (!recomposed_matrix) { return this; }

  // apply the new transform css
  ddd.applyMatrix.call(this, recomposed_matrix);

  return this;
}

// $.ddd.animate({
//    'scaleBy': [ 1.5, 'xy' ]
//   ,'translateBy': [ 50, 'xyz' ]
//   ,'rotateBy': [{ 'x': 50 }, { 'y': 25 }]
// }, 2000, 'easeInCirc', function() {
//   // complete callback
// });
DDD.prototype.animate = function(/* args */) {
  // TODO: This duplicates some of the logic found in the transform_funcs
  // and was the last part of the plugin added.
  // It works for now, but it's the section most in need of refactoring
  // into common functions, or a less confusing flow

  // TODO: prevent multiple animations from interfering with each other

  var args = Array.prototype.slice.call(arguments);
  if (!args || !args.length) { return this; }
  if (!$.isPlainObject(args[0])) { return this; }
  if (!args[1] || !$.isNumeric(args[1])) { return this; }

  // convenience
  var transforms = args[0];
  var duration   = args[1];
  var easing     = args[2] || 'linear';
  var callback   = args[3] || $.noop;

  var legit_functions = ['scaleBy'    , 'scaleTo'
                        ,'translateBy', 'translateTo'
                        ,'rotateBy'   , 'rotateTo'];

  // get the current matrix & components
  var matrix = ddd.getMatrix.call(this);
  var orig_components = ddd.decomposeMatrix.call(this, matrix);
  if (!orig_components) { return this; }
  var dest_quat = $.extend(true, {}, orig_components.quaternion); // only used when rotation is present

  $.each(transforms, $.proxy(function(fn_name, transform) {
    if ($.inArray(fn_name, legit_functions) === -1) { return; }
    var basic_type = fn_name.replace(/(To|By)$/, '');
    var transform_type = /To$/.test(fn_name) ? 'to' : 'by';
    var transform_object = get_transform_object.apply(this, transform);
    var map = { x: 0, y: 1, z: 2 };

    // rotations get Slerped inside the step function, but precalculated here
    // TODO: currently slerp animation only works for one rotate transform at a time,
    //       but it should work for a series as well
    if (basic_type === 'rotate') {
      $.each(transform_object, $.proxy(function(key, value) {
        // var transform_value = ddd.parseValue(transform[axis]);
        var rotation_angle = (value * (Math.PI / 180)) * -1;
        var rotation_axis = [0, 0, 0];
        rotation_axis[map[key]] = 1;

        // make a quaternion representing the rotation
        var local_rotation = Vector.create([
           rotation_axis[0] * Math.sin(rotation_angle / 2)
          ,rotation_axis[1] * Math.sin(rotation_angle / 2)
          ,rotation_axis[2] * Math.sin(rotation_angle / 2)
          ,Math.cos(rotation_angle / 2)
        ]);

        dest_quat = ddd.quaternionMultiply(dest_quat, local_rotation);
      }));
    }

    this.$.css({ orphans: 0 });       // this exploits a little-used CSS property
    this.$.animate({ orphans: 1 }, {  // called orphans to control the animation
       step: $.proxy(function(n, fx) {
        if (n === 0) { return; }
        var new_transform = $.extend(true, {}, transform_object);
        var cur_matrix = ddd.getMatrix.call(this); // this might be inefficient
        var cur_components = ddd.decomposeMatrix.call(this, cur_matrix);

        $.each(transform_object, $.proxy(function(key, value) {
          if (!$.isNumeric(value)) { return; } // TODO: only allowing int values for now, should allow px/deg/% in future

          switch (basic_type) {
            case 'scale':
              if (map[key] === undefined) { break; }

              var size = (key === 'x') ? this.$.width() : this.$.height();
              var scaled_size = orig_components.scale.elements[map[key]] * (size || 1);
              if (transform_type === 'by') {
                new_transform[key] = scaled_size + (new_transform[key] * n);
              } else {
                new_transform[key] = scaled_size + ((scaled_size - new_transform[key]) * n * -1);
              }

            break;
            case 'translate':
              if (map[key] === undefined) { break; }

              if (transform_type === 'by') {
                new_transform[key] = orig_components.translation.elements[map[key]] + (new_transform[key] * n);
              } else {
                new_transform[key] = orig_components.translation.elements[map[key]]
                                   + ((orig_components.translation.elements[map[key]] - new_transform[key]) * n * -1);
              }

            break;
          }
        }, this));

        var modified_components = $.extend(true, {}, orig_components);
        if (dest_quat !== orig_components.quaternion) { // rotations are a special case - use slerp
          modified_components.quaternion = ddd.quaternionSlerp(orig_components.quaternion, dest_quat, n)
        } else { // apply the new transform step
          this.transform_type = 'to'; // animations always get converted to absolute terms
          modified_components = ddd[basic_type + '_func'].call(this, cur_components, new_transform);
        }

        if (!modified_components) { return; }
        var recomposed_matrix = ddd.recomposeMatrix.call(this, modified_components);
        if (!recomposed_matrix) { return; }
        ddd.applyMatrix.call(this, recomposed_matrix);
       }, this)
      ,easing: easing
      ,duration: duration
      ,complete: callback
    });

  }, this));

  return this;
}

// standardizes the multiple input formats into one
// object format { x: 10, y, '20px', z: '5%' }
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
  } else if (args.length === 1 && $.isArray(args[0])) {
    // special case for rotate functions
    transform = args[0];
  } else { // expecting { 'x': 20, 'y': 10 } format
    transform = $.extend(transform, args[0]);
  }

  return transform;
}

DDD.prototype.scale_func = function(components, transform) {
  // scaling Z doesn't quite make sense in 3d environment comprising only 2d shapes
  // technically the value is there, but it doesn't seem to do much
  // if depth could be determined (for pixel-based transforms) it can be added back
  var map = { x: 0, y: 1, z: 2 };
  ['x', 'y'].forEach($.proxy(function(axis, i, array) {
    if (transform[axis] === undefined) { return; }

    var transform_ratio = components.scale.elements[map[axis]];
    var transform_value = ddd.parseValue(transform[axis]);
    if (/%$/.test(String(transform[axis]))) { // scale by percent
      if (this.transform_type === 'to') {
        components.scale.elements[map[axis]] *= (transform_value * 0.01);
      } else {
        components.scale.elements[map[axis]] += (transform_ratio * (transform_value * 0.01));
      }
    } else { // scale by pixels
      var size;
      switch (axis) {
        case 'x': size = this.$.width()  * transform_ratio; break;
        case 'y': size = this.$.height() * transform_ratio; break;
      }
      if (!size) { size = 1; } // prevent division by 0

      if (this.transform_type === 'to') {
        components.scale.elements[map[axis]] = (transform_value / size) * transform_ratio;
      } else {
        components.scale.elements[map[axis]] = (size + transform_value) * (transform_ratio / size);
      }
    }
  }, this));

  return components;
}

DDD.prototype.translate_func = function(components, transform) {
  var map = { x: 0, y: 1, z: 2 };
  ['x', 'y', 'z'].forEach($.proxy(function(axis, i, array) {
    if (transform[axis] === undefined) { return; }

    var transform_value = ddd.parseValue(transform[axis]);
    if (/%$/.test(String(transform[axis]))) { // scale by percent
      if (this.transform_type === 'to') {
        components.translation.elements[map[axis]] *= (transform_value * 0.01);
      } else {
        components.translation.elements[map[axis]] += (components.translation.elements[map[axis]] * (transform_value * 0.01));
      }
    } else { // scale by pixels
      if (this.transform_type === 'to') {
        components.translation.elements[map[axis]] = transform_value;
      } else {
        components.translation.elements[map[axis]] += transform_value;
      }
    }
  }, this));

  return components;  
}

DDD.prototype.rotate_func = function(components, transforms) {
  if (!$.isArray(transforms)) { transforms = [transforms]; }

  var map = { x: 0, y: 1, z: 2 };
  transforms.forEach($.proxy(function(transform, i) {
    var axis = transform.x ? 'x'
             : transform.y ? 'y'
             : transform.z ? 'z'
             : undefined;

    if (axis === undefined) { return; }

    var transform_value = ddd.parseValue(transform[axis]);
    var rotation_angle = (transform_value * (Math.PI / 180)) * -1;
    var rotation_axis = [0, 0, 0];
    rotation_axis[map[axis]] = 1;

    // make a quaternion representing the rotation
    var local_rotation = Vector.create([
       rotation_axis[0] * Math.sin(rotation_angle / 2)
      ,rotation_axis[1] * Math.sin(rotation_angle / 2)
      ,rotation_axis[2] * Math.sin(rotation_angle / 2)
      ,Math.cos(rotation_angle / 2)
    ]);

    // if using rotateTo, the local_rotation is simply the new quat
    if (this.transform_type === 'to') {
      components.quaternion = local_rotation;
      return components;
    }

    // obtain the new quat by multiplying the old quat by the new rotation
    var quat_product = ddd.quaternionMultiply(components.quaternion, local_rotation);
    if (!quat_product) { return; }

    components.quaternion = quat_product;

    // (w^2 + x^2 + y^2 + z^2)
    var magnitude = Math.pow(components.quaternion.elements[0], 2)
                  + Math.pow(components.quaternion.elements[1], 2)
                  + Math.pow(components.quaternion.elements[2], 2)
                  + Math.pow(components.quaternion.elements[3], 2);

    // normalize the quat if the magnitude is out of tolerance
    if (magnitude < 1 || magnitude > 1) { // zero tolerance for now
      for (var i = 0; i < 4; i++) {
        components.quaternion.elements[i] /= magnitude;
        components.quaternion.elements[i] = components.quaternion.elements[i].toFixed(15);
      }
    }
  }, this));

  return components;
}

// scale and translate functions take arguments like:
//   scaleBy(45, 'x'); or translateTo(0, 'xyz');
// but they can also take arguments like:
//   scaleTo({ x: '50%', y: '150%' });
DDD.prototype.scaleBy = function(/* args */) {
  this.transform_type = 'by';
  return ddd.transform.call(this, ddd.scale_func, arguments);
}
DDD.prototype.scaleTo = function(/* args */) {
  this.transform_type = 'to';
  return ddd.transform.call(this, ddd.scale_func, arguments);
}
DDD.prototype.translateBy = function(/* args */) {
  this.transform_type = 'by';
  return ddd.transform.call(this, ddd.translate_func, arguments);
}
DDD.prototype.translateTo = function(/* args */) {
  this.transform_type = 'to';
  return ddd.transform.call(this, ddd.translate_func, arguments);
}
// rotate functions are a little different.
// since quaternion multiplication is non-commutative,
// I can't provide the same interface as scale or translate
// since I wouldn't know in which order to perform rotations
// So, these functions accept a slightly different format:
//   rotateBy(45, 'x');  a single axis and a degree value
// or an array of objects representing rotations that should be applied in order:
//   rotateBy([ { x: 45 }, { y: 20 }, { z: 50 }, { x: 15 }, ... ]);
DDD.prototype.rotateBy = function(/* args */) {
  this.transform_type = 'by';
  return ddd.transform.call(this, ddd.rotate_func, arguments);
}
DDD.prototype.rotateTo = function(/* args */) {
  this.transform_type = 'to';
  return ddd.transform.call(this, ddd.rotate_func, arguments);
}

// parse a numeric value from a CSS string
DDD.prototype.parseValue = function(value) {
  return +(String(value).replace(/[^0-9\.-]/g, ''));
}

// gets the matrix from CSS, defaulting to the identity matrix
DDD.prototype.getMatrix = function() {
  var matrix;
  var css_matrix = this.$.css('transform');
  if (!css_matrix || css_matrix === 'none') {
    matrix = Matrix.I(4); // use the identity matrix if one doesn't exist in css
  } else {
    matrix = ddd.parseMatrix(css_matrix);
    if (!matrix || !matrix.elements || isNaN(matrix.elements[0][0])) {
      matrix = Matrix.I(4);
    }
  }
  return matrix;
}

// parse a matrix3d() css string into a Sylvester Matrix
DDD.prototype.parseMatrix = function(matrix) {
  if (!matrix || typeof matrix !== 'string') {
    return null;
  }

  var matrix_array = matrix.match(/(-*[0-9]+\.*[0-9]*)[,\)]/g);
  if (!matrix_array || $.isArray(matrix_array) === -1) {
    return null;
  }

  if (matrix_array.length < 16) {
    if (matrix_array.length === 6) {
      // DOM decided to give us a matrix() which is 2d
      // luckily, it can be mapped to a proper matrix3d()
      var matrix_dd = matrix_array;
      matrix_array = ddd.sylvesterToLinearMatrix(Matrix.I(4));
      matrix_array[0]  = matrix_dd[0];
      matrix_array[1]  = matrix_dd[1];
      matrix_array[4]  = matrix_dd[2];
      matrix_array[5]  = matrix_dd[3];
      matrix_array[12] = matrix_dd[4];
      matrix_array[13] = matrix_dd[5];
    } else {
      return null;
    }
  }

  // we only ever expect a 4x4 matrix
  if (matrix_array.length !== 16) { return null; }

  matrix_array.forEach(function(element, index, array) {
    matrix_array[index] = +(String(element).replace(/[,\)]$/, ''));
  });

  return ddd.linearToSylvesterMatrix(matrix_array);
}

// takes the Sylvester matrix constructed by parseMatrix
// and applies it to the ddd element's CSS
DDD.prototype.applyMatrix = function(matrix) {
  var new_css = 'matrix3d(';

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      if (i !== 0 || j !== 0) { new_css += ', '; }

      // matrix3d() does not play well with javascript numbers using scientific notation
      if (/e[\+-][0-9]+$/.test(String(matrix.elements[i][j]))) {
        var places = String(matrix.elements[i][j]).match(/[0-9]+$/);
        new_css += Number(matrix.elements[i][j]).toFixed(++places > 20 ? 20 : places);
      } else {
        new_css += matrix.elements[i][j];
      }
    }
  }

  new_css += ')';

  this.$.css({
    '-webkit-transform': new_css,
       '-moz-transform': new_css,
        '-ms-transform': new_css,
         '-o-transform': new_css,
            'transform': new_css
  });
}

// takes a square matrix array (e.g. of length 16)
// and converts it to a Sylvester matrix
DDD.prototype.linearToSylvesterMatrix = function(matrix) {
  if (!matrix || !matrix.length) { return null; }

  var side = Math.sqrt(matrix.length);
  if (side % 1 !== 0) { return 0; } // not square

  var row_array = [];
  while (matrix.length) {
    row_array.push(matrix.splice(0, side));
  }

  return Matrix.create(row_array);
}

// takes a Sylvester matrix and converts it to a
// linear array equivalent by concatenating its rows in order
DDD.prototype.sylvesterToLinearMatrix = function(matrix) {
  if (!matrix || !matrix.elements) { return null; }

  var linear_matrix = [];
  var rows = matrix.rows();
  var cols = matrix.cols();
  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      linear_matrix.push(matrix.elements[i][j]);
    }
  }

  return linear_matrix;
}

// decomposes a Sylvester matrix into components
// and returns an object containing them
DDD.prototype.decomposeMatrix = function(matrix) {
  if (!matrix || !matrix.e || matrix.elements[3][3] === 0) {
    return null;
  }

  // Normalize
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      matrix.elements[i][j] /= matrix.elements[3][3];
    }
  }

  // perspective_matrix is used to solve for perspective, but it also provides
  // an easy way to test for singularity of the upper 3x3 component
  var perspective_matrix = matrix.dup();
  for (var i = 0; i < 3; i++) {
    perspective_matrix.elements[i][3] = 0;
  }
  perspective_matrix.elements[3][3] = 1;
  if (perspective_matrix.determinant() === 0) {
    return null;
  }

  // Perspective
  var perspective = [];
  if (matrix.elements[0][3] !== 0
   || matrix.elements[1][3] !== 0
   || matrix.elements[2][3] !== 0
  ) { // perspective exists
    var right_hand_side = [];
    for (var i = 0; i < 4; i++) {
      right_hand_side[i] = matrix.elements[i][3];
    }
    var right_hand_vector = Vector.create(right_hand_side);

    // solve by inverting perspective_matrix and
    // multiplying right_hand_side by the inverse
    perspective = perspective_matrix
                    .inverse()
                    .transpose()
                    .multiply(right_hand_vector);
  } else { // no perspective
    perspective = Vector.create([0, 0, 0, 1]);
  }

  // Translation
  var translation = [];
  for (var i = 0; i < 3; i++) {
    translation[i] = matrix.elements[3][i];
  }

  // Scale and Skew
  var scale = [], skew = [], row = [[], [], []];
  for (i = 0; i < 3; i++) {
    row[i][0] = matrix.elements[i][0];
    row[i][1] = matrix.elements[i][1];
    row[i][2] = matrix.elements[i][2];
  }

  // Compute X scale and normalize first row
  scale[0] = ddd.vectorLength(row[0]);
  row[0]   = ddd.vectorNormalize(row[0]);

  // Compute XY shear factor, make 2nd row orthogonal to 1st
  skew[0] = ddd.dotProduct(row[0], row[1]);
  row[1]  = ddd.vectorCombine(row[1], row[0], 1, (-1 * skew[0]));

  // Compute Y scale and normalize second row
  scale[1] = ddd.vectorLength(row[1]);
  row[1]   = ddd.vectorNormalize(row[1]);
  skew[0] /= scale[1];

  // Compute XZ and YZ shears, make 3rd row orthogonal
  skew[1] = ddd.dotProduct(row[0], row[2]);
  row[2]  = ddd.vectorCombine(row[2], row[0], 1, (-1 * skew[1]));
  skew[2] = ddd.dotProduct(row[1], row[2]);
  row[2]  = ddd.vectorCombine(row[2], row[1], 1, (-1 * skew[2]));

  // Get Z scale and normalize third row
  scale[2] = ddd.vectorLength(row[2]);
  row[2]   = ddd.vectorNormalize(row[2]);
  skew[1] /= scale[2];
  skew[2] /= scale[2];

  // The matrix rows should be orthonormal
  // Check for a coordinate system flip.
  // If the determinant = -1, negate the matrix and scaling factors
  var cross_ab = ddd.crossProduct(row[1], row[2]);
  if (ddd.dotProduct(row[0], cross_ab) < 0) {
    for (var i = 0; i < 3; i++) {
      scale[0]  *= -1;
      row[i][0] *= -1;
      row[i][1] *= -1;
      row[i][2] *= -1;
    }
  }

  // Rotations
  var quaternion = [];
  quaternion[0] = 0.5 * Math.sqrt(Math.max(1 + row[0][0] - row[1][1] - row[2][2], 0));
  quaternion[1] = 0.5 * Math.sqrt(Math.max(1 - row[0][0] + row[1][1] - row[2][2], 0));
  quaternion[2] = 0.5 * Math.sqrt(Math.max(1 - row[0][0] - row[1][1] + row[2][2], 0));
  quaternion[3] = 0.5 * Math.sqrt(Math.max(1 + row[0][0] + row[1][1] + row[2][2], 0));

  if (row[2][1] < row[1][2]) { quaternion[0] *= -1; }
  if (row[0][2] < row[2][0]) { quaternion[1] *= -1; }
  if (row[1][0] < row[0][1]) { quaternion[2] *= -1; }

  // return components as Sylvester vectors
  var components = {
     translation: Vector.create(translation)
    ,scale      : Vector.create(scale)
    ,skew       : Vector.create(skew)
    ,perspective: perspective // already a Vector
    ,quaternion : Vector.create(quaternion)
  };
  return components;
}

// translates structures produced by ddd.decomposeMatrix()
// back into a 4x4 Sylvester matrix.
DDD.prototype.recomposeMatrix = function(components) {
  if (!components) { return null; }

  // All components are required
  var missing_components = false;
  var required_components = ['perspective', 'translation', 'quaternion', 'skew', 'scale'];
  required_components.forEach(function(component, i, array) {
    if (!components[component]) { missing_components = true; }
  });
  if (missing_components) { return null; }

  // Convenience variables
  var perspective = components.perspective;
  var translation = components.translation;
  var quaternion  = components.quaternion;
  var skew        = components.skew;
  var scale       = components.scale;

  // Start with the Identity matrix
  var matrix = Matrix.I(4);

  // Apply Perspective
  for (var i = 0; i < 4; i++) {
    matrix.elements[i][3] = perspective.elements[i];
  }

  // Apply Translation
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      matrix.elements[3][i] += translation.elements[j] * matrix.elements[j][i];
    }
  }

  // Apply Rotation
  var x = quaternion.elements[0];
  var y = quaternion.elements[1];
  var z = quaternion.elements[2];
  var w = quaternion.elements[3];

  // Construct a rotation matrix from the quaternion values
  var rotation_matrix = Matrix.I(4);
  rotation_matrix.elements[0][0] = 1 - (2 * (Math.pow(y, 2) + Math.pow(z, 2)));
  rotation_matrix.elements[0][1] = 2 * (x * y - z * w);
  rotation_matrix.elements[0][2] = 2 * (x * z + y * w);
  rotation_matrix.elements[1][0] = 2 * (x * y + z * w);
  rotation_matrix.elements[1][1] = 1 - (2 * (Math.pow(x, 2) + Math.pow(z, 2)));
  rotation_matrix.elements[1][2] = 2 * (y * z - x * w);
  rotation_matrix.elements[2][0] = 2 * (x * z - y * w);
  rotation_matrix.elements[2][1] = 2 * (y * z + x * w);
  rotation_matrix.elements[2][2] = 1 - (2 * (Math.pow(x, 2) + Math.pow(y, 2)));

  matrix = matrix.multiply(rotation_matrix);

  // Apply Skew
  var skew_matrix = Matrix.I(4);
  if (skew.elements[2]) {
    skew_matrix.elements[2][1] = skew.elements[2];
    matrix = matrix.multiply(skew_matrix);
  }

  skew_matrix = Matrix.I(4);
  if (skew.elements[1]) {
    skew_matrix.elements[2][0] = skew.elements[1];
    matrix = matrix.multiply(skew_matrix);
  }

  skew_matrix = Matrix.I(4);
  if (skew.elements[0]) {
    skew_matrix.elements[1][0] = skew.elements[0];
    matrix = matrix.multiply(skew_matrix);
  }

  // Apply Scale
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      matrix.elements[i][j] *= scale.elements[i];
    }
  }

  return matrix;
}

// expects a vector array of [x, y, z]
DDD.prototype.vectorLength = function(vector) {
  if ($.isArray(vector) === -1 || vector.length !== 3) {
    return null;
  }
  var len = Math.sqrt((Math.pow(vector[0], 2))
                    + (Math.pow(vector[1], 2))
                    + (Math.pow(vector[2], 2)));
  return len;
}

// expects a vector array [x, y, z]
DDD.prototype.vectorNormalize = function(vector) {
  var len = ddd.vectorLength(vector);
  if (!len) { return null; }

  vector.forEach(function(value, i, array) {
    vector[i] = value / len;
  });

  return vector;
}

// expects two vector arrays of equal length and two scalar values
DDD.prototype.vectorCombine = function(vector_a, vector_b, scalar_a, scalar_b) {
  if ($.isArray(vector_a) === -1
   || $.isArray(vector_b) === -1
   || vector_a.length !== vector_b.length
  ) { return null; }

  var result = [];
  vector_a.forEach(function(value, i, array) {
    result[i] = (scalar_a * vector_a[i]) + (scalar_b * vector_b[i]);
  });
  return result;
}

// expects two vector arrays of equal length
DDD.prototype.dotProduct = function(vector_a, vector_b) {
  if ($.isArray(vector_a) === -1
   || $.isArray(vector_b) === -1
   || vector_a.length !== vector_b.length
  ) { return null; }

  var product = 0;
  vector_a.forEach(function(value, i, array) {
    product += (vector_a[i] * vector_b[i]);
  });
  return product;
}

// expects two vector arrays of length 3
DDD.prototype.crossProduct = function(vector_a, vector_b) {
  if ($.isArray(vector_a) === -1
   || $.isArray(vector_b) === -1
   || vector_a.length !== vector_b.length
   || vector_a.length !== 3
  ) { return null; }

  var product = [];
  product[0] = (vector_a[1] * vector_b[2]) - (vector_a[2] * vector_b[1]);
  product[1] = (vector_a[2] * vector_b[0]) - (vector_a[0] * vector_b[1]);
  product[2] = (vector_a[0] * vector_b[1]) - (vector_a[1] * vector_b[0]);
  return product;
}

// expects two quaternions as arrays or Sylvester vectors
// and returns their non-commutative product
DDD.prototype.quaternionMultiply = function(q1, q2) {
  if (!q1 || !q2) { return null; }

  // convert potential Sylvestor vectors to Arrays
  if (!$.isArray(q1) && q1.elements) { q1 = q1.elements; }
  if (!$.isArray(q2) && q2.elements) { q2 = q2.elements; }

  // arrays must be the same length
  if (q1.length !== q2.length) { return null; }

  // for readability
  var x1 = q1[0], y1 = q1[1], z1 = q1[2], w1 = q1[3];
  var x2 = q2[0], y2 = q2[1], z2 = q2[2], w2 = q2[3];

  var vector =  Vector.create([
     (w1 * x2) + (x1 * w2) + (y1 * z2) - (z1 * y2)
    ,(w1 * y2) - (x1 * z2) + (y1 * w2) + (z1 * x2)
    ,(w1 * z2) + (x1 * y2) - (y1 * x2) + (z1 * w2)
    ,(w1 * w2) - (x1 * x2) - (y1 * y2) - (z1 * z2)
  ]);

  return vector;
}

// expects two quaternions as Sylvester vectors
// and a theta value between -1 and 1
// returns a quaternion as a Sylvester vector
DDD.prototype.quaternionSlerp = function(q1, q2, t) {
  var product = q1.dot(q2);

  // clamp product between -1 and 1
  // product = Math.max(product, 1);
  // product = Math.min(product, -1);
  product = Math.min(product,  1);
  product = Math.max(product, -1);

  if (product === 1) { return q1; }

  var theta = Math.acos(product);
  var w = Math.sin(t * theta) * (1 / Math.sqrt(1 - Math.pow(product, 2)));

  var qA = $.extend(true, {}, q1);
  var qB = $.extend(true, {}, q2);
  var qQ = Vector.create([0,0,0,0]);
  for (var i = 0; i < 4; i++) {
    qA.elements[i] *= Math.cos(t * theta) - product * w;
    qB.elements[i] *= w;
    qQ.elements[i] = qA.elements[i] + qB.elements[i];
  }

  return qQ;

  // double  dot(vector, vector)         returns the dot product of the passed vectors
  // vector  multVector(vector, vector)  multiplies the passed vectors
  // double  sqrt(double)                returns the root square of passed value
  // double  max(double y, double x)     returns the bigger value of the two passed values
  // double  min(double y, double x)     returns the smaller value of the two passed values
  // double  cos(double)                 returns the cosines of passed value
  // double  sin(double)                 returns the sine of passed value  
  // double  acos(double)                returns the inverse cosine of passed value

  // product = dot(quaternionA, quaternionB)


  // if (product == 1.0)
  //    quaternionDst = quaternionA
  //    return

  // theta = acos(dot)
  // w = sin(t * theta) * 1 / sqrt(1 - product * product)

  // for (i = 0; i < 4; i++)
  //   quaternionA[i] *= cos(t * theta) - product * w
  //   quaternionB[i] *= w
  //   quaternionDst[i] = quaternionA[i] + quaternionB[i]

  // return
}

// convenient for using DDD in a chained call
//  i.e. $('#my_object').ddd().scaleBy('10%', 'xy').end()
//                      .addClass('buffed')
DDD.prototype.end = function() {
  return this.$;
}

// convenient for using ddd functions within this library
// instead of calling DDD.prototype.someFunction()
// with this I can just call ddd.someFunction()
var ddd = $.ddd();

// This is a minified copy of Sylvester 0.1.3 used for matrix/vector math.
// It's taken from http://sylvester.jcoglan.com/ and is under MIT license
eval(function(p,a,c,k,e,r){e=function(c){return(c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)r[e(c)]=k[c]||e(c);k=[function(e){return r[e]}];e=function(){return'\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p}('9 17={3i:\'0.1.3\',16:1e-6};l v(){}v.23={e:l(i){8(i<1||i>7.4.q)?w:7.4[i-1]},2R:l(){8 7.4.q},1u:l(){8 F.1x(7.2u(7))},24:l(a){9 n=7.4.q;9 V=a.4||a;o(n!=V.q){8 1L}J{o(F.13(7.4[n-1]-V[n-1])>17.16){8 1L}}H(--n);8 2x},1q:l(){8 v.u(7.4)},1b:l(a){9 b=[];7.28(l(x,i){b.19(a(x,i))});8 v.u(b)},28:l(a){9 n=7.4.q,k=n,i;J{i=k-n;a(7.4[i],i+1)}H(--n)},2q:l(){9 r=7.1u();o(r===0){8 7.1q()}8 7.1b(l(x){8 x/r})},1C:l(a){9 V=a.4||a;9 n=7.4.q,k=n,i;o(n!=V.q){8 w}9 b=0,1D=0,1F=0;7.28(l(x,i){b+=x*V[i-1];1D+=x*x;1F+=V[i-1]*V[i-1]});1D=F.1x(1D);1F=F.1x(1F);o(1D*1F===0){8 w}9 c=b/(1D*1F);o(c<-1){c=-1}o(c>1){c=1}8 F.37(c)},1m:l(a){9 b=7.1C(a);8(b===w)?w:(b<=17.16)},34:l(a){9 b=7.1C(a);8(b===w)?w:(F.13(b-F.1A)<=17.16)},2k:l(a){9 b=7.2u(a);8(b===w)?w:(F.13(b)<=17.16)},2j:l(a){9 V=a.4||a;o(7.4.q!=V.q){8 w}8 7.1b(l(x,i){8 x+V[i-1]})},2C:l(a){9 V=a.4||a;o(7.4.q!=V.q){8 w}8 7.1b(l(x,i){8 x-V[i-1]})},22:l(k){8 7.1b(l(x){8 x*k})},x:l(k){8 7.22(k)},2u:l(a){9 V=a.4||a;9 i,2g=0,n=7.4.q;o(n!=V.q){8 w}J{2g+=7.4[n-1]*V[n-1]}H(--n);8 2g},2f:l(a){9 B=a.4||a;o(7.4.q!=3||B.q!=3){8 w}9 A=7.4;8 v.u([(A[1]*B[2])-(A[2]*B[1]),(A[2]*B[0])-(A[0]*B[2]),(A[0]*B[1])-(A[1]*B[0])])},2A:l(){9 m=0,n=7.4.q,k=n,i;J{i=k-n;o(F.13(7.4[i])>F.13(m)){m=7.4[i]}}H(--n);8 m},2Z:l(x){9 a=w,n=7.4.q,k=n,i;J{i=k-n;o(a===w&&7.4[i]==x){a=i+1}}H(--n);8 a},3g:l(){8 S.2X(7.4)},2d:l(){8 7.1b(l(x){8 F.2d(x)})},2V:l(x){8 7.1b(l(y){8(F.13(y-x)<=17.16)?x:y})},1o:l(a){o(a.K){8 a.1o(7)}9 V=a.4||a;o(V.q!=7.4.q){8 w}9 b=0,2b;7.28(l(x,i){2b=x-V[i-1];b+=2b*2b});8 F.1x(b)},3a:l(a){8 a.1h(7)},2T:l(a){8 a.1h(7)},1V:l(t,a){9 V,R,x,y,z;2S(7.4.q){27 2:V=a.4||a;o(V.q!=2){8 w}R=S.1R(t).4;x=7.4[0]-V[0];y=7.4[1]-V[1];8 v.u([V[0]+R[0][0]*x+R[0][1]*y,V[1]+R[1][0]*x+R[1][1]*y]);1I;27 3:o(!a.U){8 w}9 C=a.1r(7).4;R=S.1R(t,a.U).4;x=7.4[0]-C[0];y=7.4[1]-C[1];z=7.4[2]-C[2];8 v.u([C[0]+R[0][0]*x+R[0][1]*y+R[0][2]*z,C[1]+R[1][0]*x+R[1][1]*y+R[1][2]*z,C[2]+R[2][0]*x+R[2][1]*y+R[2][2]*z]);1I;2P:8 w}},1t:l(a){o(a.K){9 P=7.4.2O();9 C=a.1r(P).4;8 v.u([C[0]+(C[0]-P[0]),C[1]+(C[1]-P[1]),C[2]+(C[2]-(P[2]||0))])}1d{9 Q=a.4||a;o(7.4.q!=Q.q){8 w}8 7.1b(l(x,i){8 Q[i-1]+(Q[i-1]-x)})}},1N:l(){9 V=7.1q();2S(V.4.q){27 3:1I;27 2:V.4.19(0);1I;2P:8 w}8 V},2n:l(){8\'[\'+7.4.2K(\', \')+\']\'},26:l(a){7.4=(a.4||a).2O();8 7}};v.u=l(a){9 V=25 v();8 V.26(a)};v.i=v.u([1,0,0]);v.j=v.u([0,1,0]);v.k=v.u([0,0,1]);v.2J=l(n){9 a=[];J{a.19(F.2F())}H(--n);8 v.u(a)};v.1j=l(n){9 a=[];J{a.19(0)}H(--n);8 v.u(a)};l S(){}S.23={e:l(i,j){o(i<1||i>7.4.q||j<1||j>7.4[0].q){8 w}8 7.4[i-1][j-1]},33:l(i){o(i>7.4.q){8 w}8 v.u(7.4[i-1])},2E:l(j){o(j>7.4[0].q){8 w}9 a=[],n=7.4.q,k=n,i;J{i=k-n;a.19(7.4[i][j-1])}H(--n);8 v.u(a)},2R:l(){8{2D:7.4.q,1p:7.4[0].q}},2D:l(){8 7.4.q},1p:l(){8 7.4[0].q},24:l(a){9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}o(7.4.q!=M.q||7.4[0].q!=M[0].q){8 1L}9 b=7.4.q,15=b,i,G,10=7.4[0].q,j;J{i=15-b;G=10;J{j=10-G;o(F.13(7.4[i][j]-M[i][j])>17.16){8 1L}}H(--G)}H(--b);8 2x},1q:l(){8 S.u(7.4)},1b:l(a){9 b=[],12=7.4.q,15=12,i,G,10=7.4[0].q,j;J{i=15-12;G=10;b[i]=[];J{j=10-G;b[i][j]=a(7.4[i][j],i+1,j+1)}H(--G)}H(--12);8 S.u(b)},2i:l(a){9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}8(7.4.q==M.q&&7.4[0].q==M[0].q)},2j:l(a){9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}o(!7.2i(M)){8 w}8 7.1b(l(x,i,j){8 x+M[i-1][j-1]})},2C:l(a){9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}o(!7.2i(M)){8 w}8 7.1b(l(x,i,j){8 x-M[i-1][j-1]})},2B:l(a){9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}8(7.4[0].q==M.q)},22:l(a){o(!a.4){8 7.1b(l(x){8 x*a})}9 b=a.1u?2x:1L;9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}o(!7.2B(M)){8 w}9 d=7.4.q,15=d,i,G,10=M[0].q,j;9 e=7.4[0].q,4=[],21,20,c;J{i=15-d;4[i]=[];G=10;J{j=10-G;21=0;20=e;J{c=e-20;21+=7.4[i][c]*M[c][j]}H(--20);4[i][j]=21}H(--G)}H(--d);9 M=S.u(4);8 b?M.2E(1):M},x:l(a){8 7.22(a)},32:l(a,b,c,d){9 e=[],12=c,i,G,j;9 f=7.4.q,1p=7.4[0].q;J{i=c-12;e[i]=[];G=d;J{j=d-G;e[i][j]=7.4[(a+i-1)%f][(b+j-1)%1p]}H(--G)}H(--12);8 S.u(e)},31:l(){9 a=7.4.q,1p=7.4[0].q;9 b=[],12=1p,i,G,j;J{i=1p-12;b[i]=[];G=a;J{j=a-G;b[i][j]=7.4[j][i]}H(--G)}H(--12);8 S.u(b)},1y:l(){8(7.4.q==7.4[0].q)},2A:l(){9 m=0,12=7.4.q,15=12,i,G,10=7.4[0].q,j;J{i=15-12;G=10;J{j=10-G;o(F.13(7.4[i][j])>F.13(m)){m=7.4[i][j]}}H(--G)}H(--12);8 m},2Z:l(x){9 a=w,12=7.4.q,15=12,i,G,10=7.4[0].q,j;J{i=15-12;G=10;J{j=10-G;o(7.4[i][j]==x){8{i:i+1,j:j+1}}}H(--G)}H(--12);8 w},30:l(){o(!7.1y){8 w}9 a=[],n=7.4.q,k=n,i;J{i=k-n;a.19(7.4[i][i])}H(--n);8 v.u(a)},1K:l(){9 M=7.1q(),1c;9 n=7.4.q,k=n,i,1s,1n=7.4[0].q,p;J{i=k-n;o(M.4[i][i]==0){2e(j=i+1;j<k;j++){o(M.4[j][i]!=0){1c=[];1s=1n;J{p=1n-1s;1c.19(M.4[i][p]+M.4[j][p])}H(--1s);M.4[i]=1c;1I}}}o(M.4[i][i]!=0){2e(j=i+1;j<k;j++){9 a=M.4[j][i]/M.4[i][i];1c=[];1s=1n;J{p=1n-1s;1c.19(p<=i?0:M.4[j][p]-M.4[i][p]*a)}H(--1s);M.4[j]=1c}}}H(--n);8 M},3h:l(){8 7.1K()},2z:l(){o(!7.1y()){8 w}9 M=7.1K();9 a=M.4[0][0],n=M.4.q-1,k=n,i;J{i=k-n+1;a=a*M.4[i][i]}H(--n);8 a},3f:l(){8 7.2z()},2y:l(){8(7.1y()&&7.2z()===0)},2Y:l(){o(!7.1y()){8 w}9 a=7.4[0][0],n=7.4.q-1,k=n,i;J{i=k-n+1;a+=7.4[i][i]}H(--n);8 a},3e:l(){8 7.2Y()},1Y:l(){9 M=7.1K(),1Y=0;9 a=7.4.q,15=a,i,G,10=7.4[0].q,j;J{i=15-a;G=10;J{j=10-G;o(F.13(M.4[i][j])>17.16){1Y++;1I}}H(--G)}H(--a);8 1Y},3d:l(){8 7.1Y()},2W:l(a){9 M=a.4||a;o(1g(M[0][0])==\'1f\'){M=S.u(M).4}9 T=7.1q(),1p=T.4[0].q;9 b=T.4.q,15=b,i,G,10=M[0].q,j;o(b!=M.q){8 w}J{i=15-b;G=10;J{j=10-G;T.4[i][1p+j]=M[i][j]}H(--G)}H(--b);8 T},2w:l(){o(!7.1y()||7.2y()){8 w}9 a=7.4.q,15=a,i,j;9 M=7.2W(S.I(a)).1K();9 b,1n=M.4[0].q,p,1c,2v;9 c=[],2c;J{i=a-1;1c=[];b=1n;c[i]=[];2v=M.4[i][i];J{p=1n-b;2c=M.4[i][p]/2v;1c.19(2c);o(p>=15){c[i].19(2c)}}H(--b);M.4[i]=1c;2e(j=0;j<i;j++){1c=[];b=1n;J{p=1n-b;1c.19(M.4[j][p]-M.4[i][p]*M.4[j][i])}H(--b);M.4[j]=1c}}H(--a);8 S.u(c)},3c:l(){8 7.2w()},2d:l(){8 7.1b(l(x){8 F.2d(x)})},2V:l(x){8 7.1b(l(p){8(F.13(p-x)<=17.16)?x:p})},2n:l(){9 a=[];9 n=7.4.q,k=n,i;J{i=k-n;a.19(v.u(7.4[i]).2n())}H(--n);8 a.2K(\'\\n\')},26:l(a){9 i,4=a.4||a;o(1g(4[0][0])!=\'1f\'){9 b=4.q,15=b,G,10,j;7.4=[];J{i=15-b;G=4[i].q;10=G;7.4[i]=[];J{j=10-G;7.4[i][j]=4[i][j]}H(--G)}H(--b);8 7}9 n=4.q,k=n;7.4=[];J{i=k-n;7.4.19([4[i]])}H(--n);8 7}};S.u=l(a){9 M=25 S();8 M.26(a)};S.I=l(n){9 a=[],k=n,i,G,j;J{i=k-n;a[i]=[];G=k;J{j=k-G;a[i][j]=(i==j)?1:0}H(--G)}H(--n);8 S.u(a)};S.2X=l(a){9 n=a.q,k=n,i;9 M=S.I(n);J{i=k-n;M.4[i][i]=a[i]}H(--n);8 M};S.1R=l(b,a){o(!a){8 S.u([[F.1H(b),-F.1G(b)],[F.1G(b),F.1H(b)]])}9 d=a.1q();o(d.4.q!=3){8 w}9 e=d.1u();9 x=d.4[0]/e,y=d.4[1]/e,z=d.4[2]/e;9 s=F.1G(b),c=F.1H(b),t=1-c;8 S.u([[t*x*x+c,t*x*y-s*z,t*x*z+s*y],[t*x*y+s*z,t*y*y+c,t*y*z-s*x],[t*x*z-s*y,t*y*z+s*x,t*z*z+c]])};S.3b=l(t){9 c=F.1H(t),s=F.1G(t);8 S.u([[1,0,0],[0,c,-s],[0,s,c]])};S.39=l(t){9 c=F.1H(t),s=F.1G(t);8 S.u([[c,0,s],[0,1,0],[-s,0,c]])};S.38=l(t){9 c=F.1H(t),s=F.1G(t);8 S.u([[c,-s,0],[s,c,0],[0,0,1]])};S.2J=l(n,m){8 S.1j(n,m).1b(l(){8 F.2F()})};S.1j=l(n,m){9 a=[],12=n,i,G,j;J{i=n-12;a[i]=[];G=m;J{j=m-G;a[i][j]=0}H(--G)}H(--12);8 S.u(a)};l 14(){}14.23={24:l(a){8(7.1m(a)&&7.1h(a.K))},1q:l(){8 14.u(7.K,7.U)},2U:l(a){9 V=a.4||a;8 14.u([7.K.4[0]+V[0],7.K.4[1]+V[1],7.K.4[2]+(V[2]||0)],7.U)},1m:l(a){o(a.W){8 a.1m(7)}9 b=7.U.1C(a.U);8(F.13(b)<=17.16||F.13(b-F.1A)<=17.16)},1o:l(a){o(a.W){8 a.1o(7)}o(a.U){o(7.1m(a)){8 7.1o(a.K)}9 N=7.U.2f(a.U).2q().4;9 A=7.K.4,B=a.K.4;8 F.13((A[0]-B[0])*N[0]+(A[1]-B[1])*N[1]+(A[2]-B[2])*N[2])}1d{9 P=a.4||a;9 A=7.K.4,D=7.U.4;9 b=P[0]-A[0],2a=P[1]-A[1],29=(P[2]||0)-A[2];9 c=F.1x(b*b+2a*2a+29*29);o(c===0)8 0;9 d=(b*D[0]+2a*D[1]+29*D[2])/c;9 e=1-d*d;8 F.13(c*F.1x(e<0?0:e))}},1h:l(a){9 b=7.1o(a);8(b!==w&&b<=17.16)},2T:l(a){8 a.1h(7)},1v:l(a){o(a.W){8 a.1v(7)}8(!7.1m(a)&&7.1o(a)<=17.16)},1U:l(a){o(a.W){8 a.1U(7)}o(!7.1v(a)){8 w}9 P=7.K.4,X=7.U.4,Q=a.K.4,Y=a.U.4;9 b=X[0],1z=X[1],1B=X[2],1T=Y[0],1S=Y[1],1M=Y[2];9 c=P[0]-Q[0],2s=P[1]-Q[1],2r=P[2]-Q[2];9 d=-b*c-1z*2s-1B*2r;9 e=1T*c+1S*2s+1M*2r;9 f=b*b+1z*1z+1B*1B;9 g=1T*1T+1S*1S+1M*1M;9 h=b*1T+1z*1S+1B*1M;9 k=(d*g/f+h*e)/(g-h*h);8 v.u([P[0]+k*b,P[1]+k*1z,P[2]+k*1B])},1r:l(a){o(a.U){o(7.1v(a)){8 7.1U(a)}o(7.1m(a)){8 w}9 D=7.U.4,E=a.U.4;9 b=D[0],1l=D[1],1k=D[2],1P=E[0],1O=E[1],1Q=E[2];9 x=(1k*1P-b*1Q),y=(b*1O-1l*1P),z=(1l*1Q-1k*1O);9 N=v.u([x*1Q-y*1O,y*1P-z*1Q,z*1O-x*1P]);9 P=11.u(a.K,N);8 P.1U(7)}1d{9 P=a.4||a;o(7.1h(P)){8 v.u(P)}9 A=7.K.4,D=7.U.4;9 b=D[0],1l=D[1],1k=D[2],1w=A[0],18=A[1],1a=A[2];9 x=b*(P[1]-18)-1l*(P[0]-1w),y=1l*((P[2]||0)-1a)-1k*(P[1]-18),z=1k*(P[0]-1w)-b*((P[2]||0)-1a);9 V=v.u([1l*x-1k*z,1k*y-b*x,b*z-1l*y]);9 k=7.1o(P)/V.1u();8 v.u([P[0]+V.4[0]*k,P[1]+V.4[1]*k,(P[2]||0)+V.4[2]*k])}},1V:l(t,a){o(1g(a.U)==\'1f\'){a=14.u(a.1N(),v.k)}9 R=S.1R(t,a.U).4;9 C=a.1r(7.K).4;9 A=7.K.4,D=7.U.4;9 b=C[0],1E=C[1],1J=C[2],1w=A[0],18=A[1],1a=A[2];9 x=1w-b,y=18-1E,z=1a-1J;8 14.u([b+R[0][0]*x+R[0][1]*y+R[0][2]*z,1E+R[1][0]*x+R[1][1]*y+R[1][2]*z,1J+R[2][0]*x+R[2][1]*y+R[2][2]*z],[R[0][0]*D[0]+R[0][1]*D[1]+R[0][2]*D[2],R[1][0]*D[0]+R[1][1]*D[1]+R[1][2]*D[2],R[2][0]*D[0]+R[2][1]*D[1]+R[2][2]*D[2]])},1t:l(a){o(a.W){9 A=7.K.4,D=7.U.4;9 b=A[0],18=A[1],1a=A[2],2N=D[0],1l=D[1],1k=D[2];9 c=7.K.1t(a).4;9 d=b+2N,2h=18+1l,2o=1a+1k;9 Q=a.1r([d,2h,2o]).4;9 e=[Q[0]+(Q[0]-d)-c[0],Q[1]+(Q[1]-2h)-c[1],Q[2]+(Q[2]-2o)-c[2]];8 14.u(c,e)}1d o(a.U){8 7.1V(F.1A,a)}1d{9 P=a.4||a;8 14.u(7.K.1t([P[0],P[1],(P[2]||0)]),7.U)}},1Z:l(a,b){a=v.u(a);b=v.u(b);o(a.4.q==2){a.4.19(0)}o(b.4.q==2){b.4.19(0)}o(a.4.q>3||b.4.q>3){8 w}9 c=b.1u();o(c===0){8 w}7.K=a;7.U=v.u([b.4[0]/c,b.4[1]/c,b.4[2]/c]);8 7}};14.u=l(a,b){9 L=25 14();8 L.1Z(a,b)};14.X=14.u(v.1j(3),v.i);14.Y=14.u(v.1j(3),v.j);14.Z=14.u(v.1j(3),v.k);l 11(){}11.23={24:l(a){8(7.1h(a.K)&&7.1m(a))},1q:l(){8 11.u(7.K,7.W)},2U:l(a){9 V=a.4||a;8 11.u([7.K.4[0]+V[0],7.K.4[1]+V[1],7.K.4[2]+(V[2]||0)],7.W)},1m:l(a){9 b;o(a.W){b=7.W.1C(a.W);8(F.13(b)<=17.16||F.13(F.1A-b)<=17.16)}1d o(a.U){8 7.W.2k(a.U)}8 w},2k:l(a){9 b=7.W.1C(a.W);8(F.13(F.1A/2-b)<=17.16)},1o:l(a){o(7.1v(a)||7.1h(a)){8 0}o(a.K){9 A=7.K.4,B=a.K.4,N=7.W.4;8 F.13((A[0]-B[0])*N[0]+(A[1]-B[1])*N[1]+(A[2]-B[2])*N[2])}1d{9 P=a.4||a;9 A=7.K.4,N=7.W.4;8 F.13((A[0]-P[0])*N[0]+(A[1]-P[1])*N[1]+(A[2]-(P[2]||0))*N[2])}},1h:l(a){o(a.W){8 w}o(a.U){8(7.1h(a.K)&&7.1h(a.K.2j(a.U)))}1d{9 P=a.4||a;9 A=7.K.4,N=7.W.4;9 b=F.13(N[0]*(A[0]-P[0])+N[1]*(A[1]-P[1])+N[2]*(A[2]-(P[2]||0)));8(b<=17.16)}},1v:l(a){o(1g(a.U)==\'1f\'&&1g(a.W)==\'1f\'){8 w}8!7.1m(a)},1U:l(a){o(!7.1v(a)){8 w}o(a.U){9 A=a.K.4,D=a.U.4,P=7.K.4,N=7.W.4;9 b=(N[0]*(P[0]-A[0])+N[1]*(P[1]-A[1])+N[2]*(P[2]-A[2]))/(N[0]*D[0]+N[1]*D[1]+N[2]*D[2]);8 v.u([A[0]+D[0]*b,A[1]+D[1]*b,A[2]+D[2]*b])}1d o(a.W){9 c=7.W.2f(a.W).2q();9 N=7.W.4,A=7.K.4,O=a.W.4,B=a.K.4;9 d=S.1j(2,2),i=0;H(d.2y()){i++;d=S.u([[N[i%3],N[(i+1)%3]],[O[i%3],O[(i+1)%3]]])}9 e=d.2w().4;9 x=N[0]*A[0]+N[1]*A[1]+N[2]*A[2];9 y=O[0]*B[0]+O[1]*B[1]+O[2]*B[2];9 f=[e[0][0]*x+e[0][1]*y,e[1][0]*x+e[1][1]*y];9 g=[];2e(9 j=1;j<=3;j++){g.19((i==j)?0:f[(j+(5-i)%3)%3])}8 14.u(g,c)}},1r:l(a){9 P=a.4||a;9 A=7.K.4,N=7.W.4;9 b=(A[0]-P[0])*N[0]+(A[1]-P[1])*N[1]+(A[2]-(P[2]||0))*N[2];8 v.u([P[0]+N[0]*b,P[1]+N[1]*b,(P[2]||0)+N[2]*b])},1V:l(t,a){9 R=S.1R(t,a.U).4;9 C=a.1r(7.K).4;9 A=7.K.4,N=7.W.4;9 b=C[0],1E=C[1],1J=C[2],1w=A[0],18=A[1],1a=A[2];9 x=1w-b,y=18-1E,z=1a-1J;8 11.u([b+R[0][0]*x+R[0][1]*y+R[0][2]*z,1E+R[1][0]*x+R[1][1]*y+R[1][2]*z,1J+R[2][0]*x+R[2][1]*y+R[2][2]*z],[R[0][0]*N[0]+R[0][1]*N[1]+R[0][2]*N[2],R[1][0]*N[0]+R[1][1]*N[1]+R[1][2]*N[2],R[2][0]*N[0]+R[2][1]*N[1]+R[2][2]*N[2]])},1t:l(a){o(a.W){9 A=7.K.4,N=7.W.4;9 b=A[0],18=A[1],1a=A[2],2M=N[0],2L=N[1],2Q=N[2];9 c=7.K.1t(a).4;9 d=b+2M,2p=18+2L,2m=1a+2Q;9 Q=a.1r([d,2p,2m]).4;9 e=[Q[0]+(Q[0]-d)-c[0],Q[1]+(Q[1]-2p)-c[1],Q[2]+(Q[2]-2m)-c[2]];8 11.u(c,e)}1d o(a.U){8 7.1V(F.1A,a)}1d{9 P=a.4||a;8 11.u(7.K.1t([P[0],P[1],(P[2]||0)]),7.W)}},1Z:l(a,b,c){a=v.u(a);a=a.1N();o(a===w){8 w}b=v.u(b);b=b.1N();o(b===w){8 w}o(1g(c)==\'1f\'){c=w}1d{c=v.u(c);c=c.1N();o(c===w){8 w}}9 d=a.4[0],18=a.4[1],1a=a.4[2];9 e=b.4[0],1W=b.4[1],1X=b.4[2];9 f,1i;o(c!==w){9 g=c.4[0],2l=c.4[1],2t=c.4[2];f=v.u([(1W-18)*(2t-1a)-(1X-1a)*(2l-18),(1X-1a)*(g-d)-(e-d)*(2t-1a),(e-d)*(2l-18)-(1W-18)*(g-d)]);1i=f.1u();o(1i===0){8 w}f=v.u([f.4[0]/1i,f.4[1]/1i,f.4[2]/1i])}1d{1i=F.1x(e*e+1W*1W+1X*1X);o(1i===0){8 w}f=v.u([b.4[0]/1i,b.4[1]/1i,b.4[2]/1i])}7.K=a;7.W=f;8 7}};11.u=l(a,b,c){9 P=25 11();8 P.1Z(a,b,c)};11.2I=11.u(v.1j(3),v.k);11.2H=11.u(v.1j(3),v.i);11.2G=11.u(v.1j(3),v.j);11.36=11.2I;11.35=11.2H;11.3j=11.2G;9 $V=v.u;9 $M=S.u;9 $L=14.u;9 $P=11.u;',62,206,'||||elements|||this|return|var||||||||||||function|||if||length||||create|Vector|null|||||||||Math|nj|while||do|anchor||||||||Matrix||direction||normal||||kj|Plane|ni|abs|Line|ki|precision|Sylvester|A2|push|A3|map|els|else||undefined|typeof|contains|mod|Zero|D3|D2|isParallelTo|kp|distanceFrom|cols|dup|pointClosestTo|np|reflectionIn|modulus|intersects|A1|sqrt|isSquare|X2|PI|X3|angleFrom|mod1|C2|mod2|sin|cos|break|C3|toRightTriangular|false|Y3|to3D|E2|E1|E3|Rotation|Y2|Y1|intersectionWith|rotate|v12|v13|rank|setVectors|nc|sum|multiply|prototype|eql|new|setElements|case|each|PA3|PA2|part|new_element|round|for|cross|product|AD2|isSameSizeAs|add|isPerpendicularTo|v22|AN3|inspect|AD3|AN2|toUnitVector|PsubQ3|PsubQ2|v23|dot|divisor|inverse|true|isSingular|determinant|max|canMultiplyFromLeft|subtract|rows|col|random|ZX|YZ|XY|Random|join|N2|N1|D1|slice|default|N3|dimensions|switch|liesIn|translate|snapTo|augment|Diagonal|trace|indexOf|diagonal|transpose|minor|row|isAntiparallelTo|ZY|YX|acos|RotationZ|RotationY|liesOn|RotationX|inv|rk|tr|det|toDiagonalMatrix|toUpperTriangular|version|XZ'.split('|'),0,{}));

})(jQuery);