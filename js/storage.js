// storage.js

const STORAGE_KEY = "among-us-stat-tracker-data";
const PLAYER_SETTINGS_KEY = "among-us-player-settings";

function loadStoredEntries() {

    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {

        return [];

    }

    try {

        return JSON.parse(raw);

    } catch {

        return [];

    }

}

function saveEntries(entries) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(entries)
    );

}

function loadPlayerSettings() {

    const raw =
        localStorage.getItem(
            PLAYER_SETTINGS_KEY
        );

    const defaults = {
        aliases: {},
        hidden: [],
        keepSingleGame: []
    };

    if (!raw) {
        return defaults;
    }

    try {

        const parsed = JSON.parse(raw);

        // Migrate settings saved before keepSingleGame existed.
        return {
            aliases: parsed.aliases || {},
            hidden: parsed.hidden || [],
            keepSingleGame: parsed.keepSingleGame || []
        };

    } catch {

        return defaults;

    }

}

function savePlayerSettings(settings) {

    localStorage.setItem(

        PLAYER_SETTINGS_KEY,

        JSON.stringify(settings)

    );

}