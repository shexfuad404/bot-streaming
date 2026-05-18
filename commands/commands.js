const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// لۆدکردنی کۆنفیگی سەرەکی
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')));

// تۆمارکردنی فەرمانەکانی دیسکۆرد (Slash Commands)
const commands = [
  new SlashCommandBuilder()
    .setName('add_token')
    .setDescription('Add token and voice channel ID')
    .addStringOption(option => option.setName('token').setDescription('The bot token').setRequired(true))
    .addStringOption(option => option.setName('idvoice').setDescription('The voice channel ID').setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('remove_token')
    .setDescription('Remove token and stop bot instance')
    .addStringOption(option => option.setName('token').setDescription('The bot token to remove').setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('token_list')
    .setDescription('Send the list of tokens in private chat')
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('limit')
    .setDescription('Manage token limits for users')
    .addStringOption(option => option.setName('action').setDescription('Action to perform (remove/give)').setRequired(true)
      .addChoices(
        { name: 'remove', value: 'remove' },
        { name: 'give', value: 'give' }
      ))
    .addUserOption(option => option.setName('user').setDescription('The user to modify').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('The amount to add/remove').setRequired(true))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coins.')
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('credit')
    .setDescription('Check your current coin balance.')
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('buy_limit')
    .setDescription('Buy additional token limit.')
    .addIntegerOption(option => option.setName('amount').setDescription('Amount of additional tokens to buy.').setRequired(true))
    .toJSON(),
    
  new SlashCommandBuilder()
    .setName('reconnect')
    .setDescription('To reconnect all accounts')
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('To see all commands')
    .toJSON(),
];

const registerCommands = async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};

// کۆنتڕۆڵکردنی فەرمانەکان و بەستنەوەیان بە مۆنگۆ
const handleInteraction = async (interaction, client, db) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user } = interaction;

  // دیاریکردنی کۆلێکشنەکانی مۆنگۆ
  const configColl = db.collection('config');
  const limitsColl = db.collection('limits');
  const balanceColl = db.collection('balance');

  switch (commandName) {
    case 'add_token': {
      const token = options.getString('token');
      const channelId = options.getString('idvoice');

      try {
        // وەرگرتنی لیمیت لە مۆنگۆ
        const limitRow = await limitsColl.findOne({ userId: user.id });
        const userLimit = limitRow ? limitRow.tokens_limit : 1;

        // وەرگرتنی ئەو تۆکنانەی بەکارهێنەرەکە پێشتر زیادی کردوون
        const userTokens = await configColl.find({ userId: user.id }).toArray();

        if (userTokens.length >= userLimit) {
          return await interaction.reply({ content: `تۆ ناتوانیت لە لیمیتی خۆت زیاتر تۆکن دابنێیت! لیمیتی تۆ: ${userLimit}`, ephemeral: true });
        }

        // خەزنکردنی تۆکن لە مۆنگۆ
        await configColl.insertOne({ token, channelId, userId: user.id });

        // دروستکردنی سپاون بۆ سه‌ب-بۆت بە جیاوازی
        const subBotProcess = spawn('node', [path.join(__dirname, 'subBot.js'), token, channelId]);

        subBotProcess.stdout.on('data', (data) => console.log(`Sub-bot output: ${data}`));
        subBotProcess.stderr.on('data', (data) => console.error(`Sub-bot error: ${data}`));

        await interaction.reply({ content: `تۆکنەکە بە سەرکەوتوویی پاشەکەوت کرا و چووە ناو ڤۆیسەکەوە!`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشەیەک لە داتابەیسی مۆنگۆدا ڕوویدا.', ephemeral: true });
      }
      break;
    }
  
    case 'reconnect': {
      if (!config.ownerIDs.includes(user.id)) {
        return await interaction.reply({ content: 'تۆ مۆڵەتی بەکارهێنانی ئەم فەرمانەت نییە.', ephemeral: true });
      }

      try {
        // هێنانی هەموو تۆکنەکان لە مۆنگۆ
        const rows = await configColl.find({}).toArray();

        rows.forEach(({ token, channelId }) => {
          const subBotProcess = spawn('node', [path.join(__dirname, 'subBot.js'), token, channelId]);
          subBotProcess.stdout.on('data', (data) => console.log(`Sub-bot output: ${data}`));
          subBotProcess.stderr.on('data', (data) => console.error(`Sub-bot error: ${data}`));
        });

        await interaction.reply({ content: 'هەموو ئەکاونتەکان دووبارە ڕێکۆنێکت کرانەوە!', ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشەی داتابەیس.', ephemeral: true });
      }
      break;
    }

    case 'remove_token': {
      const tokenToRemove = options.getString('token');

      try {
        const row = await configColl.findOne({ token: tokenToRemove, userId: user.id });

        if (!row) {
          return await interaction.reply({ content: 'ئەم تۆکنە نەدۆزرایەوە یان هی تۆ نییە!', ephemeral: true });
        }

        await configColl.deleteOne({ token: tokenToRemove, userId: user.id });
        await interaction.reply({ content: `تۆکنی نێردراو بە سەرکەوتوویی سڕایەوە.`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشەی داتابەیس.', ephemeral: true });
      }
      break;
    }

    case 'token_list': {
      try {
        const rows = await configColl.find({ userId: user.id }).toArray();
        const userTokens = rows.map(r => r.token).join('\n') || 'هیچ تۆکنێکت نییە.';
        
        await user.send(`لیستی تۆکنەکانت:\n\`\`\`${userTokens}\`\`\``);
        await interaction.reply({ content: 'لیستی تۆکنەکان بۆ نێردرا لە چاتی تایبەت (DM).', ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: 'نەمتوانی نامەت بۆ بنێرم، دڵنیابەوە چاتی تایبەتت کراوەیە.', ephemeral: true });
      }
      break;
    }

    case 'limit': {
      if (!config.ownerIDs.includes(user.id)) {
        return await interaction.reply({ content: 'تۆ مۆڵەتی بەکارهێنانی ئەم فەرمانەت نییە.', ephemeral: true });
      }

      const action = options.getString('action');
      const targetUser = options.getUser('user');
      const amount = options.getInteger('amount');

      try {
        const limitRow = await limitsColl.findOne({ userId: targetUser.id });
        const currentLimit = limitRow ? limitRow.tokens_limit : 1;
        let newLimit = currentLimit;

        if (action === 'give') {
          newLimit += amount;
        } else if (action === 'remove') {
          newLimit = Math.max(1, currentLimit - amount);
        }

        await limitsColl.updateOne(
          { userId: targetUser.id },
          { $set: { tokens_limit: newLimit } },
          { upsert: true }
        );

        await interaction.reply({ content: `لیمیتی بەکارهێنەر ${targetUser.tag} گۆڕدرا بۆ: ${newLimit}`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشەی داتابەیس لە گۆڕینی لیمیت.', ephemeral: true });
      }
      break;
    }

    case 'daily': {
      try {
        const row = await balanceColl.findOne({ userId: user.id });
        const now = Date.now();
        const lastClaim = row ? row.lastClaim : 0;
        const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

        if (hoursSinceLastClaim < 24) {
          const remainingHours = 24 - hoursSinceLastClaim;
          await interaction.reply({ content: `تۆ دەتوانیت کۆینی ڕۆژانە وەربگریتەوە دوای: ${remainingHours.toFixed(1)} کاتژمێر.`, ephemeral: true });
        } {
          const dailyCoins = 3;
          const newCoins = (row ? row.coins : 0) + dailyCoins;

          await balanceColl.updateOne(
            { userId: user.id },
            { $set: { coins: newCoins, lastClaim: now } },
            { upsert: true }
          );
          await interaction.reply(`تۆ ٣ کۆینی ڕۆژانەت وەرگرت! کۆی گشتی کۆینەکانت: ${newCoins}`);
        }
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشە لە وەرگرتنی دەیلی.', ephemeral: true });
      }
      break;
    }

    case 'credit': {
      try {
        const row = await balanceColl.findOne({ userId: user.id });
        const userBalance = row ? row.coins : 0;

        const limitRow = await limitsColl.findOne({ userId: user.id });
        const userLimit = limitRow ? limitRow.tokens_limit : 1;

        await interaction.reply(`کۆینەکانت: ${userBalance} کۆین | لیمیتی تۆکنەکانت: ${userLimit}`);
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشەی داتابەیس لە پیشاندانی کرێدیت.', ephemeral: true });
      }
      break;
    }

    case 'buy_limit': {
      const amountToBuy = options.getInteger('amount');
      const cost = amountToBuy * 20;

      try {
        const row = await balanceColl.findOne({ userId: user.id });
        const userBalance = row ? row.coins : 0;

        if (userBalance < cost) {
          return await interaction.reply({ content: `کۆینی پێویستت نییە! پێویستت بە ${cost} کۆین هەیە.`, ephemeral: true });
        }

        const limitRow = await limitsColl.findOne({ userId: user.id });
        const currentLimit = limitRow ? limitRow.tokens_limit : 1;

        const newBalance = userBalance - cost;
        const newLimit = currentLimit + amountToBuy;

        // ئەپدێتکردنی باڵانس و لیمیت لە مۆنگۆ
        await balanceColl.updateOne({ userId: user.id }, { $set: { coins: newBalance } });
        await limitsColl.updateOne({ userId: user.id }, { $set: { tokens_limit: newLimit } }, { upsert: true });

        await interaction.reply(`پیرۆزە! تۆ ${amountToBuy} لیمیتی زیاترت کڕی بە ${cost} کۆین. لیمیتی نوێت: ${newLimit}`);
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'کێشە لە کڕینی لیمیت.', ephemeral: true });
      }
      break;
    }

    case 'help': {
      const helpMessage = `
        **لیستی هەموو فەرمانەکان**
        /add_token: زیادکردنی ئەکاونت بۆ ناو ڤۆیس.
        /remove_token: سڕینەوەی ئەکاونتەکە لە لۆدبوون.
        /token_list: بینینی لیستی ئەو تۆکنانەی داتناون.
        /daily: وەرگرتنی ٣ کۆینی ڕۆژانە.
        /credit: بینینی باڵانسی کۆین و لیمیتی خۆت.
        /buy_limit: کڕینی لیمیتی تۆکنی زیاتر بە کۆینەکانت.
      `;
      await interaction.reply(helpMessage);
      break;
    }

    default:
      await interaction.reply({ content: 'فەرمانەکە نەدۆزرایەوە.', ephemeral: true });
      break;
  }
};

module.exports = { registerCommands, handleInteraction };