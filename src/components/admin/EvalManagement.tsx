'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Plus, Play, Ban, RefreshCw, Trash2, Eye, Archive, Gauge } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (kept local — this UI reads/writes a subset of the Prisma models in
// prisma/schema.prisma's "RAG Evaluation & Continuous Improvement System"
// block; see src/lib/eval/{metrics,judge,runner}.ts for the engine itself).
// ---------------------------------------------------------------------------
interface Dataset {
  id: number; name: string; description: string | null; version: number;
  testCaseCount: number; runCount: number; updatedAt: string;
}
interface TestCase {
  id: number; question: string; expectedAnswer: string | null;
  relevantMenuIds: string[]; relevantChunkIds: number[];
  category: string | null; language: string; difficulty: string | null;
  answerable: boolean; isActive: boolean;
}
interface Run {
  id: number; name: string; status: string; totalCases: number; completedCases: number;
  failedCases: number; concurrency: number; datasetId: number; datasetVersion: number;
  generationModel: string; embeddingModel: string; rerankerEnabled: boolean;
  judgeEnabled: boolean;
  judgeProvider: string; judgeModel: string; createdAt: string; startedAt: string | null; completedAt: string | null;
  dataset?: { name: string };
}
interface ResultRow {
  id: number; question: string; expectedAnswer: string | null; generatedAnswer: string | null;
  noAnswer: boolean; confidence: string | null; status: string; errorMessage: string | null;
  abstentionOutcome: string; totalMs: number | null;
  testCase: { category: string | null; language: string; difficulty: string | null; answerable: boolean };
  judgeEvaluation: {
    faithfulnessScore: number | null; correctnessScore: number | null; relevanceScore: number | null;
    completenessScore: number | null; hallucinationDetected: boolean | null; hallucinationSeverity: string | null;
    overallScore: number | null; reasoning: string | null;
    claims: { claimText: string; supportStatus: string }[];
  } | null;
}
interface JudgeConfig {
  enabled: boolean; provider: string; model: string; temperature: number; maxTokens: number; timeoutMs: number; retryCount: number;
}
type RetrievalAgg = {
  mrr: number;
  byK: { k: number; hitRate: number; recall: number; precision: number; ndcg: number }[];
  sampleSize: number;
} | null;
interface RunSummary {
  runId: number; totalCases: number; completedCases: number; failedCases: number; errorRate: number | null;
  retrieval: { pool: RetrievalAgg; reranked: RetrievalAgg; context: RetrievalAgg };
  generation: {
    faithfulness: number | null; correctness: number | null; relevance: number | null; completeness: number | null;
    contextRelevance: number | null; overallScore: number | null; sampleSize: number;
  };
  safety: {
    hallucinationRate: number | null; unsupportedClaimRate: number | null; abstentionAccuracy: number | null;
    incorrectAbstentionRate: number | null; hallucinatedAnswerRate: number | null; judgeParseFailureRate: number | null;
    abstentionSampleSize: number;
  };
  citations: { correctness: number | null; completeness: number | null };
  performance: {
    p50Ms: number | null; p95Ms: number | null; p99Ms: number | null;
    avgEmbedMs: number | null; avgRetrieveMs: number | null; avgRerankMs: number | null; avgGenerateMs: number | null;
  };
}

const pct = (v: number | null | undefined) => v == null ? '—' : `${(v * 100).toFixed(0)}%`;
const num = (v: number | null | undefined, digits = 2) => v == null ? '—' : v.toFixed(digits);
const ms = (v: number | null | undefined) => v == null ? '—' : v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`;

function MetricTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const toneClass = tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : '';
  return (
    <div className="border rounded-md p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const RUNNING_STATUSES = new Set(['pending', 'running']);
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  completed_with_failures: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

export function EvalManagement() {
  const { csrfFetch } = useAdminAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'datasets' | 'runs' | 'failures' | 'settings'>('overview');

  // ---- Overview ----
  const [overviewRunId, setOverviewRunId] = useState<string>('');
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ---- Datasets ----
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDesc, setNewDatasetDesc] = useState('');
  const [creatingDataset, setCreatingDataset] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [caseFormOpen, setCaseFormOpen] = useState(false);
  const [caseSaving, setCaseSaving] = useState(false);
  const emptyCaseForm = {
    question: '', expectedAnswer: '', relevantMenuIds: '', category: '', language: 'en',
    difficulty: 'medium', answerable: true,
  };
  const [caseForm, setCaseForm] = useState(emptyCaseForm);

  // ---- Runs ----
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [newRunDatasetId, setNewRunDatasetId] = useState<string>('');
  // Default 1 — concurrent generate() calls don't parallelize on CPU-only
  // Ollama inference (see EvaluationRun.concurrency's schema comment).
  const [newRunConcurrency, setNewRunConcurrency] = useState(1);
  // Per-run judge override. Defaults to what judgeForm says when it loads —
  // "use global EvalJudgeConfig setting" is the default; toggling it off
  // passes judgeEnabled:false explicitly in the runs/POST body.
  const [newRunJudgeEnabled, setNewRunJudgeEnabled] = useState<boolean | null>(null);
  const [runCreating, setRunCreating] = useState(false);

  // ---- Failed Questions ----
  const [failuresRunId, setFailuresRunId] = useState<string>('');
  const [failureResults, setFailureResults] = useState<ResultRow[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [failuresPage, setFailuresPage] = useState(0);
  const [failuresTotal, setFailuresTotal] = useState(0);
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);

  // ---- Settings ----
  const [judgeForm, setJudgeForm] = useState<JudgeConfig | null>(null);
  const [judgeSaving, setJudgeSaving] = useState(false);

  // ---------------------------------------------------------------------
  // Loaders
  // ---------------------------------------------------------------------
  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const res = await csrfFetch('/api/admin/eval/datasets', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') setDatasets(json.data);
    } catch { /* silently fail */ } finally { setDatasetsLoading(false); }
  }, [csrfFetch]);

  const loadTestCases = useCallback(async (datasetId: number) => {
    setCasesLoading(true);
    try {
      const res = await csrfFetch(`/api/admin/eval/datasets/${datasetId}/cases`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') setTestCases(json.data);
    } catch { /* silently fail */ } finally { setCasesLoading(false); }
  }, [csrfFetch]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await csrfFetch('/api/admin/eval/runs?pageSize=50', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') setRuns(json.data);
    } catch { /* silently fail */ } finally { setRunsLoading(false); }
  }, [csrfFetch]);

  const loadFailures = useCallback(async (runId: number, page: number, problemsOnly: boolean) => {
    setFailuresLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (problemsOnly) params.set('hallucinations', 'true');
      const res = await csrfFetch(`/api/admin/eval/runs/${runId}/results?${params}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') {
        setFailureResults(json.data);
        setFailuresTotal(json.meta.total);
      }
    } catch { /* silently fail */ } finally { setFailuresLoading(false); }
  }, [csrfFetch]);

  const loadSummary = useCallback(async (runId: number) => {
    setSummaryLoading(true);
    try {
      const res = await csrfFetch(`/api/admin/eval/runs/${runId}/summary`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') setSummary(json.data);
    } catch { /* silently fail */ } finally { setSummaryLoading(false); }
  }, [csrfFetch]);

  const loadJudgeConfig = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/eval/judge-config', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success') setJudgeForm(json.data);
    } catch { /* silently fail */ }
  }, [csrfFetch]);

  useEffect(() => { loadDatasets(); loadRuns(); loadJudgeConfig(); }, [loadDatasets, loadRuns, loadJudgeConfig]);
  // Keep the per-run "judge enabled" override in sync with the global default
  // whenever the Judge config is fetched/refreshed — null means "use the
  // global default" and the admin can toggle away from that baseline at any
  // time. A saved true/false persists across a judge config reload so the
  // user's explicit override is not silently erased.
  useEffect(() => {
    if (typeof newRunJudgeEnabled !== 'boolean' && typeof judgeForm?.enabled === 'boolean') {
      setNewRunJudgeEnabled(judgeForm.enabled);
    }
  }, [judgeForm?.enabled]);
  useEffect(() => { if (selectedDatasetId) loadTestCases(selectedDatasetId); }, [selectedDatasetId, loadTestCases]);

  // Default the Overview run picker to the most recent run once runs load.
  useEffect(() => {
    if (!overviewRunId && runs.length) setOverviewRunId(String(runs[0].id));
  }, [runs, overviewRunId]);

  useEffect(() => {
    if (overviewRunId) loadSummary(Number(overviewRunId));
  }, [overviewRunId, loadSummary]);

  // Keep the summary fresh while the selected run is still in progress.
  useEffect(() => {
    if (activeTab !== 'overview' || !overviewRunId) return;
    const selected = runs.find(r => String(r.id) === overviewRunId);
    if (!selected || !RUNNING_STATUSES.has(selected.status)) return;
    const t = setInterval(() => loadSummary(Number(overviewRunId)), 4000);
    return () => clearInterval(t);
  }, [activeTab, overviewRunId, runs, loadSummary]);
  useEffect(() => {
    const id = failuresRunId ? Number(failuresRunId) : null;
    if (id) loadFailures(id, failuresPage, onlyProblems);
  }, [failuresRunId, failuresPage, onlyProblems, loadFailures]);

  // Poll while any run is pending/running, only when the Runs tab is visible.
  const anyRunning = runs.some(r => RUNNING_STATUSES.has(r.status));
  useEffect(() => {
    if (activeTab !== 'runs' || !anyRunning) return;
    const t = setInterval(loadRuns, 3000);
    return () => clearInterval(t);
  }, [activeTab, anyRunning, loadRuns]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  const handleCreateDataset = async () => {
    if (!newDatasetName.trim() || creatingDataset) return;
    setCreatingDataset(true);
    try {
      const res = await csrfFetch('/api/admin/eval/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDatasetName.trim(), description: newDatasetDesc.trim() || null }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: 'Dataset created' });
        setNewDatasetName(''); setNewDatasetDesc('');
        await loadDatasets();
      } else {
        toast({ title: 'Create failed', description: json?.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally { setCreatingDataset(false); }
  };

  const handleSaveCase = async () => {
    if (!selectedDatasetId || !caseForm.question.trim() || caseSaving) return;
    setCaseSaving(true);
    try {
      const res = await csrfFetch(`/api/admin/eval/datasets/${selectedDatasetId}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: caseForm.question.trim(),
          expectedAnswer: caseForm.expectedAnswer.trim() || null,
          relevantMenuIds: caseForm.relevantMenuIds.split(',').map(s => s.trim()).filter(Boolean),
          category: caseForm.category.trim() || null,
          language: caseForm.language.trim() || 'en',
          difficulty: caseForm.difficulty,
          answerable: caseForm.answerable,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: 'Test case added' });
        setCaseForm(emptyCaseForm);
        setCaseFormOpen(false);
        await loadTestCases(selectedDatasetId);
        await loadDatasets();
      } else {
        toast({ title: 'Save failed', description: json?.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally { setCaseSaving(false); }
  };

  const handleArchiveCase = async (id: number) => {
    if (!selectedDatasetId) return;
    try {
      const res = await csrfFetch(`/api/admin/eval/cases/${id}`, { method: 'DELETE' });
      if (res.ok) { toast({ title: 'Test case archived' }); await loadTestCases(selectedDatasetId); }
      else toast({ title: 'Archive failed', variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
  };

  const handleCreateRun = async () => {
    if (!newRunDatasetId || runCreating) return;
    setRunCreating(true);
    try {
      const body: Record<string, unknown> = { datasetId: Number(newRunDatasetId), concurrency: newRunConcurrency };
      // newRunJudgeEnabled === null means "use global default" (don't send the
      // field) — the API defaults to EvalJudgeConfig.enabled. An explicit
      // true/false is sent only when the admin tweaks the per-run toggle.
      if (typeof newRunJudgeEnabled === 'boolean') body.judgeEnabled = newRunJudgeEnabled;
      const res = await csrfFetch('/api/admin/eval/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 202) {
        toast({ title: 'Run started', description: 'Progress updates every few seconds below.' });
        await loadRuns();
      } else {
        toast({ title: 'Failed to start run', description: json?.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally { setRunCreating(false); }
  };

  const handleCancelRun = async (id: number) => {
    try {
      const res = await csrfFetch(`/api/admin/eval/runs/${id}/cancel`, { method: 'POST' });
      if (res.ok) { toast({ title: 'Cancellation requested' }); await loadRuns(); }
      else toast({ title: 'Cancel failed', variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
  };

  const handleResumeRun = async (id: number) => {
    try {
      const res = await csrfFetch(`/api/admin/eval/runs/${id}/start`, { method: 'POST' });
      if (res.status === 202) { toast({ title: 'Run resumed' }); await loadRuns(); }
      else {
        const json = await res.json().catch(() => null);
        toast({ title: 'Resume failed', description: json?.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
  };

  const handleSaveJudgeConfig = async () => {
    if (!judgeForm || judgeSaving) return;
    setJudgeSaving(true);
    try {
      const res = await csrfFetch('/api/admin/eval/judge-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(judgeForm),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) { toast({ title: 'Judge settings saved' }); setJudgeForm(json.data); }
      else toast({ title: 'Save failed', description: json?.message, variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally { setJudgeSaving(false); }
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview" className="text-xs flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />Overview</TabsTrigger>
        <TabsTrigger value="datasets" className="text-xs flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" />Test Dataset</TabsTrigger>
        <TabsTrigger value="runs" className="text-xs flex items-center gap-1"><Play className="h-3.5 w-3.5" />Evaluation Runs</TabsTrigger>
        <TabsTrigger value="failures" className="text-xs flex items-center gap-1"><Eye className="h-3.5 w-3.5" />Failed Questions</TabsTrigger>
        <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
      </TabsList>

      {/* ---------------- Overview ---------------- */}
      <TabsContent value="overview" className="space-y-4 m-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div className="min-w-[260px]">
              <Label className="text-xs">Run</Label>
              <Select value={overviewRunId} onValueChange={setOverviewRunId}>
                <SelectTrigger><SelectValue placeholder="Select a run" /></SelectTrigger>
                <SelectContent>
                  {runs.map(r => <SelectItem key={r.id} value={String(r.id)}>#{r.id} {r.name} ({r.status})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => overviewRunId && loadSummary(Number(overviewRunId))} disabled={!overviewRunId || summaryLoading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
        </Card>

        {!overviewRunId && (
          <Card><CardContent className="text-center text-muted-foreground text-xs py-10">Run an evaluation first (Evaluation Runs tab), then pick it here.</CardContent></Card>
        )}

        {summary && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-sm">Retrieval — success metrics</CardTitle>
                <CardDescription>Computed 3 ways so you can see exactly where a question is lost: the raw candidate pool, the reranked list, and what actually reached the LLM's prompt.</CardDescription>
              </CardHeader>
              <CardContent>
                {(['pool', 'reranked', 'context'] as const).every(k => !summary.retrieval[k]) ? (
                  <p className="text-xs text-muted-foreground">No test cases in this run have page-level ground truth (relevantMenuIds) set — retrieval metrics need at least one to compute.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stage</TableHead>
                          <TableHead>MRR</TableHead>
                          {(summary.retrieval.context?.byK ?? summary.retrieval.pool?.byK ?? []).map(b => (
                            <TableHead key={b.k} colSpan={4} className="text-center">K={b.k}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {([
                          ['Retrieval pool (pre-rerank)', summary.retrieval.pool],
                          ['Reranked', summary.retrieval.reranked],
                          ['Final context (sent to LLM)', summary.retrieval.context],
                        ] as const).map(([label, agg]) => agg && (
                          <TableRow key={label}>
                            <TableCell className="font-medium">{label}<div className="text-[10px] text-muted-foreground">n={agg.sampleSize}</div></TableCell>
                            <TableCell>{num(agg.mrr)}</TableCell>
                            {agg.byK.map(b => (
                              <TableCell key={b.k} className="text-[10px]">
                                <div>Hit {pct(b.hitRate)}</div>
                                <div>Rec {pct(b.recall)}</div>
                                <div>Prec {pct(b.precision)}</div>
                                <div>nDCG {num(b.ndcg)}</div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Generation — success metrics</CardTitle>
                <CardDescription>LLM-judge scores, averaged over {summary.generation.sampleSize} judged answers. Individual components only — never a single blended score.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MetricTile label="Faithfulness" value={pct(summary.generation.faithfulness)} />
                <MetricTile label="Correctness" value={pct(summary.generation.correctness)} />
                <MetricTile label="Relevance" value={pct(summary.generation.relevance)} />
                <MetricTile label="Completeness" value={pct(summary.generation.completeness)} />
                <MetricTile label="Context relevance" value={pct(summary.generation.contextRelevance)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Safety — failure metrics</CardTitle>
                <CardDescription>Lower is better for every tile here.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricTile label="Error rate" value={pct(summary.errorRate)} sub={`${summary.failedCases}/${summary.totalCases} cases`} tone={summary.errorRate ? (summary.errorRate > 0 ? 'bad' : 'good') : 'neutral'} />
                <MetricTile label="Hallucination rate" value={pct(summary.safety.hallucinationRate)} tone={summary.safety.hallucinationRate ? 'bad' : 'good'} />
                <MetricTile label="Unsupported claim rate" value={pct(summary.safety.unsupportedClaimRate)} tone={summary.safety.unsupportedClaimRate ? 'bad' : 'good'} />
                <MetricTile label="Judge parse failures" value={pct(summary.safety.judgeParseFailureRate)} tone={summary.safety.judgeParseFailureRate ? 'bad' : 'good'} />
                <MetricTile label="Abstention accuracy" value={pct(summary.safety.abstentionAccuracy)} sub={`n=${summary.safety.abstentionSampleSize}`} tone="good" />
                <MetricTile label="Incorrect abstention" value={pct(summary.safety.incorrectAbstentionRate)} sub="answerable Q, said No Answer" tone={summary.safety.incorrectAbstentionRate ? 'bad' : 'good'} />
                <MetricTile label="Hallucinated answer" value={pct(summary.safety.hallucinatedAnswerRate)} sub="unanswerable Q, answered anyway" tone={summary.safety.hallucinatedAnswerRate ? 'bad' : 'good'} />
                <MetricTile label="Citation correctness" value={pct(summary.citations.correctness)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Performance</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricTile label="P50 latency" value={ms(summary.performance.p50Ms)} />
                <MetricTile label="P95 latency" value={ms(summary.performance.p95Ms)} />
                <MetricTile label="P99 latency" value={ms(summary.performance.p99Ms)} />
                <MetricTile label="Avg embed" value={ms(summary.performance.avgEmbedMs)} />
                <MetricTile label="Avg retrieve" value={ms(summary.performance.avgRetrieveMs)} />
                <MetricTile label="Avg rerank" value={ms(summary.performance.avgRerankMs)} />
                <MetricTile label="Avg generate" value={ms(summary.performance.avgGenerateMs)} />
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      {/* ---------------- Test Dataset ---------------- */}
      <TabsContent value="datasets" className="space-y-4 m-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Datasets</CardTitle>
            <CardDescription>Golden question sets, versioned by test-case changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">New dataset name</Label>
                <Input value={newDatasetName} onChange={e => setNewDatasetName(e.target.value)} placeholder="e.g. Core Golden Set" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Description (optional)</Label>
                <Input value={newDatasetDesc} onChange={e => setNewDatasetDesc(e.target.value)} />
              </div>
              <Button size="sm" onClick={handleCreateDataset} disabled={!newDatasetName.trim() || creatingDataset}>
                <Plus className="h-3.5 w-3.5 mr-1" />Create
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Test cases</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map(d => (
                  <TableRow key={d.id} className={selectedDatasetId === d.id ? 'bg-muted/50' : ''}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>v{d.version}</TableCell>
                    <TableCell>{d.testCaseCount}</TableCell>
                    <TableCell>{d.runCount}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedDatasetId(d.id)}>
                        Manage cases
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!datasetsLoading && !datasets.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-6">No datasets yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedDatasetId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Test cases — {datasets.find(d => d.id === selectedDatasetId)?.name}</CardTitle>
                <CardDescription>Ground truth is page-level (`relevantMenuIds`) — see docs/AI_CONFIG.md for why chunk ids aren't used as primary ground truth.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setCaseFormOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add case</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Answerable</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testCases.filter(tc => tc.isActive).map(tc => (
                    <TableRow key={tc.id}>
                      <TableCell className="max-w-[320px] truncate" title={tc.question}>{tc.question}</TableCell>
                      <TableCell>{tc.category ?? '—'}</TableCell>
                      <TableCell>{tc.language}</TableCell>
                      <TableCell>{tc.difficulty ?? '—'}</TableCell>
                      <TableCell>{tc.answerable ? <Badge variant="outline">Yes</Badge> : <Badge variant="outline">No (unanswerable)</Badge>}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleArchiveCase(tc.id)} title="Archive">
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!casesLoading && !testCases.filter(tc => tc.isActive).length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">No test cases yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Sheet open={caseFormOpen} onOpenChange={setCaseFormOpen}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add test case</SheetTitle>
              <SheetDescription>relevantMenuIds is the primary retrieval ground truth — comma-separated menu/article ids (find them in Knowledge Base → Status).</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 mt-4">
              <div>
                <Label className="text-xs">Question *</Label>
                <Textarea value={caseForm.question} onChange={e => setCaseForm(f => ({ ...f, question: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Expected answer (optional)</Label>
                <Textarea value={caseForm.expectedAnswer} onChange={e => setCaseForm(f => ({ ...f, expectedAnswer: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label className="text-xs">Relevant menu/article ids (comma-separated)</Label>
                <Input value={caseForm.relevantMenuIds} onChange={e => setCaseForm(f => ({ ...f, relevantMenuIds: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input value={caseForm.category} onChange={e => setCaseForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Language</Label>
                  <Input value={caseForm.language} onChange={e => setCaseForm(f => ({ ...f, language: e.target.value }))} placeholder="en / am" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <Label className="text-xs">Difficulty</Label>
                  <Select value={caseForm.difficulty} onValueChange={v => setCaseForm(f => ({ ...f, difficulty: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={caseForm.answerable} onCheckedChange={v => setCaseForm(f => ({ ...f, answerable: v }))} />
                  <Label className="text-xs">Answerable (off = expect "No Answer")</Label>
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveCase} disabled={!caseForm.question.trim() || caseSaving}>
                {caseSaving ? 'Saving…' : 'Add case'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </TabsContent>

      {/* ---------------- Evaluation Runs ---------------- */}
      <TabsContent value="runs" className="space-y-4 m-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Start a run</CardTitle>
            <CardDescription>Runs the real RAG pipeline (queryKB) for every test case, then judges each answer.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 items-end flex-wrap">
            <div className="min-w-[220px]">
              <Label className="text-xs">Dataset</Label>
              <Select value={newRunDatasetId} onValueChange={setNewRunDatasetId}>
                <SelectTrigger><SelectValue placeholder="Select a dataset" /></SelectTrigger>
                <SelectContent>
                  {datasets.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name} ({d.testCaseCount} cases)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label className="text-xs">Concurrency</Label>
              <Input type="number" min={1} max={10} value={newRunConcurrency} onChange={e => setNewRunConcurrency(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
            </div>
            <div className="flex items-end gap-2 rounded-md border px-3 py-2 min-w-[190px]">
              <div className="space-y-1">
                <Label className="text-xs">AI Judge</Label>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {typeof newRunJudgeEnabled === 'boolean' && newRunJudgeEnabled === (judgeForm?.enabled ?? true)
                    ? 'Using global default'
                    : typeof newRunJudgeEnabled === 'boolean'
                      ? 'Per-run override'
                      : '—'}
                </p>
              </div>
              <Switch
                checked={!!newRunJudgeEnabled}
                onCheckedChange={setNewRunJudgeEnabled}
                disabled={runCreating}
              />
            </div>
            <Button size="sm" onClick={handleCreateRun} disabled={!newRunDatasetId || runCreating}>
              <Play className="h-3.5 w-3.5 mr-1" />{runCreating ? 'Starting…' : 'Run evaluation'}
            </Button>
            <Button size="sm" variant="outline" onClick={loadRuns} disabled={runsLoading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-3">
            {runs.map(r => {
              const pct = r.totalCases > 0 ? Math.round(((r.completedCases + r.failedCases) / r.totalCases) * 100) : 0;
              return (
                <div key={r.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-medium text-sm">{r.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {r.dataset?.name} · v{r.datasetVersion} · {r.generationModel} · rerank {r.rerankerEnabled ? 'on' : 'off'} · judge {r.judgeEnabled ? 'on' : 'off'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_BADGE[r.status] ?? ''}>{r.status}</Badge>
                      {RUNNING_STATUSES.has(r.status) && (
                        <Button size="sm" variant="outline" onClick={() => handleCancelRun(r.id)}><Ban className="h-3.5 w-3.5 mr-1" />Cancel</Button>
                      )}
                      {(r.status === 'completed_with_failures' || r.status === 'failed') && (
                        <Button size="sm" variant="outline" onClick={() => handleResumeRun(r.id)}><RefreshCw className="h-3.5 w-3.5 mr-1" />Resume</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setFailuresRunId(String(r.id)); setActiveTab('failures'); }}>
                        View results
                      </Button>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="text-[10px] text-muted-foreground">
                    {r.completedCases} succeeded, {r.failedCases} failed, {r.totalCases} total
                  </div>
                </div>
              );
            })}
            {!runsLoading && !runs.length && (
              <div className="text-center text-muted-foreground text-xs py-6">No runs yet.</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Failed Questions ---------------- */}
      <TabsContent value="failures" className="space-y-4 m-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div className="min-w-[240px]">
              <Label className="text-xs">Run</Label>
              <Select value={failuresRunId} onValueChange={v => { setFailuresRunId(v); setFailuresPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Select a run" /></SelectTrigger>
                <SelectContent>
                  {runs.map(r => <SelectItem key={r.id} value={String(r.id)}>#{r.id} {r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={onlyProblems} onCheckedChange={setOnlyProblems} />
              <Label className="text-xs">Hallucinations/failures only</Label>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Hallucination</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failureResults.map(res => (
                  <TableRow key={res.id}>
                    <TableCell className="max-w-[280px] truncate" title={res.question}>{res.question}</TableCell>
                    <TableCell>
                      <Badge variant={res.status === 'success' ? 'outline' : 'destructive'}>{res.status}</Badge>
                      {' '}
                      {res.noAnswer && <Badge variant="outline">no answer</Badge>}
                    </TableCell>
                    <TableCell>{res.confidence ?? '—'}</TableCell>
                    <TableCell>{res.judgeEvaluation?.overallScore != null ? res.judgeEvaluation.overallScore.toFixed(2) : '—'}</TableCell>
                    <TableCell>{res.judgeEvaluation?.hallucinationDetected ? <Badge variant="destructive">{res.judgeEvaluation.hallucinationSeverity ?? 'yes'}</Badge> : '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedResult(res)}><Eye className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!failuresLoading && !failureResults.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                    {failuresRunId ? 'Nothing matches this filter.' : 'Select a run above.'}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {failuresTotal > 10 && (
              <Pagination currentPage={failuresPage} pageSize={10} totalItems={failuresTotal} onPageChange={setFailuresPage} />
            )}
          </CardContent>
        </Card>

        <Sheet open={!!selectedResult} onOpenChange={(open) => { if (!open) setSelectedResult(null); }}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            {selectedResult && (
              <>
                <SheetHeader>
                  <SheetTitle>Result detail</SheetTitle>
                </SheetHeader>
                <ScrollArea className="mt-4 h-[calc(100vh-8rem)] pr-4">
                  <div className="space-y-4 text-sm">
                    <div><Label className="text-xs text-muted-foreground">Question</Label><p>{selectedResult.question}</p></div>
                    {selectedResult.expectedAnswer && (
                      <div><Label className="text-xs text-muted-foreground">Expected answer</Label><p className="whitespace-pre-wrap">{selectedResult.expectedAnswer}</p></div>
                    )}
                    <div><Label className="text-xs text-muted-foreground">Generated answer</Label>
                      <p className="whitespace-pre-wrap">{selectedResult.generatedAnswer ?? (selectedResult.noAnswer ? '(No Answer)' : '—')}</p>
                    </div>
                    {selectedResult.errorMessage && (
                      <div><Label className="text-xs text-muted-foreground">Error</Label><p className="text-destructive">{selectedResult.errorMessage}</p></div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Confidence: <b>{selectedResult.confidence ?? '—'}</b></div>
                      <div>Abstention: <b>{selectedResult.abstentionOutcome}</b></div>
                      <div>Latency: <b>{selectedResult.totalMs ? `${(selectedResult.totalMs / 1000).toFixed(1)}s` : '—'}</b></div>
                      <div>Category: <b>{selectedResult.testCase.category ?? '—'}</b></div>
                    </div>
                    {selectedResult.judgeEvaluation && (
                      <div className="border-t pt-3 space-y-2">
                        <Label className="text-xs text-muted-foreground">Judge scores</Label>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>Faithfulness: {selectedResult.judgeEvaluation.faithfulnessScore?.toFixed(2) ?? '—'}</div>
                          <div>Correctness: {selectedResult.judgeEvaluation.correctnessScore?.toFixed(2) ?? '—'}</div>
                          <div>Relevance: {selectedResult.judgeEvaluation.relevanceScore?.toFixed(2) ?? '—'}</div>
                          <div>Completeness: {selectedResult.judgeEvaluation.completenessScore?.toFixed(2) ?? '—'}</div>
                          <div>Overall: {selectedResult.judgeEvaluation.overallScore?.toFixed(2) ?? '—'}</div>
                        </div>
                        {selectedResult.judgeEvaluation.reasoning && (
                          <p className="text-xs text-muted-foreground italic">{selectedResult.judgeEvaluation.reasoning}</p>
                        )}
                        {!!selectedResult.judgeEvaluation.claims.length && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Claims</Label>
                            {selectedResult.judgeEvaluation.claims.map((c, i) => (
                              <div key={i} className="text-xs flex gap-2">
                                <Badge variant={c.supportStatus === 'supported' ? 'outline' : 'destructive'} className="shrink-0">{c.supportStatus}</Badge>
                                <span>{c.claimText}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </SheetContent>
        </Sheet>
      </TabsContent>

      {/* ---------------- Settings ---------------- */}
      <TabsContent value="settings" className="space-y-4 m-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Judge configuration</CardTitle>
            <CardDescription>Only "ollama" is wired up today — the provider interface (src/lib/eval/judge.ts) is ready for a second provider later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {judgeForm && (
              <>
                <div className="flex items-center justify-between rounded-md border px-3 py-2.5 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Enable AI Judge scoring</Label>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      When disabled, new runs skip the judge entirely — retrieval metrics and RAG answers are still produced, but no LLM-judge overall score.
                    </p>
                  </div>
                  <Switch
                    checked={judgeForm.enabled}
                    onCheckedChange={v => setJudgeForm(f => f && ({ ...f, enabled: v }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Provider</Label><Input disabled={!judgeForm.enabled} value={judgeForm.provider} onChange={e => setJudgeForm(f => f && ({ ...f, provider: e.target.value }))} /></div>
                  <div><Label className="text-xs">Model</Label><Input disabled={!judgeForm.enabled} value={judgeForm.model} onChange={e => setJudgeForm(f => f && ({ ...f, model: e.target.value }))} /></div>
                  <div><Label className="text-xs">Temperature</Label><Input disabled={!judgeForm.enabled} type="number" step={0.1} min={0} max={2} value={judgeForm.temperature} onChange={e => setJudgeForm(f => f && ({ ...f, temperature: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">Max tokens</Label><Input disabled={!judgeForm.enabled} type="number" value={judgeForm.maxTokens} onChange={e => setJudgeForm(f => f && ({ ...f, maxTokens: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">Timeout (ms)</Label><Input disabled={!judgeForm.enabled} type="number" value={judgeForm.timeoutMs} onChange={e => setJudgeForm(f => f && ({ ...f, timeoutMs: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">Retry count</Label><Input disabled={!judgeForm.enabled} type="number" min={0} max={5} value={judgeForm.retryCount} onChange={e => setJudgeForm(f => f && ({ ...f, retryCount: Number(e.target.value) }))} /></div>
                </div>
                <Button size="sm" onClick={handleSaveJudgeConfig} disabled={judgeSaving}>{judgeSaving ? 'Saving…' : 'Save'}</Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
