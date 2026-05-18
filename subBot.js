const { Client, Options } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');

const token = process.argv[2];
const channelId = process.argv[3];

if (!token || !channelId) {
  console.error("❌ Token or channel ID not provided to sub-bot!");
  process.exit(1);
}

// 🛠️ بەشی کەمکردنەوەی ڕام بۆ خوار 5MB
const client = new Client({
  checkUpdate: false,
  intents: 1 | 128  // GuildMessages | GuildVoiceStates
});

let connection = null;

// 🔥 چارەسەری داینامیکی ئێرۆرە نوێیەکەی دیسکۆرد بەبێ بەکارهێنانی ڕێڕەوی فۆڵدەر
client.on('shardReady', (shardId, unavailableGuilds) => {
  if (client.user && client.user.settings) {
    client.user.settings._patch = function(data) {
      if (data && !data.friend_source_flags) {
        data.friend_source_flags = { all: false, mutual_friends: false, mutual_guilds: false };
      }
    };
  }
});

client.once('ready', async () => {
  console.log(`✅ Bot logged in: ${token.substring(0, 10)}...`);
  client.user.setStatus("idle");

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`❌ Channel ${channelId} not found`);
      return;
    }
    console.log(`📞 Found channel: ${channel.name || channel.id}`);
    await joinChannel(channel);
  } catch (error) {
    console.error(`❌ Error fetching channel: ${error.message}`);
  }
});

async function joinChannel(channel) {
  try {
    if (!channel) {
      console.error('❌ Error: Channel is undefined');
      return;
    }

    console.log(`🔌 Attempting to join voice channel...`);
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true,
    });

    console.log(`✅ Joined the voice channel: ${channel.id}`);

    connection.on('stateChange', (oldState, newState) => {
      console.log(`📡 Connection state: ${oldState.status} → ${newState.status}`);
      if (newState.status === 'Disconnected') {
        console.log(`⏳ Disconnected. Reconnecting in 5 seconds...`);
        setTimeout(async () => {
          try {
            await joinChannel(channel);
          } catch (error) {
            console.error(`❌ Reconnection failed: ${error.message}`);
          }
        }, 5000);
      }
    });

    connection.on('error', (error) => {
      console.error(`❌ Voice connection error: ${error.message}`);
    });

    connection.on('disconnect', () => {
      console.log(`⚠️ Voice connection disconnected`);
    });
  } catch (error) {
    console.error(`❌ Error joining voice channel: ${error.message}`);
  }
}

client.login(token).catch(err => {
  console.error(`❌ Failed to login: ${err.message}`);
  process.exit(1);
});

// Graceful error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
