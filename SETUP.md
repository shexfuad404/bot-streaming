# Bot Setup Guide

## Prerequisites
- Node.js 16+
- Discord Bot Token (from Discord Developer Portal)
- MongoDB (optional, falls back to local JSON)

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up your Discord token:**

   **Option A: Using environment variables (RECOMMENDED)**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your bot token:
   ```
   DISCORD_TOKEN=your_bot_token_here
   MONGO_URI=mongodb://127.0.0.1:27017
   ```

   **Option B: Update config.json**
   ```json
   {
     "token": "your_bot_token_here",
     "clientId": "your_client_id",
     "ownerIDs": ["your_user_id"],
     "mongoUri": "mongodb://127.0.0.1:27017"
   }
   ```

## Running the Bot

```bash
npm start
```

## Troubleshooting

### "Failed to login: An invalid token was provided"
- ❌ Token is incorrect or expired
- ✅ Get a new token from https://discord.com/developers/applications
- ✅ Make sure you're using a BOT token, not a user token

### "Error joining voice"
- ❌ Bot doesn't have voice permissions in the channel
- ✅ Check bot permissions: View Channel, Connect, Speak

### "MongoDB connection refused"
- ✅ MongoDB not required - bot falls back to local JSON database
- ✅ Or start MongoDB: `mongod`

## Security Notes
- ⚠️ Never commit tokens to git
- ⚠️ Use `.env` files for sensitive data
- ⚠️ Add `.env` to `.gitignore` (already done)
- ⚠️ Rotate tokens if they're exposed
