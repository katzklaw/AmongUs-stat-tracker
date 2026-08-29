// js/playerDatabase.js

const PLAYER_DB_KEY = "among-us-player-database"; // legacy localStorage key

async function loadPlayerDatabase() {

    const fallback = { nextId: 1, players: {} };

    try {

        const stored = await loadPlayerDatabaseRaw();
        if (stored) {
            return stored;
        }

        // One-time migration from the old localStorage key, same idea as
        // the entries/settings migration in storage.js.
        const raw = localStorage.getItem(PLAYER_DB_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            await savePlayerDatabaseRaw(parsed);
            localStorage.removeItem(PLAYER_DB_KEY);
            return parsed;
        }

        return fallback;

    } catch (err) {

        console.error("Failed to load player database:", err);
        return fallback;

    }

}

async function savePlayerDatabase(database) {

    await savePlayerDatabaseRaw(database);

}

function getPlayer(database, id) {

    return database.players[id];

}

function getPlayerByAlias(database, alias) {

    alias = alias.trim().toLowerCase();

    for (const player of Object.values(database.players)) {

        for (const existing of player.aliases) {

            if (existing.toLowerCase() === alias) {

                return player;

            }

        }

    }

    return null;

}

function addPlayer(database, name) {

    const existing =
        getPlayerByAlias(
            database,
            name
        );

    if (existing) {

        return existing;

    }

    const player = {

        id: database.nextId++,

        displayName: name,

        aliases: [

            name

        ],

        hidden: false,

        notes: ""

    };

    database.players[player.id] = player;

    return player;

}

function addAlias(

    database,

    playerId,

    alias

) {

    alias = alias.trim();

    if (!alias) return;

    const player =
        database.players[playerId];

    if (!player) return;

    if (

        player.aliases.some(

            a =>

            a.toLowerCase() === alias.toLowerCase()

        )

    ) {

        return;

    }

    player.aliases.push(alias);

}