// js/playerStats.js

function createPlayerStats() {

    return {

        gamesPlayed: 0,

        gamesAsCrewmate: 0,

        gamesAsImpostor: 0,

        crewWins: 0,

        impWins: 0,

        crewWinRate: 0,

        impWinRate: 0

    };

}

function finalizePlayerRates(playerStats) {

    for (const stat of Object.values(playerStats)) {

        stat.crewWinRate =
            stat.gamesAsCrewmate
                ? stat.crewWins / stat.gamesAsCrewmate
                : 0;

        stat.impWinRate =
            stat.gamesAsImpostor
                ? stat.impWins / stat.gamesAsImpostor
                : 0;

    }

    return playerStats;

}

function formatRate(rate) {

    if (!Number.isFinite(rate)) {

        return "0.00 (0%)";

    }

    return `${rate.toFixed(2)} (${(rate * 100).toFixed(0)}%)`;

}