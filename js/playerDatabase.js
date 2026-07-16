// js/playerDatabase.js

const PLAYER_DB_KEY = "among-us-player-database";

function loadPlayerDatabase() {

    const raw = localStorage.getItem(PLAYER_DB_KEY);

    if (!raw) {

        return {
            nextId: 1,
            players: {}
        };

    }

    try {

        return JSON.parse(raw);

    } catch {

        return {
            nextId: 1,
            players: {}
        };

    }

}

function savePlayerDatabase(database) {

    localStorage.setItem(
        PLAYER_DB_KEY,
        JSON.stringify(database)
    );

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