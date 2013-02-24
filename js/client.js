var Client = {
    socket: null,

    init: function() {
        this.socket = io.connect("http://localhost:8080");

        this.socket.send( "inquire" ); //can i haz play

        this.socket.on( "setup", function( data ) {

            console.log( "connection established! I am " + data.d );

            Settings.me = parseInt( data.d );

            var me = Settings.me;
            Settings.init();
            Settings.addPlayer( me );
            
            Render.init();

            Game.run( Util, Render,
                      {
                canvas: Settings.canvas,
                render: Render.render,
                update: Game.update,
                step: Settings.step,
                client: true,
                images: ["background", "sprites"],
                keys: [ { keys: [KEY.LEFT,  KEY.A], mode: 'down', action: function() { Settings.players[me].keyLeft   = true; Client.sendKeyState();  } },
                        { keys: [KEY.RIGHT, KEY.D], mode: 'down', action: function() { Settings.players[me].keyRight  = true; Client.sendKeyState();  } },
                        { keys: [KEY.UP,    KEY.W], mode: 'down', action: function() { Settings.players[me].keyFaster = true;  Client.sendKeyState(); } },
                        { keys: [KEY.DOWN,  KEY.S], mode: 'down', action: function() { Settings.players[me].keySlower = true;  Client.sendKeyState(); } },
                        { keys: [KEY.LEFT,  KEY.A], mode: 'up',   action: function() { Settings.players[me].keyLeft   = false; Client.sendKeyState(); } },
                        { keys: [KEY.RIGHT, KEY.D], mode: 'up',   action: function() { Settings.players[me].keyRight  = false; Client.sendKeyState(); } },
                        { keys: [KEY.UP,    KEY.W], mode: 'up',   action: function() { Settings.players[me].keyFaster = false; Client.sendKeyState(); } },
                        { keys: [KEY.DOWN,  KEY.S], mode: 'up',   action: function() { Settings.players[me].keySlower = false; Client.sendKeyState(); } } ],
                ready: function(images) {
                          Settings.background = images[0];
                          Settings.sprites    = images[1];
                          Settings.reset();
                       }
            } );

        } );

        //me
        this.socket.on( 'positionverify', function( data ) {
            if ( data.pid == Settings.me ) {
                Settings.players[ Settings.me ].position = data.position;
            }
        } );

        //other players
        this.socket.on( 'positionchange', function( data ) {

            for ( i = 0; i < data.players.length; i++ ) {
                if ( !Settings.players[i]) {
                    Settings.addPlayer(i);
                }

                Settings.players[i].position = data.players[i].position;
                Settings.players[i].speed = data.players[i].speed;
                Settings.players[i].X = data.players[i].X;
            }

            /*
            Settings.players[ data.pid ].position = data.position;
            Settings.players[ data.pid ].speed = data.speed;
            Settings.players[ data.pid ].X = data.X;
            Settings.players[ data.pid ].keyLeft = data.keyLeft;
            Settings.players[ data.pid ].keyRight = data.keyRight;
            Settings.players[ data.pid ].keyFaster = data.keyFaster;
            Settings.players[ data.pid ].keySlower = data.keySlower;
            */
        } );

        this.socket.on( 'message', function( message ) {
            if ( message = "no" ) {
                //sorry! Just play locally.
                alert( "Server full. Go play something else." );
            }
        } );
    },

    sendKeyState: function() {

        var msg = {
            pid : Settings.me,
            keySlower: Settings.players[ Settings.me ].keySlower,
            keyFaster: Settings.players[ Settings.me ].keyFaster,
            keyLeft:   Settings.players[ Settings.me ].keyLeft,
            keyRight:  Settings.players[ Settings.me ].keyRight
        }

        this.socket.emit( 'keystatechange', msg );
    },

}