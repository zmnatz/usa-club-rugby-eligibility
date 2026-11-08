// Type definitions for every file the nightly job reads and writes, in one place.
// Importing from "@zmnatz/usa-club-rugby-data/types" pulls in no runtime code.
//
//   public/data/index.json           PublishedIndexFile
//   public/data/fixtures.json        PublishedFixturesFile
//   public/data/clubs/<key>.json     PublishedClubFile
//   archive/manifest.json            ArchiveManifest
//   archive/fixtures/<season>.json   ArchiveFixturesFile
//   archive/matches/<season>.json    ArchiveMatchesFile

import type { ArchiveManifest } from './archive.ts';
import type { FeedFixture } from './feeds.ts';
import type { ParticipationSnapshot } from './participation.ts';
import type { MatchCentreData } from './playerHistory.ts';
import type { PublishedIndex } from './published.ts';

/** `index.json`: the current season's clubs and their sides, and when the
 *  published data last changed. */
export type PublishedIndexFile = PublishedIndex;

/** `fixtures.json`: the current season's fixtures, in date order. */
export interface PublishedFixturesFile {
  season: string;
  fixtures: FeedFixture[];
}

/** `clubs/<key>.json`: one club's Match Participation rows, gaps and result ids.
 *  A player who played for two clubs appears in both clubs' files. */
export interface PublishedClubFile extends ParticipationSnapshot {
  /** When the data last changed; always present in a published file. */
  generatedAt: string;
}

/** Which clubs each player is in the record of, by CMS id, for finding a player from
 *  their id. Not published: worked out from the club files by `buildPlayerIndex`, which
 *  leaves out players whose profile isn't public. */
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
export type { ParticipationGap, PlayerRoundStatus } from './participation.ts';
export type { PlayerGameLog, PlayerHistory, PlayerScoringEvent } from './playerHistory.ts';
export type { PublishedClub } from './published.ts';
export type * from './types.ts';
