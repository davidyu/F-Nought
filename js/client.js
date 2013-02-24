var Client = {
    socket: null,

    init: function() {
        this.socket = io.connect("http://localhost:8080");
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