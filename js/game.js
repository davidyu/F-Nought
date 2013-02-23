//mostly from http://codeincomplete.com/posts/2012/6/23/javascript_racer_v1_straight/
//minor modifications mine

var Game = {
    run : function( options ) {
        Game.loadImages( options.images, function( images ) {

            options.ready(images);

            Game.setKeyListener(options.keys);

            var canvas = options.canvas,
                update = options.update,
                render = options.render,
                step   = options.step,
                now    = null,
                last   = Util.timestamp(),
                dt     = 0,
                gdt    = 0;

            var frame = function() {
                now = Util.timestamp();
                dt = Math.min( 1, ( now - last ) / 1000 );
                gdt += dt;
                while ( gdt > step ) {
                    gdt -= step;
                    update( step );
                }
                
                last = now;
                render( Settings.position );
                requestAnimationFrame( frame, canvas );

                
            }

            frame();
        } );
    },

    // load multiple images and callback when ALL images have loaded
    loadImages: function( names, callback ) {
        var result = [];
        var count  = names.length;

        var onload = function() {
          if ( --count == 0) //wait until everything's loaded
            callback( result );
        };

        //set up DOM elements and callbacks to preload images
        for(var n = 0; n < names.length; n++) {
            var name = names[n];
            result[n] = document.createElement('img');
            Dom.on(result[n], 'load', onload);
            result[n].src = "images/" + name + ".png";
        }
    },

    update: function( dt ) {

        var playerSegment = Settings.findSegment( Settings.position + Settings.playerZ );
        var speedPercent  = Settings.speed/Settings.maxSpeed;
        var dx = dt * 2 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second

        Settings.position = Util.increase( Settings.position, dt * Settings.speed, Settings.trackLength );        

        Settings.skyOffset  = Util.increase(Settings.skyOffset,  Settings.skySpeed  * playerSegment.curve * speedPercent, 1);
        Settings.hillOffset = Util.increase(Settings.hillOffset, Settings.hillSpeed * playerSegment.curve * speedPercent, 1);
        Settings.treeOffset = Util.increase(Settings.treeOffset, Settings.treeSpeed * playerSegment.curve * speedPercent, 1);

        if ( Settings.keyLeft )
            Settings.playerX -= dx;
        else if ( Settings.keyRight )
            Settings.playerX += dx;

        Settings.playerX -= (dx * speedPercent * playerSegment.curve * Settings.centrifugal);

        if ( Settings.keyFaster )
            Settings.speed = Util.accelerate( Settings.speed, Settings.accel, dt );
        else if ( Settings.keySlower )
            Settings.speed = Util.accelerate( Settings.speed, Settings.breaking, dt );
        else
            Settings.speed = Util.accelerate( Settings.speed, Settings.decel, dt );

        if ( ( ( Settings.playerX < -1 ) || ( Settings.playerX > 1 ) ) && ( Settings.speed > Settings.offRoadLimit ) )
            Settings.speed = Util.accelerate( Settings.speed, Settings.offRoadDecel, dt );

        Settings.playerX = Util.limit( Settings.playerX, -2, 2 );     // dont ever let player go too far out of bounds
        Settings.speed   = Util.limit( Settings.speed, 0, Settings.maxSpeed ); // or exceed maxSpeed

    },

    setKeyListener: function( keys ) {
        var onkey = function( keyCode, mode ) {
            var n, k;

            for( n = 0 ; n < keys.length ; n++ ) {
                k = keys[n];
                k.mode = k.mode || 'up';
                if ( ( k.key == keyCode ) || ( k.keys && ( k.keys.indexOf( keyCode ) >= 0 ) ) ) {
                    if ( k.mode == mode ) {
                        k.action.call();
                    }
                }
            }
        };

        Dom.on( document, 'keydown', function( ev ) { onkey( ev.keyCode, 'down' ); } );
        Dom.on( document, 'keyup',   function( ev ) { onkey( ev.keyCode, 'up' );   } );
    },

    playMusic: function() {
        var music = Dom.get( 'music' );
        music.loop = true;
        music.volume = 0.05; // shhhh! annoying music!
        music.muted = ( Dom.storage.muted === "true" );
        music.play();
        Dom.toggleClassName( 'mute', 'on', music.muted );
        Dom.on( 'mute', 'click', function() {
            Dom.storage.muted = music.muted = !music.muted;
            Dom.toggleClassName( 'mute', 'on', music.muted );
        } );
    }
}

var Settings = {

    fps           : 60,                      // how many 'update' frames per second
    step          : 1/60,                    // how long is each frame (in seconds)
    width         : 1024,                    // logical canvas width
    height        : 768,                     // logical canvas height
    centrifugal   : 0.3,                     // centrifugal force multiplier when going around curves
    offRoadDecel  : 0.99,                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
    skySpeed      : 0.001,                   // background sky layer scroll speed when going around curve (or up hill)
    hillSpeed     : 0.002,                   // background hill layer scroll speed when going around curve (or up hill)
    treeSpeed     : 0.003,                   // background tree layer scroll speed when going around curve (or up hill
    skyOffset     : 0,                       // current sky scroll offset
    hillOffset    : 0,                       // current hill scroll offset
    treeOffset    : 0,                       // current tree scroll offset
    segments      : [],                      // array of road segments
    canvas        : Dom.get('canvas'),       // our canvas...
    ctx           : this.canvas.getContext('2d'), // ...and its drawing context
    background    : null,                    // our background image (loaded below)
    sprites       : null,                    // our spritesheet (loaded below)
    resolution    : null,                    // scaling factor to provide resolution independence (computed)
    roadWidth     : 2000,                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
    segmentLength : 200,                     // length of a single segment
    rumbleLength  : 3,                       // number of segments per red/white rumble strip
    trackLength   : null,                    // z length of entire track (computed)
    lanes         : 3,                       // number of lanes
    fieldOfView   : 100,                     // angle (degrees) for field of view
    cameraHeight  : 1000,                    // z height of camera
    cameraDepth   : null,                    // z distance camera is from screen (computed)
    drawDistance  : 300,                     // number of segments to draw
    playerX       : 0,                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
    playerZ       : null,                    // player relative z distance from camera (computed)
    fogDensity    : 5,                       // exponential fog density
    position      : 0,                       // current camera Z position (add playerZ to get player's absolute Z position)
    speed         : 0,                       // current speed
    maxSpeed      : this.segmentLength/this.step,      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
    accel         :  this.maxSpeed/5,        // acceleration rate - tuned until it 'felt' right
    breaking      : -this.maxSpeed,               // deceleration rate when braking
    decel         : -this.maxSpeed/5,             // 'natural' deceleration rate when neither accelerating, nor braking
    offRoadDecel  : -this.maxSpeed/2,             // off road deceleration is somewhere in between
    offRoadLimit  :  this.maxSpeed/4,             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)

    //must call init! Some values in Settings null
    init: function() {
        this.fps           = 60;                      // how many 'update' frames per second
        this.step          = 1/this.fps;                   // how long is each frame (in seconds)
        this.width         = 1024;                    // logical canvas width
        this.height        = 768;                     // logical canvas height
        this.centrifugal   = 0.3;                     // centrifugal force multiplier when going around curves
        this.offRoadDecel  = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
        this.skySpeed      = 0.001;                   // background sky layer scroll speed when going around curve (or up hill)
        this.hillSpeed     = 0.002;                   // background hill layer scroll speed when going around curve (or up hill)
        this.treeSpeed     = 0.003;                   // background tree layer scroll speed when going around curve (or up hill
        this.skyOffset     = 0;                       // current sky scroll offset
        this.hillOffset    = 0;                       // current hill scroll offset
        this.treeOffset    = 0;                       // current tree scroll offset
        this.segments      = [];                      // array of road segments
        this.canvas        = Dom.get('canvas');       // our canvas...
        this.ctx           = this.canvas.getContext('2d'); // ...and its drawing context
        this.background    = null;                    // our background image (loaded below)
        this.sprites       = null;                    // our spritesheet (loaded below)
        this.resolution    = null;                    // scaling factor to provide resolution independence (computed)
        this.roadWidth     = 3000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
        this.segmentLength = 200;                     // length of a single segment
        this.rumbleLength  = 3;                       // number of segments per red/white rumble strip
        this.trackLength   = null;                    // z length of entire track (computed)
        this.lanes         = 6;                       // number of lanes
        this.fieldOfView   = 100;                     // angle (degrees) for field of view
        this.cameraHeight  = 1400;                    // z height of camera
        this.cameraDepth   = null;                    // z distance camera is from screen (computed)
        this.drawDistance  = 300;                     // number of segments to draw
        this.playerX       = 0;                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
        this.playerZ       = null;                    // player relative z distance from camera (computed)
        this.fogDensity    = 5;                       // exponential fog density
        this.position      = 0;                       // current camera Z position (add playerZ to get player's absolute Z position)
        this.speed         = 0;                       // current speed
        this.maxSpeed      = this.segmentLength/this.step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
        this.accel         =  this.maxSpeed/5;             // acceleration rate - tuned until it 'felt' right
        this.breaking      = -this.maxSpeed;               // deceleration rate when braking
        this.decel         = -this.maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
        this.offRoadDecel  = -this.maxSpeed/2;             // off road deceleration is somewhere in between
        this.offRoadLimit  =  this.maxSpeed/4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)

        this.keyLeft       = false;
        this.keyRight      = false;
        this.keyFaster     = false;
        this.keySlower     = false;
    },


    findSegment: function( z ) {
        return this.segments[ Math.floor( z/this.segmentLength ) % this.segments.length ];
    },

    lastY: function() {
        return ( this.segments.length == 0 ) ? 0 : this.segments[ this.segments.length - 1 ].p2.world.y;
    },

    resetRoad: function() {
        this.segments = [];

        this.addStraight( ROAD.LENGTH.SHORT/4 );
        this.addHill(ROAD.LENGTH.SHORT, ROAD.HILL.LOW);
        this.addLowRollingHills();
        this.addSCurves();
        this.addStraight( ROAD.LENGTH.LONG );
        this.addCurve( ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM );
        this.addCurve( ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM );
        this.addStraight();
        this.addSCurves();
        this.addCurve( ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM );
        this.addCurve( ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM );
        this.addStraight();
        this.addSCurves();
        this.addCurve( ROAD.LENGTH.LONG, -ROAD.CURVE.EASY );

        this.segments[ this.findSegment( this.playerZ ).index + 2 ].color = COLORS.START;
        this.segments[ this.findSegment( this.playerZ ).index + 3 ].color = COLORS.START;
        for(var n = 0 ; n < this.rumbleLength; n++)
            this.segments[ this.segments.length - 1 - n ].color = COLORS.FINISH;

        this.trackLength = this.segments.length * this.segmentLength;
    },

    reset: function( options ) {
      options       = options || {};
      this.canvas.width  = this.width  = Util.toInt(options.width,     this.width);
      this.canvas.height = this.height = Util.toInt(options.height,    this.height);
      this.lanes                  = Util.toInt(options.lanes,          this.lanes);
      this.roadWidth              = Util.toInt(options.roadWidth,      this.roadWidth);
      this.cameraHeight           = Util.toInt(options.cameraHeight,   this.cameraHeight);
      this.drawDistance           = Util.toInt(options.drawDistance,   this.drawDistance);
      this.fogDensity             = Util.toInt(options.fogDensity,     this.fogDensity);
      this.fieldOfView            = Util.toInt(options.fieldOfView,    this.fieldOfView);
      this.segmentLength          = Util.toInt(options.segmentLength,  this.segmentLength);
      this.rumbleLength           = Util.toInt(options.rumbleLength,   this.rumbleLength);
      this.cameraDepth            = 1 / Math.tan( ( this.fieldOfView / 2 ) * Math.PI / 180);
      this.playerZ                = ( this.cameraHeight * this.cameraDepth );
      this.resolution             = this.height / 480;

      if (( this.segments.length == 0) || (options.segmentLength) || (options.rumbleLength))
        this.resetRoad(); // only rebuild road when necessary
    },

    addSegment: function( curve, height ) {
        var n = this.segments.length;
        this.segments.push( { index: n,
                              p1: { world: { y: this.lastY(), z:  n   * this.segmentLength }, camera: {}, screen: {} },
                              p2: { world: { y: height,       z: (n+1)* this.segmentLength }, camera: {}, screen: {} },
                              curve: curve,
                              color: Math.floor( n / this.rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
                          } );
    },

    addRoad: function( enter, hold, leave, curve, height ) {
        var startY   = this.lastY();
        var endY     = startY + ( Util.toInt( height, 0 ) * this.segmentLength );
        var n, total = enter + hold + leave;

        for( n = 0 ; n < enter ; n++ ) {
            this.addSegment( Util.easeIn( 0, curve, n/enter ), Util.easeInOut( startY, endY, n / total ) );
        }

        for( n = 0 ; n < hold  ; n++ ) {
            this.addSegment( curve, Util.easeInOut( startY, endY, ( enter * n ) / total ) );
        }

        for( n = 0 ; n < leave ; n++ ) {
            this.addSegment( Util.easeInOut( curve, 0, n/leave ), Util.easeInOut( startY, endY, ( enter + hold + n ) / total ) );
        }
    },

    addStraight: function( num ) {
        num = num || ROAD.LENGTH.MEDIUM;
        this.addRoad( num, num, num, 0 );
    },

    addHill: function( num, height ) {
        num    = num    || ROAD.LENGTH.MEDIUM;
        height = height || ROAD.HILL.MEDIUM;
        this.addRoad( num, num, num, 0, height);
    },

    addLowRollingHills: function( num, height ) {
        num    = num    || ROAD.LENGTH.SHORT;
        height = height || ROAD.HILL.LOW;
        this.addRoad(num, num, num,  0,  height/2);
        this.addRoad(num, num, num,  0, -height);
        this.addRoad(num, num, num,  0,  height);
        this.addRoad(num, num, num,  0,  0);
        this.addRoad(num, num, num,  0,  height/2);
        this.addRoad(num, num, num,  0,  0);
    },

    addCurve: function( num, curve ) {
        num    = num    || ROAD.LENGTH.MEDIUM;
        curve  = curve  || ROAD.CURVE.MEDIUM;
        this.addRoad( num, num, num, curve );
    },

    addSCurves: function() {
        this.addRoad( ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,  -ROAD.CURVE.EASY,     ROAD.HILL.NONE   );
        this.addRoad( ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,   ROAD.CURVE.MEDIUM,   ROAD.HILL.MEDIUM );
        this.addRoad( ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,   ROAD.CURVE.EASY,    -ROAD.HILL.LOW    );
        this.addRoad( ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,  -ROAD.CURVE.EASY,     ROAD.HILL.MEDIUM );
        this.addRoad( ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,  -ROAD.CURVE.MEDIUM,  -ROAD.HILL.MEDIUM );
    },

    addDownhillToEnd: function( num ) {
        num = num || 200;
        this.addRoad( num, num, num, -ROAD.CURVE.EASY, -this.lastY() / this.segmentLength );
    }



}