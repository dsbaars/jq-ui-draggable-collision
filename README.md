JQuery UI Draggable Collision
==============================

## Installation ##

* Copy jquery-ui-draggable-collision.js or any specific or minified version of jquery-ui-draggable-collision(-x.x.x)(.min).js into your javascript directory
* Make sure that jquery 1.10.1 or later is somewhere accessible
* Make sure that jqueryui 10.4 or later is somewhere accessible
* Make sure that jquery-collision 1.0.1 or later is somewhere accessible
* Load jquery-ui-draggable-collision and its dependencies:
```html
<script src="../bower_components/jquery/dist/jquery.js"></script>
<script src="../bower_components/jquery-ui/ui/jquery-ui.js"></script>
<script src="../bower_components/jquery-collision/js/jquery-collision.js"></script>
<script src="../js/jquery-ui-draggable-collision.js"></script>
```
* After that, there are several new features available for `$(selector).draggable()`, and 6 new events for `$(selector).bind()`

### Activation ###

In order for any of the features of JQuery UI Draggable Collision to work, including the new events, one or more of the following
options must be used during the draggable plugin setup for a given selector:

```javascript
$(selector).draggable( {
    obstacle: 'some_obstacle_selector'
});

$(selector).draggable( {
    restraint: 'some_obstacle_selector'
});

$(selector).draggable( {
    multipleCollisionInteractions: [
        /* list of sets of options, see below */
    ]
});
```
## Events ##

All events are UI events, and bindable just like "drag":
```javascript
  $(draggable).bind(
    "collision",
    function(event,ui) {
      // $(this) is the draggable
      // event is one of the below types, see them for details and event.* contents
      // ui is the same as in "drag" et al
    }
  );
```

### Precollision ###

If there are any obstacles listed, all colliders that have obstacles get a precollision event at each drag step (start, drag, and stop)
just before the actual collision-detection is done. The reason for the PRE-collision event is in case you need to make adjustments to
the ui or event variable, or anything else, right before the collisions are calculated. Note: these events are always sent, regardless
of whether there is a collision, since the detection hasn't been done yet. Same goes for all the pre- and post- events.

-  __event.collider__ = the individual collider being checked for collision
-  __event.obstacle__ = the individual obstacle being checked for collision
-  __event.collisionType__ = "collision" or "protrusion"

### Preprotrusion ###

If any colliders have restraints listed, they get the same kind of event as precollision above. Same event data available.

### Postcollision ###

Same as precollision, but after the collision-detection and events, for each drag step (start, drag, and stop).

### Postprotrusion ###

Same as postcollision, but for colliders with protrusions.

### Collision ###

__If__ there is a collision between a collider and an obstacle, there is a collision event sent to the collider. It contains the same
information as the pre- and post-collision events, but also:

  event.collision = the `$("<div />")` collision object located at the overlap coordinates

### Protrusion ###

__If__ there is a protrusion of a collider from a restraint, there is a collision event sent to the collider. It contains the same
information as the pre- and post-collision events, but also:

  event.collision = the `$("<div />") `collision object located at the overlap coordinates

  event.obstacle = restraint, just a reminder that it's not a separate event.restraint variable

## Options ##

### collider: $("any selector") ###

Normally, the default is for the draggable itself to be the collider. It's the thing that registers collisions with obstacles or
protrusions from restraints. However, if you specify a selector here, then any *children* of the draggable (or itself) that matches
that selector become the items that can collide or protrude. So for example, the draggable might be a transparent div with four
divs in it that look like a tetris block. The inner divs might be class="block". If you set "collider" to ".block", then the blocks
become the colliding entity. It's okay if there are other ".block" items on the page, because they aren't children of the
draggable.

A reminder: though "collider" objects have to physically be children of the draggable, the obstacles do not. (And should not.) In
fact, obstacles do not need to be siblings of draggable - only the global position of them makes a difference.

### obstacle: $("any selector") ###

This is the selector used to determine the things that the collider(s) might collide with.

### restraint: $("any selector") ###

This is the selector used to determine the things that the collider(s) might protrude from.

### multipleCollisionInteractions: [ { /*options*/ }, {}, {}, ... ] ###

Here's where it gets cool. You can specify an array of objects that contain any or all of the jquery-ui-draggable-collision options,
to apply them simultaneously to a single draggable selector. Why would you want to do this? This allows you to have different classes
of interactions. So for example, a single draggable could contain blue blocks that only collide with blue obstacles, AND ALSO red
blocks that only interact with red obstacles. If this option were not available, you couldn't have two different things going on at
the same time. But in the given example, red blocks would ignore blue obstacles and vice versa. For example:

```javascript
  $(draggable).draggable( multipleCollisionInteractions: [ { collider:  ".redCollider", obstacle:  ".redObstacle", preventCollision: true },
                                                           { collider: ".blueCollider", obstacle: ".blueObstacle", preventCollision: true } ] );
```
### preventCollision: true ###

When this is set, the colliders will try very, very hard not to ever overlap with any specified obstacle. I say very, very hard
because if it starts out already overlapping, and the algorithm for "finding a nice place to fit" doesn't find a spot within a reasonable
amount of time, it does eventually have to give up. That way, it won't hang if it's given silly settings. In that rare case, it will
send out collision events for the forced collisions. However, in most reasonable cases, the whole draggable will "flow around" the
obstacles smoothly.

### preventProtrusion: true ###

When this is set, the colliders stay within their restraints. Again with the above caveat, in case it's given an impossible situation.

## Carry-over options ##

Some options have been carried over from jquery-collision, and affect all collisions during the dragging process. For example:

  $(draggable).draggable( { obstacle: ".obstacle", relative: "collider", directionData: "ddata" } );

### relative: "body", "collider", "obstacle", or any selector ###

The event.collision object will be relative to this, in the same way that jquery-collision works.

### colliderData: "some_string" ###

Somewhat redundant, since event.collider contains this info, but this places the $(collider) in $(collision).data("some_string")

### obstacleData: "some_string" ###

Somewhat redundant, since event.obstacle contains this info, but this places the $(obstacle) in $(collision).data("some_string")

### directionData: "some_string" ###

This places the direction information in `$(collision).data("some_string").` See jquery-collision for more details.

* NOTE: "as" has not been carried over - it is always a "<div />"

* NOTE: "mode" has not been carried over - it is set by using "obstacle" and "restraint"

## Examples ##

__You need [bower](http://www.bower.io) to install dependencies__

* Run `bower install`
* Load the examples up in a browser

## DEBUGGING OPTIONS ##

### collisionVisualDebug: true ###

When this is set, it appends transparent divs to the end of the body tag during dragging, that correspond with the prevention mechanism. This
slows it down a bit, and should only be used for debugging, but it's there if needed. Obstacles are bordered with black, restraints are
bordered with magenta, and if there's a containment option set for the draggable, that's bordered in blue. Then there will be a bunch
of overlapping black, magenta, or blue boxes that correspond to the locations that it "tries to fit" the colliders into, during the process
of determining where it should flow to. The numbers increase with each successive attempt. The "c"/"p"/"x" correspond to failures to meet
collision, protrusion, or containment requirements. And the text that's dumped at the mouse position additionally contains the delta dx/dy
that are calculated before each attempt.

It looks neat to try, but it won't be useful unless you're actually debugging something.
