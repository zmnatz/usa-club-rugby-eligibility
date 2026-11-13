// Type definitions for every file the nightly job reads and writes, in one place.
// Importing from "@zmnatz/usa-club-rugby-data/types" pulls in no runtime code.
//
//   public/data/index.json           PublishedIndexFile
//   public/data/fixtures.json        PublishedFixturesFile
//   public/data/clubs/<key>.json     PublishedClubFile
//   public/data/players.json         PublishedPlayersFile
//   public/data/seasons.json         PublishedSeasonsFile
//   public/data/seasons/<slug>.json  PublishedSeasonFile
//   public/data/seasons/<slug>.players.json  PublishedPlayersFile
//   archive/manifest.json            ArchiveManifest
//   archive/fixtures/<season>.json   ArchiveFixturesFile
//   archive/matches/<season>.json    ArchiveMatchesFile

import type { ArchiveManifest, LockedSeasonData } from './archive.ts';
import type { FeedFixture } from './feeds.ts';
import type { ParticipationSnapshot } from './snapshot.ts';
import type { MatchCentreData } from './playerHistory.ts';
import type { PublishedIndex, PublishedSeason } from './published.ts';

/** `index.json`: the current season's clubs and their sides, and when the
 *  archive was last pulled. */
export type PublishedIndexFile = PublishedIndex;

/** `fixtures.json`: the current season's fixtures, in date order. */
export interface PublishedFixturesFile {
  season: string;
  fixtures: FeedFixture[];
}

/** `clubs/<key>.json`: one club's Match Participation rows, gaps and result ids.
 *  A player who played for two clubs appears in both clubs' files. */
export interface PublishedClubFile extends ParticipationSnapshot {
  /** When the archive was last pulled, which is when the file was calculated;
   *  always present in a published file. */
  generatedAt: string;
}

/** `seasons.json`: the Locked Seasons published, newest first. Absent until one is. */
export interface PublishedSeasonsFile {
  seasons: PublishedSeason[];
}

/** `seasons/<slug>.json`: everything published for one Locked Season, in one file:
 *  its clubs, Unplaced Teams, fixtures, and each club's Match Participation by club key. */
export type PublishedSeasonFile = LockedSeasonData;

/** `players.json`: which clubs each player is in the current season's record of, by CMS
 *  id, for finding a player from their id without reading every club. Worked out from the
 *  club files by `buildPlayerIndex`, which leaves out players whose profile isn't public.
 *  `seasons/<slug>.players.json` is the same for one Locked Season. The client works one
 *  out itself for custom eligibility options, and when a file is missing. */
export interface PublishedPlayersFile {
  season: string;
  players: Record<string, { name: string; clubs: string[] }>;
}

/** `archive/fixtures/<season>.json`: every senior club fixture that season by id. */
export interface ArchiveFixturesFile {
  season: string;
  fixtures: Record<string, FeedFixture>;
}

/** `archive/matches/<season>.json`: every played match's CMS record by fixture
 *  id; null where the CMS has none. */
export interface ArchiveMatchesFile {
  season: string;
  matches: Record<string, MatchCentreData | null>;
}

export type { ArchiveManifest, FeedFixture, MatchCentreData, ParticipationSnapshot, PublishedIndex };
export type {
  MatchCommentary,
  MatchData,
  MatchLineUp,
  MatchPlayer,
  MatchStatsSummary,
  Team,
} from './match.ts';
export type { PlayerRoundStatus } from './clubReport.ts';
export type { ParticipationGap } from './snapshot.ts';
export type { PlayerGameLog, PlayerHistory, PlayerScoringEvent } from './playerHistory.ts';
export type { PublishedClub } from './published.ts';
export type * from './types.ts';
