const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

// Discord credentials from environment variables
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback';
const DISCORD_BOT_TOKEN = process.env.OFFICIAL_BOT_TOKEN || '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';

// Scopes for user login only (removed 'bot' and 'applications.commands' to prevent server selection screen)
const scopes = ['identify', 'guilds.join', 'email', 'guilds', 'guilds.members.read'];

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

console.log('🔧 Discord OAuth Configuration:');
console.log('- Client ID:', DISCORD_CLIENT_ID);
console.log('- Callback URL:', DISCORD_CALLBACK_URL);
console.log('- Environment:', process.env.NODE_ENV);

passport.use(
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK_URL,
      scope: scopes,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log('Discord profile received:', profile.username);

        // Create avatar URL
        let avatarUrl = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null;

        // Find or create user
        let user = await User.findOneAndUpdate(
          { oauthProvider: 'discord', oauthId: profile.id },
          {
            $set: {
              name: profile.username,
              email: profile.email,
              avatar: avatarUrl,
              lastLogin: Date.now(),
              discordAccessToken: accessToken // Store access token for server joining
            },
            $setOnInsert: {
              nickname: profile.username,
              oauthProvider: 'discord',
              oauthId: profile.id,
              plan: 'free',
              isAdmin: false,
              banned: false
            }
          },
          { new: true, upsert: true }
        );

        console.log('User found/created:', user.name);

        // Check if user is banned
        if (user.banned) {
          console.log('User is banned:', user._id);
          return done(null, false, { message: 'You are banned.' });
        }

        // Auto-join user to Discord server (if configured)
        if (DISCORD_GUILD_ID && DISCORD_BOT_TOKEN) {
          try {
            console.log(`🔗 Attempting to auto-join user ${profile.username} (${profile.id}) to Discord server...`);
            
            // First, check if bot is in the server and has permissions
            const botCheckResponse = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}`, {
              headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
              }
            });
            
            if (!botCheckResponse.ok) {
              console.log(`❌ Bot is not in server or lacks permissions: ${botCheckResponse.status}`);
              throw new Error(`Bot not in server: ${botCheckResponse.status}`);
            }
            
            console.log(`✅ Bot has access to server, proceeding with user join...`);
            
            const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${profile.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                access_token: accessToken
              })
            });

            if (response.ok || response.status === 201) {
              console.log(`✅ Successfully auto-joined user ${profile.username} to Discord server`);
            } else if (response.status === 204) {
              console.log(`ℹ️ User ${profile.username} is already in the Discord server`);
            } else {
              const error = await response.text();
              console.log(`⚠️ Failed to auto-join user ${profile.username} to server: ${response.status}`);
            }
          } catch (joinError) {
            console.error('Error auto-joining user to Discord server:', joinError);
            // Don't fail authentication if server join fails
          }
        }

        return done(null, user);
      } catch (err) {
        console.error('Error in Discord auth strategy:', err);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;