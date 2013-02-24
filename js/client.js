var Client = {
    socket: null,

    init: function() {
        this.socket = io.connect("http://localhost:8080");

        this.socket.send( "inquire" ); //can i haz play

        this.socket.on( "setup", function( data ) {
            Settings.me = parseInt( data.d );
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
            keySlower: Settings.keySlower,
            keyFaster: Settings.keyFaster,
            keyLeft:   Settings.keyLeft,
            keyRight:  Settings.keyRight
        }

        this.socket.emit( 'keystatechange', msg );
    },

}