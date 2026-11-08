// The player database: every player in the nightly data, their verdict in each club
// they appear for, and the fixtures behind it, worked out once by scripts/build-players.ts
// so each player's page is built from one lookup. A build cache, not published
// data: it is derived from public/data and rebuilt with every build.
// Server only (it needs Node's sqlite), and plain TypeScript Node can run.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { PlayerEligibility, PlayerRound } from '@zmnatz/usa-club-rugby-data';
import type { PlayerFixtures } from './playerDetail.ts';

export const PLAYER_DB_PATH = path.join(process.cwd(), '.cache', 'players.sqlite');

export const SCHEMA = `
CREATE TABLE clubs (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
-- A player's verdict on one side of one club (a player can be listed on several). eligibility is the PlayerEligibility as JSON,
-- without its raw rows, which only the detail's fixtures need.
CREATE TABLE player_clubs (
  player_id TEXT NOT NULL REFERENCES players(id),
  club_key TEXT NOT NULL REFERENCES clubs(key),
  team_name TEXT NOT NULL,
  side_label TEXT NOT NULL,
  eligible INTEGER NOT NULL,
  on_track INTEGER NOT NULL,
  participation INTEGER NOT NULL,
  played INTEGER NOT NULL,
  substitute INTEGER NOT NULL,
  show_cms_id INTEGER NOT NULL,
  eligibility TEXT NOT NULL,
  sides TEXT NOT NULL,
  possible TEXT NOT NULL,
  PRIMARY KEY (player_id, club_key, team_name)
);
-- One fixture on one of a club's sides, as it counts toward one of a player's verdicts
-- (verdict_team), which are worked out from that verdict's rows.
CREATE TABLE rounds (
  player_id TEXT NOT NULL,
  club_key TEXT NOT NULL,
  verdict_team TEXT NOT NULL,
  team_name TEXT NOT NULL,
  ord INTEGER NOT NULL,
  fixture_id TEXT NOT NULL,
  round TEXT NOT NULL,
  competition TEXT NOT NULL,
  date_time TEXT NOT NULL,
  opponent TEXT NOT NULL,
  score_for TEXT NOT NULL,
  score_against TEXT NOT NULL,
  status TEXT NOT NULL,
  counted INTEGER NOT NULL,
  substitutions_missing INTEGER NOT NULL
);
CREATE INDEX rounds_by_player ON rounds (player_id, club_key, verdict_team, team_name, ord);
CREATE INDEX rounds_by_fixture ON rounds (fixture_id);
CREATE INDEX player_clubs_by_club ON player_clubs (club_key);
`;

/** One side of one club's part of a player's page. */
export interface PlayerClubEntry {
  clubKey: string;
  clubName: string;
  /** The side this verdict is for. */
  sideLabel: string;
  showCmsId: boolean;
  player: PlayerEligibility;
  fixtures: PlayerFixtures;
}

export interface PlayerPageData {
  id: string;
  name: string;
  clubs: PlayerClubEntry[];
}

let db: DatabaseSync | undefined;

function open(): DatabaseSync {
  db ??= new DatabaseSync(PLAYER_DB_PATH, { readOnly: true });
  return db;
}

export function listPlayerIds(): string[] {
  return open()
    .prepare('SELECT id FROM players ORDER BY id')
    .all()
    .map((row) => String(row.id));
}

interface PlayerClubRow {
  club_key: string;
  team_name: string;
  club_name: string;
  side_label: string;
  show_cms_id: number;
  eligibility: string;
  sides: string;
  possible: string;
}

interface RoundRow {
  club_key: string;
  verdict_team: string;
  team_name: string;
  fixture_id: string;
  round: string;
  competition: string;
  date_time: string;
  opponent: string;
  score_for: string;
  score_against: string;
  status: PlayerRound['status'];
  counted: number;
  substitutions_missing: number;
}

/** A player and everything their page shows, or null if they have no page. */
export function readPlayerPage(id: string): PlayerPageData | null {
  const conn = open();
  const player = conn.prepare('SELECT id, name FROM players WHERE id = ?').get(id);
  if (!player) return null;

  const clubRows = conn
    .prepare(
      `SELECT pc.club_key, pc.team_name, c.name AS club_name, pc.side_label, pc.show_cms_id, pc.eligibility, pc.sides, pc.possible
       FROM player_clubs pc JOIN clubs c ON c.key = pc.club_key
       WHERE pc.player_id = ? ORDER BY c.name, pc.side_label`,
    )
    .all(id) as unknown as PlayerClubRow[];
  const roundRows = conn
    .prepare('SELECT * FROM rounds WHERE player_id = ? ORDER BY club_key, verdict_team, team_name, ord')
    .all(id) as unknown as RoundRow[];

  return {
    id: String(player.id),
    name: String(player.name),
    clubs: clubRows.map((row) => ({
      clubKey: row.club_key,
      clubName: row.club_name,
      sideLabel: row.side_label,
      showCmsId: row.show_cms_id === 1,
      player: JSON.parse(row.eligibility) as PlayerEligibility,
      fixtures: {
        sides: (JSON.parse(row.sides) as string[]).map((teamName) => ({
          teamName,
          rounds: roundRows
            .filter((round) => round.club_key === row.club_key && round.verdict_team === row.team_name && round.team_name === teamName)
            .map((round) => ({
              fixtureId: round.fixture_id,
              round: round.round,
              competition: round.competition,
              dateTime: round.date_time,
              opponent: round.opponent,
              scoreFor: round.score_for,
              scoreAgainst: round.score_against,
              status: round.status,
              counted: round.counted === 1,
              substitutionsMissing: round.substitutions_missing === 1,
            })),
        })),
        possible: JSON.parse(row.possible),
      },
    })),
  };
}
