// Define and initialise up the form
var form = new Vue({
    el: '#form',
    data: {
        anonymous: false,
        authorised: false,
        discordName: '',
        discordAvatar: '',
        amount: 0,
        donationId: '',
        moneyFormat: {
            decimal: '.',
            thousands: ',',
            prefix: 'AU$',
            suffix: '',
            precision: 2,
            masked: false
        }
    },
    methods: {
        openDiscordPopout: function() {
            // Open the popup
            var w = window.open(
                'https://discordapp.com/api/oauth2/authorize?client_id=631115320823644180&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fdiscord%2Fcallback&response_type=code&scope=identify',
                'Authorise with Discord',
                'width=375,height=485,top=' + ((window.innerHeight / 2) - 200) + ',left=' + ((window.innerWidth / 2) - 187)
            );

            // Handle the popup closing to refresh our authorised state
            // Hacky, but it works for all origins, not just the site we're hosting
            const vueInstance = this; // Necessary since 'this' becomes the DOM
            var timer = setInterval(function() {
                if (w.closed) {
                    // Stop the timer and check our auth state
                    clearInterval(timer);
                    vueInstance.checkIfAuthorised();
                }
            }, 250);
        },
        checkIfAuthorised: function() {
            // Get the authorised status from the API and parse it as JSON
            this.$http.get('/discord/authorised').then(res => {return res.json()}).then(json => {
                // Update the authorised state
                this.authorised = json.authorised;

                // Update our name and avatar according to our auth state
                if (json.authorised) {
                    this.updateDiscordDetails();
                } else {
                    this.discordName = '';
                    this.discordAvatar = '';
                }
            });
        },
        updateDiscordDetails: function() {
            this.$http.get('/discord/profile').then(res => {return res.json()}).then(json => {
                // Update our name and avatar
                this.discordName = json.name;
                this.discordAvatar = json.avatar;
            });
        },
        openPaypalPopout: function() {
            // Don't do anything if we don't have a donation ID
            if (!this.donationId) return;

            // Construct a button URL
            var url = 'https://www.paypal.com/cgi-bin/webscr' +
                        '?cmd=_donations' +                                         // This is a donation
                        '&business=cocytus-services@aaaaaaaaaaaaaaaaaaaaaaaa.net' + // Send it to Cocytus Services
                        '&item_name=Keep Cocytus up and running' +                  // Donation cause/name
                        '&no_note=1' +                                              // Disable the note field
                        '&currency_code=AUD' +                                      // Accept AUD
                        '&amount=' + this.amount +                                  // The donation amount in dollars
                        '&notify_url=https://tem.party/paypal/donation' +           // The return URL to send confirmation to
                        '&image_url=https://i.imgur.com/bkvytpE.png' +              // Image shown as the recipient's icon (SFP Logo)
                        '&custom=' + this.donationId;                               // Pass a unique donation ID as a token for the server to verify

            // Open the popup
            var w = window.open(
                url,
                'Donate with PayPal',
                'width=375,height=485,top=' + ((window.innerHeight / 2) - 200) + ',left=' + ((window.innerWidth / 2) - 187)
            );

            // Handle the popup closing to refresh the donation pool
            // Hacky, but it works for all origins, not just the site we're hosting
            const vueInstance = this; // Necessary since 'this' becomes the DOM
            var timer = setInterval(function() {
                if (w.closed) {
                    // Stop the timer, finish the donation, and refresh the donation panel
                    clearInterval(timer);
                    vueInstance.finishDonation();
                    // TODO: Refresh donation panel
                }
            }, 250);
        },
        getDonations: function() {
            this.$http.get('/api/donations').then(res => {return res.json()}).then(json => {
                // Update our target and donor list
                this.donationBalance = json.balance;
                this.donationDonors = json.donors;
                this.donationLeaderboard = json.leaderboard;
            });
        },
        getDonationId: function() {
            // Get a unique donation ID
            this.$http.get('/api/donationId').then(res => {return res.json()}).then(json => {
                this.donationId = json.donationId;
            });
        }
    },
    created: function() {
        // Get a donation ID for the PayPal button
        this.getDonationId();

        // Check if we're auth'd already
        this.checkIfAuthorised();
    }
});
