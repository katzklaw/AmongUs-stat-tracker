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

    if (!raw) {

        return {

            aliases: {},

            hidden: []

        };

    }

    try {

        return JSON.parse(raw);

    } catch {

        return {

            aliases: {},

            hidden: []

        };

    }

}

function savePlayerSettings(settings) {

    localStorage.setItem(

        PLAYER_SETTINGS_KEY,

        JSON.stringify(settings)

    );

}