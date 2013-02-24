var Client = {
    socket: null,

    init: function() {
        this.socket = io.connect("http://localhost:8080");

        this.socket.send( "inquire" ); //can i haz play

        this.socket.on( "setup", function( data ) {
            Settings.me = parseInt( data.d );

            Settings.init();
            Settings.addPlayer( Settings.me );

            console.log( Settings.players[ Settings.me ] );
            
            Render.init();

            Game.run( Util, Render,
                      {
                canvas: Settings.canvas,
                render: Render.render,
                update: Game.update,
                step: Settings.step,
                client: true,
                images: ["background", "sprites"],
                keys: [ { keys: [KEY.LEFT,  KEY.A], mode: 'down', action: function() { Settings.keyLeft   = true; Client.sendKeyState();  } },
                        { keys: [KEY.RIGHT, KEY.D], mode: 'down', action: function() { Settings.keyRight  = true; Client.sendKeyState();  } },
                        { keys: [KEY.UP,    KEY.W], mode: 'down', action: function() { Settings.keyFaster = true;  Client.sendKeyState(); } },
                        { keys: [KEY.DOWN,  KEY.S], mode: 'down', action: function() { Settings.keySlower = true;  Client.sendKeyState(); } },
                        { keys: [KEY.LEFT,  KEY.A], mode: 'up',   action: function() { Settings.keyLeft   = false; Client.sendKeyState(); } },
                        { keys: [KEY.RIGHT, KEY.D], mode: 'up',   action: function() { Settings.keyRight  = false; Client.sendKeyState(); } },
                        { keys: [KEY.UP,    KEY.W], mode: 'up',   action: function() { Settings.keyFaster = false; Client.sendKeyState(); } },
                        { keys: [KEY.DOWN,  KEY.S], mode: 'up',   action: function() { Settings.keySlower = false; Client.sendKeyState(); } } ],
                ready: function(images) {
                          Settings.background = images[0];
                          Settings.sprites    = images[1];
                          Settings.reset();
                       }
            } );

        } );

        this.socket.on( 'positionchange', function( data ) {
            console.log( data );

            Settings.position = data.position;
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