// js/parser.js
//
// Turns one raw Among Us game log (from Twix's GameLogger) into a rich
// "game record" object. This is the only file that reads raw log text -
// everything downstream (app.js) just works with the structured object
// this returns.

function normalizeLocationKey(rawLocation) {
  let loc = String(rawLocation || '').trim();
  // Logs write locations as "at Dropship", "in Reactor", etc. Strip a
  // leading simple preposition, but leave compound phrases like
  // "outside / in a hallway" intact since that's the whole location name.
  loc = loc.replace(/^(?:at|in|near|during|from)\s+/i, '');
  loc = loc.replace(/[.,!?]+$/, '').trim();
  return loc;
}

function extractGameDate(lines) {
  // Log lines look like either:
  //   [3/31/2026 22:54:26]        (24-hour)
  //   [3/1/2026 11:53:50 PM]      (12-hour with AM/PM)
  for (const line of lines) {
    const match = line.match(/^\[(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?\]/i);
    if (match) {
      const month = Number(match[1]);
      const day = Number(match[2]);
      const year = Number(match[3]);
      let hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6]);
      const meridiem = match[7] ? match[7].toUpperCase() : null;

      if (meridiem === 'PM' && hour !== 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;

      const date = new Date(year, month - 1, day, hour, minute, second);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  return null;
}

function extractMap(lines) {
  for (const line of lines) {
    const match = line.match(/^Started game on (.+?)\s*-\s*game mode:\s*(.+)$/i);
    if (match) {
      return { map: match[1].trim(), gameMode: match[2].trim() };
    }
  }
  return { map: null, gameMode: null };
}

function normalizeWinCondition(rawCondition) {
  const c = String(rawCondition || '').toLowerCase();
  if (/task/.test(c)) return 'task';
  if (/kill/.test(c)) return 'kill';
  if (/vot/.test(c)) return 'vote'; // covers "vote", "voting", "voted"
  if (/sabotage|reactor|oxygen|meltdown/.test(c)) return 'sabotage';
  return 'other';
}

function createEmptyPlayerGameRecord(displayName, role) {
  return {
    displayName,
    role, // 'crewmate' or 'impostor' (team, not exact role name)
    gamesPlayed: 1,
    gamesAsCrewmate: role === 'crewmate' ? 1 : 0,
    gamesAsImpostor: role === 'impostor' ? 1 : 0,
    crewWins: 0,
    impWins: 0,
    kills: 0,
    died: 0,
    wasEjected: 0,
    survived: 1, // flipped to 0 the moment we register a death or ejection
    completedAllTasks: 0,
    taskWins: 0,
    killWins: 0,
    voteWins: 0,
    sabotageWins: 0,
    otherWins: 0,
    killLocations: {},
    deathLocations: {},
    votesCast: 0,       // meetings where they voted for someone (not skip)
    votesSkipped: 0,    // meetings where they skipped/didn't vote
    correctVotes: 0,    // voted for someone who actually was an impostor
    incorrectVotes: 0,  // voted for someone who actually was crew
    decisiveVotes: 0    // their vote's target was the one actually ejected
  };
}

function parseLogText(
    text,
    fileName = "unknown.log",
    category = "Casual"
) {
  const lines = String(text).split(/\r?\n/);

  const { map, gameMode } = extractMap(lines);
  const gameDate = extractGameDate(lines);

  const stats = {
    fileName,
    category,
    date: gameDate,
    map,
    gameMode,
    games: lines.some((line) => line.trim() && !/set protection on/i.test(line)) ? 1 : 0,
    winnerTeam: null,
    winCondition: null,
    impWins: 0,
    crewWins: 0,
    totalKills: 0,
    crewDeaths: 0,
    kills: [],       // { killer, victim, location }
    ejections: [],   // { player, role }
    playerStats: {}
  };

  const roles = new Map();
  const seenDeaths = new Set();
  const playerRecords = new Map(); // lowercase name -> per-game player record
  let inRolesSection = false;
  let winnerRecorded = false;

  const normalizeName = (name) => {
    let cleaned = String(name || "")
        .replace(/\s*\(.+?\)$/, "")
        .trim();

    const alias = state.playerSettings.aliases[cleaned.toLowerCase()];
    if (alias) {
      cleaned = alias;
    }

    return cleaned;
  };

  const normalizeRole = (role = '') => String(role).trim().toLowerCase();
  const crewRoles = new Set(['crewmate', 'crew', 'engineer', 'scientist', 'tracker', 'detective', 'noisemaker', 'host']);
  const impostorRoles = new Set(['impostor', 'viper', 'shapeshifter', 'phantom']);
  const isImpostorRole = (role = '') => impostorRoles.has(normalizeRole(role));
  const isCrewLikeRole = (role = '') => crewRoles.has(normalizeRole(role)) || !isImpostorRole(role);

  const getPlayerRecord = (name) => {
    const displayName = normalizeName(name);
    const key = displayName.toLowerCase();
    if (!key) {
      return null;
    }

    if (!playerRecords.has(key)) {
      const role = roles.get(key);
      const team = role ? (isCrewLikeRole(role) ? 'crewmate' : 'impostor') : 'crewmate';
      playerRecords.set(key, createEmptyPlayerGameRecord(displayName, team));
    }

    return playerRecords.get(key);
  };

  const recordWinnerForPlayers = (winnerTeam, winCondition) => {
    for (const [playerKey, playerRole] of roles.entries()) {
      const playerRecord = getPlayerRecord(playerKey);
      if (!playerRecord) {
        continue;
      }

      const isWinningTeam =
        (winnerTeam === 'crewmate' && isCrewLikeRole(playerRole)) ||
        (winnerTeam === 'impostor' && isImpostorRole(playerRole));

      if (!isWinningTeam) {
        continue;
      }

      if (winnerTeam === 'crewmate') {
        playerRecord.crewWins += 1;
      } else {
        playerRecord.impWins += 1;
      }

      if (winCondition === 'task') playerRecord.taskWins += 1;
      else if (winCondition === 'kill') playerRecord.killWins += 1;
      else if (winCondition === 'vote') playerRecord.voteWins += 1;
      else if (winCondition === 'sabotage') playerRecord.sabotageWins += 1;
      else playerRecord.otherWins += 1;
    }
  };

  // location is only known for direct kill lines; other "death" mentions
  // (body found, round summary) are de-duped confirmations, not new info.
  const registerDeath = (name, location) => {
    const cleaned = normalizeName(name);
    const key = cleaned.toLowerCase();
    if (!cleaned || key === 'no one' || key === 'nobody' || seenDeaths.has(key)) {
      return;
    }

    const role = roles.get(key);
    const isCrewLike = role ? isCrewLikeRole(role) : true;
    if (isCrewLike) {
      stats.crewDeaths += 1;
    }
    seenDeaths.add(key);

    const record = getPlayerRecord(cleaned);
    if (record) {
      record.died = 1;
      record.survived = 0;
      if (location) {
        const locKey = normalizeLocationKey(location);
        record.deathLocations[locKey] = (record.deathLocations[locKey] || 0) + 1;
      }
    }
  };

  const registerEjection = (name) => {
    const cleaned = normalizeName(name);
    const key = cleaned.toLowerCase();
    if (!cleaned || key === 'no one' || key === 'nobody') {
      return;
    }

    const role = roles.get(key) || '';
    stats.ejections.push({ player: cleaned, role: isImpostorRole(role) ? 'impostor' : 'crewmate' });

    const record = getPlayerRecord(cleaned);
    if (record) {
      record.wasEjected = 1;
      record.survived = 0;
    }
  };

  // Votes accumulate here as they're seen, then get resolved (decisive or
  // not) once we learn the outcome of that meeting.
  let pendingMeetingVotes = []; // { record, targetKey }

  const registerVote = (voterName, targetName) => {
    const voter = normalizeName(voterName);
    const target = normalizeName(targetName);
    const voterRecord = getPlayerRecord(voter);
    if (!voterRecord) {
      return;
    }

    const targetKey = target.toLowerCase();
    voterRecord.votesCast += 1;

    const targetRole = roles.get(targetKey);
    if (targetRole && isImpostorRole(targetRole)) {
      voterRecord.correctVotes += 1;
    } else {
      voterRecord.incorrectVotes += 1;
    }

    pendingMeetingVotes.push({ record: voterRecord, targetKey });
  };

  const registerVoteSkip = (voterName) => {
    const voter = normalizeName(voterName);
    const voterRecord = getPlayerRecord(voter);
    if (voterRecord) {
      voterRecord.votesSkipped += 1;
    }
  };

  // ejectedKey is null when no one was ejected this meeting (tie/skip).
  const resolvePendingMeetingVotes = (ejectedKey) => {
    for (const { record, targetKey } of pendingMeetingVotes) {
      if (ejectedKey && targetKey === ejectedKey) {
        record.decisiveVotes += 1;
      }
    }
    pendingMeetingVotes = [];
  };

  const registerKill = (killerName, victimName, location) => {
    const killer = normalizeName(killerName);
    const victim = normalizeName(victimName);
    const locKey = normalizeLocationKey(location);

    stats.totalKills += 1;
    stats.kills.push({ killer, victim, location: locKey || null });

    const killerRecord = getPlayerRecord(killer);
    if (killerRecord) {
      killerRecord.kills += 1;
      if (locKey) {
        killerRecord.killLocations[locKey] = (killerRecord.killLocations[locKey] || 0) + 1;
      }
    }

    registerDeath(victim, locKey);
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

        const record = getPlayerRecord(playerName);
        if (record) {
          record.role = isCrewLikeRole(playerRole) ? 'crewmate' : 'impostor';
          record.gamesAsCrewmate = record.role === 'crewmate' ? 1 : 0;
          record.gamesAsImpostor = record.role === 'impostor' ? 1 : 0;
        }
        continue;
      }

      if (/^\[/.test(trimmed)) {
        inRolesSection = false;
      }
    }

    const normalized = trimmed.toLowerCase();

    // --- Winner line: "Winners: Crewmates by task win" / "Winners: Impostors by kill win" etc.
    const winnerMatch = trimmed.match(/^winners?:?\s*(crewmates?|crew|impostors?|impostor team)\s*(?:by\s+(.+))?$/i);
    if (winnerMatch) {
      const winnerTeamRaw = winnerMatch[1].toLowerCase();
      const winnerTeam = /^crew/.test(winnerTeamRaw) ? 'crewmate' : 'impostor';
      const winCondition = normalizeWinCondition(winnerMatch[2]);

      stats.winnerTeam = winnerTeam;
      stats.winCondition = winCondition;

      if (winnerTeam === 'crewmate') {
        stats.crewWins += 1;
      } else {
        stats.impWins += 1;
      }
      recordWinnerForPlayers(winnerTeam, winCondition);
      winnerRecorded = true;
      continue;
    }

    if (!winnerRecorded && /impostor team wins|impostors? win|impostor wins/.test(normalized)) {
      stats.winnerTeam = 'impostor';
      stats.winCondition = stats.winCondition || 'other';
      stats.impWins += 1;
      recordWinnerForPlayers('impostor', stats.winCondition);
      winnerRecorded = true;
      continue;
    }

    if (!winnerRecorded && /crewmates? win|crew win|crewmate win/.test(normalized)) {
      stats.winnerTeam = 'crewmate';
      stats.winCondition = stats.winCondition || 'other';
      stats.crewWins += 1;
      recordWinnerForPlayers('crewmate', stats.winCondition);
      winnerRecorded = true;
      continue;
    }

    // --- Kills (location-aware)
    const killMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+killed\s+(.+?)\s*(?:\([^)]+\))?(?:\s+((?:at|outside|in|near|during|from)\s+.+))?$/i);
    if (killMatch) {
      const victimRaw = killMatch[2];
      if (!/^\d+\s+players$/i.test(victimRaw)) {
        registerKill(killMatch[1], victimRaw, killMatch[3] || '');
        continue;
      }
    }

    // --- Vote results
    if (/^Vote results:?$/i.test(trimmed)) {
      pendingMeetingVotes = [];
      continue;
    }

    const votedForMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+voted for\s+(.+?)\s*(?:\([^)]+\))?$/i);
    if (votedForMatch) {
      registerVote(votedForMatch[1], votedForMatch[2]);
      continue;
    }

    const skippedVoteMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+(?:skipped|did not vote)\s*$/i);
    if (skippedVoteMatch) {
      registerVoteSkip(skippedVoteMatch[1]);
      continue;
    }

    // --- Ejections / votes
    const ejectedMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+(?:was ejected|was voted out)\b/i);
    if (ejectedMatch) {
      const rawName = ejectedMatch[1].trim();
      const cleanedKey = normalizeName(rawName).toLowerCase();

      if (cleanedKey === 'no one' || cleanedKey === 'nobody') {
        resolvePendingMeetingVotes(null);
      } else {
        resolvePendingMeetingVotes(cleanedKey);
        registerEjection(rawName);
      }
      continue;
    }

    // --- Fallback death mentions (deduped against kills already seen)
    const deathLineMatch = trimmed.match(/^(.*?)\s*(?:\([^)]+\))?\s+(?:was killed|was eliminated|is dead|has died)(?:\s+by\b.*)?$/i);
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
      continue;
    }

    // --- Per-player task completion
    const taskCompleteMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+has completed all tasks$/i);
    if (taskCompleteMatch) {
      const record = getPlayerRecord(taskCompleteMatch[1]);
      if (record) {
        record.completedAllTasks = 1;
      }
      continue;
    }
  }

  const playerStatsOut = {};
  for (const [key, record] of playerRecords.entries()) {
    playerStatsOut[key] = record;
  }
  stats.playerStats = playerStatsOut;

  return stats;
}
