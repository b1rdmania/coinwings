# CoinWings Bot - Modular Structure

This document outlines the modular structure of the CoinWings bot codebase, designed to make incremental improvements easier and safer.

## Core Principles

1. **Centralized Configuration**: All key settings and constants are stored in a single configuration file.
2. **Modular Services**: External integrations (OpenAI, Firebase) are isolated in their own service modules.
3. **Clear Separation of Concerns**: Each file has a specific responsibility.
4. **Consistent Error Handling**: Errors are caught and handled consistently throughout the codebase.

## File Structure

```
src/
├── bot.js                  # Main bot entry point
├── config/
│   └── config.js           # Centralized configuration
├── models/
│   └── conversation.js     # Conversation data model
├── services/
│   ├── firebase.js         # Firebase integration
│   └── openai.js           # OpenAI integration
└── utils/
    └── leadScoring.js      # Lead scoring utility
```

## Key Components

### 1. Configuration (`src/config/config.js`)

Contains all configurable parameters:
- API keys and tokens
- Webhook settings
- Lead scoring thresholds
- Response templates
- OpenAI parameters

### 2. OpenAI Service (`src/services/openai.js`)

Handles all interactions with the OpenAI API:
- Initializes the OpenAI client
- Generates responses using the API
- Provides fallback responses when the API fails

### 3. Lead Scoring (`src/utils/leadScoring.js`)

Calculates lead scores based on conversation data:
- Uses thresholds from the central configuration
- Determines when to escalate to an agent
- Assigns priority levels to leads

### 4. Main Bot (`src/bot.js`)

The main entry point that:
- Initializes the Telegram bot
- Handles commands and messages
- Uses the services and utilities
- Manages the conversation flow

## Making Changes Safely

When making changes to the codebase:

1. **Configuration Changes**: Modify `src/config/config.js` for any parameter adjustments.
2. **OpenAI Integration**: Update `src/services/openai.js` for changes to AI behavior.
3. **Lead Scoring Logic**: Modify `src/utils/leadScoring.js` for changes to scoring algorithm.
4. **Bot Behavior**: Update `src/bot.js` for changes to the conversation flow.

## Deployment Process

1. Make changes to the appropriate module
2. Test locally using `npm run dev`
3. Commit changes with descriptive messages
4. Deploy to Heroku with `git push heroku main`

## Monitoring and Debugging

- Use `heroku logs --tail` to monitor the bot in real-time
- Check for specific log messages that indicate the flow of execution
- Look for error messages that pinpoint issues

By following this modular structure, we can make incremental improvements without risking the stability of the entire system. 