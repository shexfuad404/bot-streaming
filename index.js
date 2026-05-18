const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const { registerCommands, handleInteraction } = require('./commands/commands');
const { spawn } = require('child_process');
const path = require('path');
const config = JSON.parse(fs.readFileSync('./config.json'));

// ڕێکخستنی مۆنگۆ
const MONGO_URI = config.mongoUri || "mongodb://localhost:27017";
const DB_NAME = "discord_manager";
let db;

// دروستکردنی کلاینتی بۆتی سەرەکی
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

async function initMongoDB() {
  try {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    console.log('[MongoDB] بە سەرکەوتوویی گرێدرا.');
    
    // لۆگین کردنی بۆتی سەرەکی دوای بەستنەوەی داتابەیس
    client.login(config.token);
  } catch (error) {
    console.error('[MongoDB Error]:', error.message);
    process.exit(1);
  }
}

client.once('ready', async () => {
  console.log('Main bot is ready!');
  registerCommands(); // تۆمارکردنی فەرمانەکان

  try {
    // هێنانی هەموو تۆکنەکان و ئایدی کەناڵەکان لە کۆلێکشنەکەوە
    const configCollection = db.collection('config');
    const rows = await configCollection.find({}).toArray();

    rows.forEach(({ token, channelId }) => {
      // سپاون کردنی پڕۆسەی سەربەخۆ بۆ هەر سه‌ب-بۆتێک
      const subBotProcess = spawn('node', [path.join(__dirname, 'subBot.js'), token, channelId]);

      subBotProcess.stdout.on('data', (data) => {
        console.log(`Sub-bot [${channelId}] output: ${data}`);
      });

      subBotProcess.stderr.on('data', (data) => {
        console.error(`Sub-bot [${channelId}] error: ${data}`);
      });

      subBotProcess.on('close', (code) => {
        console.log(`Sub-bot process [${channelId}] exited with code ${code}`);
      });
    });
  } catch (err) {
    console.error('کێشە لە هێنانی تۆکنەکان لە مۆنگۆ:', err);
  }
});

client.on('interactionCreate', (interaction) => {
  // ناردنی کۆنتێکستی داتابەیس بۆ هاندلەرەکە ئەگەر پێویست بوو
  handleInteraction(interaction, client, db); 
});

// دەستپێکردنی پڕۆژەکە لە داتابەیسەوە
initMongoDB();