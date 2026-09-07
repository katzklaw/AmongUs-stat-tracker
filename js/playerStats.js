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
    votesCastAsCrew: 0,
    correctVotesAsCrew: 0,
    incorrectVotesAsCrew: 0,

    tasksDoneSum: 0,     // exact task fractions, only from newer-format logs
    tasksTotalSum: 0,
    gamesWithTaskData: 0,

    // filled in by finalizePlayerRates:
    crewWinRate: 0,
    impWinRate: 0,
    avgKillsPerImpGame: 0,
    survivalRate: 0,
    taskCompletionRate: 0,
    exactTaskCompletionRate: null,
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
// `gameRecord` may come from an older, differently-shaped saved entry -
// every field is defaulted so old/partial data contributes zero rather
// than corrupting the running totals with NaN.
function mergeGameRecordIntoAggregate(aggregate, gameRecord) {
  const g = gameRecord || {};
  const num = (value) => (typeof value === 'number' && !Number.isNaN(value) ? value : 0);

  aggregate.gamesPlayed += num(g.gamesPlayed);
  aggregate.gamesAsCrewmate += num(g.gamesAsCrewmate);
  aggregate.gamesAsImpostor += num(g.gamesAsImpostor);
  aggregate.crewWins += num(g.crewWins);
  aggregate.impWins += num(g.impWins);

  aggregate.kills += num(g.kills);
  aggregate.deaths += num(g.died);
  aggregate.ejections += num(g.wasEjected);
  if (g.wasEjected) {
    if (g.role === 'crewmate') aggregate.ejectionsAsCrew += 1;
    else aggregate.ejectionsAsImpostor += 1;
  }
  aggregate.survivedGames += num(g.survived);
  aggregate.tasksCompletedGames += num(g.completedAllTasks);

  aggregate.taskWins += num(g.taskWins);
  aggregate.killWins += num(g.killWins);
  aggregate.voteWins += num(g.voteWins);
  aggregate.sabotageWins += num(g.sabotageWins);
  aggregate.otherWins += num(g.otherWins);

  mergeLocationCounts(aggregate.killLocations, g.killLocations);
  mergeLocationCounts(aggregate.deathLocations, g.deathLocations);

  aggregate.votesCast += num(g.votesCast);
  aggregate.votesSkipped += num(g.votesSkipped);
  aggregate.correctVotes += num(g.correctVotes);
  aggregate.incorrectVotes += num(g.incorrectVotes);
  aggregate.decisiveVotes += num(g.decisiveVotes);
  aggregate.votesCastAsCrew += num(g.votesCastAsCrew);
  aggregate.correctVotesAsCrew += num(g.correctVotesAsCrew);
  aggregate.incorrectVotesAsCrew += num(g.incorrectVotesAsCrew);

  // Only newer-format logs have this - older games simply don't contribute.
  if (typeof g.tasksDone === 'number' && typeof g.tasksTotal === 'number' && g.tasksTotal > 0) {
    aggregate.tasksDoneSum += g.tasksDone;
    aggregate.tasksTotalSum += g.tasksTotal;
    aggregate.gamesWithTaskData += 1;
  }
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
    stat.voteAccuracy = stat.votesCastAsCrew ? stat.correctVotesAsCrew / stat.votesCastAsCrew : 0;
    stat.decisiveVoteRate = stat.votesCast ? stat.decisiveVotes / stat.votesCast : 0;
    stat.exactTaskCompletionRate = stat.tasksTotalSum ? stat.tasksDoneSum / stat.tasksTotalSum : null;
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
