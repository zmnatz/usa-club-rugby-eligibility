// Builds .cache/players.sqlite from public/data: each player's verdict in every club
// they appear for and the fixtures behind it, using the engine. Run before
// `next build` (the build and dev scripts do). Run with `node`, which runs
// TypeScript that uses only erasable syntax.
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  clubFixtures,
  computeBreakdown,
  DEFAULT_RULES as eligibility,
  hasSharedName,
  isNameWithheld,
  participationRows,
  remainingMatches,
  sharedNames,
} from '@zmnatz/usa-club-rugby-data';
import { PLAYER_DB_PATH, SCHEMA } from '../src/utils/playerDb.ts';
import { playerFixtures, type ClubSchedule, type RoundAccounting } from '../src/utils/playerDetail.ts';
import { readClubSnapshot, readFixtures, readIndex } from '../src/utils/published.ts';

const started = Date.now();
mkdirSync(path.dirname(PLAYER_DB_PATH), { recursive: true });
rmSync(PLAYER_DB_PATH, { force: true });
const db = new DatabaseSync(PLAYER_DB_PATH);
db.exec(SCHEMA);

const insertClub = db.prepare('INSERT INTO clubs (key, name) VALUES (?, ?)');
const insertPlayer = db.prepare('INSERT OR IGNORE INTO players (id, name) VALUES (?, ?)');
const insertPlayerClub = db.prepare(
  `INSERT INTO player_clubs (player_id, club_key, team_name, side_label, eligible, on_track, participation,
     played, substitute, show_cms_id, eligibility, sides, possible)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertRound = db.prepare(
  `INSERT INTO rounds (player_id, club_key, verdict_team, team_name, ord, fixture_id, round, competition, date_time,
     opponent, score_for, score_against, status, counted, substitutions_missing)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const allFixtures = readFixtures();
let players = 0;
let rounds = 0;

db.exec('BEGIN');
for (const club of readIndex().clubs) {
  insertClub.run(club.key, club.name);
  const snapshot = readClubSnapshot(club.key);
  const fixtures = clubFixtures(allFixtures, club);
  const breakdown = computeBreakdown(
    participationRows(snapshot, club, eligibility),
    club.sides,
    eligibility,
    remainingMatches(fixtures, club, eligibility),
  );
  const accounting: RoundAccounting = {
    snapshot,
    fixtures,
    clubSlug: null,
    sides: club.sides.map((side) => side.teamName),
  };
  const schedule: ClubSchedule = { club, fixtures, clubSlug: null };

  for (const side of breakdown.sides) {
    const shared = sharedNames(side.players);
    for (const player of side.players) {
      // A player whose profile isn't public gets no page.
      if (isNameWithheld(player.name)) continue;
      const detail = playerFixtures(player, accounting, schedule);
      // The raw rows only fed the fixtures above.
      const { rows: _rows, ...verdict } = player;

      insertPlayer.run(player.playerId, player.name);
      insertPlayerClub.run(
        player.playerId,
        club.key,
        player.teamName,
        side.label,
        player.eligible ? 1 : 0,
        player.eligible && player.pending.length > 0 ? 1 : 0,
        player.participation,
        player.played,
        player.substitute,
        hasSharedName(player, shared) ? 1 : 0,
        JSON.stringify({ ...verdict, rows: [] }),
        JSON.stringify(detail.sides.map((entry) => entry.teamName)),
        JSON.stringify(detail.possible),
      );
      for (const entry of detail.sides) {
        entry.rounds.forEach((round, ord) => {
          insertRound.run(
            player.playerId,
            club.key,
            player.teamName,
            entry.teamName,
            ord,
            round.fixtureId,
            round.round,
            round.competition,
            round.dateTime,
            round.opponent,
            round.scoreFor,
            round.scoreAgainst,
            round.status,
            round.counted ? 1 : 0,
            round.substitutionsMissing ? 1 : 0,
          );
          rounds += 1;
        });
      }
      players += 1;
    }
  }
}
db.exec('COMMIT');
db.close();
console.log(`players.sqlite: ${players} player-club verdicts, ${rounds} rounds in ${Date.now() - started} ms`);
