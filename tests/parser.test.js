import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { parseLogText, summarizeFiles } from '../src/parser.js';
import { exportLogSummariesToDatabase } from '../src/database.js';

test('counts impostor wins, kills, and crew deaths from log text', () => {
  const log = [
    'Game 1 started',
    'Crewmate Alice was killed by Impostor Bob',
    'Impostor Bob killed Crewmate Carol',
    'Impostor team wins',
    'Crewmate Dave died during the emergency meeting'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.impWins, 1);
  assert.equal(result.crewWins, 0);
  assert.equal(result.totalKills, 2);
  assert.equal(result.crewDeaths, 2);
  assert.equal(result.games, 1);
});

test('parses the sample game log style from the provided logs', () => {
  const log = [
    '[6/27/2026 18:27:04]',
    'Started game on Polus - game mode: Normal',
    '',
    '[6/27/2026 18:27:09]',
    "Player's Roles:",
    'ArtfulDdgr (Pink) : Crewmate',
    'Bane (Orange) : Impostor',
    'Chomp (Green) : Impostor',
    '',
    '[6/27/2026 18:27:40]',
    'Chomp (Green) killed gin (Lime) at Storage',
    '[6/27/2026 18:27:43]',
    'Bane (Orange) killed Frosty (Blue) outside / in a hallway',
    '[6/27/2026 18:27:46]',
    'Meeting started by Chomp (Green)',
    "Frosty (Blue)'s body was found",
    'Players died this round: Frosty (Blue), gin (Lime)',
    '[6/27/2026 18:31:22]',
    'Chomp (Green) killed ArtfulDdgr (Pink) at O2',
    '[6/27/2026 18:31:31]',
    'Meeting started by ItzJdøt (Brown)',
    "ArtfulDdgr (Pink)'s body was found",
    'Players died this round: ArtfulDdgr (Pink)',
    '[6/27/2026 18:37:28]',
    'Winners: Crewmates by voting out Impostors',
    'Chomp (Green) killed 2 players',
    'Bane (Orange) killed 1 players'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.games, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.impWins, 0);
  assert.equal(result.totalKills, 3);
  assert.equal(result.crewDeaths, 3);
});

test('supports the crewmate task-win winner phrasing used by Among Us logs', () => {
  const log = [
    'Started game on Skeld',
    'Winners: Crewmates by task win'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.games, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.impWins, 0);
});

test('records the host player as a crewmate-style participant', () => {
  const log = [
    'Started game on Skeld',
    "Player's Roles:",
    'Alice (Pink) : Crewmate',
    'Host (White) : Host',
    'Winners: Crewmates by task win'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.games, 1);
  assert.equal(result.playerStats.host.gamesPlayed, 1);
  assert.equal(result.playerStats.host.gamesAsCrewmate, 1);
  assert.equal(result.playerStats.host.crewWins, 1);
});

test('records scientist, phantom, and viper roles from recent Among Us logs', () => {
  const log = [
    'Started game on Polus - game mode: Normal',
    "Player's Roles:",
    'ArtfulDdgr (Maroon) : Scientist',
    'Wordy Elf (Gray) : Phantom',
    'Leo (Purple) : Viper',
    'Winners: Crewmates by voting out Impostors'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.games, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.impWins, 0);
  assert.equal(result.playerStats.artfulddgr.gamesPlayed, 1);
  assert.equal(result.playerStats.artfulddgr.gamesAsCrewmate, 1);
  assert.equal(result.playerStats.artfulddgr.crewWins, 1);
  assert.equal(result.playerStats['wordy elf'].gamesPlayed, 1);
  assert.equal(result.playerStats['wordy elf'].gamesAsImpostor, 1);
  assert.equal(result.playerStats['wordy elf'].impWins, 0);
  assert.equal(result.playerStats.leo.gamesPlayed, 1);
  assert.equal(result.playerStats.leo.gamesAsImpostor, 1);
  assert.equal(result.playerStats.leo.impWins, 0);
});

test('supports the impostor killing winner phrasing used by Among Us logs', () => {
  const log = [
    'Started game on Skeld',
    'Winners: Impostors by killing'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.games, 1);
  assert.equal(result.crewWins, 0);
  assert.equal(result.impWins, 1);
});

test('tracks per-player win rates across multiple logs', async () => {
  const files = [
    new File([
      [
        'Started game on Skeld',
        "Player's Roles:",
        'Alice (Pink) : Crewmate',
        'Bob (Orange) : Impostor',
        'Winners: Crewmates by task win'
      ].join('\n')
    ], 'a.log', { type: 'text/plain' }),
    new File([
      [
        'Started game on Mira',
        "Player's Roles:",
        'Alice (Pink) : Crewmate',
        'Bob (Orange) : Impostor',
        'Winners: Impostors by killing'
      ].join('\n')
    ], 'b.log', { type: 'text/plain' }),
    new File([
      [
        'Started game on Polus',
        "Player's Roles:",
        'Alice (Pink) : Impostor',
        'Bob (Orange) : Crewmate',
        'Winners: Impostors by killing'
      ].join('\n')
    ], 'c.log', { type: 'text/plain' })
  ];

  const result = await summarizeFiles(files);

  assert.equal(result.playerStats.alice.gamesPlayed, 3);
  assert.equal(result.playerStats.alice.gamesAsCrewmate, 2);
  assert.equal(result.playerStats.alice.gamesAsImpostor, 1);
  assert.equal(result.playerStats.alice.crewWins, 1);
  assert.equal(result.playerStats.alice.impWins, 1);
  assert.equal(result.playerStats.alice.crewWinRate, 0.5);
  assert.equal(result.playerStats.alice.impWinRate, 1);

  assert.equal(result.playerStats.bob.gamesPlayed, 3);
  assert.equal(result.playerStats.bob.gamesAsCrewmate, 1);
  assert.equal(result.playerStats.bob.gamesAsImpostor, 2);
  assert.equal(result.playerStats.bob.crewWins, 0);
  assert.equal(result.playerStats.bob.impWins, 1);
  assert.equal(result.playerStats.bob.crewWinRate, 0);
  assert.equal(result.playerStats.bob.impWinRate, 0.5);
});

test('exports searchable game and player stats to sqlite', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'among-us-stats-'));
  const dbPath = join(tempDir, 'stats.sqlite');

  const files = [
    new File([
      [
        'Started game on Skeld',
        "Player's Roles:",
        'Alice (Pink) : Crewmate',
        'Bob (Orange) : Impostor',
        'Winners: Crewmates by task win'
      ].join('\n')
    ], 'a.log', { type: 'text/plain' }),
    new File([
      [
        'Started game on Mira',
        "Player's Roles:",
        'Alice (Pink) : Crewmate',
        'Bob (Orange) : Impostor',
        'Winners: Impostors by killing'
      ].join('\n')
    ], 'b.log', { type: 'text/plain' })
  ];

  await exportLogSummariesToDatabase(files, dbPath);

  const db = new DatabaseSync(dbPath);
  const gameCount = db.prepare('SELECT COUNT(*) AS count FROM games').get();
  const aliceRow = db.prepare('SELECT games_played, games_as_crewmate, games_as_impostor, crew_wins, imp_wins FROM player_stats WHERE player_name = ?').get('alice');

  assert.equal(gameCount.count, 2);
  assert.equal(aliceRow.games_played, 2);
  assert.equal(aliceRow.games_as_crewmate, 2);
  assert.equal(aliceRow.games_as_impostor, 0);
  assert.equal(aliceRow.crew_wins, 1);
  assert.equal(aliceRow.imp_wins, 0);

  db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

test('cli can export a folder of logs into sqlite', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'among-us-cli-'));
  const inputDir = join(tempDir, 'logs');
  const dbPath = join(tempDir, 'stats.sqlite');

  mkdirSync(inputDir, { recursive: true });

  writeFileSync(join(inputDir, 'a.log'), [
    'Started game on Skeld',
    "Player's Roles:",
    'Alice (Pink) : Crewmate',
    'Bob (Orange) : Impostor',
    'Winners: Crewmates by task win'
  ].join('\n'));

  writeFileSync(join(inputDir, 'b.log'), [
    'Started game on Mira',
    "Player's Roles:",
    'Alice (Pink) : Crewmate',
    'Bob (Orange) : Impostor',
    'Winners: Impostors by killing'
  ].join('\n'));

  const result = spawnSync(process.execPath, ['src/cli.js', inputDir, dbPath], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const db = new DatabaseSync(dbPath);
  const gameCount = db.prepare('SELECT COUNT(*) AS count FROM games').get();
  const bobRow = db.prepare('SELECT games_played, imp_wins FROM player_stats WHERE player_name = ?').get('bob');

  assert.equal(gameCount.count, 2);
  assert.equal(bobRow.games_played, 2);
  assert.equal(bobRow.imp_wins, 1);

  db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

test('summarizeFiles aggregates multiple files', async () => {
  const files = [
    new File(['Impostor team wins\nCrewmate Eve was killed by Impostor Frank'], 'a.log', { type: 'text/plain' }),
    new File(['Crewmates win\nImpostor Grace killed Crewmate Heidi'], 'b.log', { type: 'text/plain' })
  ];

  const result = await summarizeFiles(files);

  assert.equal(result.impWins, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.totalKills, 2);
  assert.equal(result.crewDeaths, 2);
  assert.equal(result.filesProcessed, 2);
});
