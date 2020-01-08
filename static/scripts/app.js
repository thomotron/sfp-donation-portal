var form = new Vue({
    el: '#form',
    data: {
        anonymous: false,
        authorised: false,
        discordName: '',
        discordAvatar: ''
    },
    methods: {
        openDiscordPopout: function() {
            window.open(
                'https://discordapp.com/api/oauth2/authorize?client_id=631115320823644180&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fdiscord%2Fcallback&response_type=code&scope=identify',
                'Authorise with Discord',
                'width=375,height=485,top=' + ((window.innerHeight / 2) - 200) + ',left=' + ((window.innerWidth / 2) - 187)
            );
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
        }
    },
    created: function() {
        // Check if we're auth'd already
        this.checkIfAuthorised();
    }
});
