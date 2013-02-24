var Client = {
    socket: null,

    init: function() {
        this.socket = io.connect("http://localhost:8080");

        this.socket.on( 'positionchange', function( data ) {
            console.log( data );

            Settings.position = data.position;
            Settings.speed = data.speed;
            Settings.accel = data.accel;
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