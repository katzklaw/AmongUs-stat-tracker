
const elements = {

  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  folderInput: document.getElementById('folderInput'),
  searchInput: document.getElementById('searchInput'),
  clearButton: document.getElementById('clearButton'),
  gameTableBody: document.getElementById('gameTableBody'),
  playerTableBody: document.getElementById('playerTableBody'),
  gamesTotal: document.getElementById('gamesTotal'),
  crewWinsTotal: document.getElementById('crewWinsTotal'),
  impWinsTotal: document.getElementById('impWinsTotal'),
  totalKillsTotal: document.getElementById('totalKillsTotal'),
  crewDeathsTotal: document.getElementById('crewDeathsTotal'),
  categorySelect: document.getElementById('categorySelect'),
  categoryFilter: document.getElementById('categoryFilter'),
  chooseFilesButton: document.getElementById('chooseFilesButton'),
  chooseFolderButton: document.getElementById('chooseFolderButton'),
  playerManagerButton: document.getElementById('playerManagerButton'),
  playerManagerModal: document.getElementById('playerManagerModal'),
  closePlayerManager: document.getElementById('closePlayerManager'),
  playerManagerSearch: document.getElementById('playerManagerSearch'),
  playerManagerBody: document.getElementById('playerManagerBody'),
  showHiddenCheckbox: document.getElementById('showHiddenCheckbox'),
  trendsPlayerSelect: document.getElementById('trendsPlayerSelect'),
  trendsTableBody: document.getElementById('trendsTableBody'),
  playerDetailModal: document.getElementById('playerDetailModal'),
  closePlayerDetail: document.getElementById('closePlayerDetail'),
  playerDetailName: document.getElementById('playerDetailName'),
  playerDetailSummary: document.getElementById('playerDetailSummary'),
  playerDetailKillLocations: document.getElementById('playerDetailKillLocations'),
  playerDetailDeathLocations: document.getElementById('playerDetailDeathLocations'),
  playerDetailMonthlyBody: document.getElementById('playerDetailMonthlyBody'),
  playerNameHeader: document.getElementById('playerNameHeader'),
  playerGamesHeader: document.getElementById('playerGamesHeader'),

};

if (!elements.categorySelect) {
  console.error("categorySelect wasn't found!");
}

const state = {

    entries: [],

    players: {},

    playerDatabase:
        loadPlayerDatabase(),

    search: "",

    playerManagerSearch: "",

    categoryFilter: "All",

    playerManagerShowHidden: false,

    trendsPlayerName: null,

    playerSort: { key: 'games', dir: 'desc' }

};

function getSelectedCategory() {
  return elements.categorySelect.value;
}

function getFilteredEntries() {
  if (!state.categoryFilter || state.categoryFilter === 'All') {
    return state.entries;
  }
  return state.entries.filter((entry) => entry.category === state.categoryFilter);
}

function updateCategoryFilterOptions() {
  const categories = Array.from(new Set(state.entries.map((entry) => entry.category))).sort();
  const current = elements.categoryFilter.value || state.categoryFilter || 'All';
  const options = ['All', ...categories];

  elements.categoryFilter.innerHTML = options
    .map((cat) => `<option value="${cat}">${cat}</option>`)
    .join('');

  elements.categoryFilter.value = options.includes(current) ? current : 'All';
  state.categoryFilter = elements.categoryFilter.value;
}

// Merges every game's per-player records (from parser.js) into running
// totals, honoring name aliases. Does NOT filter out hidden players -
// that's a separate step so the Player Manager can still see everyone.
function sumPlayerStatsFromEntries(entries) {

  const playerMap = {};

  const aliases = state.playerSettings.aliases || {};

  for (const entry of entries) {

    for (const [key, record] of Object.entries(entry.playerStats || {})) {

      // Defends against stale localStorage data saved by an older version
      // of this app, where player records didn't have a displayName field.
      const originalName = record && record.displayName ? record.displayName : key;

      if (!originalName) {
        continue;
      }

      const finalName =
        aliases[originalName.toLowerCase()] || originalName;

      if (!playerMap[finalName]) {

        playerMap[finalName] = createEmptyAggregateStats(finalName);

      }

      mergeGameRecordIntoAggregate(playerMap[finalName], record);

    }

  }

  return playerMap;

}

// A player is excluded from dashboard stats if they were manually hidden,
// OR if they've only ever appeared in one game and haven't been explicitly
// "kept" (players.settings.keepSingleGame overrides the auto-hide).
function isPlayerExcluded(name, stats) {
  const key = name.toLowerCase();
  const hidden = state.playerSettings.hidden || [];
  const kept = state.playerSettings.keepSingleGame || [];

  if (hidden.includes(key)) {
    return true;
  }

  if (stats.gamesPlayed <= 1 && !kept.includes(key)) {
    return true;
  }

  return false;
}

// Every player used for actual dashboard stats: aliased + hidden/one-off
// players removed + rates computed.
function aggregatePlayers(entries) {

  const raw = sumPlayerStatsFromEntries(entries);

  for (const name of Object.keys(raw)) {

    if (isPlayerExcluded(name, raw[name])) {

      delete raw[name];

    }

  }

  return finalizePlayerRates(raw);

}

// Every player ever seen, hidden or not - used by Player Manager and the
// trends dropdown so hidden players can still be found/restored.
function getAllPlayersRaw() {
  return finalizePlayerRates(sumPlayerStatsFromEntries(state.entries));
}

function renderSummary(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.games += entry.games;
      acc.crewWins += entry.crewWins;
      acc.impWins += entry.impWins;
      acc.totalKills += entry.totalKills;
      acc.crewDeaths += entry.crewDeaths;
      return acc;
    },
    { games: 0, crewWins: 0, impWins: 0, totalKills: 0, crewDeaths: 0 }
  );

  elements.gamesTotal.textContent = String(totals.games);
  elements.crewWinsTotal.textContent = String(totals.crewWins);
  elements.impWinsTotal.textContent = String(totals.impWins);
  elements.totalKillsTotal.textContent = String(totals.totalKills);
  elements.crewDeathsTotal.textContent = String(totals.crewDeaths);
}

function formatWinner(entry) {
  if (entry.winnerTeam === 'crewmate') return 'Crewmate';
  if (entry.winnerTeam === 'impostor') return 'Impostor';
  return 'Unknown';
}

function formatWinCondition(entry) {
  if (!entry.winCondition) return 'Unknown';
  return entry.winCondition.charAt(0).toUpperCase() + entry.winCondition.slice(1);
}

function formatGameDate(entry) {
  if (!entry.date) return 'Unknown';
  return new Date(entry.date).toLocaleDateString();
}

function renderGames(entries) {
  const searchTerm = state.search;
  const filtered = entries
    .filter((entry) => {
      const haystack = `${entry.fileName} ${entry.category} ${entry.map || ''} ${formatWinner(entry)} ${formatWinCondition(entry)}`.toLowerCase();
      return haystack.includes(searchTerm);
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (filtered.length === 0) {
    elements.gameTableBody.innerHTML = '<tr><td colspan="8" class="empty">No matching game data yet.</td></tr>';
    return;
  }

  elements.gameTableBody.innerHTML = filtered.map((entry) => `
    <tr>
      <td>${entry.category}</td>
      <td>${formatGameDate(entry)}</td>
      <td>${entry.map || 'Unknown'}</td>
      <td>${entry.fileName}</td>
      <td>${formatWinner(entry)}</td>
      <td>${formatWinCondition(entry)}</td>
      <td>${entry.totalKills}</td>
      <td>${entry.crewDeaths}</td>
    </tr>
  `).join('');
}

function sortPlayerRows(rows) {
  const { key, dir } = state.playerSort;
  const factor = dir === 'asc' ? 1 : -1;

  return rows.slice().sort((a, b) => {
    if (key === 'name') {
      return factor * a.playerName.localeCompare(b.playerName);
    }
    return factor * (a.gamesPlayed - b.gamesPlayed);
  });
}

function toggleSort(key) {
  if (state.playerSort.key === key) {
    state.playerSort.dir = state.playerSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.playerSort.key = key;
    state.playerSort.dir = key === 'name' ? 'asc' : 'desc';
  }
  renderPlayers();
}

function updatePlayerTableHeaders() {
  const { key, dir } = state.playerSort;
  const arrow = dir === 'asc' ? ' ▲' : ' ▼';

  if (elements.playerNameHeader) {
    elements.playerNameHeader.textContent = 'Player' + (key === 'name' ? arrow : '');
  }
  if (elements.playerGamesHeader) {
    elements.playerGamesHeader.textContent = 'Games' + (key === 'games' ? arrow : '');
  }
}

function renderPlayers() {
  const searchTerm = state.search;
  const playerRows = Object.entries(state.players || {}).map(([playerName, stat]) => ({ playerName, ...stat }));
  const filtered = sortPlayerRows(
    playerRows.filter((row) => {
      const haystack = `${row.playerName} ${row.gamesPlayed} ${row.gamesAsCrewmate} ${row.gamesAsImpostor} ${row.crewWins} ${row.impWins}`.toLowerCase();
      return haystack.includes(searchTerm);
    })
  );

  updatePlayerTableHeaders();

  if (filtered.length === 0) {
    elements.playerTableBody.innerHTML = '<tr><td colspan="13" class="empty">No matching players yet.</td></tr>';
    return;
  }

  elements.playerTableBody.innerHTML = filtered.map((row) => `
    <tr>
      <td>${row.playerName}</td>
      <td>${row.gamesPlayed}</td>
      <td>${row.gamesAsCrewmate}</td>
      <td>${row.gamesAsImpostor}</td>
      <td>${row.crewWins}</td>
      <td>${row.impWins}</td>
      <td>${formatRate(row.crewWinRate)}</td>
      <td>${formatRate(row.impWinRate)}</td>
      <td>${row.kills}</td>
      <td>${formatAverage(row.avgKillsPerImpGame)}</td>
      <td>${formatPercent(row.survivalRate)}</td>
      <td>${formatPercent(row.taskCompletionRate)}</td>
      <td><button class="details-button player-details-button" data-player="${row.playerName}">Details</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.player-details-button').forEach((button) => {
    button.onclick = () => openPlayerDetail(button.dataset.player);
  });
}

function renderAliasList() {

  console.log("========== ALIASES ==========");

  const aliases =
    state.playerSettings.aliases;

  const keys =
    Object.keys(aliases).sort();

  if (!keys.length) {

    console.log("No aliases.");

    return;

  }

  keys.forEach(name => {

    console.log(
      name + "  →  " + aliases[name]
    );

  });

}

function createAlias(oldName, newName) {

  oldName = oldName.trim();
  newName = newName.trim();

  if (!oldName || !newName) {
    return;
  }

  const aliases = state.playerSettings.aliases;

  // Resolve newName to whatever it ultimately already points to, if anything.
  let finalName = newName;

  while (aliases[finalName.toLowerCase()]) {

    finalName = aliases[finalName.toLowerCase()];

  }

  // Anyone who has changed names several times will have older aliases
  // pointing at oldName itself - redirect those too, or merging "Name2"
  // into "Name3" would silently orphan "Name1 -> Name2".
  for (const [alias, target] of Object.entries(aliases)) {

    if (target.toLowerCase() === oldName.toLowerCase()) {

      aliases[alias] = finalName;

    }

  }

  aliases[oldName.toLowerCase()] = finalName;

  savePlayerSettings(state.playerSettings);

  renderAll();

}

// All the names that currently resolve to `playerName`, for display in the
// Player Manager.
function getAliasesForPlayer(playerName) {

  const aliases = state.playerSettings.aliases;
  const matches = [];

  for (const [alias, target] of Object.entries(aliases)) {

    if (target.toLowerCase() === playerName.toLowerCase()) {

      matches.push(alias);

    }

  }

  return matches;

}

function removeAlias(alias) {

  if (!confirm(`Stop merging "${alias}" into its current name? Future imports of "${alias}" will show up as their own player again.`)) {
    return;
  }

  delete state.playerSettings.aliases[alias.toLowerCase()];

  savePlayerSettings(state.playerSettings);

  renderAll();

}

function askForAlias(playerName) {

  const newName = prompt(

      `Merge "${playerName}" into which player? (Type the name you want to keep.)`,

      playerName

  );

  if (!newName) {

      return;

  }

  if (newName.trim().toLowerCase() === playerName.toLowerCase()) {

      return;

  }

  createAlias(

      playerName,

      newName.trim()

  );

}

function toggleHidden(playerName) {

  const key = playerName.toLowerCase();
  const hidden = state.playerSettings.hidden;
  const idx = hidden.indexOf(key);

  if (idx === -1) {

    if (!confirm(`Hide "${playerName}" from all stats? You can bring them back later with "Show hidden players" in the Player Manager.`)) {
      return;
    }

    hidden.push(key);

  } else {

    hidden.splice(idx, 1);

  }

  savePlayerSettings(state.playerSettings);

  renderAll();

}

function toggleKeepSingleGame(playerName) {

  const key = playerName.toLowerCase();
  const kept = state.playerSettings.keepSingleGame;
  const idx = kept.indexOf(key);

  if (idx === -1) {
    kept.push(key);
  } else {
    kept.splice(idx, 1);
  }

  savePlayerSettings(state.playerSettings);

  renderAll();

}

function openPlayerManager() {

  state.playerManagerSearch = "";

  elements.playerManagerSearch.value = "";

  state.playerManagerShowHidden = false;

  elements.showHiddenCheckbox.checked = false;

  renderPlayerManager();

  elements.playerManagerModal.classList.remove("hidden");

}

function closePlayerManager() {

  elements.playerManagerModal.classList.add("hidden");

}

function renderPlayerManager() {

    const search =
        state.playerManagerSearch.toLowerCase();

    const hiddenSet = new Set(state.playerSettings.hidden);
    const keptSet = new Set(state.playerSettings.keepSingleGame);

    const allPlayers = getAllPlayersRaw();

    const rows =
        Object.entries(allPlayers)

        .map(([name, stats]) => {

            const key = name.toLowerCase();
            const isManuallyHidden = hiddenSet.has(key);
            const isAutoHidden = stats.gamesPlayed <= 1 && !keptSet.has(key);

            return {
                name,
                games: stats.gamesPlayed,
                isManuallyHidden,
                isAutoHidden,
                isHidden: isManuallyHidden || isAutoHidden,
                aliases: getAliasesForPlayer(name)
            };

        })

        .filter(player =>

            state.playerManagerShowHidden ? true : !player.isHidden

        )

        .filter(player=>

            player.name
                .toLowerCase()
                .includes(search)

        )

        .sort((a,b)=>

            b.games-a.games

        );

    if(!rows.length){

        elements.playerManagerBody.innerHTML=`

        <tr>

        <td colspan="4">

        No players.

        </td>

        </tr>

        `;

        return;

    }

    elements.playerManagerBody.innerHTML=

    rows.map(player=>{

        const badge = player.isManuallyHidden
            ? ' <em>(hidden)</em>'
            : player.isAutoHidden
                ? ' <em>(auto-hidden — 1 game)</em>'
                : '';

        const aliasHtml = player.aliases.length
            ? player.aliases.map(alias => `
                <span class="alias-chip">
                  ${alias}
                  <button class="remove-alias" data-alias="${alias}" title="Stop merging ${alias}">&times;</button>
                </span>
              `).join('')
            : '<span class="no-aliases">—</span>';

        const hideRestoreButton = player.isManuallyHidden
            ? `<button class="toggle-hidden-player" data-player="${player.name}">Restore</button>`
            : `<button class="toggle-hidden-player" data-player="${player.name}">Hide</button>`;

        const keepButton = (!player.isManuallyHidden && player.isAutoHidden)
            ? `<button class="toggle-keep-player" data-player="${player.name}">Keep</button>`
            : (!player.isManuallyHidden && player.games <= 1)
                ? `<button class="toggle-keep-player" data-player="${player.name}">Stop keeping</button>`
                : '';

        return `
    <tr>
    <td>${player.name}${badge}</td>
    <td>${player.games}</td>
    <td>${aliasHtml}</td>
    <td>
        <button class="merge-player" data-player="${player.name}">Merge / Alias</button>
        ${hideRestoreButton}
        ${keepButton}
    </td>
    </tr>
    `;

    }).join("");

    document
        .querySelectorAll(".merge-player")
        .forEach(button=>{

        button.onclick=()=>{

            askForAlias(

                button.dataset.player

            );

        };

    });

    document
        .querySelectorAll(".toggle-hidden-player")
        .forEach(button=>{

        button.onclick=()=>{

            toggleHidden(

                button.dataset.player

            );

        };

    });

    document
        .querySelectorAll(".toggle-keep-player")
        .forEach(button=>{

        button.onclick=()=>{

            toggleKeepSingleGame(

                button.dataset.player

            );

        };

    });

    document
        .querySelectorAll(".remove-alias")
        .forEach(button=>{

        button.onclick=()=>{

            removeAlias(

                button.dataset.alias

            );

        };

    });

}

function getMonthKey(isoDate) {
  if (!isoDate) return 'unknown';
  return isoDate.slice(0, 7); // "YYYY-MM"
}

function formatMonthLabel(monthKey) {
  if (monthKey === 'unknown') return 'Unknown date';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function groupEntriesByMonth(entries) {
  const groups = {};
  for (const entry of entries) {
    const key = getMonthKey(entry.date);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }
  return groups;
}

// Returns [{ monthKey, label, stat }, ...] in chronological order, one row
// per month that `playerName` actually appears in (within `entries`).
function computeMonthlyStatsForPlayer(playerName, entries) {
  const groups = groupEntriesByMonth(entries);
  const monthKeys = Object.keys(groups).sort(); // "YYYY-MM" sorts chronologically; "unknown" sorts last
  const rows = [];

  for (const key of monthKeys) {
    const monthPlayers = aggregatePlayers(groups[key]);
    const stat = monthPlayers[playerName];
    if (stat) {
      rows.push({ monthKey: key, label: formatMonthLabel(key), stat });
    }
  }

  return rows;
}

function renderMonthlyTable(tbodyEl, playerName, entries) {
  const rows = computeMonthlyStatsForPlayer(playerName, entries);

  if (!rows.length) {
    tbodyEl.innerHTML = '<tr><td colspan="7" class="empty">No games found for this player in the current filter.</td></tr>';
    return;
  }

  tbodyEl.innerHTML = rows.map(({ label, stat }) => `
    <tr>
      <td>${label}</td>
      <td>${stat.gamesPlayed}</td>
      <td>${formatRate(stat.crewWinRate)}</td>
      <td>${formatRate(stat.impWinRate)}</td>
      <td>${formatAverage(stat.avgKillsPerImpGame)}</td>
      <td>${formatPercent(stat.survivalRate)}</td>
      <td>${formatPercent(stat.taskCompletionRate)}</td>
    </tr>
  `).join('');
}

function renderTrendsPlayerOptions() {
  const allPlayers = getAllPlayersRaw();
  const players = Object.keys(allPlayers)
    .filter((name) => !isPlayerExcluded(name, allPlayers[name]))
    .sort((a, b) => a.localeCompare(b));

  const current = state.trendsPlayerName;

  elements.trendsPlayerSelect.innerHTML = [
    '<option value="">Choose a player…</option>',
    ...players.map((name) => `<option value="${name}">${name}</option>`)
  ].join('');

  if (current && players.includes(current)) {
    elements.trendsPlayerSelect.value = current;
  } else {
    state.trendsPlayerName = null;
    elements.trendsPlayerSelect.value = "";
  }
}

function renderTrendsTable() {
  if (!state.trendsPlayerName) {
    elements.trendsTableBody.innerHTML = '<tr><td colspan="7" class="empty">Pick a player above to see their trend over time.</td></tr>';
    return;
  }

  renderMonthlyTable(elements.trendsTableBody, state.trendsPlayerName, getFilteredEntries());
}

function renderLocationList(listEl, locationCounts) {
  const top = topLocations(locationCounts, 5);

  if (!top.length) {
    listEl.innerHTML = '<li class="empty-list"></li>';
    return;
  }

  listEl.innerHTML = top.map(([location, count]) => `
    <li><span>${location}</span><span>${count}</span></li>
  `).join('');
}

function openPlayerDetail(playerName) {

  const stat = state.players[playerName];

  if (!stat) {
    return;
  }

  elements.playerDetailName.textContent = playerName;

  const cards = [
    ['Games', stat.gamesPlayed],
    ['Crew Games', stat.gamesAsCrewmate],
    ['Imp Games', stat.gamesAsImpostor],
    ['Crew Win Rate', formatRate(stat.crewWinRate)],
    ['Imp Win Rate', formatRate(stat.impWinRate)],
    ['Kills', stat.kills],
    ['Avg Kills / Imp Game', formatAverage(stat.avgKillsPerImpGame)],
    ['Deaths', stat.deaths],
    ['Survival Rate', formatPercent(stat.survivalRate)],
    ['Ejected as Crew', stat.ejectionsAsCrew],
    ['Ejected as Impostor', stat.ejectionsAsImpostor],
    ['Task Completion', formatPercent(stat.taskCompletionRate)],
    ['Exact Task Completion', stat.exactTaskCompletionRate === null ? 'No data yet' : formatPercent(stat.exactTaskCompletionRate)],
    ['Task Wins', stat.taskWins],
    ['Kill Wins', stat.killWins],
    ['Vote Wins', stat.voteWins],
    ['Sabotage Wins', stat.sabotageWins],
    ['Other/Unrecognized Wins', stat.otherWins],
    ['Votes Cast', stat.votesCast],
    ['Votes Skipped', stat.votesSkipped],
    ['Vote Accuracy', formatPercent(stat.voteAccuracy)],
    ['Decisive Votes', stat.decisiveVotes]
  ];

  elements.playerDetailSummary.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <span class="summary-label">${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');

  renderLocationList(elements.playerDetailKillLocations, stat.killLocations);
  renderLocationList(elements.playerDetailDeathLocations, stat.deathLocations);

  renderMonthlyTable(elements.playerDetailMonthlyBody, playerName, getFilteredEntries());

  elements.playerDetailModal.classList.remove("hidden");

}

function closePlayerDetail() {
  elements.playerDetailModal.classList.add("hidden");
}

function renderAll() {
  state.search = elements.searchInput.value.trim().toLowerCase();
  state.categoryFilter = elements.categoryFilter.value;

  const filteredEntries = getFilteredEntries();
  state.players = aggregatePlayers(filteredEntries);

  renderSummary(filteredEntries);
  renderGames(filteredEntries);
  renderPlayers();
  renderPlayerManager();
  renderTrendsPlayerOptions();
  renderTrendsTable();
}

// Identifies a game by its actual content, not its filename - so reused
// filenames (e.g. "game 1.txt" reused across different tournaments) don't
// falsely collide, and a genuinely re-uploaded file is still recognized
// even if it got renamed in between.
function computeGameFingerprint(entry) {

  const players = Object.values(entry.playerStats || {})
    .map((p) => (p.displayName || '').toLowerCase())
    .sort()
    .join(',');

  // Every log starts with a timestamp down to the second, which is
  // effectively a unique ID on its own for sequential games. The player
  // roster is added too, in case two parallel lobbies (running at once
  // in a tournament) happen to start in the very same second.
  if (entry.date) {
    return `${entry.date}|${entry.map || 'nomap'}|${players}`;
  }

  // Fallback for the rare file where a timestamp couldn't be parsed:
  // fingerprint the actual game content instead.
  const killsSig = (entry.kills || [])
    .map((k) => `${(k.killer || '').toLowerCase()}>${(k.victim || '').toLowerCase()}@${(k.location || '').toLowerCase()}`)
    .join(';');

  const ejectionsSig = (entry.ejections || [])
    .map((e) => `${(e.player || '').toLowerCase()}:${e.role || ''}`)
    .join(';');

  return [
    'nodate',
    entry.map || 'nomap',
    entry.gameMode || 'nomode',
    entry.winnerTeam || 'nowinner',
    entry.winCondition || 'nocondition',
    entry.totalKills,
    entry.crewDeaths,
    players,
    killsSig,
    ejectionsSig
  ].join('|');

}

function getEntryFingerprint(entry) {
  return entry.fingerprint || computeGameFingerprint(entry);
}

// Folders can contain anything (README files, .git internals, images) -
// only try to parse things that look like a log. Doesn't apply to files
// chosen via the file picker, which the OS already filters by accept=.
function looksLikeLogFile(file) {
  return /\.(txt|log)$/i.test(file.name);
}

// A dropped folder arrives as DataTransferItems, not Files - this walks
// it (and any subfolders) recursively to collect every actual File.
function walkFileEntry(entry, out) {
  return new Promise((resolve, reject) => {
    if (entry.isFile) {
      entry.file((file) => {
        out.push(file);
        resolve();
      }, reject);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (!batch.length) {
            resolve();
            return;
          }
          // readEntries() can require multiple calls for large folders.
          Promise.all(batch.map((child) => walkFileEntry(child, out)))
            .then(readBatch)
            .catch(reject);
        }, reject);
      };
      readBatch();
    } else {
      resolve();
    }
  });
}

async function collectFilesFromDrop(dataTransfer) {
  const items = dataTransfer.items;

  if (!items || !items.length || !items[0].webkitGetAsEntry) {
    // Fallback for browsers without the entry API - plain files still work,
    // dropped folders just won't expand.
    return Array.from(dataTransfer.files || []);
  }

  const entries = Array.from(items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter(Boolean);

  if (!entries.length) {
    return Array.from(dataTransfer.files || []);
  }

  const files = [];
  await Promise.all(entries.map((entry) => walkFileEntry(entry, files)));
  return files;
}

async function handleFiles(fileList) {

  const files = Array.from(fileList).filter(looksLikeLogFile);

  if (files.length === 0) {
    return;
  }

  let addedCount = 0;
  let retaggedCount = 0;

  for (const file of files) {

    try {

      const text = await file.text();

      const parsed = parseLogText(
        text,
        file.name,
        getSelectedCategory()
      );

      parsed.fingerprint = computeGameFingerprint(parsed);

      const existingIndex = state.entries.findIndex(
        (entry) => getEntryFingerprint(entry) === parsed.fingerprint
      );

      if (existingIndex === -1) {

        state.entries.push(parsed);
        addedCount += 1;

      } else if (state.entries[existingIndex].category !== parsed.category) {

        // Same game re-imported under a different tag: just retag it,
        // don't duplicate it. Keep the newer fileName too, in case it
        // was re-exported/renamed since the last import.
        state.entries[existingIndex].category = parsed.category;
        state.entries[existingIndex].fileName = parsed.fileName;
        retaggedCount += 1;

      }
      // else: identical game, identical category - already imported, skip.

    } catch (err) {

      console.error(err);

    }

  }

  saveEntries(state.entries);

  try {

    const allPlayers = sumPlayerStatsFromEntries(state.entries);

    for (
      const playerName
      of Object.keys(allPlayers)
    ) {

      addPlayer(

          state.playerDatabase,

          playerName

      );

    }

    savePlayerDatabase(

        state.playerDatabase

    );

    updateCategoryFilterOptions();

    renderAll();

    if (addedCount || retaggedCount) {
      console.log(`Imported ${addedCount} new game(s), retagged ${retaggedCount} game(s).`);
    }

  } catch (err) {

    console.error("Import succeeded but updating the dashboard failed:", err);
    alert("Your file(s) imported, but something went wrong updating the dashboard. Check the console and let Claude know what it says.");

  }

}

function bindEvents() {

  // Without this, dropping a file anywhere on the page OUTSIDE the exact
  // drop zone makes the browser navigate away to open that file directly -
  // which looks like "drag and drop is broken" since it can trigger from
  // being a few pixels off, and gets more likely whenever the page layout
  // shifts (new sections, columns, etc).
  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  window.addEventListener("drop", (event) => {
    event.preventDefault();
  });

  if (elements.playerNameHeader) {
      elements.playerNameHeader.onclick = () => toggleSort('name');
  }

  if (elements.playerGamesHeader) {
      elements.playerGamesHeader.onclick = () => toggleSort('games');
  }

  if (elements.playerManagerButton) {
      elements.playerManagerButton.onclick = openPlayerManager;
  }

  if (elements.closePlayerManager) {
      elements.closePlayerManager.onclick = closePlayerManager;
  }

  if (elements.playerManagerModal) {
      elements.playerManagerModal.onclick = (event) => {
          if (event.target === elements.playerManagerModal) {
              closePlayerManager();
          }
      };
  }

  if (elements.playerManagerSearch) {
      elements.playerManagerSearch.oninput = () => {
          state.playerManagerSearch = elements.playerManagerSearch.value;
          renderPlayerManager();
      };
  }

  if (elements.showHiddenCheckbox) {
      elements.showHiddenCheckbox.onchange = () => {
          state.playerManagerShowHidden = elements.showHiddenCheckbox.checked;
          renderPlayerManager();
      };
  }

  if (elements.closePlayerDetail) {
      elements.closePlayerDetail.onclick = closePlayerDetail;
  }

  if (elements.playerDetailModal) {
      elements.playerDetailModal.onclick = (event) => {
          if (event.target === elements.playerDetailModal) {
              closePlayerDetail();
          }
      };
  }

  if (elements.trendsPlayerSelect) {
      elements.trendsPlayerSelect.onchange = () => {
          state.trendsPlayerName = elements.trendsPlayerSelect.value || null;
          renderTrendsTable();
      };
  }

  if (elements.categoryFilter) {
      elements.categoryFilter.onchange = renderAll;
  }

  elements.chooseFilesButton.addEventListener("click", () => {

    elements.fileInput.click();

  });

  if (elements.chooseFolderButton && elements.folderInput) {
      elements.chooseFolderButton.addEventListener("click", () => {

        elements.folderInput.click();

      });

      elements.folderInput.onchange = async (event) => {

        await handleFiles(event.target.files);

        event.target.value = "";

      };
  }

  elements.fileInput.onchange = async (event) => {

    await handleFiles(event.target.files);

    event.target.value = "";

  };

  elements.dropZone.ondragenter = (event) => {

    event.preventDefault();

    elements.dropZone.classList.add("dragover");

  };

  elements.dropZone.ondragover = (event) => {

    event.preventDefault();

    elements.dropZone.classList.add("dragover");

  };

  elements.dropZone.ondragleave = () => {

    elements.dropZone.classList.remove("dragover");

  };

  elements.dropZone.ondrop = async (event) => {

    event.preventDefault();

    elements.dropZone.classList.remove("dragover");

    const files = await collectFilesFromDrop(event.dataTransfer);
    await handleFiles(files);

  };

  elements.searchInput.oninput = renderAll;

  elements.clearButton.onclick = () => {

    if (!confirm("Clear all saved game data? This can't be undone.")) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);

    state.entries = [];

    state.players = {};

    state.trendsPlayerName = null;

    updateCategoryFilterOptions();

    renderAll();

  };

}


function bootstrap() {
  state.playerSettings =
    loadPlayerSettings();

  state.entries =
      loadStoredEntries();

  updateCategoryFilterOptions();
  bindEvents();

  try {

    renderAll();

  } catch (err) {

    console.error("Failed to render saved data - it may be from an older version of this app:", err);
    alert("Something in your saved data couldn't be loaded (probably left over from an older version of this app). Open the console for details, or use \"Clear saved data\" to start fresh.");

  }

}

bootstrap();
