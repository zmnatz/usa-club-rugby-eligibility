# The published data is built from the archive at build time, not committed

**Supersedes the reproducibility decision in [ADR 003](003-library-and-verify.md).**

Issue #80. Everything in `public/data/` is derived from `archive/` (ADR 002), yet it was committed, so a branch that changed the calculation conflicted with the next nightly snapshot, a code change carried hundreds of regenerated files, and the committed copy could drift from the code until someone reran the snapshot. `verify` existed to catch that drift.

Decisions, so they are not "fixed" later:

- **Only the archive is committed.** `public/data/` is gitignored and made by `bun run data`, which `dev`, `build` and `build:quick` run first; CI and Pages build it too. A checkout has no published data until then.
- **The nightly job commits the archive only.** It refreshes `archive/`, opens and merges its pull request, and the deploy builds the data from it. There is nothing derived to conflict with a branch or to drift.
- **The published stamp is the archive's `pulledAt`.** The manifest records it on every CMS read, and the data is calculated as of it rather than the build time, so the same archive always gives the same files. `generatedAt` is the last pull, not the last change: a night with no new record still moves it, and recording it commits the manifest, which keeps the site's "as of" date current. The old arrangement moved `generatedAt` only when the published content changed, which let a quiet night keep a stamp that no longer described when the archive was read.
- **`verify` stays as a check, not as the gate.** It still recalculates a published directory from the archive at its index's `generatedAt` and fails on any difference, for anyone holding a copy. The package's tests build and verify from the archive; CI no longer checks committed data, because there is none.
- **Locked Seasons are built with the rest**, not committed as final. They carry no timestamp, so the same archive gives the same file.
- **The published files stay the same public interface.** The URL, the file layout and the JSON shapes don't change; only the time in `generatedAt` is now the archive's pull.

A rules change no longer shows as a data diff in a pull request. To see what it does, run `bun run data` on the branch and on its base and compare the two `public/data/` directories.
