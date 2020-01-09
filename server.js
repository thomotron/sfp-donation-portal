// Config variables
var CLIENT_ID = ""
var CLIENT_SECRET = ""
var PORT = 8080;
var REDIRECT_URI = "http://localhost:8080/discord/callback";

// Node module imports
var express = require('express');
var session = require('express-session');
var sqlitestore = require('connect-sqlite3')(session);
var request = require('request-promise');
var ipn = require('express-ipn');
var bodyParser = require('body-parser');
var sqlite3 = require('better-sqlite3');
var uuid = require('uuid/v4');

// Node module instantiation
var app = express();
var db = new sqlite3('donations.db', { verbose: console.log });

// Initialise the database if it's empty
// Get a list of tables in the database
var statement = db.prepare('SELECT name FROM sqlite_master WHERE type = \'table\'');
var tables = statement.all();
console.log(JSON.stringify(tables));
// Make sure the donor and donation tables exist
if (!tables.find(table => table.name == 'donor')) {
    db.prepare('CREATE TABLE donor (id INTEGER, name TEXT NOT NULL, avatar TEXT NOT NULL, PRIMARY KEY (id))').run();
}
if (!tables.find(table => table.name == 'donation')) {
    db.prepare('CREATE TABLE donation (id TEXT NOT NULL, donorId INTEGER, amount REAL NOT NULL, timestamp INTEGER NOT NULL, PRIMARY KEY (id), FOREIGN KEY (donorId) REFERENCES donor (id))').run();
}

// Express middleware config
app.use(express.static(__dirname + '/static'));
app.use(bodyParser.urlencoded({extended: false}));
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
app.get('/discord/callback', function(req, res){
    // Validate our URL query strings
    if (req.query.hasOwnProperty('error') && req.query.error == 'access_denied') // Got '?error=access_denied'
        return res.status(400).send('<html><body onload="window.close()">Authorisation cancelled, you may now close this window.</body></html>');
    else if (req.query.hasOwnProperty('error')) // Got '?error=...'
        return res.status(400).send('<html><body onload="/*window.close()*/">Authorisation failed, you may now close this window.</body></html>');
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
            if (!json.hasOwnProperty('access_token')) return res.status(500).send('<html><body onload="/*window.close()*/">Failed to get access token from Discord.</body></html>');

            // Save the token to the session
            req.session.discordToken = json.access_token;

            console.log("Got a token: " + req.session.discordToken);

            return res.status(200).send('<html><body onload="window.close()">Authorisation successful, you may now close this window.</body></html>');
        })
        .catch(function(err) {
            // Fail the request
            return res.status(500).send('<html><body onload="/*window.close()*/">Failed to get access token from Discord.</body></html>');
        });
});

// Check authorisation status
app.get('/discord/authorised', function(req, res) {
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
            // Update the user's discord details
            req.session.discordId = json.id;
            req.session.discordName = json.username;
            req.session.discordAvatar = 'https://cdn.discordapp.com/avatars/' + json.id + '/' + json.avatar + '.png?size=128';

            return res.json({authorised: true});
        })
        .catch(function(err) {
            // Fail the request
            return res.status(500).json({authorised: false});
        });
});

// Get Discord name and avatar
app.get('/discord/profile', function(req, res) {
    // Fail the request if there isn't any data
    if (!req.session.hasOwnProperty('discordName') || !req.session.hasOwnProperty('discordAvatar')) return res.status(404);

    // Return the user's name and avatar
    return res.json({
        name: req.session.discordName,
        avatar: req.session.discordAvatar
    });
});

// Process PayPal Instant Payment Notifications from donations
app.post('/paypal/donation', ipn.validator((err, content) => {
    // Check if the IPN failed validation
    if (err) {
        console.log(err);
        return;
    }

    // Dump the IPN to the console
    console.log(JSON.stringify(content));
}, true)); // Production mode?

// Generates a donation ID
app.get('/api/donationid', function(req, res) => {
    // Return a new donation ID
    return res.json({donationId: uuid()});
});

// Finishes the donation process and stores the donation within the database
app.post('/api/donation', function(req, res) => {
    // TODO: Store donation in the database
    console.log(JSON.stringify(req.headers));
    console.log(JSON.stringify(req.body));
});

db_getLeaderboard();

// Start the app
app.listen(PORT);
console.log('Express server listening on port %d in %s mode', PORT, app.settings.env);

// Close the database when we're done
db.close();
