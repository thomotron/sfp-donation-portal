// Config variables
var PORT = 8080
var CLIENT_ID = ""
var CLIENT_SECRET = ""

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
    else if (!req.query.hasOwnProperty('code') || !req.query.hasOwnProperty('state')) // Got neither '?code=...' nor '?state=...'
        return res.status(400).send('<html><body onload="window.close()">Authorisation failed for an unknown reason.</body></html>');

    // Ok, so we have a code, let's use it.
    var form = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code,
        scope: 'identify'
    };
    var oauthRes = await request.post('https://discordapp.com/api/oauth2/token').form(form);

    // Make sure we got an access token
    if (!oauthRes.json().hasOwnProperty('access_token'))
        return res.status(500).send('<html><body onload="window.close()">Failed to get access token from Discord.</body></html>');

    // Add it to the session
    req.session.discordToken = oauthRes.json().access_token;
});

// Start the app
app.listen(PORT);
console.log('Express server listening on port %d in %s mode', PORT, app.settings.env);
