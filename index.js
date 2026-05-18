const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const { registerCommands, handleInteraction } = require('./commands/commands');
const { spawn } = require('child_process');
const path = require('path');
const { createLocalDb } = require('./localDb');

// Load config and use environment variables as fallback
let config;
try {
  config = JSON.parse(fs.readFileSync('./config.json'));
} catch (err) {
  console.error('❌ Error reading config.json:', err.message);
  process.exit(1);
}

// Use environment variables for sensitive data
config.token = process.env.DISCORD_TOKEN || config.token;
config.mongoUri = process.env.MONGO_URI || config.mongoUri || "mongodb://127.0.0.1:27017";

if (!config.token || config.token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ CRITICAL: No valid Discord token found! Set DISCORD_TOKEN env var or update config.json');
  process.exit(1);
}

const DB_NAME = "discord_manager";
const LOCAL_DB_PATH = path.join(__dirname, 'local-db.json');
let db;

// Create Discord client with proper intents
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

async function initMongoDB() {
  try {
    const mongoClient = new MongoClient(config.mongoUri);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    console.log('✅ [MongoDB] Connected successfully');
  } catch (error) {
    console.error('❌ [MongoDB Error]:', error.message);
    console.warn('⚠️  [MongoDB] Falling back to local JSON file');
    db = createLocalDb(LOCAL_DB_PATH);
    console.log('✅ [LocalDB] JSON backup ready');
  }

  // Login after database is ready
  client.login(config.token);
}

client.once('clientReady', async () => {
  console.log('✅ Main bot is ready!');
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
  // Pass database context to handler
  handleInteraction(interaction, client, db); 
});

// Add global error handlers
client.on('error', (error) => {
  console.error('❌ [Discord Client Error]:', error.message);
});

client.on('warn', (info) => {
  console.warn('⚠️  [Discord Client Warning]:', info);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start the bot
initMongoDB();