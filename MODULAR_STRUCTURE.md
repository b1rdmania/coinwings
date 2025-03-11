# CoinWings Bot - Modular Structure

This document outlines the modular structure of the CoinWings bot codebase, designed to make incremental improvements easier and safer.

## Core Principles

1. **Centralized Configuration**: All key settings and constants are stored in a single configuration file.
2. **Modular Services**: External integrations (OpenAI, Firebase) are isolated in their own service modules.
3. **Clear Separation of Concerns**: Each file has a specific responsibility.
4. **Consistent Error Handling**: Errors are caught and handled consistently throughout the codebase.
5. **Functional Decomposition**: Complex functionality is broken down into smaller, focused functions.

## File Structure

```
src/
├── bot.js                  # Main bot entry point
├── config/
│   └── config.js           # Centralized configuration
├── handlers/
│   ├── commandHandlers.js  # Command and action handlers
│   ├── messageHandler.js   # Text message handler
│   └── notificationHandler.js # Agent notification handler
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

### 2. Bot Entry Point (`src/bot.js`)

The main entry point that:
- Initializes the Telegram bot
- Registers handlers
- Configures webhook or polling
- Handles graceful shutdown

### 3. Handlers

#### Command Handlers (`src/handlers/commandHandlers.js`)
- Registers all command and action handlers
- Provides keyboard creation utilities
- Handles user interactions with buttons

#### Message Handler (`src/handlers/messageHandler.js`)
- Processes incoming text messages
- Manages conversation flow
- Integrates with OpenAI for responses

#### Notification Handler (`src/handlers/notificationHandler.js`)
- Sends notifications to agents
- Formats notification messages
- Stores lead data in the database

### 4. Services

#### OpenAI Service (`src/services/openai.js`)
- Handles all interactions with the OpenAI API
- Generates responses using the API
- Provides fallback responses when the API fails

#### Firebase Service (`src/services/firebase.js`)
- Manages database interactions
- Stores and retrieves conversation data
- Handles lead information

### 5. Utilities

#### Lead Scoring (`src/utils/leadScoring.js`)
- Calculates lead scores based on conversation data
- Uses thresholds from the central configuration
- Determines when to escalate to an agent
- Assigns priority levels to leads

## Making Changes Safely

When making changes to the codebase:

1. **Configuration Changes**: Modify `src/config/config.js` for any parameter adjustments.
2. **Command Behavior**: Update `src/handlers/commandHandlers.js` for changes to commands and actions.
3. **Message Processing**: Modify `src/handlers/messageHandler.js` for changes to message handling.
4. **Agent Notifications**: Update `src/handlers/notificationHandler.js` for changes to agent notifications.
5. **OpenAI Integration**: Update `src/services/openai.js` for changes to AI behavior.
6. **Lead Scoring Logic**: Modify `src/utils/leadScoring.js` for changes to scoring algorithm.

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