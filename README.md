The $.ddd library is a simple tool for manipulating 3d HTML objects.

First, to get a 3d object in ddd context:

    var $cube = $.ddd('#my_cube');

You can store this variable and call ddd functions on it,
or you can chain the function call to the end of the $.ddd() selector.

It exposes three useful functions, and their aptly-named counterparts:

scaleBy(), rotateBy(), and translateBy()

or, if you prefer absolute frames of reference:

scaleTo(), rotateTo(), and translateTo()

They're called like this:

    $.ddd('#my_cube').scaleBy(50, 'x');
    $.ddd('#my_cube').scaleBy(50, 'y');
    $.ddd('#my_cube').scaleBy(50, 'xy');
    $.ddd('#my_cube').scaleBy({
       'x': 50, 'y': 100, 'z': 1337
    });

scaleTo() takes the same varieties of arguments, but instead of scaling *by* a certain number of pixels, it scales *to* that number.

Likewise, translateBy() & translateTo() as well as rotateBy() and rotateTo() take arguments in the same format.

The four translate & scale functions each take a number of pixels (e.g. 125 or '125px') or a percent ('15%').
The two rotate functions instead take a number of degrees (-45 or '-45deg').

These functions provide instantaneous 3d transformations, which can be useful on their own or in the step() function of animations.

$.ddd also includes an animation implementation called like this:

$.ddd('#my_cube').animate({
   'scaleBy':     [ 1.5, 'xy' ]
  ,'translateBy': [ 50, 'x' ]
  ,'rotateBy':    { 'x': 45 ,'y', 90, 'z': 180 }
}, 2000, 'easeInCirc', function() {
  // this callback fires on
  // animation completion
});

As you can see, the arrays/object of arguments in this .animate() call are the same as defined above, and correspond to their functions.

I hope you find this library useful!


scaleBy(1.5, 'xyz')
scaleBy({})
scaleTo(10, 'xy')
scaleTo({})

translateBy(40, 'x')
translateBy({})
translateTo(50, 'xy')
translateTo({})

$.ddd('#screenshot').rotateBy(45, 'x')
rotateBy(90, 'xy')
rotateBy({ 'x': 45, 'y': -28, 'z': 150 })
rotateBy({ 'x': 45, 'y': -28, 'z': 150 }, 2000, 'easeOutQuad')

$my_3d_object = $.ddd('#screenshot');
$my_3d_object.rotateBy(45, 'x');
$my_3d_object.translateBy(50, 'xy');

$.ddd.animate({
   'scaleBy': [ 1.5, 'xy' ]
  ,'translateBy': [ 50, 'xyz' ]
  ,'rotateBy': [{ 'x': 50, 'y', 25 }]
}, 2000, 'easeInCirc', function() {
  // complete callback
});


You can call ddd one of two main ways:
  `var ddd = $.ddd('#my-element');`
or
  `var ddd = $('#my-element').ddd();`

If you'd just like access to some of ddd's useful functions,
but don't want it in the context of a particular DOM node:
  var ddd = $.ddd();
Note that transformation calls won't work without a proper DOM context,
which can be set manually by `ddd.$ = $('#my-dom-node');`
If you use ddd this way, you are a hacker, and are own your own.