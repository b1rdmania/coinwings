require('dotenv').config();

const config = {
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        serviceAccount: require('../../serviceAccountKey.json')
    }
};

module.exports = config; 