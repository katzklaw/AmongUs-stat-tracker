import { DatabaseSync } from 'node:sqlite';
import { parseLogText } from './parser.js';

const createEmptyPlayerStats = () => ({
  gamesPlayed: 0,
  gamesAsCrewmate: 0,
  gamesAsImpostor: 0,
  crewWins: 0,
  impWins: 0,
  crewWinRate: 0,
  impWinRate: 0
});

const finalizePlayerRates = (playerStats) => {
  for (const stat of Object.values(playerStats)) {
    stat.crewWinRate = stat.gamesAsCrewmate ? stat.crewWins / stat.gamesAsCrewmate : 0;
    stat.impWinRate = stat.gamesAsImpostor ? stat.impWins / stat.gamesAsImpostor : 0;
  }

  return playerStats;
};

const mergePlayerStats = (target, source) => {
  target.gamesPlayed += source.gamesPlayed;
  target.gamesAsCrewmate += source.gamesAsCrewmate;
  target.gamesAsImpostor += source.gamesAsImpostor;
  target.crewWins += source.crewWins;
  target.impWins += source.impWins;
};

const getTextContent = async (file) => {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return String(file);
};

export async function exportLogSummariesToDatabase(files, dbPath = 'stats.sqlite') {
  const parsedGames = await Promise.all(
    files.map(async (file) => {
      const content = await getTextContent(file);
      return parseLogText(content, file.name || 'unknown.log');
    })
  );

  const playerStats = {};
  for (const game of parsedGames) {
    for (const [playerName, stat] of Object.entries(game.playerStats || {})) {
      if (!playerStats[playerName]) {
        playerStats[playerName] = createEmptyPlayerStats();
      }

      mergePlayerStats(playerStats[playerName], stat);
    }
  }

  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      imp_wins INTEGER NOT NULL,
      crew_wins INTEGER NOT NULL,
      total_kills INTEGER NOT NULL,
      crew_deaths INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      player_name TEXT PRIMARY KEY,
      games_played INTEGER NOT NULL,
      games_as_crewmate INTEGER NOT NULL,
      games_as_impostor INTEGER NOT NULL,
      crew_wins INTEGER NOT NULL,
      imp_wins INTEGER NOT NULL,
      crew_win_rate REAL NOT NULL,
      imp_win_rate REAL NOT NULL
    );

    DELETE FROM games;
    DELETE FROM player_stats;
  `);

  const insertGame = db.prepare(`
    INSERT INTO games (file_name, imp_wins, crew_wins, total_kills, crew_deaths)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const game of parsedGames) {
    insertGame.run(game.fileName, game.impWins, game.crewWins, game.totalKills, game.crewDeaths);
  }

  const insertPlayer = db.prepare(`
    INSERT INTO player_stats (
      player_name,
      games_played,
      games_as_crewmate,
      games_as_impostor,
      crew_wins,
      imp_wins,
      crew_win_rate,
      imp_win_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const finalizedPlayerStats = finalizePlayerRates(playerStats);
  for (const [playerName, stat] of Object.entries(finalizedPlayerStats)) {
    insertPlayer.run(
      playerName,
      stat.gamesPlayed,
      stat.gamesAsCrewmate,
      stat.gamesAsImpostor,
      stat.crewWins,
      stat.impWins,
      stat.crewWinRate,
      stat.impWinRate
    );
  }

  db.close();

  return {
    dbPath,
    games: parsedGames.length,
    playerStats: finalizedPlayerStats
  };
}
