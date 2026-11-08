import { type ChangeEvent, useMemo, useState } from 'react';
import { Button, Dialog, DialogTitle, Link as MuiLink, TextField, Typography } from '@mui/material';
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
import { ClubPicker, FileButton, FormDialogContent, Panel, ReportAlert, Row } from './primitives.tsx';

interface CsvFormProps {
  csvText: string;
  fileName: string;
  canClear: boolean;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onTextChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
}

function CsvForm({ csvText, fileName, canClear, onFile, onTextChange, onRun, onClear }: CsvFormProps) {
  return (
    <>
      <Row gap={2} stretch below={2}>
        <FileButton variant="outlined" component="label">
          Choose CSV file…
          <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </FileButton>
        <TextField
          label="…or paste the CSV"
          multiline
          minRows={6}
          maxRows={14}
          fullWidth
          value={csvText}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </Row>
      <Row gap={2}>
        <Button variant="contained" onClick={onRun} disabled={!csvText.trim()}>
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
      </Row>
    </>
  );
}

export interface MatchParticipationReportProps {
  /** Every fixture the report's clubs could still play, for on-track verdicts.
   *  Leave undefined until they load: unknown isn't the same as none left. */
  fixtures?: FeedFixture[];
}

/** Checks a Rugby Xplorer Match Participation Report, uploaded or pasted, for any club. */
export function MatchParticipationReport({ fixtures }: MatchParticipationReportProps) {
  const { Link, routes } = useEligibilityLinks();
  const [csvClubName, setCsvClubName] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<PlayerRow[] | null>(null);
  const [activeSide, setActiveSide] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const clubs = useMemo(() => (csvRows ? clubsInRows(csvRows) : []), [csvRows]);
  const club = clubs.find((candidate) => candidate.name === csvClubName) ?? (clubs.length === 1 ? clubs[0] : null);

  const breakdown = useMemo(() => {
    if (!club || !csvRows) return null;
    // Fixtures not loaded (yet) are unknown, which isn't the same as none left.
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

  const handleRun = () => {
    setError(null);
    try {
      setCsvRows(parsePlayerRows(csvText));
    } catch (err) {
      setCsvRows(null);
      setError(err instanceof Error ? err.message : 'Could not read the CSV.');
    }
    setDialogOpen(false);
  };

  const handleClear = () => {
    setCsvText('');
    setFileName('');
    setError(null);
    setCsvRows(null);
    setDialogOpen(false);
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

      <Row gap={2} below={3}>
        {clubs.length > 1 && (
          <ClubPicker
            size="small"
            options={clubs}
            value={club}
            onChange={(_, next) => {
              setCsvClubName(next?.name ?? '');
              setActiveSide(0);
            }}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            renderInput={(params) => <TextField {...params} label={`Club in this report (${clubs.length})`} />}
          />
        )}
      </Row>

      {!breakdown && (
        <Panel pad={3} below={4}>
          <CsvForm
            csvText={csvText}
            fileName={fileName}
            canClear={Boolean(csvText)}
            onFile={handleFile}
            onTextChange={handleTextChange}
            onRun={handleRun}
            onClear={handleClear}
          />
        </Panel>
      )}

      {error && <ReportAlert severity="error">{error}</ReportAlert>}

      {!breakdown && !error && (
        <Typography color="text.secondary">Upload a report and run the breakdown to see player eligibility.</Typography>
      )}

      {breakdown && club && (
        <EligibilityReportView
          source="csv"
          club={club}
          breakdown={breakdown}
          activeSide={activeSide}
          onActiveSideChange={setActiveSide}
          actions={
            <Button variant="outlined" size="small" onClick={() => setDialogOpen(true)}>
              Edit Report Data
            </Button>
          }
        />
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Report Data</DialogTitle>
        <FormDialogContent dividers>
          <CsvForm
            csvText={csvText}
            fileName={fileName}
            canClear={Boolean(csvText) || Boolean(csvRows)}
            onFile={handleFile}
            onTextChange={handleTextChange}
            onRun={handleRun}
            onClear={handleClear}
          />
        </FormDialogContent>
      </Dialog>
    </>
  );
}
