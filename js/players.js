// js/players.js

function createPlayerDatabase() {

    return {

        nextId: 1,

        players: {}

    };

}

function createPlayer(displayName) {

    return {

        id: null,

        displayName,

        aliases: [displayName],

        hidden: false

    };

}

function findPlayerByAlias(database, name) {

    const search = name.toLowerCase();

    for (const player of Object.values(database.players)) {

        if (

            player.aliases.some(

                alias => alias.toLowerCase() === search

            )

        ) {

            return player;

        }

    }

    return null;

}

function getOrCreatePlayer(database, name) {

    let player =

        findPlayerByAlias(

            database,

            name

        );

    if (player) {

        return player;

    }

    player = createPlayer(name);

    player.id = database.nextId++;

    database.players[player.id] = player;

    return player;

}

function mergePlayers(

    database,

    alias,

    targetName

) {

    const target =

        getOrCreatePlayer(

            database,

            targetName

        );

    if (

        !target.aliases.includes(alias)

    ) {

        target.aliases.push(alias);

    }

}