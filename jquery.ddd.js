$.ddd = function(selector) {
  this.$ = $(String(selector));
  if (!this.$) {
    //   this.scaleBy     = this.scaleTo 
    // = this.translateBy = this.translateTo 
    // = this.rotateBy    = this.rotateTo
    // = this.animate = function() {

    // }
    return this;
  }

  return this;

  //return $ddd;

  // this.$ = $ddd;
}

$.ddd.scaleBy = function(/* args */) {
  // args can be [ int/string, string ]
  // or [ object ]

  if (!arguments.length) { return this; }

  var args;

  console.log('scaleBy arguments', arguments);
  console.log('isObject arguments', $.isObject(arguments));

  if ($.isObject(arguments)) {
    args = $.extend(arguments);
  }
}