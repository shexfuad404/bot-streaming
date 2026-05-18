const { Client, Options } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');

const token = process.argv[2];
const channelId = process.argv[3];

if (!token || !channelId) {
  console.log("تۆکن یان ئایدی کەناڵ نەنێردراوە بۆ سه‌ب-بۆت!");
  process.exit(1);
}

// 🛠️ بەشی کەمکردنەوەی ڕام بۆ خوار 5MB
const client = new Client({
  checkUpdate: false,
  makeCache: Options.cacheWithLimits({
    MessageManager: 0,
    PresenceManager: 0,
    UserManager: 0,
    GuildMemberManager: 0,
    ChannelManager: 0,
    GuildChannelManager: 0,
    RoleManager: 0,
    ReactionManager: 0,
    ThreadManager: 0,
    StageInstanceManager: 0,
    VoiceStateManager: 0
  }),
  intents: [ 1, 128 ]
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
  console.log(`Bot with token ${token.substring(0, 10)}... is ready!`);
  client.user.setStatus("idle");

  try {
    const channel = await client.channels.fetch(channelId);
    await joinChannel(channel);
  } catch (error) {
    console.error(`Error fetching the channel: ${error}`);
  }
});

async function joinChannel(channel) {
  try {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true,
    });

    console.log(`Joined the voice channel: ${channelId}`);

    connection.on('stateChange', (oldState, newState) => {
      console.log(`Connection state changed: ${newState.status}`);
      if (newState.status === 'Disconnected') {
        console.log(`Disconnected. Reconnecting in 5 seconds...`);
        setTimeout(async () => {
          try {
            await joinChannel(channel);
          } catch (error) {
            console.error(`Reconnection failed: ${error}`);
          }
        }, 5000);
      }
    });

    connection.on('error', (error) => console.error(`Voice error: ${error}`));
  } catch (error) {
    console.error(`Error joining voice: ${error}`);
  }
}

client.login(token).catch(err => {
  console.error(`Failed to login: ${err.message}`);
  process.exit(1);
});
