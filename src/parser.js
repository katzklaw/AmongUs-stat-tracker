const createPlayerStats = () => ({
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

export function parseLogText(text, fileName = 'unknown.log') {
  const lines = text.split(/\r?\n/);
  const stats = {
    fileName,
    games: lines.some((line) => line.trim() && !/set protection on/i.test(line)) ? 1 : 0,
    impWins: 0,
    crewWins: 0,
    totalKills: 0,
    crewDeaths: 0,
    playerStats: {}
  };
  const roles = new Map();
  const seenDeaths = new Set();
  const playerStats = new Map();
  let inRolesSection = false;
  let winnerRecorded = false;

  const normalizeName = (name) => name.replace(/\s*\(.+?\)$/, '').trim();
  const normalizeRole = (role = '') => String(role).trim().toLowerCase();
  const crewRoles = new Set(['crewmate', 'crew', 'engineer', 'scientist', 'tracker', 'detective', 'noisemaker', 'host']);
  const impostorRoles = new Set(['impostor', 'viper', 'shapeshifter', 'phantom']);
  const isImpostorRole = (role = '') => impostorRoles.has(normalizeRole(role));
  const isCrewLikeRole = (role = '') => crewRoles.has(normalizeRole(role)) || !isImpostorRole(role);

  const getPlayerStats = (name) => {
    const normalized = normalizeName(name || '').toLowerCase();
    if (!normalized) {
      return null;
    }

    if (!playerStats.has(normalized)) {
      playerStats.set(normalized, createPlayerStats());
    }

    return playerStats.get(normalized);
  };

  const recordWinnerForPlayers = (winnerTeam) => {
    for (const [playerName, playerRole] of roles.entries()) {
      const playerRecord = getPlayerStats(playerName);
      if (!playerRecord) {
        continue;
      }

      if (winnerTeam === 'crewmate' && isCrewLikeRole(playerRole)) {
        playerRecord.crewWins += 1;
      }

      if (winnerTeam === 'impostor' && isImpostorRole(playerRole)) {
        playerRecord.impWins += 1;
      }
    }
  };

  const registerDeath = (name) => {
    const cleaned = normalizeName(name || '');
    if (!cleaned || seenDeaths.has(cleaned.toLowerCase())) {
      return;
    }

    const role = roles.get(cleaned.toLowerCase());
    const isCrewLike = role ? isCrewLikeRole(role) : true;
    if (isCrewLike) {
      stats.crewDeaths += 1;
    }
    seenDeaths.add(cleaned.toLowerCase());
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /set protection on/i.test(trimmed)) {
      continue;
    }

    if (/^Player's Roles:/.test(trimmed)) {
      inRolesSection = true;
      continue;
    }

    if (inRolesSection) {
      const roleMatch = trimmed.match(/^(.+?) \(([^)]+)\) : (.+)$/);
      if (roleMatch) {
        const playerName = roleMatch[1].trim();
        const playerRole = roleMatch[3].trim().toLowerCase();
        roles.set(playerName.toLowerCase(), playerRole);

        const playerRecord = getPlayerStats(playerName);
        if (playerRecord) {
          playerRecord.gamesPlayed += 1;
          if (isCrewLikeRole(playerRole)) {
            playerRecord.gamesAsCrewmate += 1;
          } else if (isImpostorRole(playerRole)) {
            playerRecord.gamesAsImpostor += 1;
          }
        }
        continue;
      }

      if (/^\[/.test(trimmed)) {
        inRolesSection = false;
      }
    }

    const normalized = trimmed.toLowerCase();

    if (/^winners?:?\s*/i.test(trimmed)) {
      const winnerTeamMatch = trimmed.match(/^winners?:?\s*(crewmates?|crew|impostors?|impostor team)\b/i);
      if (winnerTeamMatch) {
        const winnerTeam = winnerTeamMatch[1].toLowerCase();
        if (/^crew|^crewmate/.test(winnerTeam)) {
          stats.crewWins += 1;
          recordWinnerForPlayers('crewmate');
          winnerRecorded = true;
          continue;
        }

        if (/^impostor/.test(winnerTeam)) {
          stats.impWins += 1;
          recordWinnerForPlayers('impostor');
          winnerRecorded = true;
          continue;
        }
      }
    }

    if (!winnerRecorded && /impostor team wins|impostors? win|impostor wins/.test(normalized)) {
      stats.impWins += 1;
      recordWinnerForPlayers('impostor');
      winnerRecorded = true;
      continue;
    }

    if (!winnerRecorded && /crewmates? win|crew win|crewmate win/.test(normalized)) {
      stats.crewWins += 1;
      recordWinnerForPlayers('crewmate');
      winnerRecorded = true;
      continue;
    }

    const killMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+killed\s+(.+?)\s*(?:\([^)]+\))?(?:\s+(?:at|outside|in|near|during|from)\b|$)/i);
    if (killMatch) {
      const victim = normalizeName(killMatch[2]);
      if (!/^\d+\s+players$/i.test(victim)) {
        stats.totalKills += 1;
        registerDeath(victim);
        continue;
      }
    }

    const deathLineMatch = trimmed.match(/^(.*?)\s*(?:\([^)]+\))?\s+(?:was killed|was eliminated|was ejected|is dead|has died)(?:\s+by\b.*)?$/i);
    if (deathLineMatch) {
      registerDeath(deathLineMatch[1]);
      continue;
    }

    const roundDeathsMatch = trimmed.match(/players died this round:\s*(.+)$/i);
    if (roundDeathsMatch) {
      const names = roundDeathsMatch[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      for (const name of names) {
        registerDeath(name);
      }
      continue;
    }

    const bodyFoundMatch = trimmed.match(/^(.*?)\s*(?:\([^)]+\))?'s body was found/i);
    if (bodyFoundMatch) {
      registerDeath(bodyFoundMatch[1]);
    }
  }

  stats.playerStats = finalizePlayerRates(Object.fromEntries(playerStats.entries()));
  return stats;
}

export async function summarizeFiles(files) {
  const summaries = files.map((file) => {
    if (typeof file.text === 'function') {
      return file.text().then((content) => parseLogText(content, file.name));
    }

    return Promise.resolve(parseLogText(String(file), file.name));
  });

  const results = await Promise.all(summaries);

  const summary = results.reduce(
    (acc, result) => {
      acc.games += result.games;
      acc.impWins += result.impWins;
      acc.crewWins += result.crewWins;
      acc.totalKills += result.totalKills;
      acc.crewDeaths += result.crewDeaths;
      acc.filesProcessed += 1;

      for (const [playerName, playerRecord] of Object.entries(result.playerStats || {})) {
        if (!acc.playerStats[playerName]) {
          acc.playerStats[playerName] = createPlayerStats();
        }

        const target = acc.playerStats[playerName];
        target.gamesPlayed += playerRecord.gamesPlayed;
        target.gamesAsCrewmate += playerRecord.gamesAsCrewmate;
        target.gamesAsImpostor += playerRecord.gamesAsImpostor;
        target.crewWins += playerRecord.crewWins;
        target.impWins += playerRecord.impWins;
      }

      return acc;
    },
    {
      games: 0,
      impWins: 0,
      crewWins: 0,
      totalKills: 0,
      crewDeaths: 0,
      filesProcessed: 0,
      playerStats: {}
    }
  );

  summary.playerStats = finalizePlayerRates(summary.playerStats);
  return summary;
}
