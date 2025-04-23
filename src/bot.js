require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/config');
const http = require('http');
const https = require('https');
const express = require('express');
const path = require('path');

// Import handlers
const { registerCommandHandlers } = require('./handlers/commandHandlers');
const { registerMessageHandler } = require('./handlers/messageHandler');

// Import admin routes AFTER potential Firebase init (assuming handlers don't init Firebase)
// Ensure Firebase is initialized (likely happens when handlers/services are required)
// For safety, we could explicitly require firebase service here if needed.
// Example: require('./services/firebase'); // Uncomment if Firebase isn't initialized elsewhere first

const adminRoutes = require('./routes/adminRoutes');

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
 * Initialize Express App
 * @returns {Object} Configured Express app instance
 */
function initializeExpressApp() {
    const app = express();

    // Debug logging middleware
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} WEB ${req.method} ${req.url}`);
        next();
    });

    // Middleware
    app.use(express.json());

    // API Routes
    app.use('/api/admin', adminRoutes);

    // Serve static files from the React build directory
    app.use(express.static(path.join(__dirname, '../build')));

    // For any other request, send the React app
    app.get('*', (req, res) => {
        // Check if it looks like an API call that wasn't caught
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        // Otherwise, serve the frontend
        res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('Web server error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    });

    return app;
}

/**
 * Start the bot and web server
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} app - Express app instance
 */
function startApp(bot, app) {
  const port = process.env.PORT || 3000;
  const webAdminPort = process.env.ADMIN_PORT || 3001;

  // Start based on environment
  if (process.env.NODE_ENV === 'production' || process.env.APP_URL) {
    // Production: Webhook mode, single server
    console.log('Starting in production mode (webhook)...');
    const domain = config.telegram.webhookDomain;
    const secretPath = config.telegram.webhookPath || `/telegraf/${bot.secretPathComponent()}`;

    // Mount bot webhook handler onto the Express app
    app.use(bot.webhookCallback(secretPath));
    console.log(`Bot webhook will be available at ${domain}${secretPath}`);

    // Set webhook with Telegram
    bot.telegram.setWebhook(`${domain}${secretPath}`).then(() => {
        console.log('Webhook set successfully');
    }).catch(err => {
        console.error('Error setting webhook:', err);
    });

    // Start the combined HTTP server
    const server = http.createServer(app);
    server.listen(port, () => {
      console.log(`CoinWings Bot & Admin UI running on port ${port}`);
    });

    // Graceful shutdown logic
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
    
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } else {
    // Development: Long polling for bot, separate server for admin UI
    console.log('Starting in development mode (long polling)...');
    // Start bot with long polling
    bot.launch().then(() => {
        console.log('CoinWings bot running with long polling');
    });

    // Start Express server for Admin UI/API on a different port
    app.listen(webAdminPort, () => {
        console.log(`Admin UI/API available at http://localhost:${webAdminPort}`);
    });

    // Enable graceful stop for bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

// Initialize Bot and Express App
const bot = initializeBot();
const app = initializeExpressApp();

// Start everything
startApp(bot, app);