/*
Copyright (c) 2011 Sean Cusack

MIT-LICENSE:

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function($){

	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Default settings
	//

	var DEBUG = false;
	var VISUAL_DEBUG = DEBUG;

	$.ui.draggable.prototype.options.obstacle          = ".ui-draggable-collision-obstacle";
	$.ui.draggable.prototype.options.restraint         = ".ui-draggable-collision-restraint";
	$.ui.draggable.prototype.options.collider          = ".ui-draggable-dragging";
	$.ui.draggable.prototype.options.colliderData      = null;
	$.ui.draggable.prototype.options.obstacleData      = null;
	$.ui.draggable.prototype.options.directionData     = null;
	$.ui.draggable.prototype.options.relative          = "body";
	$.ui.draggable.prototype.options.preventCollision  = false;
	$.ui.draggable.prototype.options.preventProtrusion = false;
	$.ui.draggable.prototype.options.collisionVisualDebug = false;
	$.ui.draggable.prototype.options.multipleCollisionInteractions = [];

	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Plugin setup
	//

	$.ui.plugin.add( "draggable", "obstacle", {
		create: function(event,ui){       handleInit   .call( this, event, ui ); },
		start: function(event,ui){        handleStart  .call( this, event, ui ); } ,
		drag:  function(event,ui){ return handleCollide.call( this, event, ui ); } ,
		stop:  function(event,ui){        handleCollide.call( this, event, ui );
																			handleStop   .call( this, event, ui ); }
	});

	// NOTE: the "handleCollide" function must do all collision and protrusion detection at once, in order for the
	//       simultaneous prevention cases to work properly, so basically, if you ask for both, the obstacle events
	//       will occur first (and do both), and then these will trigger, see that they have an obstacle, and not
	//       do anything a second time
	$.ui.plugin.add( "draggable", "restraint", {
		create: function(event,ui){         handleInit   .call( this, event, ui ); },
		start: function(event,ui){ if( ! $(this).data("draggable").options.obstacle ) // if there are obstacles, we already handled both
															 {        
																				handleStart  .call( this, event, ui );
															 }
														 } ,
		drag:  function(event,ui){ if( ! $(this).data("draggable").options.obstacle ) // if there are obstacles, we already handled both
															 { 
																 return handleCollide.call( this, event, ui ); 
															 }
														 } ,
		stop:  function(event,ui){ if( ! $(this).data("draggable").options.obstacle ) // if there are obstacles, we already handled both
															 {
																				handleCollide.call( this, event, ui );
																				handleStop   .call( this, event, ui );
															 }
														 }
	});

	// Likewise, if we already have an obstacle or restraint, we've done it all, so don't repeat
	$.ui.plugin.add( "draggable", "multipleCollisionInteractions", {
		create: function(event,ui){         handleInit   .call( this, event, ui ); },
		start: function(event,ui){ if( ! $(this).data("draggable").options.obstacle &&
																	 ! $(this).data("draggable").options.restraint   )
															 {       
																				handleStart  .call( this, event, ui );
															 }
														 } ,
		drag:  function(event,ui){ if( ! $(this).data("draggable").options.obstacle &&
																	 ! $(this).data("draggable").options.restraint   )
															 { 
																 return handleCollide.call( this, event, ui ); 
															 }
														 } ,
		stop:  function(event,ui){ if( ! $(this).data("draggable").options.obstacle &&
																	 ! $(this).data("draggable").options.restraint   )
															 {
																				handleCollide.call( this, event, ui );
																				handleStop   .call( this, event, ui );
															 }
														 }
	});


	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Private Classes
	//

	////////////
	// EVENTS //
	////////////

	function CollisionEvent( eventType, collider, obstacle, collisionType, collision )
	{
		jQuery.Event.call( this, eventType );
		this.collider  = collider;
		this.obstacle  = obstacle; 
		this.collisionType = collisionType;
		this.collision = collision;
	}

	CollisionEvent.prototype = new $.Event( "" );

	function CollisionCheckEvent( eventType, collider, obstacle, collisionType )
	{
		jQuery.Event.call( this, eventType );
		this.collider  = collider;
		this.obstacle  = obstacle; 
		this.collisionType = collisionType;
	}

	CollisionCheckEvent.prototype = new $.Event( "" );

	//////////////////////
	// COORDINATE CLASS //
	//////////////////////

	function Coords( x1, y1, x2, y2 )
	{
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2; 
		this.y2 = y2;
	}

	Coords.prototype.width   = function() { return (this.x2-this.x1);   }
	Coords.prototype.height  = function() { return (this.y2+this.y1);   }
	Coords.prototype.centerx = function() { return (this.x1+this.x2)/2; }
	Coords.prototype.centery = function() { return (this.y1+this.y2)/2; }
	Coords.prototype.area    = function() { return this.width()*this.height(); }
	Coords.prototype.hash    = function() { return "["+[this.x1,this.y1,this.x2,this.y2].join(",")+"]" }
	Coords.prototype.distance = function(c)  
	{ 
		return this.distanceTo( c.centerx(), c.centery() );
	}
	Coords.prototype.distanceTo = function(x,y)  
	{ 
		var dx = this.centerx()-x;
		var dy = this.centerx()-y;
		return Math.sqrt( dx*dx + dy*dy );
	}

	/////////////////////////////////
	// COORDINATE HELPER FUNCTIONS //
	/////////////////////////////////

	// create a box with the same total area, centered at center of gravity
	function centerGravity( coordsList )
	{
		if( coordsList.length <= 0 ) return null;
		var wsumx = 0;
		var wsumy = 0;
		var suma  = 0;
		for( var i = 0; i < coordsList.length; i++ )
		{
			suma += coordsList[i].area();
			wsumx += coordsList[i].centerx() * coordsList[i].area();
			wsumy += coordsList[i].centery() * coordsList[i].area();
		}
		var d = Math.sqrt( suma ); // dimension of square (both w and h)
		return new Coords( (wsumx/suma) - d/2, (wsumy/suma) - d/2, (wsumx/suma) + d/2, (wsumy/suma) + d/2 );
	}

	// convert a jq object into a Coords object, handling all the nice-n-messy offsets and margins and crud
	function jq2Coords( jq, dx, dy )
	{
		if( !dx ) dx=0;
		if( !dy ) dy=0;
		if( jq.parent().length > 0 )
		{
			var x1 = dx + jq.offset().left - (parseInt(jq.css("margin-left"))||0);
			var y1 = dy + jq.offset().top  - (parseInt(jq.css("margin-top" ))||0);
			var x2 = x1 + jq.outerWidth( true);
			var y2 = y1 + jq.outerHeight(true);
		}
		else
		{
			var x1 = dx + parseInt(jq.css("left"  )) || 0;
			var y1 = dy + parseInt(jq.css("top"   )) || 0;
			var x2 = x1 + parseInt(jq.css("width" )) || 0;
			var y2 = y1 + parseInt(jq.css("height")) || 0;
			x2 += (parseInt(jq.css("margin-left"))||0) + (parseInt(jq.css("border-left"))||0) + (parseInt(jq.css("padding-left"))||0) + 
						(parseInt(jq.css("padding-right"))||0) + (parseInt(jq.css("border-right"))||0) + (parseInt(jq.css("margin-right"))||0);
			y2 += (parseInt(jq.css("margin-top"))||0) + (parseInt(jq.css("border-top"))||0) + (parseInt(jq.css("padding-top"))||0) + 
						(parseInt(jq.css("padding-bottom"))||0) + (parseInt(jq.css("border-bottom"))||0) + (parseInt(jq.css("margin-bottom"))||0);

		}
		return new Coords( x1, y1, x2, y2 );
	}

	function jqList2CenterGravity( jqList, dx, dy )
	{
		return centerGravity( jqList.toArray().map( function(e,i,a){ return jq2Coords($(e),dx,dy); } ) );
	}

	/////////////////////
	// COLLISION CLASS //
	/////////////////////

	function Collision( jq, cdata, odata, type, dx, dy, ddata, recentCenterOfGravity, mousex, mousey )
	{
		if(!recentCenterOfGravity) recentCenterOfGravity=jqList2CenterGravity($(this.collider), dx, dy);
		if(!dx) dx = 0;
		if(!dy) dy = 0;
		this.collision = $(jq            );
		this.collider  = $(jq.data(cdata));
		this.obstacle  = $(jq.data(odata));
		this.direction =   jq.data(ddata);
		this.type      = type;
		this.dx        = dx;
		this.dy        = dy;
		this.centerOfMass    = recentCenterOfGravity;
		this.collisionCoords = jq2Coords( this.collision );
		this.colliderCoords  = jq2Coords( this.collider,  dx, dy );
		this.obstacleCoords  = jq2Coords( this.obstacle  );
		if(!mousex) mousex = this.colliderCoords.centerx();
		if(!mousey) mousex = this.colliderCoords.centery();
		this.mousex = mousex;
		this.mousey = mousey;
	}

	// amount "embedded" into obstacle in x-direction
	// might be negative or zero if it doesn't make sense
	// this is used with the delta calculation - if its <= 0, it'll get skipped
	// dirx is -1 or +1, depending on which way we are orienting things (which way we want to move it)
	// NOTE: originally, we were taking the collision area into account, but it's easier to recalc embed value
	Collision.prototype.embedx = function( dirx )
	{
		if( this.type == "collision" )
		{
			if( dirx < 0 ) /* want to move left  */ return this.colliderCoords.x2 - this.obstacleCoords.x1;
			if( dirx > 0 ) /* want to move right */ return this.obstacleCoords.x2 - this.colliderCoords.x1;
		}
		else if( this.type == "protrusion" )
		{
			// if we're embedded in a top/bottom edge, don't move left or right, silly:
			if( ( this.direction == "N" ) || ( this.direction == "S" ) ) return 0; 

			if( dirx < 0 ) /* want to move left  */ return this.colliderCoords.x2 - this.obstacleCoords.x2;
			if( dirx > 0 ) /* want to move right */ return this.obstacleCoords.x1 - this.colliderCoords.x1;
		}
		return 0;
	}

	// and ditto for y-direction
	Collision.prototype.embedy = function( diry )
	{
		if( this.type == "collision" )
		{
			if( diry < 0 ) /* want to move up   */ return this.colliderCoords.y2 - this.obstacleCoords.y1;
			if( diry > 0 ) /* want to move down */ return this.obstacleCoords.y2 - this.colliderCoords.y1;
		}
		else if( this.type == "protrusion" )
		{
			// if we're embedded in a left/right edge, don't move up or down, silly:
			if( ( this.direction == "E" ) || ( this.direction == "W" ) ) return 0;

			if( diry < 0 ) /* want to move up   */ return this.colliderCoords.y2 - this.obstacleCoords.y2;
			if( diry > 0 ) /* want to move down */ return this.obstacleCoords.y1 - this.colliderCoords.y1;
		}
		return 0;
	}

	// distance from collision to recent center of mass, i.e. it used to be in one place, and we're dragging it
	// to another, so the "overlap" of some collider happens a certain "distance" from the center of where stuff
	// used to be...
	Collision.prototype.distance = function()
	{
		var cx1 = this.centerOfMass.centerx();
		var cy1 = this.centerOfMass.centery();
		var cx2 = this.collisionCoords.centerx();
		var cy2 = this.collisionCoords.centery();
		return Math.sqrt( (cx2-cx1)*(cx2-cx1) + (cy2-cy1)*(cy2-cy1) );
	};

	Collision.prototype.hash = function(){ return this.type+"["+this.colliderCoords.hash()+","+this.obstacleCoords.hash()+"]"; }

	////////////////////////////////
	// COLLISION HELPER FUNCTIONS //
	////////////////////////////////

	// sort so that collisions closest to recent center of mass come first -- we need to resolve them in order
	function collisionComparison(c1,c2)
	{
		var cd1 = c1.distance();
		var cd2 = c2.distance();
		return ( ( cd1 < cd2 ) ? -1 : ( cd1 > cd2 ) ? +1 : 0 );
	};

	///////////////////////
	// INTERACTION CLASS //
	///////////////////////

	function Interaction( draggable, options )
	{
		this.draggable         = $(draggable);
		this.obstacleSelector  =   options.obstacle        || ".ui-draggable-collision-obstacle"   ;
		this.restraintSelector =   options.restraint       || ".ui-draggable-collision-restraint"  ;
		this.obstacle          = $(options.obstacle        || ".ui-draggable-collision-obstacle"  );
		this.restraint         = $(options.restraint       || ".ui-draggable-collision-restraint" );
		var  collider          =   options.collider        || ".ui-draggable-dragging"             ;
		this.collider          = draggable.find( collider ).andSelf().filter( collider );
		this.colliderData      = options.colliderData      || null;
		this.obstacleData      = options.obstacleData      || null;
		this.directionData     = options.directionData     || null;
		this.relative          = options.relative          || "body";
		this.preventCollision  = options.preventCollision  || false;
		this.preventProtrusion = options.preventProtrusion || false;
		this.collisions        = $();
		this.protrusions       = $();
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Main handler functions
	//

	function uiTrigger( _this, widget, eventName, event, ui )
	{
		$.ui.plugin.call( widget, eventName, event, ui );
		_this.trigger( event, ui );
	}

	function handleInit( event, ui, type )
	{
		var w = $(this).data("draggable");
		var o = w.options;
	}

	function handleStart(event,ui)
	{
		VISUAL_DEBUG = $(this).data("draggable").options.collisionVisualDebug;
		$(this).data( "jquery-ui-draggable-collision-recent-position", ui.originalPosition ); 
	}

	function handleStop (event,ui)
	{ 
		$(this).removeData("jquery-ui-draggable-collision-recent-position");
		if( VISUAL_DEBUG ) $(".testdebug").remove();
		VISUAL_DEBUG = DEBUG;
	}

	// This is the monolithic workhorse of the plugin:
	//   * At the beginning and end, it sends out all the pre/post-collision/protrusion events
	//   * In the middle, it both calculates collisions, and prevents them if requested
	//   * When it's either tried its best, or found a fit, or wasn't required to avoid obstacles, it sends out actual collision events
	//
	// Inside the first big loop is the actual "prevention" logic
	//   * It calculates the "intended position" of everything, checks all the collision logic, and if it needs to,
	//     then calculates a delta movement to see if that fits, and the loop continues until it either works,
	//     or an arbitrary iteration limit is reached, just in case it gets in a loop
	//   * The delta function is described in more detail below
	//
	// During all the "trying a new position" and "determining collisions" calculations, it's not using purely the
	//   current position of the colliders -- it can't because the draggable is now in a new "intended position",
	//   and with it, all its children, including any collider children
	//   * So, it keeps track of a dx and dy from known position, and populates a "jquery-collision-coordinates" data value
	//     that the jquery-collision plugin takes into account during the calculations
	//   * Also, the Coords() values get populated with these offsets at various times, so that they reflect "intended position"
	//
	// Note also that the collider, obstacle, and direction data fields are temporarily overriden (because we need them here,
	//   and the user may not have asked for them), and then erased and placed where the user wants them, right before
	//   sending out the collision events
	//
	// Note also that the collisions and protrusions requested are "relative" to "body". If the use asked for
	// something relative, it has to get translated right before sending out the events...
	function handleCollide( event, ui )
	{
		// Note that $(this) is the draggable that's moving - it has a ui.position that moves acording to where
		// the draggable is "about to move". However, our "collidable" objects might not be the same as $(this) -
		// they might be child elements. So we need to keep track of recent and present position so we can apply the
		// "intended" dx and dy to all the moving elements:
		var rp = $(this).data("jquery-ui-draggable-collision-recent-position");

		if( DEBUG ) { console.log( "handleCollision ******************************************************************" ); }

		if( VISUAL_DEBUG ) $(".testdebug").remove();

		var ctyp  =     "collision";
		var prec  =  "precollision";
		var postc = "postcollision";
		var ptyp  =     "protrusion";
		var prep  =  "preprotrusion";
		var postp = "postprotrusion";

		// NOTE: widget is used for uiTrigger, otherwise event-binders don't get a "ui" variable
		var widget = $(this).data("draggable");
		var o      = widget.options;

		// List of Interactions -- first one is the main set of args from the .draggable() setup call, rest are multipleCollisionInteractions:[...]
		var ilist  = [];
		
		if( o.obstacle || o.restraint ) ilist.push( new Interaction( $(this), o ) );
		if( o.multipleCollisionInteractions && o.multipleCollisionInteractions["length"] )
		{
			var mci = o.multipleCollisionInteractions;
			for( var i=0; i<mci.length; i++ )
				ilist.push( new Interaction( $(this), mci[i] ) );
		}

		if( ilist.length <= 0 )
		{
			// Just forget the whole stpuid business - why are we in here, anyways - no interactions to check
			// Cache the current position anyways, and jump out:
			$(this).data( "jquery-ui-draggable-collision-recent-position", ui.position );
			return;
		}

		var d1 = "ui-draggable-collision-collider-temp";
		var d2 = "ui-draggable-collision-obstacle-temp";
		var d3 = "ui-draggable-collision-direction-temp";
		var di = "ui-draggable-collision-interaction-temp";
		var d  = event.data;
		var as = "<div />";
		if( d && d.as ) as = d.as;

		var e;

		// Try moving things twice the number of colliders times obstacles+restraints, plus 1 original attempt
		// We need to calculate maxiter here because there may be several levels of interactions
		// (Honestly, anything will do, just need a reasonable cutoff)
		var maxiter = 1;

		// Global just-about-to-check-collisions event:
		for( var i=0; i<ilist.length; i++ )
		{
			maxiter += 2 * ilist[i].collider.length * ( ilist[i].obstacle.length + ilist[i].restraint.length );

			if( VISUAL_DEBUG )
			{
				ilist[i].obstacle .each(function(){$(this).clone().removeClass().empty().addClass("testdebug").css("pointer-events","none")
																									.css("background","transparent").css("padding","0px")
																									.css("border","1px solid black"  ).css("margin","-1px")
																									.appendTo($(this).parent());});
				ilist[i].restraint.each(function(){$(this).clone().removeClass().empty().addClass("testdebug").css("pointer-events","none")
																									.css("background","transparent").css("padding","0px")
																									.css("border","1px solid magenta").css("margin","-1px")
																									.appendTo($(this).parent());});
			}

			if( ilist[i].obstacleSelector )
			{
				e = new CollisionCheckEvent( prec, $(this), ilist[i].obstacle, ctyp )
				uiTrigger( ilist[i].collider, widget, prec, e, ui );
			}

			if( ilist[i].restraintSelector )
			{
				e = new CollisionCheckEvent( prep, $(this), ilist[i].restraint, ptyp )
				uiTrigger( ilist[i].collider, widget, prep, e, ui );
			}
		}

		var origleft = rp.left;
		var origtop  = rp.top;
		var origdx = ui.position.left - rp.left;
		var origdy = ui.position.top  - rp.top;
		var dx;
		var dy;
		var ocl  = []; // list of Collision()'s total
		var cocl = []; // list of Collision()'s just from collisions
		var pocl = []; // list of Collision()'s just from protrusions
		var ccl  = []; // list of Collision()'s just from containment (also a protrusion)

		// Check if there's containment for the draggable:
		var $cont = $();
		if( widget.containment )
		{
			maxiter += 2; // the main draggable container times twice the number of containers (1)

			var cn = widget.containment;
			$cont = $("<div />").offset( { left: cn[0], top: cn[1] } )
													.width(  cn[2]-cn[0]+$(this).width( ) )  // because it had the draggable's size chopped out :-P
													.height( cn[3]-cn[1]+$(this).height() ); // because it had the draggable's size chopped out :-P

			if( VISUAL_DEBUG )
				$cont.clone()
						 .css("background","transparent")
						 .css("border","1px solid blue")
						 .css("margin","-1px").css("padding","0px")
						 .addClass("testdebug")
						 .appendTo();
		}

		var deltaCache = {};
		var iter = 0;
		while( iter < maxiter )
		{
			iter++;

			// Calc offset from recent move, so we can move the objects that are "coming along for the ride" before calculating their
			// collisions. Otherwise the ui variable only keeps track of the main draggable, not its contents, which may contain
			// the actual things that collide
			dx = ui.position.left - rp.left;
			dy = ui.position.top  - rp.top;
	
			// Empty the collision containers outside the interaction loop:
			ocl = [];
			cocl = [];
			pocl = [];

			for( var i=0; i<ilist.length; i++ )
			{
				ilist[i].collisions  = $();
				ilist[i].protrusions = $();

				var $c = ilist[i].collider;
				var $o = ilist[i].obstacle;
				var $r = ilist[i].restraint;
				if( DEBUG ) console.log( "trying inter,c,o,r=",ilist[i],$c,$o,$r)

				// Add offset to coordinates before figuring out collisions, because we're basing it on "where its about to go", not "where it is":
				// (Don't do this for anything but colliders! Applying to obstacles or restrictions or containment screws things up!!)
				$c.each( function(){ $(this).data( "jquery-collision-coordinates", jq2Coords($(this),dx,dy) ); } );
		
				var cog = jqList2CenterGravity($c);
				for( var ci=0; ci<$c.length; ci++ )
				{
					// Calculate collisions separately from protrusions, as we might only prevent one or the other:
					var oc = $($c[ci]).collision( $o, { mode: "collision",  as: "<div />", colliderData: d1, obstacleData: d2, directionData: d3, relative: "body" } );
					if( DEBUG ) { console.log( "collisions", oc ); }

					// Add the interaction settings to their data, so we can pick it apart later:
					oc.data( di, ilist[i] );

					// And add the collisions to the interaction:
					ilist[i].collisions = ilist[i].collisions.add(oc);

					// And if there are any, make the appropriate Collision() objects and add them to the list
					if( oc.length > 0 )
					{
						cocl = oc.toArray().map( function(e,i,a){ return new Collision($(e), d1, d2, "collision" , dx, dy, d3, cog, event.pageX, event.pageY ); } );
						ocl = ocl.concat( cocl );
						if(VISUAL_DEBUG) $("<span>c"+iter+"</span>").appendTo(oc.addClass("testdebug").css("position","absolute").css("padding","0px")
																												.css("border","1px solid black").css("margin","-1").appendTo("body"));
					}

					// Calculate protrusions likewise:
					oc     = $($c[ci]).collision( $r, { mode: "protrusion", as: "<div />", colliderData: d1, obstacleData: d2, directionData: d3, relative: "body" } );
					if( DEBUG ) { console.log( "protrusions", oc ); }

					// Add the interaction settings to their data, so we can pick it apart later:
					oc.data( di, ilist[i] );

					// And add the protrusions to the interaction:
					ilist[i].protrusions = ilist[i].protrusions.add( oc );

					// And if there are any, make the appropriate Collision() objects and add them to the list
					if( oc.length > 0 )
					{
						pocl = oc.toArray().map( function(e,i,a){ return new Collision($(e), d1, d2, "protrusion", dx, dy, d3, cog, event.pageX, event.pageY ); } );
						ocl = ocl.concat( pocl );
						if(VISUAL_DEBUG) $("<span>p"+iter+"</span>").appendTo(oc.addClass("testdebug").css("position","absolute").css("padding","0px")
																												.css("border","1px solid magenta").css("margin","-1").appendTo("body"));
					}
				}
		
				// Now remove coordinate offsets before sending events, otherwise event results might futz with em:
				$c.each( function(){ $(this).removeData( "jquery-collision-coordinates" ); } );
			}

			if( widget.containment )
			{
				// Add offset to coordinates before figuring out collisions, because we're basing it on "where its about to go", not "where it is":
				// (Don't do this for anything but colliders! Applying to obstacles or restrictions or containment screws things up!!)
				$(this).each( function(){ $(this).data( "jquery-collision-coordinates", jq2Coords($(this),dx,dy) ); } );

				// Check protrusion from container as well
				// NOTE: since draggable plugin has already applied containment, if we accidentally move it outside, it won't fix it for us
				var $cc = $(this).collision( $cont, { mode: "protrusion", as: "<div />", colliderData: d1, obstacleData: d2, directionData: d3, relative: "body" } );
						ccl = $cc.toArray().map( function(e,i,a){ return new Collision($(e), d1, d2, "protrusion", dx, dy, d3, jqList2CenterGravity($c), event.pageX, event.pageY ); } );
				if(VISUAL_DEBUG) $("<span>x"+iter+"</span>").appendTo($cc.addClass("testdebug").css("position","absolute")
																											.css("padding","0px").css("border","1px solid blue").css("margin","-1").appendTo("body"));

				// Now remove coordinate offsets before sending events, otherwise event results might futz with em:
				$(this).each( function(){ $(this).removeData( "jquery-collision-coordinates" ); } );
			}

			if( DEBUG ) console.log("checking if we have any collisions at all...");
			// If there's no collisions, INCLUDING the container, stop now, don't keep doing stuff
			if( ( cocl.length <= 0 ) && ( pocl.length <= 0 ) && ( ccl.length <= 0 ) ) break;

			var doneAdjusting = true;

			// Go through each interaction -- if any of them break the prevention rule, we aren't done adjusting yet
			for( var i=0; i<ilist.length; i++ )
			{
				if( DEBUG ) console.log("checking adjustments for",ilist[i],"ccl=",ccl,
																"pc,cl,pp,pl=",ilist[i].preventCollision, ilist[i].collisions.length, ilist[i].preventProtrusion, ilist[i].protrusions.length);

				if( DEBUG ) console.log("checking if we overstepped our containment...");
				// If we aren't trying to prevent anything yet we SOMEHOW jumped our containment, stop - this shouldn't ever happen, DANGER, WILL ROBINSON!
				if( ( ! ilist[i].preventCollision ) && ( ! ilist[i].preventProtrusion ) && ( ccl.length > 0 ) )
				{
					if( DEBUG ) { console.log( "not trying to prevent anything, but jumped our containment", ilist[i] ); }
					doneAdjusting = false;
				}

				if( DEBUG ) console.log("checking if we want to block something we have collided with...");
				// More specifically, if aren't any collisions that we actually want to prevent, stop -- though we have to think of this in the opposite sense:
				// if we DO either 
				//   want to prevent collisions yet have a collision or containment failure, OR
				//   want to prevent protrusions yet have a protrusion or a containment failure,
				// then DON'T STOP
				if( ( ilist[i].preventCollision  && ( ( ilist[i].collisions .length > 0 ) || ( ccl.length > 0 ) ) ) ||
						( ilist[i].preventProtrusion && ( ( ilist[i].protrusions.length > 0 ) || ( ccl.length > 0 ) ) )    )
				{
					if( DEBUG ) { console.log( "trying to prevent something that we're still hitting", ilist[i] ); }
					doneAdjusting = false;
				}
			}

			if( doneAdjusting )
			{
				if( DEBUG ) { console.log( "done adjusting" ); }
				break;
			}

			if( DEBUG ) console.log("calculating delta with ocl,ccl=",ocl,ccl);
			// Calculate a delta to move, based on collisions+protrusions and containment
			var d = delta( ocl.concat(), ccl, deltaCache );

			if( DEBUG ) console.log("dx=",d.dx,"dy=",d.dy);
			// If there's nothing to do, stop -- it shouldn't happen if we had collisions, but...
			if( d.dx == 0 && d.dy == 0 ) break;

			// Apply the movement, and let the loop run again, to see if our proposed delta movement was any good
			ui.position.left += d.dx;
			ui.position.top  += d.dy;
		}

		dx = ui.position.left - rp.left;
		dy = ui.position.top  - rp.top;
		/* deactivated for now - doesn't seem to be needed - may revisit later:
			// if our new center of gravity is further from the mouse position than the last one, revert
			var origd = jqList2CenterGravity($c,origdx,origdy).distanceTo( event.pageX, event.pageY );
			var  newd = jqList2CenterGravity($c,    dx,    dy).distanceTo( event.pageX, event.pageY );
			if( newd > origd ) { console.log("center of gravity issue: ",origd,newd); } // add this to revert
		*/

		// If we failed to find a fit, revert to the previous position
		if( ( iter > maxiter ) ||                             // if we ran out of iterations, tough, revert
				( ccl.length > 0 ) ||                             // if we ran outside out containment, also revert
				( o.preventProtrusion && ( pocl.length > 0 ) ) || // if we have a protrusion and are trying to prevent protrusions, revert
				( o.preventCollision  && ( cocl.length > 0 ) ) )  // if we have a collision and are trying to prevent collisions, revert
		{
			if( DEBUG ) console.log("reverting, i=",iter,"maxiter=",maxiter,"cocl=",cocl,"cocl.len=",cocl.length,"pocl=",
															 pocl,"pocl.len=",pocl.length,"ccl=",ccl,"ccl.len=",ccl.length,
															 //"newd=",newd,"origd=",origd,
															 "origdx=",origdx,"origdy=",origdy,"dx=",dx,"dy=",dy);
			ui.position.left = origleft;
			ui.position.top  = origtop;
		}

		// NOW we can go through and actually send out the events -- we couldn't before, because we might have hit
		//   collisions multiple times during the course of trying to prevent them
		for( var ci=0; ci<ocl.length; ci++ )
		{
			var oc = ocl[ci]; // each ocl[n] is a Collision()
			for( var oci=0; oci<oc.collision.length; oci++ )
			{  
				var $occ    = $( oc.collision[oci] );

				// Remove our custom data elements that guaranteed us getting the data we needed
				var $coll   = $( $occ.data(d1) );
				var $obs    = $( $occ.data(d2) );
				var dir     =    $occ.data(d3);
				var inter   =    $occ.data(di);
				$occ.removeData(d1).removeData(d2).removeData(d3).removeData(di);

				// And add them back in if the user really wanted them after all
				if(        inter.colliderData  ) $occ.data( inter.colliderData,  $coll ); // not that useful, since event gets it, but meh
				if(        inter.obstacleData  ) $occ.data( inter.obstacleData,  $obs  ); // not that useful, since event gets it, but meh
				if( dir && inter.directionData ) $occ.data( inter.directionData, dir   );

				if( inter.relative && inter.relative != "body" )
				{
					var off = $occ.offset();
					var rel = inter.relative == "collider" ? $coll :
										inter.relative == "obstacle" ? $obs  :
																									 $(inter.relative);
					var ro  = rel.offset();
					$occ.offset( { left: off.left-ro.left, top: off.top-ro.top } );
				}

				// Send actual collision event - one per collision, i.e. per collider per collided:
				if( inter.obstacleSelector  && ( oc.type == "collision"  ) )
				{
					e = new CollisionEvent( ctyp, $coll, $obs, ctyp, $occ );
					uiTrigger( $coll, widget, ctyp, e, ui );
				}
				if( inter.restraintSelector && ( oc.type == "protrusion" ) )
				{
					e = new CollisionEvent( ptyp, $coll, $obs, ptyp, $occ );
					uiTrigger( $coll, widget, ptyp, e, ui );
				}
			}
		}

		// Global just-checked-collisions event:
		for( var i=0; i<ilist.length; i++ )
		{
			if( ilist[i].obstacleSelector )
			{
				e = new CollisionCheckEvent( postc, $(this), ilist[i].obstacle, ctyp )
				uiTrigger( ilist[i].collider, widget, postc, e, ui );
			}
			if( ilist[i].restraintSelector )
			{
				e = new CollisionCheckEvent( postp, $(this), ilist[i].restraint, ptyp )
				uiTrigger( ilist[i].collider, widget, postp, e, ui );
			}
		}

		// And put the resulting ui position in our cache, so that if we keep dragging, we'll know how far stuff moved since this time
		$(this).data( "jquery-ui-draggable-collision-recent-position", ui.position );
	}

	// This is the inner-loop collision-prevention function, called maxiter times inside handleCollide()
	// Its purpose is to determine a single [dx,dy] to move the whole list of colliders and draggable,
	//   in an attempt to fit them properly. Only one of dx or dy will be non-zero at a time.
	// The cache argument is a simple object passed in from handleCollide, and is used to store previously-
	//   -tried movements, so that it doesn't repeat itself. 
	//   * The most common repeat case is if a collider is stuck inbetween two obstacles, and the space isn't big 
	//     enough -- one iteration will have it clear obstacle A, but embed into obstacle B, and the next iteration
	//     will reverse it, and it will get nowhere quickly. 
	//   * The key for the hash is collider+obstacle coordinates, so the same collider won't avoid the same obstacle
	//     in the same way twice. (Actually three times, see below.)
	//   * Note that the value of the hash is either nothing, "tried normal", or "tried reverse"
	//     * Nothing means it hasn't been tried yet
	//     * Tried normal means it was tried once
	//     * Tried reverse means it was tried a second time
	// How does it determine how to move things around?
	//   * It calculates an "embed" value, i.e. how far the collider is "embedded" into the obstacle
	//   * And a direction, either towards center of gravity or away, depending on if it's a collision or protrusion
	//   * And it returns that
	// How does it choose what obstacle to avoid?
	//   * It first sorts all the "collisions" (remember, these are the actual overlapping regions) based on how
	//     far their centers of gravity are from the last known center of gravity of the draggable itself,
	//     which was passed in during the creation of the Collision objects
	//   * It looks at the last one first, so the furthest from the object -- that way, it's going to always reign
	//     it in towards the last known good value, otherwise "closer" obstacles might keep shoving it away forever
	//   * Next, it calculates the embed values in the x and y direction, and picks the smallest one -- so if it's
	//     embedded heavily in the x-direction and only a little in the y, it'll pick the y first (small changes are
	//     more likely to succeed)
	//   * If it's a negative value, it tries again, because the embed function does the sanity-checking if we
	//     tried to move it in a strange or useless way
	//   * Finally, this is why it tries each "position" twice -- because for each starting position, it tries the
	//     smaller movement first, but then it tries the larger one. That's why the cache keeps track of the
	//     "tried reverse" value
	// In the end, it returns a { dx:_, dy:_ } object, the handleCollision tries moving everything around, recalculates
	//   all the collisions, and calls this again to see what to do next
	// NOTE: you can't easily re-calc "real position" from the jquery objects, because they're tagged with data that has
	//       offsets that are used internally by the jquery-collision plugin, so only use the thisc.*Coords values
	function delta( collisions, containments, cache )
	{
		var c = collisions.concat(containments).sort( collisionComparison );
		if( VISUAL_DEBUG ) { if(!cache.deltanum){ cache.deltanum = 1; } };
		if( DEBUG ) { console.log( "collisions, in order: ", c.map(function(e,i,a){return e.collisionCoords.hash();}).join(",") ); }
		while( c.length > 0 )
		{
			// note _pop_ not _shift_. we want to grab furthest collision from center of mass first...
			// this one is likely the one causing the most problems, because something is embedded deeply into
			// some obstacle:
			var thisc = c.pop();
			var co = thisc.obstacleCoords;
			var cc = thisc.colliderCoords;
			var cv = thisc.collisionCoords;
			var ct = thisc.type;
			var cd = thisc.direction;
			var key = thisc.hash();
			var dirx = ( thisc.type=="protrusion" ? ( cc.centerx() > co.centerx() ? -1 : +1 )
																						: ( cc.centerx() > co.centerx() ? +1 : -1 ) );
			var diry = ( thisc.type=="protrusion" ? ( cc.centery() > co.centery() ? -1 : +1 )
																						: ( cc.centery() > co.centery() ? +1 : -1 ) );
			var dx = thisc.embedx( dirx );
			var dy = thisc.embedy( diry );
			if( DEBUG ) console.log("cv,cc,co,ct,dx,dy,thisc.dx,thisc.dy,dirx,diry,co.centerx,co.centery,cc.centerx,cc.centery,key=",
									cv.hash(),cc.hash(),co.hash(),ct,dx,dy,thisc.dx,thisc.dy,dirx,diry,co.centerx(),co.centery(),cc.centerx(),cc.centery(),key);
			var tryToAdjustDX = ( dx < dy );
			if(      key in cache && cache[key] == "tried reverse" ) { if( DEBUG ) console.log("but already tried reverse too...");
																																 continue; }
			else if( key in cache && cache[key] == "tried normal"  ) { if( DEBUG ) console.log("but already tried this...");
																																 tryToAdjustDX=!tryToAdjustDX; cache[key]="tried reverse";
																															 }
			else                                                     { cache[key]="tried normal"; }
			if( tryToAdjustDX )
			{
				if( VISUAL_DEBUG ) { $("<span>"+thisc.direction+"d"+cache.deltanum+".dx="+dx+"*"+dirx+"</span>").css("color","black").addClass("testdebug")
														 .css("position","absolute")
														 .css("white-space","nowrap").offset( { left: thisc.mousex, top: thisc.mousey + 20*(cache.deltanum-1) } ).appendTo("body"); cache.deltanum++; };
				if( dx <= 0 ) { c.push(thisc); continue; }
				return { "dx":dx*dirx, "dy":0 };
			}
			else
			{
				if( VISUAL_DEBUG ) { $("<span>"+thisc.direction+"d"+cache.deltanum+".dy="+dy+"*"+diry+"</span>").css("color","black").addClass("testdebug")
														 .css("position","absolute")
														 .css("white-space","nowrap").offset( { left: thisc.mousex, top: thisc.mousey + 20*(cache.deltanum-1) } ).appendTo("body"); cache.deltanum++; };
				if( dy <= 0 ) { c.push(thisc); continue; }
				return { "dx":0, "dy":dy*diry };
			}
		}
		return { "dx":0, "dy":0 };
	};

})(jQuery);
