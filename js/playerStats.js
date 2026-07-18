// js/playerStats.js
//
// Aggregation logic: takes the per-game player records that js/parser.js
// produces and merges them across many games into running totals, then
// turns those totals into rates/averages for display.

function createEmptyAggregateStats(displayName) {
  return {
    displayName,
    gamesPlayed: 0,
    gamesAsCrewmate: 0,
    gamesAsImpostor: 0,
    crewWins: 0,
    impWins: 0,

    kills: 0,
    deaths: 0,
    ejections: 0,
    ejectionsAsCrew: 0,
    ejectionsAsImpostor: 0,
    survivedGames: 0,
    tasksCompletedGames: 0,

    taskWins: 0,
    killWins: 0,
    voteWins: 0,
    sabotageWins: 0,
    otherWins: 0,

    killLocations: {},
    deathLocations: {},

    votesCast: 0,
    votesSkipped: 0,
    correctVotes: 0,
    incorrectVotes: 0,
    decisiveVotes: 0,

    // filled in by finalizePlayerRates:
    crewWinRate: 0,
    impWinRate: 0,
    avgKillsPerImpGame: 0,
    survivalRate: 0,
    taskCompletionRate: 0,
    ejectionRateAsCrew: 0,
    ejectionRateAsImpostor: 0,
    voteAccuracy: 0,
    decisiveVoteRate: 0
  };
}

// Kept for backwards compatibility with anything expecting the old shape.
function createPlayerStats() {
  return createEmptyAggregateStats('');
}

function mergeLocationCounts(target, source) {
  for (const [location, count] of Object.entries(source || {})) {
    target[location] = (target[location] || 0) + count;
  }
}

// Adds one game's player record (from parser.js) into a running aggregate.
function mergeGameRecordIntoAggregate(aggregate, gameRecord) {
  aggregate.gamesPlayed += gameRecord.gamesPlayed;
  aggregate.gamesAsCrewmate += gameRecord.gamesAsCrewmate;
  aggregate.gamesAsImpostor += gameRecord.gamesAsImpostor;
  aggregate.crewWins += gameRecord.crewWins;
  aggregate.impWins += gameRecord.impWins;

  aggregate.kills += gameRecord.kills;
  aggregate.deaths += gameRecord.died;
  aggregate.ejections += gameRecord.wasEjected;
  if (gameRecord.wasEjected) {
    if (gameRecord.role === 'crewmate') aggregate.ejectionsAsCrew += 1;
    else aggregate.ejectionsAsImpostor += 1;
  }
  aggregate.survivedGames += gameRecord.survived;
  aggregate.tasksCompletedGames += gameRecord.completedAllTasks;

  aggregate.taskWins += gameRecord.taskWins;
  aggregate.killWins += gameRecord.killWins;
  aggregate.voteWins += gameRecord.voteWins;
  aggregate.sabotageWins += gameRecord.sabotageWins;
  aggregate.otherWins += gameRecord.otherWins;

  mergeLocationCounts(aggregate.killLocations, gameRecord.killLocations);
  mergeLocationCounts(aggregate.deathLocations, gameRecord.deathLocations);

  aggregate.votesCast += gameRecord.votesCast;
  aggregate.votesSkipped += gameRecord.votesSkipped;
  aggregate.correctVotes += gameRecord.correctVotes;
  aggregate.incorrectVotes += gameRecord.incorrectVotes;
  aggregate.decisiveVotes += gameRecord.decisiveVotes;
}

function finalizePlayerRates(playerStats) {
  for (const stat of Object.values(playerStats)) {
    stat.crewWinRate = stat.gamesAsCrewmate ? stat.crewWins / stat.gamesAsCrewmate : 0;
    stat.impWinRate = stat.gamesAsImpostor ? stat.impWins / stat.gamesAsImpostor : 0;
    stat.avgKillsPerImpGame = stat.gamesAsImpostor ? stat.kills / stat.gamesAsImpostor : 0;
    stat.survivalRate = stat.gamesPlayed ? stat.survivedGames / stat.gamesPlayed : 0;
    stat.taskCompletionRate = stat.gamesPlayed ? stat.tasksCompletedGames / stat.gamesPlayed : 0;
    stat.ejectionRateAsCrew = stat.gamesAsCrewmate ? stat.ejectionsAsCrew / stat.gamesAsCrewmate : 0;
    stat.ejectionRateAsImpostor = stat.gamesAsImpostor ? stat.ejectionsAsImpostor / stat.gamesAsImpostor : 0;
    stat.voteAccuracy = stat.votesCast ? stat.correctVotes / stat.votesCast : 0;
    stat.decisiveVoteRate = stat.votesCast ? stat.decisiveVotes / stat.votesCast : 0;
  }

  return playerStats;
}

function formatRate(rate) {
  if (!Number.isFinite(rate)) {
    return "0.00 (0%)";
  }

  return `${rate.toFixed(2)} (${(rate * 100).toFixed(0)}%)`;
}

function formatPercent(rate) {
  if (!Number.isFinite(rate)) {
    return "0%";
  }
  return `${(rate * 100).toFixed(0)}%`;
}

function formatAverage(value) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return value.toFixed(2);
}

// Returns [[location, count], ...] sorted highest-first, capped to `limit`.
function topLocations(locationCounts, limit = 5) {
  return Object.entries(locationCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
