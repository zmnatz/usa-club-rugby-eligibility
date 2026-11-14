import { type ChangeEvent, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
import { wrapRow } from './layout.ts';
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
    <Stack spacing={2} useFlexGap>
      <Stack direction="row" spacing={2} useFlexGap sx={wrapRow}>
        <Button variant="outlined" component="label">
          Choose CSV file…
          <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </Button>
        <TextField
          label="…or paste the CSV"
          multiline
          minRows={6}
          maxRows={14}
          fullWidth
          value={csvText}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </Stack>
      <Stack direction="row" spacing={2} useFlexGap sx={wrapRow}>
        <Button variant="contained" onClick={onRun} disabled={!csvText.trim()} loading={loading}>
          Run Breakdown
        </Button>
        <Button variant="text" onClick={onClear} disabled={!canClear}>
          Clear
        </Button>
        {fileName && (
          <Typography variant="body2" color="text.secondary">
            Loaded: {fileName}
          </Typography>
        )}
      </Stack>
    </Stack>
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
      <Typography color="textSecondary" gutterBottom>
        {`Paste or upload a Rugby Xplorer Match Participation Report for any club to see
             which players are NCS-eligible for each of its sides. Participation counts as
             Played + Substitute. Players are assumed registered, since the report only lists
             registered players, and the registration date is shown for reference.`}{' '}
        <MuiLink component={Link} href={routes.methodology()}>
          How this report is worked out
        </MuiLink>
      </Typography>

      {clubs.length > 1 && (
        <Autocomplete
          size="small"
          sx={{ maxWidth: 420, mb: 2 }}
          options={clubs}
          value={club}
          onChange={(_, next) => setCsvClubName(next?.name ?? '')}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.name === value.name}
          renderInput={(params) => <TextField {...params} label={`Club in this report (${clubs.length})`} />}
        />
      )}

      {!breakdown && (
        <Card component="section" sx={{ mb: 4 }}>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!breakdown && !error && (
        <Typography color="text.secondary">Upload a report and run the breakdown to see player eligibility.</Typography>
      )}

      {breakdown && club && (
        <Stack spacing={2} useFlexGap>
          <EligibilityReportView
            source="csv"
            club={club}
            breakdown={breakdown}
            now={ranAt}
            actions={
              <Button variant="outlined" size="small" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
                Edit Report Data
              </Button>
            }
          />
          {editing && (
            <Card component="section" aria-label="Edit Report Data">
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </>
  );
}
