S = {};

var Server = {

    init: function( Settings ) {
        S = Settings;
    },

    sendPositions: function( socket ) {
        var msg = {
            position: S.position,
            speed: S.speed,
            accel: S.accel,
        }

        console.log( "broadcasting position" );
        socket.emit( 'positionchange', msg );
    }
}

module.exports = {
    Server: Server
}