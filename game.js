//mostly from http://codeincomplete.com/posts/2012/6/23/javascript_racer_v1_straight/
//minor modifications mine

var Game = {
    run : function( options ) {
        Game.loadImages( options.images, function( images ) {
            var update = options.update,
                render = options.render,
                step   = options.step,
                now    = null,
                last   = Util.timestamp(),
                dt     = 0,
                gdt    = 0;

            function frame() {
                now = Util.timestamp();
                dt = Math.min( 1, ( now - last ) / 1000 );
                gdt += dt;
                while ( gdt > step ) {
                    gdt -= step;
                    update( step );
                }
                render();
                last = now;
                requestAnimationFrame( frame );
            }(); //self-execute frame
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

    setKeyListener: function( keys ) {
        var onkey = function( keyCode, mode ) {
            var n, k;

            //Dave: will this for-loop be called EVERY time a key is pressed? Seems inefficient.
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

    fps           : 60;                      // how many 'update' frames per second
    step          : 1/fps;                   // how long is each frame (in seconds)
    width         : 1024;                    // logical canvas width
    height        : 768;                     // logical canvas height
    segments      : [];                      // array of road segments
    canvas        : Dom.get('canvas');       // our canvas...
    ctx           : canvas.getContext('2d'); // ...and its drawing context
    background    : null;                    // our background image (loaded below)
    sprites       : null;                    // our spritesheet (loaded below)
    resolution    : null;                    // scaling factor to provide resolution independence (computed)
    roadWidth     : 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
    segmentLength : 200;                     // length of a single segment
    rumbleLength  : 3;                       // number of segments per red/white rumble strip
    trackLength   : null;                    // z length of entire track (computed)
    lanes         : 3;                       // number of lanes
    fieldOfView   : 100;                     // angle (degrees) for field of view
    cameraHeight  : 1000;                    // z height of camera
    cameraDepth   : null;                    // z distance camera is from screen (computed)
    drawDistance  : 300;                     // number of segments to draw
    playerX       : 0;                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
    playerZ       : null;                    // player relative z distance from camera (computed)
    fogDensity    : 5;                       // exponential fog density
    position      : 0;                       // current camera Z position (add playerZ to get player's absolute Z position)
    speed         : 0;                       // current speed
    maxSpeed      : segmentLength/step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
    accel         :  maxSpeed/5;             // acceleration rate - tuned until it 'felt' right
    breaking      : -maxSpeed;               // deceleration rate when braking
    decel         : -maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
    offRoadDecel  : -maxSpeed/2;             // off road deceleration is somewhere in between
    offRoadLimit  :  maxSpeed/4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)

}