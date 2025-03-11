require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/config');
const http = require('http');

// Import handlers
const { registerCommandHandlers } = require('./handlers/commandHandlers');
const { registerMessageHandler } = require('./handlers/messageHandler');

/**
 * Initialize and configure the Telegram bot
 * @returns {Object} Configured Telegraf bot instance
 */
function initializeBot() {
  // Initialize bot
  const bot = new Telegraf(config.telegram.token);
  
  // Register handlers
  registerCommandHandlers(bot);
  registerMessageHandler(bot);
  
  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('Sorry, something went wrong. Our team has been notified.');
  });
  
  return bot;
}

/**
 * Start the bot with appropriate configuration
 * @param {Object} bot - Telegraf bot instance
 */
function startBot(bot) {
  // Start bot with webhook when deployed
  if (process.env.NODE_ENV === 'production' || process.env.APP_URL) {
    // Set webhook
    const domain = config.telegram.webhookDomain;
    const secretPath = config.telegram.webhookPath;
    const port = process.env.PORT || 3000;
    
    // Start webhook with the correct path
    bot.telegram.setWebhook(`${domain}${secretPath}`);
    
    // Create an HTTP server to handle the webhook
    const server = http.createServer(bot.webhookCallback(secretPath));
    server.listen(port, () => {
      console.log(`CoinWings bot is running with webhook on port ${port}`);
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = () => {
      console.log('Received shutdown signal, closing server...');
      server.close(() => {
        console.log('Server closed, exiting process');
        process.exit(0);
      });
      
      // Force close after 10 seconds if server doesn't close gracefully
      setTimeout(() => {
        console.log('Server did not close in time, forcing exit');
        process.exit(1);
      }, 10000);
    };
    
    // Keep alive
    setInterval(() => {
      http.get(`${domain}/ping`);
    }, 25 * 60 * 1000); // 25 minutes
    
    // Register shutdown handlers
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } else {
    // Start bot with long polling for local development
    bot.launch();
    console.log('CoinWings bot is running with long polling');
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

// Initialize and start the bot
const bot = initializeBot();
startBot(bot);