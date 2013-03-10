# $.ddd() - jQuery 3D

*version 0.2*

The jQuery $.ddd plugin is a useful tool for manipulating 3D HTML5 elements.

### Let's get $.ddd

You can call `$.ddd()` functions in one of two ways.

Get an HTML element in the `$.ddd()` context like this:

    var $cube = $.ddd('#my_cube');

or like this:

    var $cube = $('#my_cube').ddd();

You can store this as a variable and call ddd functions on it,
or you can chain the function call to the end of the $.ddd() selector.

### Using $.ddd functions

`$.ddd` currently exposes three main functions, and their aptly-named counterparts:

 - `scaleBy()`
 - `rotateBy()`
 - `translateBy()`

Or, if you prefer absolute frames of reference:

 - `scaleTo()`
 - `rotateTo()`
 - `translateTo()`

They can be called like this:

    $.ddd('#my_cube').translateTo(-100, 'y');

    $('#my_cube').ddd().rotateBy(45, 'z');

    $.ddd('#my_cube').scaleBy('100%', 'xy');

    $('#my_cube').ddd().translateTo({ y: 0, x: 150 });

The `To` functions take the same varieties of arguments as the `By` functions, but instead of scaling *by* a certain number of pixels, it scales *to* that number, as you might expect.

The four `translate` & `scale` functions each take a number of pixels (e.g. `125` or `'125px'`) or a percent (`'15%'`).
The two `rotate` functions instead take a number of degrees (`-45` or `'-45deg'`).

These functions provide instantaneous 3d transformations, which can be useful on their own or in the step() function of animations.

### Animations

For this reason, `$.ddd` also includes an animation implementation called like this:

    $.ddd('#my_cube').animate({
       'scaleBy':     [ 100, 'xy' ]
      ,'translateBy': [ 50, 'x' ]
      ,'rotateBy':    [ 45, 'z' ]
    }, 2000, 'easeInCirc', function() {
      // this callback fires on
      // animation completion
    });

As you can see, the first argument object corresponds to the functions described above. Similar to jQuery's own `.animate()`, this version takes a duration in the form of milliseconds, any of the jQuery easing functions, and an optional callback. Only the first two parameters are required.

### Hackers

Additionally, there are a number of helper functions exposed (but not documented yet) that you may find useful for parsing CSS matrices, manipulating quaternions, or doing basic vector math.

If you'd like access to these functions, but don't want the context of a particular DOM node, use:

    var ddd = $.ddd();


Note that transformation calls won't work without a proper DOM context (which can be set manually by `ddd.$ = $('#my-dom-node');`)