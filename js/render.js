//set up the DOM
var Dom = {

    get:  function( id ) {
        return (( id instanceof HTMLElement ) || ( id === document ) ) ? 
               id : document.getElementById( id ); 
    },

    set:  function( id, html )               { Dom.get( id ).innerHTML = html;                        },
    on:   function( ele, type, fn, capture ) { Dom.get( ele ).addEventListener( type, fn, capture );    },
    un:   function( ele, type, fn, capture ) { Dom.get( ele ).removeEventListener( type, fn, capture ); },
    show: function( ele, type )              { Dom.get( ele ).style.display = ( type || 'block' );      },
    blur: function( ev )                     { ev.target.blur();                                    },

    addClassName:    function( ele, name )     { Dom.toggleClassName( ele, name, true );  },
    removeClassName: function( ele, name )     { Dom.toggleClassName( ele, name, false ); },
    toggleClassName: function( ele, name, on ) {

        ele = Dom.get( ele );
        var classes = ele.className.split(' ');
        var n = classes.indexOf( name );
        on = ( typeof on == 'undefined' ) ? ( n < 0 ) : on;

        if ( on && ( n < 0 ) ) {
            classes.push( name );
        } else if ( !on && ( n >= 0 ) ) {
            classes.splice( n, 1 );
        }

        ele.className = classes.join(' ');
    },

    storage: window.localStorage || {}

}

var Render = {

    canvas        : Dom.get('canvas'),       // our canvas...
    ctx           : this.canvas.getContext('2d'), // ...and its drawing context
    
    init: function() {
        if ( !window.requestAnimationFrame ) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
            window.requestAnimationFrame = window.webkitRequestAnimationFrame || 
                                           window.mozRequestAnimationFrame    || 
                                           window.oRequestAnimationFrame      || 
                                           window.msRequestAnimationFrame     || 
                                           function( callback, element ) {
                                               window.setTimeout( callback, 1000 / 60 );
                                           }
        }

        this.canvas        = Dom.get('canvas');       // our canvas...
        this.ctx           = this.canvas.getContext('2d'); // ...and its drawing context

    },


    polygon: function(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
    },

    //---------------------------------------------------------------------------

    segment: function( ctx, width, lanes, x1, y1, w1, x2, y2, w2, fog, color ) {

        var r1 = Render.rumbleWidth( w1, lanes ),
            r2 = Render.rumbleWidth( w2, lanes ),
            l1 = Render.laneMarkerWidth( w1, lanes ),
            l2 = Render.laneMarkerWidth( w2, lanes ),
            lanew1, lanew2, lanex1, lanex2, lane;

        ctx.fillStyle = color.grass;
        ctx.fillRect(0, y2, width, y1 - y2);

        Render.polygon(ctx, x1-w1-r1, y1, x1-w1, y1, x2-w2, y2, x2-w2-r2, y2, color.rumble);
        Render.polygon(ctx, x1+w1+r1, y1, x1+w1, y1, x2+w2, y2, x2+w2+r2, y2, color.rumble);
        Render.polygon(ctx, x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2, color.road);

        if (color.lane) {
            lanew1 = w1*2/lanes;
            lanew2 = w2*2/lanes;
            lanex1 = x1 - w1 + lanew1;
            lanex2 = x2 - w2 + lanew2;
            for(lane = 1 ; lane < lanes ; lanex1 += lanew1, lanex2 += lanew2, lane++)
              Render.polygon(ctx, lanex1 - l1/2, y1, lanex1 + l1/2, y1, lanex2 + l2/2, y2, lanex2 - l2/2, y2, color.lane);
        }

        Render.fog(ctx, 0, y1, width, y2-y1, fog);
    },

    //---------------------------------------------------------------------------

    background: function( ctx, background, width, height, layer, rotation, offset  ) {

        rotation = rotation || 0;
        offset   = offset   || 0;

        var imageW = layer.w/2;
        var imageH = layer.h;

        var sourceX = layer.x + Math.floor(layer.w * rotation);
        var sourceY = layer.y
        var sourceW = Math.min(imageW, layer.x+layer.w-sourceX);
        var sourceH = imageH;

        var destX = 0;
        var destY = offset;
        var destW = Math.floor(width * (sourceW/imageW));
        var destH = height;

        ctx.drawImage(background, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH);
        if (sourceW < imageW) {
            ctx.drawImage(background, layer.x, sourceY, imageW-sourceW, sourceH, destW-1, destY, width-destW, destH);
        }
    },

    //---------------------------------------------------------------------------

    sprite: function(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY, offsetX, offsetY, clipY) {

        //  scale for projection AND relative to roadWidth (for tweakUI)
        var destW  = (sprite.w * scale * width/2) * (SPRITES.SCALE * roadWidth);
        var destH  = (sprite.h * scale * width/2) * (SPRITES.SCALE * roadWidth);

        destX = destX + (destW * (offsetX || 0));
        destY = destY + (destH * (offsetY || 0));

        var clipH = clipY ? Math.max(0, destY+destH-clipY) : 0;
        if (clipH < destH) {
            ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);
        }

    },

    //---------------------------------------------------------------------------

    player: function(ctx, width, height, resolution, roadWidth, sprites, speedPercent, scale, destX, destY, steer, updown) {

        var bounce = (1.5 * Math.random() * speedPercent * resolution) * Util.randomChoice([-1,1]);
        var sprite;
        if (steer < 0) {
            sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT;
        } else if (steer > 0) {
            sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT;
        } else {
            sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT;
        }

        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce, -0.5, -1);
    },

    //---------------------------------------------------------------------------

    fog: function(ctx, x, y, width, height, fog) {
        if (fog < 1) {
            ctx.globalAlpha = (1-fog)
            ctx.fillStyle = COLORS.FOG;
            ctx.fillRect(x, y, width, height);
            ctx.globalAlpha = 1;
        }
    },

    //the big show

    render: function( position ) {

        console.log( "rendering..." );

        var playerZ = Settings.players[ Settings.me ].Z;
        var playerX = Settings.players[ Settings.me ].X;

        var baseSegment   = Settings.findSegment( position );
        var basePercent   = Util.percentRemaining( position, Settings.segmentLength );
        var playerSegment = Settings.findSegment( position + playerZ );
        var playerPercent = Util.percentRemaining( position + playerZ, Settings.segmentLength );
        var playerY       = Util.interpolate( playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent );

        var maxy          = Settings.height;

        var x  = 0;
        var dx = - (baseSegment.curve * basePercent);

        var ctx = Render.ctx;

        ctx.clearRect( 0, 0, Settings.width, Settings.height );

        Render.background(ctx, Settings.background, Settings.width, Settings.height, BACKGROUND.SKY,    Settings.skyOffset,  Settings.resolution * Settings.skySpeed  * playerY );
        Render.background(ctx, Settings.background, Settings.width, Settings.height, BACKGROUND.HILLS,  Settings.hillOffset, Settings.resolution * Settings.hillSpeed * playerY );
        Render.background(ctx, Settings.background, Settings.width, Settings.height, BACKGROUND.TREES,  Settings.treeOffset, Settings.resolution * Settings.treeSpeed * playerY );

        var n, segment;

        var drawDistance = Settings.drawDistance;

        //painter (front-to-back) for road segments
        for(n = 0 ; n < drawDistance ; n++) {

            segment        = Settings.segments[ ( baseSegment.index + n ) % Settings.segments.length];
            segment.looped = segment.index < baseSegment.index;
            segment.fog    = Util.exponentialFog( n / drawDistance, Settings.fogDensity );
            segment.clip   = maxy;

            Util.project( segment.p1, ( playerX * Settings.roadWidth) - x,      playerY + Settings.cameraHeight, Settings.players[ Settings.me ].position - (segment.looped ? Settings.trackLength : 0), Settings.cameraDepth, Settings.width, Settings.height, Settings.roadWidth );
            Util.project( segment.p2, ( playerX * Settings.roadWidth) - x - dx, playerY + Settings.cameraHeight, Settings.players[ Settings.me ].position - (segment.looped ? Settings.trackLength : 0), Settings.cameraDepth, Settings.width, Settings.height, Settings.roadWidth );

            x  += dx;
            dx += segment.curve;

            if ((segment.p1.camera.z <= Settings.cameraDepth) || // behind us
                (segment.p2.screen.y >= segment.p1.screen.y) || // back face cull
                (segment.p2.screen.y >= maxy))          // clip by (already rendered) segment
                continue;

            Render.segment(ctx, Settings.width, Settings.lanes,
                           segment.p1.screen.x,
                           segment.p1.screen.y,
                           segment.p1.screen.w,
                           segment.p2.screen.x,
                           segment.p2.screen.y,
                           segment.p2.screen.w,
                           segment.fog,
                           segment.color );

            maxy = segment.p2.screen.y;
        }

        for(n = (drawDistance-1) ; n > 0 ; n--) {
            segment = Settings.segments[(baseSegment.index + n) % Settings.segments.length];

            // render roadside sprites
            for(i = 0 ; i < segment.sprites.length ; i++) {
                sprite      = segment.sprites[i];
                spriteScale = segment.p1.screen.scale;
                spriteX     = segment.p1.screen.x + (spriteScale * sprite.offset * Settings.roadWidth * Settings.width/2);
                spriteY     = segment.p1.screen.y;
                Render.sprite(ctx, Settings.width, Settings.height, Settings.resolution, Settings.roadWidth, Settings.sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip);
            }

            // render other cars
            for(i = 0 ; i < segment.cars.length ; i++) {
                car         = segment.cars[i];
                sprite      = car.sprite;
                spriteScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
                spriteX     = Util.interpolate(segment.p1.screen.x,     segment.p2.screen.x,     car.percent) + (spriteScale * car.offset * Settings.roadWidth * Settings.width/2);
                spriteY     = Util.interpolate(segment.p1.screen.y,     segment.p2.screen.y,     car.percent);
                Render.sprite(ctx, Settings.width, Settings.height, Settings.resolution, Settings.roadWidth, Settings.sprites, car.sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
            }

            if ( segment == playerSegment ) {
                Render.player( ctx, Settings.width, Settings.height, Settings.resolution, Settings.roadWidth, Settings.sprites, Settings.speed/Settings.maxSpeed,
                               Settings.cameraDepth/(Settings.playerZ),
                               Settings.width / 2,
                               ( Settings.height / 2 ) - ( Settings.cameraDepth / Settings.playerZ * Util.interpolate( playerSegment.p1.camera.y, playerSegment.p2.camera.y, playerPercent ) * Settings.height / 2 ),
                               Settings.speed * ( Settings.keyLeft ? -1 : Settings.keyRight ? 1 : 0 ),
                               playerSegment.p2.world.y - playerSegment.p1.world.y );                
            }
        }

    },

    rumbleWidth:     function( projectedRoadWidth, lanes ) { return projectedRoadWidth/Math.max(6,  2*lanes); },
    laneMarkerWidth: function( projectedRoadWidth, lanes ) { return projectedRoadWidth/Math.max(32, 8*lanes); }
}

