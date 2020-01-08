// Config variables
var CLIENT_ID = ""
var CLIENT_SECRET = ""
var PORT = 8080;
var REDIRECT_URI = "http://localhost:8080/callback/discord";

// Node module imports
var express = require('express');
var session = require('express-session');
var sqlitestore = require('connect-sqlite3')(session);
var request = require('request-promise');

// Node module instantiation
var app = express();

// Express middleware config
app.use(express.static(__dirname + '/static'));
app.use(session({
    secret: 'someSecretIdkWhyIsThisSigned???',
    store: new sqlitestore,
    cookie: { maxAge: 8 * 7 * 24 * 60 * 60 * 1000 } // 8 weeks
}));
app.use(function(req, res, next){
    // Initialise the session's discord token if they haven't got one already
    if (!req.session.discordToken) req.session.discordToken = "";
    if (!req.session.discordRefreshToken) req.session.discordRefreshToken = "";

    // Move on to the next middleware
    next();
});

// Express routes
// Base route

// Discord authorisation
app.get('/callback/discord', function(req, res){
    // Validate our URL query strings
    if (req.query.hasOwnProperty('error') && req.query.error == 'access_denied') // Got '?error=access_denied'
        return res.status(400).send('<html><body onload="window.close()">Authorisation cancelled, you may now close this window.</body></html>');
    else if (req.query.hasOwnProperty('error')) // Got '?error=...'
        return res.status(400).send('<html><body onload="window.close()">Authorisation failed, you may now close this window.</body></html>');
    else if (!req.query.hasOwnProperty('code')) // Didn't get '?code=...'
        return res.status(400).send('<html><body onload="/*window.close()*/">Authorisation failed for an unknown reason.</body></html>');

    // Fill out the form data
    var options = {
        method: 'POST',
        uri: 'https://discordapp.com/api/oauth2/token',
        form: {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: req.query.code,
            scope: 'identify',
            redirect_uri: REDIRECT_URI
        },
        json: true
    };

    // Make the requst
    request(options)
        .then(function(json) {
            // Ensure we have an access token, failing the request otherwise
            if (!json.hasOwnProperty('access_token')) return res.status(500).send('<html><body onload="window.close()">Failed to get access token from Discord.</body></html>');

            // Save the token to the session
            req.session.discordToken = json.access_token;

            console.log("Got a token: " + req.session.discordToken);

            return res.status(200).send('<html><body onload="window.close()">Authorisation successful, you may now close this window.</body></html>');
        })
        .catch(function(err) {
            // Fail the request
            return res.status(500).send('<html><body onload="window.close()">Failed to get access token from Discord.</body></html>');
        });
});

// Check authorisation status
app.get('/authorised', function(req, res) {
    // Return unauthorised if we don't have a token or if it's empty
    if (!req.session.hasOwnProperty('discordToken') || req.session.discordToken == '') return res.json({authorised: false});

    console.log('Checking auth with token: ' + req.session.discordToken);

    // Fill out the Discord form data
    var options = {
        method: 'GET',
        uri: 'https://discordapp.com/api/users/@me',
        headers: {
            'Authorization': 'Bearer ' + req.session.discordToken
        },
        json: true
    }

    // Try get the user's details from Discord with the token
    request(options)
        .then(function(json) {
            // Check if there's an ID and return authorised if so
            if (json.id) return res.json({authorised: true});
            // Otherwise something is borked and they aren't auth'd properly
            else return res.json({authorised: false});
        })
        .catch(function(err) {
            // Fail the request
            return res.status(500).json({authorised: false});
        });
});

// Start the app
app.listen(PORT);
console.log('Express server listening on port %d in %s mode', PORT, app.settings.env);
