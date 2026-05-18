const { Client, Options } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');

const token = process.argv[2];
const channelId = process.argv[3];

if (!token || !channelId) {
  console.log("تۆکن یان ئایدی کەناڵ نەنێردراوە بۆ سه‌ب-بۆت!");
  process.exit(1);
}

// 🛠️ گرنگترین بەش بۆ گۆڕینی بەکارهێنانی ڕام بۆ کەمتر لە 5MB (کوشتنی هەموو کاشەکان)
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
  intents: [ 1, 128 ] // تەنها ناردنی زانیاری سێرڤەر و ڤۆیس چالاک دەکات بۆ ئەوەی چاتەکان ڕام نەبەن
});

let connection = null;

// 🔥 چارەسەری ئامادەکراوی ئەو ئێرۆرەی کە پێشتر دەییا (Cannot read properties of null reading 'all')
const ClientUserSettingManager = require('discord.js-selfbot-v13/src/managers/ClientUserSettingManager');
try {
  ClientUserSettingManager.prototype._patch = function(data) {
    if (data && !data.friend_source_flags) {
      data.friend_source_flags = { all: false, mutual_friends: false, mutual_guilds: false };
    }
  };
} catch (e) {}

client.once('ready', async () => {
  console.log(`Bot with token ${token.substring(0, 10)}... is ready!`);
  
  client.user.setStatus("idle");

  try {
    const channel = await client.channels.fetch(channelId);
    
    // چوونە ناو ڤۆیسەکە
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
      selfMute: true, // خۆی میوت دەکات بۆ کەمکردنەوەی نێت و ڕام
      selfDeaf: true, // خۆی دێف دەکات بۆ ئەوەی دەنگی دەوروبەر وەرنەگرێت
    });

    console.log(`Joined the voice channel: ${channelId}`);

    // گوێگرتن لە گۆڕانکارییەکانی دۆخی پەیوەندییەکە بۆ ڕێکۆنێکت بوون
    connection.on('stateChange', (oldState, newState) => {
      console.log(`Connection state changed: ${newState.status}`);
      if (newState.status === 'Disconnected') {
        console.log(`Disconnected from voice channel. Attempting to reconnect in 5 seconds...`);
        setTimeout(() => {
          joinChannel(channel); // دووبارە هەوڵدانەوە بۆ چوونە ناو ڤۆیسەکە
        }, 5000);
      }
    });

    connection.on('error', (error) => {
      console.error(`Voice connection error: ${error}`);
    });

    connection.on('disconnect', (disconnectReason) => {
      console.log(`Disconnected from voice channel: ${disconnectReason}`);
    });
  } catch (error) {
    console.error(`Error joining the voice channel: ${error}`);
  }
}

// لۆگین کردنی سه‌ب-بۆتەکە
client.login(token).catch(err => {
  console.error(`Failed to login for sub-bot: ${err.message}`);
  process.exit(1);
});