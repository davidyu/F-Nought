var Render = {

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

        var baseSegment = Settings.findSegment( position );
        var maxy        = Settings.height;

        var ctx = Settings.ctx;

        ctx.clearRect(0, 0, Settings.width, Settings.height);

        Render.background(ctx, Settings.background, Settings.width, Settings.height, BACKGROUND.SKY);
        Render.background(ctx, Settings.background, Settings.width, Settings.height, BACKGROUND.HILLS);
        Render.background(ctx, Settings.background, Settings.width, Settings.height, BACKGROUND.TREES);

        var n, segment;

        for(n = 0 ; n < drawDistance ; n++) {

            segment        = segments[(baseSegment.index + n) % segments.length];
            segment.looped = segment.index < baseSegment.index;
            segment.fog    = Util.exponentialFog(n/drawDistance, fogDensity);

            Util.project(segment.p1, (playerX * roadWidth), cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
            Util.project(segment.p2, (playerX * roadWidth), cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);

            if ((segment.p1.camera.z <= cameraDepth) || // behind us
                (segment.p2.screen.y >= maxy))          // clip by (already rendered) segment
                continue;

            Render.segment(ctx, width, lanes,
                           segment.p1.screen.x,
                           segment.p1.screen.y,
                           segment.p1.screen.w,
                           segment.p2.screen.x,
                           segment.p2.screen.y,
                           segment.p2.screen.w,
                           segment.fog,
                           segment.color);

            maxy = segment.p2.screen.y;
        }

        Render.player( ctx, Settings.width, Settings.height, Settings.resolution, Settings.roadWidth, Settings.sprites, Settings.speed/Settings.maxSpeed,
                       Settings.cameraDepth/Settings.playerZ,
                       Settings.width/2,
                       Settings.height,
                       Settings.speed * ( Settings.keyLeft ? -1 : Settings.keyRight ? 1 : 0 ),
                       0 );
    },

    rumbleWidth:     function( projectedRoadWidth, lanes ) { return projectedRoadWidth/Math.max(6,  2*lanes); },
    laneMarkerWidth: function( projectedRoadWidth, lanes ) { return projectedRoadWidth/Math.max(32, 8*lanes); }
}