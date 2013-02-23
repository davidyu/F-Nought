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
        var playerW       = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
        var dx = dt * 2 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second

        Game.updateCars( dt, playerSegment, playerW );

        Settings.position = Util.increase( Settings.position, dt * Settings.speed, Settings.trackLength );        

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

        for( n = 0 ; n < playerSegment.cars.length ; n++ ) {
            car  = playerSegment.cars[n];
            carW = car.sprite.w * SPRITES.SCALE;
            if ( Settings.speed > car.speed ) {
                if (Util.overlap( Settings.playerX, playerW, car.offset, carW, 0.8)) {
                    Settings.speed    = car.speed * ( car.speed / Settings.speed );
                    Settings.position = Util.increase( car.z, -Settings.playerZ, Settings.trackLength );
                    break;
                }
            }
        }

        Settings.skyOffset  = Util.increase(Settings.skyOffset,  Settings.skySpeed  * playerSegment.curve * speedPercent, 1);
        Settings.hillOffset = Util.increase(Settings.hillOffset, Settings.hillSpeed * playerSegment.curve * speedPercent, 1);
        Settings.treeOffset = Util.increase(Settings.treeOffset, Settings.treeSpeed * playerSegment.curve * speedPercent, 1);

        Settings.playerX = Util.limit( Settings.playerX, -2, 2 );     // dont ever let player go too far out of bounds
        Settings.speed   = Util.limit( Settings.speed, 0, Settings.maxSpeed ); // or exceed maxSpeed

    },

    updateCars: function( dt, playerSegment, playerW ) {
        var n, car, oldSegment, newSegment;
        for( n = 0 ; n < cars.length ; n++ ) {
            car         = cars[n];
            oldSegment  = Settings.findSegment(car.z);
            car.offset  = car.offset + this.updateCarOffset(car, oldSegment, playerSegment, playerW);
            car.z       = Util.increase(car.z, dt * car.speed, Settings.trackLength);
            car.percent = Util.percentRemaining( car.z, Settings.segmentLength ); // useful for interpolation during rendering phase
            newSegment  = Settings.findSegment( car.z );

            if ( oldSegment != newSegment ) {
                index = oldSegment.cars.indexOf( car );
                oldSegment.cars.splice( index, 1 );
                newSegment.cars.push( car );
            }
        }
    },

    updateCarOffset: function( car, carSegment, playerSegment, playerW ) {

        var i, j, dir, segment, otherCar, otherCarW,
            lookahead = 20,
            carW = car.sprite.w * SPRITES.SCALE;

        //don't steer/update AI cars if out of sight
        if ( ( carSegment.index - playerSegment.index ) > Settings.drawDistance )
            return 0;

        for(i = 1 ; i < lookahead ; i++) {
            segment = Settings.segments[ ( carSegment.index + i ) % Settings.segments.length ];

            if ( ( segment === playerSegment ) && ( car.speed > Settings.speed ) && (Util.overlap( Settings.playerX, playerW, car.offset, carW, 1.2 ) ) ) {

                if ( Settings.playerX > 0.5 ) {
                    dir = -1;
                } else if ( Settings.playerX < -0.5 ) {
                    dir = 1;
                } else {
                    dir = ( car.offset > Settings.playerX ) ? 1 : -1;
                }

                return dir * 1/i * ( car.speed-Settings.speed ) / Settings.maxSpeed; // the closer the cars (smaller i) and the greated the speed ratio, the larger the offset
            }

            for( j = 0 ; j < segment.cars.length ; j++ ) {
                otherCar  = segment.cars[j];
                otherCarW = otherCar.sprite.w * SPRITES.SCALE;
                if ( ( car.speed > otherCar.speed ) && Util.overlap( car.offset, carW, otherCar.offset, otherCarW, 1.2 ) ) {
                    if ( otherCar.offset > 0.5 )
                        dir = -1;
                    else if ( otherCar.offset < -0.5 )
                        dir = 1;
                    else
                        dir = ( car.offset > otherCar.offset ) ? 1 : -1;
                    return dir * 1 / i * ( car.speed-otherCar.speed ) / Settings.maxSpeed;
                }
            }
        }

        // if no cars ahead, but I have somehow ended up off road, then steer back on
        if (car.offset < -0.9) {
            return 0.1;
        } else if (car.offset > 0.9) {
            return -0.1;
        } else {
            return 0;
        }
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
    totalCars     : 200,

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
        this.totalCars     = 200;                     // total number of cars on the road


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

        this.resetSprites();
        this.resetCars();

        this.segments[ this.findSegment( this.playerZ ).index + 2 ].color = COLORS.START;
        this.segments[ this.findSegment( this.playerZ ).index + 3 ].color = COLORS.START;
        for(var n = 0 ; n < this.rumbleLength; n++)
            this.segments[ this.segments.length - 1 - n ].color = COLORS.FINISH;

        this.trackLength = this.segments.length * this.segmentLength;
    },

    resetSprites: function() {
      var n, i;

      this.addSprite(20,  SPRITES.BILLBOARD07, -1);
      this.addSprite(40,  SPRITES.BILLBOARD06, -1);
      this.addSprite(60,  SPRITES.BILLBOARD08, -1);
      this.addSprite(80,  SPRITES.BILLBOARD09, -1);
      this.addSprite(100, SPRITES.BILLBOARD01, -1);
      this.addSprite(120, SPRITES.BILLBOARD02, -1);
      this.addSprite(140, SPRITES.BILLBOARD03, -1);
      this.addSprite(160, SPRITES.BILLBOARD04, -1);
      this.addSprite(180, SPRITES.BILLBOARD05, -1);

      this.addSprite(240,                  SPRITES.BILLBOARD07, -1.2);
      this.addSprite(240,                  SPRITES.BILLBOARD06,  1.2);
      this.addSprite(segments.length - 25, SPRITES.BILLBOARD07, -1.2);
      this.addSprite(segments.length - 25, SPRITES.BILLBOARD06,  1.2);

      for(n = 10 ; n < 200 ; n += 4 + Math.floor(n/100)) {
        this.addSprite(n, SPRITES.PALM_TREE, 0.5 + Math.random()*0.5);
        this.addSprite(n, SPRITES.PALM_TREE,   1 + Math.random()*2);
      }

      for(n = 250 ; n < 2000 ; n += 10) {
        this.addSprite(n,     SPRITES.COLUMN, 1.1);
        this.addSprite(n + Util.randomInt(0,5), SPRITES.TREE1, -1 - (Math.random() * 2));
        this.addSprite(n + Util.randomInt(0,5), SPRITES.TREE2, -1 - (Math.random() * 2));
      }

      for(n = 200 ; n < segments.length ; n += 3) {
        this.addSprite(n, Util.randomChoice(SPRITES.PLANTS), Util.randomChoice([1,-1]) * (2 + Math.random() * 5));
      }

      var side, sprite, offset;
      for(n = 1000 ; n < (segments.length-50) ; n += 100) {
        side      = Util.randomChoice([1, -1]);
        this.addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.BILLBOARDS), -side);
        for(i = 0 ; i < 20 ; i++) {
          sprite = Util.randomChoice(SPRITES.PLANTS);
          offset = side * (1.5 + Math.random());
          this.addSprite(n + Util.randomInt(0, 50), sprite, offset);
        }
          
      }

    },

    resetCars: function() {
        cars = [];
        var n, car, segment, offset, z, sprite, speed;
        for (var n = 0 ; n < this.totalCars ; n++) {
            offset = Math.random() * Util.randomChoice([-0.8, 0.8]);
            z      = Math.floor(Math.random() * this.segments.length) * this.segmentLength;
            sprite = Util.randomChoice(SPRITES.CARS);
            speed  = this.maxSpeed/4 + Math.random() * this.maxSpeed/(sprite == SPRITES.SEMI ? 4 : 2);
            car = { offset: offset, z: z, sprite: sprite, speed: speed };
            segment = this.findSegment( car.z );
            segment.cars.push(car);
            cars.push(car);
        }
    },

    resetSprites: function() {
        for( n = 250 ; n < 1000 ; n += 5 ) {
            this.addSprite( n, SPRITES.COLUMN, 1.1);
            this.addSprite( n + Util.randomInt(0,5), SPRITES.TREE1, -1 - (Math.random() * 2) );
            this.addSprite( n + Util.randomInt(0,5), SPRITES.TREE2, -1 - (Math.random() * 2) );
        }
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

    addSegment: function( curve, y ) {
        var n = this.segments.length;
        this.segments.push( { index: n,
                              p1: { world: { y: this.lastY(), z:  n   * this.segmentLength }, camera: {}, screen: {} },
                              p2: { world: { y: y,            z: (n+1)* this.segmentLength }, camera: {}, screen: {} },
                              curve: curve,
                              sprites: [],
                              cars: [],
                              color: Math.floor( n / this.rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
                          } );
    },

    addSprite: function( n, sprite, offset ) {
        this.segments[n].sprites.push({ source: sprite, offset: offset });
    },


    addRoad: function( enter, hold, leave, curve, y ) {
        var startY   = this.lastY();
        var endY     = startY + ( Util.toInt( y, 0 ) * this.segmentLength );
        var n, total = enter + hold + leave;

        for( n = 0 ; n < enter ; n++ ) {
            this.addSegment( Util.easeIn( 0, curve, n/enter ), Util.easeInOut( startY, endY, n / total ) );
        }

        for( n = 0 ; n < hold  ; n++ ) {
            this.addSegment( curve, Util.easeInOut( startY, endY, ( enter + n ) / total ) );
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