
const elements = {
  
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
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
  chooseFilesButton: document.getElementById('chooseFilesButton'),
  playerManagerButton: document.getElementById('playerManagerButton'),
  playerManagerModal: document.getElementById('playerManagerModal'),
  closePlayerManager: document.getElementById('closePlayerManager'),
  playerManagerSearch: document.getElementById('playerManagerSearch'),
  playerManagerBody: document.getElementById('playerManagerBody'),
  
};

if (!elements.categorySelect) {
  console.error("categorySelect wasn't found!");
}

const state = {

    entries: [],

    players: {},

    playerDatabase:
        loadPlayerDatabase(),

    search: ""

};

function getSelectedCategory() {
  return elements.categorySelect.value;
}

function aggregatePlayers(entries) {

  const playerMap = {};

  const aliases = state.playerSettings.aliases || {};

  for (const entry of entries) {

    for (const [originalName, stat] of Object.entries(entry.playerStats || {})) {

      const playerName =
        aliases[originalName.toLowerCase()] || originalName;

      if (!playerMap[playerName]) {

        playerMap[playerName] = createPlayerStats();

      }

      const target = playerMap[playerName];

      target.gamesPlayed += stat.gamesPlayed;
      target.gamesAsCrewmate += stat.gamesAsCrewmate;
      target.gamesAsImpostor += stat.gamesAsImpostor;
      target.crewWins += stat.crewWins;
      target.impWins += stat.impWins;

    }

  }

  return finalizePlayerRates(playerMap);

}

function renderSummary() {
  const totals = state.entries.reduce(
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

function renderGames() {
  const searchTerm = state.search;
  const filtered = state.entries.filter((entry) => {
    const haystack = `${entry.fileName} ${entry.games} ${entry.crewWins} ${entry.impWins} ${entry.totalKills} ${entry.crewDeaths}`.toLowerCase();
    return haystack.includes(searchTerm);
  });

  if (filtered.length === 0) {
    elements.gameTableBody.innerHTML = '<tr><td colspan="7" class="empty">No matching game data yet.</td></tr>';
    return;
  }

  elements.gameTableBody.innerHTML = filtered.map((entry) => `
    <tr>
      <td>${entry.category}</td>
      <td>${entry.fileName}</td>
      <td>${entry.games}</td>
      <td>${entry.crewWins}</td>
      <td>${entry.impWins}</td>
      <td>${entry.totalKills}</td>
      <td>${entry.crewDeaths}</td>
    </tr>
  `).join('');
}
function renderPlayers() {
    console.log("renderPlayers called");
}
function renderPlayerManager() {

    const search =
    (state.playerManagerSearch || "").toLowerCase();

    const hidden =
    state.playerSettings?.hidden || [];

    const rows =
        Object.entries(state.players)

        .map(([name,stats])=>({

            name,

            games:stats.gamesPlayed

        }))

        .filter(player => {

    if (!player.name) {
        return false;
    }

    return !hidden.includes(
        player.name.toLowerCase()
    );

})

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

        <td colspan="3">

        No players.

        </td>

        </tr>

        `;

        return;

    }

    elements.playerManagerBody.innerHTML=

    rows.map(player=>`

    <tr>

    <td>${player.name}</td>

    <td>${player.games}</td>

    <td>

        <button
            class="merge-player"
            data-player="${player.name}"
        >

          Merge / Alias

</button>

        <button
            class="hide-player"
            data-player="${player.name}"
        >

            Hide

        </button>

    </td>

    </tr>

    `).join("");

    document
        .querySelectorAll(".alias-player")
        .forEach(button=>{

        button.onclick=()=>{

            askForAlias(

                button.dataset.player

            );

        };

    });

    document
        .querySelectorAll(".hide-player")
        .forEach(button=>{

        button.onclick=()=>{

            hidePlayer(

                button.dataset.player

            );

        };

    });

}
function openPlayerManager() {

  state.playerManagerSearch = "";

  elements.playerManagerSearch.value = "";

  renderPlayerManager();
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
  function askForAlias(playerName) {

    const newName = prompt(

        `Merge "${playerName}" into which player?`,

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
function hidePlayer(playerName) {

    if (!confirm(`Hide "${playerName}"?`)) {

        return;

    }

    if (!state.playerSettings.hidden.includes(playerName.toLowerCase())) {

        state.playerSettings.hidden.push(playerName.toLowerCase());

    }

    savePlayerSettings();
    renderAliasList();

    renderPlayerManager();

    renderAll();

}
}
function createAlias(oldName, newName) {

  oldName = oldName.trim();
  newName = newName.trim();

  if (!oldName || !newName) {
    return;
  }

  let finalName = newName;

while (
  state.playerSettings.aliases[
    finalName.toLowerCase()
  ]
) {

  finalName =
    state.playerSettings.aliases[
      finalName.toLowerCase()
    ];

}

state.playerSettings.aliases[
  oldName.toLowerCase()
] = finalName;

  savePlayerSettings();

  state.players =
    aggregatePlayers(state.entries);

  renderAll();


}

  elements.playerManagerModal.classList.remove("hidden");

}

function closePlayerManager() {

  elements.playerManagerModal.classList.add("hidden");

}
  const searchTerm = state.search;
  const playerRows = Object.entries(state.players || {}).map(([playerName, stat]) => ({ playerName, ...stat }));
  const filtered = playerRows.filter((row) => {
    const haystack = `${row.playerName} ${row.gamesPlayed} ${row.gamesAsCrewmate} ${row.gamesAsImpostor} ${row.crewWins} ${row.impWins}`.toLowerCase();
    return haystack.includes(searchTerm);
  });

  if (filtered.length === 0) {
    elements.playerTableBody.innerHTML = '<tr><td colspan="8" class="empty">No matching players yet.</td></tr>';
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
    </tr>
  `).join('');
}

function renderAll() {
  console.log("renderPlayers exists:", typeof renderPlayers);
  state.search = elements.searchInput.value.trim().toLowerCase();
  renderSummary();
  renderGames();
  renderPlayers();
  renderPlayerManager();
}

async function handleFiles(fileList) {

  const files = Array.from(fileList);

  if (files.length === 0) {
    return;
  }

  const parsedEntries = [];

  for (const file of files) {

    try {

      const text = await file.text();

      parsedEntries.push(
        parseLogText(
          text,
          file.name,
          getSelectedCategory()
        )
      );

    } catch (err) {

      console.error(err);

    }

  }

  const newEntries = parsedEntries.filter(entry =>
    !state.entries.some(existing =>
        existing.gameId === entry.gameId
    )
);

state.entries.push(...newEntries);

  state.players = aggregatePlayers(state.entries);

  saveEntries(state.entries);
  for (

    const playerName

    of Object.keys(state.players)

) {

    addPlayer(

        state.playerDatabase,

        playerName

    );

}

savePlayerDatabase(

    state.playerDatabase

);

  renderAll();

}

function bindEvents() {
  
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

elements.playerManagerModal.onclick = (event) => {

  if (event.target === elements.playerManagerModal) {

    closePlayerManager();

  }

};

elements.playerManagerSearch.oninput = () => {

  state.playerManagerSearch =
      elements.playerManagerSearch.value;

  renderPlayerManager();

};

  elements.chooseFilesButton.addEventListener("click", () => {

    elements.fileInput.click();

  });

  elements.fileInput.onchange = async (event) => {

    await handleFiles(event.target.files);

    event.target.value = "";

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

    await handleFiles(event.dataTransfer.files);

  };

  elements.searchInput.oninput = renderAll;

  elements.clearButton.onclick = () => {

    localStorage.removeItem(STORAGE_KEY);

    state.entries = [];

    state.players = {};

    renderAll();

  };

}


function bootstrap() {
  state.playerSettings =
    loadPlayerSettings();

state.entries =
    loadStoredEntries();
  state.players = aggregatePlayers(state.entries);
  bindEvents();
  renderAll();
}

bootstrap();
