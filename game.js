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

            //Dave: will this for-loop be called EVERY time a key is pressed? Seems bad.
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
}
