import { type ChangeEvent, useMemo, useState } from 'react';
import {
  clubsInRows,
  computeBreakdown,
  DEFAULT_RULES,
  type FeedFixture,
  parsePlayerRows,
  type PlayerRow,
  qualifyingRows,
  remainingMatches,
} from '@zmnatz/usa-club-rugby-data';
import { EligibilityReportView } from './EligibilityReportView.tsx';
import { useEligibilityLinks } from './links.tsx';

interface CsvFormProps {
  csvText: string;
  fileName: string;
  canClear: boolean;
  loading: boolean;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onTextChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
}

function CsvForm({ csvText, fileName, canClear, loading, onFile, onTextChange, onRun, onClear }: CsvFormProps) {
  return (
    <div className="ec-stack">
      <label className="ec-field">
        Choose a CSV file
        <input className="ec-input" type="file" accept=".csv,text/csv" onChange={onFile} />
      </label>
      <label className="ec-field">
        …or paste the CSV
        <textarea
          className="ec-input"
          rows={8}
          value={csvText}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <div className="ec-row">
        <button type="button" className="ec-btn ec-btn--filled" onClick={onRun} disabled={!csvText.trim() || loading}>
          {loading ? 'Loading…' : 'Run Breakdown'}
        </button>
        <button type="button" className="ec-btn" onClick={onClear} disabled={!canClear}>
          Clear
        </button>
        {fileName && <span className="ec-muted ec-small">Loaded: {fileName}</span>}
      </div>
    </div>
  );
}

export interface MatchParticipationReportProps {
  /** Loads every fixture the report's clubs could still play, for on-track verdicts.
   *  Called when a report is first run, and verdicts wait for it. Without it, or if it
   *  fails, no player can be on track. */
  loadFixtures?: () => Promise<FeedFixture[]>;
}

/** Checks a Rugby Xplorer Match Participation Report, uploaded or pasted, for any club. */
export function MatchParticipationReport({ loadFixtures }: MatchParticipationReportProps) {
  const { Link, routes } = useEligibilityLinks();
  const [fixtures, setFixtures] = useState<FeedFixture[]>();
  const [loading, setLoading] = useState(false);
  const [csvClubName, setCsvClubName] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<PlayerRow[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [ranAt, setRanAt] = useState(() => new Date());

  const clubs = useMemo(() => (csvRows ? clubsInRows(csvRows) : []), [csvRows]);
  const club = clubs.find((candidate) => candidate.name === csvClubName) ?? (clubs.length === 1 ? clubs[0] : null);

  const breakdown = useMemo(() => {
    if (!club || !csvRows) return null;
    // Fixtures that didn't load are unknown, which isn't the same as none left.
    const remaining = fixtures ? remainingMatches(fixtures, club, DEFAULT_RULES) : {};
    return computeBreakdown(qualifyingRows(csvRows, DEFAULT_RULES), club.sides, DEFAULT_RULES, remaining);
  }, [club, csvRows, fixtures]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
      setFileName(file.name);
      setError(null);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRun = async () => {
    setError(null);
    try {
      const rows = parsePlayerRows(csvText);
      if (loadFixtures && !fixtures) {
        setLoading(true);
        setFixtures(await loadFixtures().catch(() => undefined));
        setLoading(false);
      }
      setCsvRows(rows);
      setRanAt(new Date());
    } catch (err) {
      setCsvRows(null);
      setError(err instanceof Error ? err.message : 'Could not read the CSV.');
    }
    setEditing(false);
  };

  const handleClear = () => {
    setCsvText('');
    setFileName('');
    setError(null);
    setCsvRows(null);
    setEditing(false);
  };

  const handleTextChange = (value: string) => {
    setCsvText(value);
    setFileName('');
  };

  return (
    <>
      <p className="ec-muted" style={{ maxWidth: 840 }}>
        {`Paste or upload a Rugby Xplorer Match Participation Report for any club to see
             which players are NCS-eligible for each of its sides. Participation counts as
             Played + Substitute. Players are assumed registered, since the report only lists
             registered players, and the registration date is shown for reference.`}{' '}
        <Link href={routes.methodology()}>How this report is worked out</Link>
      </p>

      {clubs.length > 1 && (
        <label className="ec-field" style={{ maxWidth: 420, marginBottom: 16 }}>
          {`Club in this report (${clubs.length})`}
          <select
            className="ec-input"
            value={club?.name ?? ''}
            onChange={(event) => setCsvClubName(event.target.value)}
          >
            <option value="" disabled>
              Choose a club
            </option>
            {clubs.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!breakdown && (
        <section className="ec-card" style={{ marginBottom: 32 }}>
          <CsvForm
            csvText={csvText}
            fileName={fileName}
            canClear={Boolean(csvText)}
            loading={loading}
            onFile={handleFile}
            onTextChange={handleTextChange}
            onRun={handleRun}
            onClear={handleClear}
          />
        </section>
      )}

      {error && (
        <div className="ec-alert ec-alert--error" role="alert" style={{ marginBottom: 24 }}>
          {error}
        </div>
      )}

      {!breakdown && !error && (
        <p className="ec-muted">Upload a report and run the breakdown to see player eligibility.</p>
      )}

      {breakdown && club && (
        <div className="ec-stack">
          <EligibilityReportView
            source="csv"
            club={club}
            breakdown={breakdown}
            now={ranAt}
            actions={
              <button type="button" className="ec-btn" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
                Edit Report Data
              </button>
            }
          />
          {editing && (
            <section className="ec-card" aria-label="Edit Report Data">
              <CsvForm
                csvText={csvText}
                fileName={fileName}
                canClear={Boolean(csvText) || Boolean(csvRows)}
                loading={loading}
                onFile={handleFile}
                onTextChange={handleTextChange}
                onRun={handleRun}
                onClear={handleClear}
              />
            </section>
          )}
        </div>
      )}
    </>
  );
}
