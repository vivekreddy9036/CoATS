"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState, useCallback, useMemo } from "react";
import StageBadge from "@/components/ui/StageBadge";
import Spinner from "@/components/ui/Spinner";
import Link from "next/link";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Area,
  AreaChart,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  Label,
} from "recharts";

interface StageSummary {
  stageCode: string;
  stageName: string;
  count: number;
}

interface BranchSummary {
  branchId: number;
  branchCode: string;
  branchName: string;
  stages: StageSummary[];
  total: number;
}

interface MonthlyTrend {
  month: string;
  UI: number;
  PT: number;
  HC: number;
  SC: number;
  total: number;
}

interface StageDistribution {
  stage: string;
  name: string;
  count: number;
}

interface CaseAgeBucket {
  bracket: string;
  count: number;
}

interface SectionCount {
  section: string;
  count: number;
}

interface OfficerWorkload {
  officer: string;
  cases: number;
}

interface ActionCompletion {
  completed: number;
  pending: number;
  total: number;
}

interface MonthlyProgress {
  month: string;
  entries: number;
}

interface ProgressEntry {
  id: number;
  progressDate: string;
  progressDetails: string;
  furtherAction: string | null;
  remarks: string | null;
  case: {
    uid: string;
    branch: { name: string };
    actions: { id: number; description: string }[];
  };
  createdBy: { fullName: string };
}

interface DashboardData {
  branches: BranchSummary[];
  totalCases: number;
  monthlyTrend: MonthlyTrend[];
  stageDistribution: StageDistribution[];
  caseAgeDistribution: CaseAgeBucket[];
  topSections: SectionCount[];
  officerWorkload: OfficerWorkload[];
  actionCompletion: ActionCompletion;
  monthlyProgress: MonthlyProgress[];
  progressEntries: ProgressEntry[] | null;
}

// ─── Chart Colors ──────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  UI: "hsl(217, 91%, 60%)",
  PT: "hsl(38, 92%, 50%)",
  HC: "hsl(0, 84%, 60%)",
  SC: "hsl(270, 70%, 60%)",
};

const stageChartConfig = {
  UI: { label: "Under Investigation", color: STAGE_COLORS.UI },
  PT: { label: "Pending Trial", color: STAGE_COLORS.PT },
  HC: { label: "High Court", color: STAGE_COLORS.HC },
  SC: { label: "Supreme Court", color: STAGE_COLORS.SC },
  total: { label: "Total Cases", color: "hsl(220, 15%, 50%)" },
} satisfies ChartConfig;

const PIE_FILLS = [STAGE_COLORS.UI, STAGE_COLORS.PT, STAGE_COLORS.HC, STAGE_COLORS.SC];

const AGE_COLORS = [
  "hsl(142, 71%, 45%)",  // green  - fresh
  "hsl(48, 96%, 53%)",   // yellow - moderate
  "hsl(25, 95%, 53%)",   // orange - aging
  "hsl(0, 72%, 51%)",    // red    - old
];

const ageChartConfig = {
  "< 30 days": { label: "< 30 days", color: AGE_COLORS[0] },
  "30–90 days": { label: "30–90 days", color: AGE_COLORS[1] },
  "90–180 days": { label: "90–180 days", color: AGE_COLORS[2] },
  "> 180 days": { label: "> 180 days", color: AGE_COLORS[3] },
  count: { label: "Cases", color: "hsl(220, 15%, 50%)" },
} satisfies ChartConfig;

const actionChartConfig = {
  completed: { label: "Completed", color: "hsl(142, 71%, 45%)" },
  pending: { label: "Pending", color: "hsl(0, 84%, 60%)" },
} satisfies ChartConfig;

const progressChartConfig = {
  entries: { label: "Progress Entries", color: "hsl(217, 91%, 60%)" },
} satisfies ChartConfig;

const officerChartConfig = {
  cases: { label: "Cases", color: "hsl(262, 83%, 58%)" },
} satisfies ChartConfig;

const sectionChartConfig = {
  count: { label: "Cases", color: "hsl(217, 91%, 60%)" },
} satisfies ChartConfig;

// ─── Case Holder Dashboard ─────────────────────────

function CaseHolderDashboard() {
  const [cases, setCases] = useState<{
    id: number;
    uid: string;
    crimeNumber: string;
    dateOfRegistration: string;
    sectionOfLaw: string;
    stage: { code: string; name: string };
    actions: { id: number; isCompleted: boolean }[];
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases?limit=100")
      .then((r) => r.json())
      .then((json) => setCases(json.data || []))
      .finally(() => setLoading(false));
  }, []);

  const stageCounts = useMemo(
    () =>
      ["UI", "PT", "HC", "SC"].map((code) => ({
        code,
        count: cases.filter((c) => c.stage.code === code).length,
      })),
    [cases]
  );

  const totalCases = useMemo(() => stageCounts.reduce((s, c) => s + c.count, 0), [stageCounts]);

  const pieData = useMemo(
    () => stageCounts.map((s) => ({ name: s.code, value: s.count })),
    [stageCounts]
  );

  // Case age distribution for current user's cases
  const caseAgeData = useMemo(() => {
    const buckets = { "< 30 days": 0, "30–90 days": 0, "90–180 days": 0, "> 180 days": 0 };
    const now = new Date();
    for (const c of cases) {
      const days = Math.floor((now.getTime() - new Date(c.dateOfRegistration).getTime()) / 86400000);
      if (days < 30) buckets["< 30 days"]++;
      else if (days < 90) buckets["30–90 days"]++;
      else if (days < 180) buckets["90–180 days"]++;
      else buckets["> 180 days"]++;
    }
    return Object.entries(buckets).map(([bracket, count]) => ({ bracket, count }));
  }, [cases]);

  // Radar data — profile of workload
  const radarData = useMemo(() => {
    const totalActions = cases.reduce((s, c) => s + (c.actions?.length || 0), 0);
    const completedActions = cases.reduce((s, c) => s + (c.actions?.filter((a) => a.isCompleted).length || 0), 0);
    const pendingActions = totalActions - completedActions;
    return [
      { metric: "UI Cases", value: stageCounts.find((s) => s.code === "UI")?.count || 0 },
      { metric: "PT Cases", value: stageCounts.find((s) => s.code === "PT")?.count || 0 },
      { metric: "HC Cases", value: stageCounts.find((s) => s.code === "HC")?.count || 0 },
      { metric: "SC Cases", value: stageCounts.find((s) => s.code === "SC")?.count || 0 },
      { metric: "Pending Actions", value: pendingActions },
      { metric: "Done Actions", value: completedActions },
    ];
  }, [cases, stageCounts]);

  const radarConfig = {
    value: { label: "Count", color: "hsl(217, 91%, 60%)" },
  } satisfies ChartConfig;

  if (loading) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stageCounts.map((s) => (
          <Card key={s.code} className="py-4">
            <CardContent className="pb-0">
              <StageBadge code={s.code} showFullName />
              <div className="text-3xl font-bold text-gray-800 mt-3">{s.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Donut + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Case Distribution</CardTitle>
            <CardDescription>By current stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="mx-auto aspect-square max-h-[280px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={4}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_FILLS[i % PIE_FILLS.length]} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="text-3xl font-bold fill-foreground">
                              {totalCases}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="text-sm fill-muted-foreground">
                              Cases
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cases by Stage</CardTitle>
            <CardDescription>Your assigned cases breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="max-h-[300px] w-full">
              <BarChart data={stageCounts.map((s) => ({ stage: s.code, count: s.count }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stageCounts.map((s, i) => (
                    <Cell key={s.code} fill={PIE_FILLS[i % PIE_FILLS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Case Age Radial + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Case Age Distribution — Radial Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Case Age Analysis</CardTitle>
            <CardDescription>How old are your active cases</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ageChartConfig} className="mx-auto aspect-square max-h-[300px]">
              <RadialBarChart
                data={caseAgeData.map((d, i) => ({ ...d, fill: AGE_COLORS[i] }))}
                innerRadius={30}
                outerRadius={130}
                startAngle={180}
                endAngle={0}
              >
                <ChartTooltip content={<ChartTooltipContent nameKey="bracket" />} />
                <RadialBar dataKey="count" background cornerRadius={6} />
              </RadialBarChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {caseAgeData.map((d, i) => (
                <div key={d.bracket} className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AGE_COLORS[i] }} />
                  {d.bracket}: <span className="font-semibold">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart — Workload Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Workload Profile</CardTitle>
            <CardDescription>Cases &amp; actions overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[300px]">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Radar
                  dataKey="value"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.3}
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-gray-500 text-sm">No cases assigned to you.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Case UID</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Crime No.</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Stage</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.slice(0, 10).map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{c.uid}</td>
                      <td className="py-2 px-3">{c.crimeNumber}</td>
                      <td className="py-2 px-3"><StageBadge code={c.stage.code} /></td>
                      <td className="py-2 px-3">
                        <Link href={`/cases/${c.id}`} className="text-navy hover:underline text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Supervisory Dashboard ─────────────────────────

function SupervisoryDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (branchFilter) params.set("branchId", branchFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/dashboard?${params}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, [branchFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ─── Derived chart data ──────────────────────

  const filteredBranches = useMemo(
    () =>
      data?.branches.filter(
        (b) => !branchFilter || b.branchId === parseInt(branchFilter)
      ) || [],
    [data, branchFilter]
  );

  const kpiStages = useMemo(
    () =>
      ["UI", "PT", "HC", "SC"].map((stageCode) => ({
        code: stageCode,
        total: filteredBranches.reduce(
          (sum, b) =>
            sum + (b.stages.find((s) => s.stageCode === stageCode)?.count || 0),
          0
        ),
      })),
    [filteredBranches]
  );

  const pieData = useMemo(
    () =>
      (data?.stageDistribution || []).map((s) => ({
        name: s.stage,
        value: s.count,
      })),
    [data]
  );

  const barChartData = useMemo(
    () =>
      filteredBranches.map((b) => ({
        branch: b.branchCode,
        UI: b.stages.find((s) => s.stageCode === "UI")?.count || 0,
        PT: b.stages.find((s) => s.stageCode === "PT")?.count || 0,
        HC: b.stages.find((s) => s.stageCode === "HC")?.count || 0,
        SC: b.stages.find((s) => s.stageCode === "SC")?.count || 0,
      })),
    [filteredBranches]
  );

  // Radar data — Branch comparison profile
  const radarData = useMemo(
    () =>
      ["UI", "PT", "HC", "SC"].map((code) => ({
        stage: stageChartConfig[code as keyof typeof stageChartConfig]?.label || code,
        ...Object.fromEntries(
          filteredBranches.map((b) => [
            b.branchCode,
            b.stages.find((s) => s.stageCode === code)?.count || 0,
          ])
        ),
      })),
    [filteredBranches]
  );

  const radarConfig = useMemo(() => {
    const BRANCH_COLORS = [
      "hsl(217, 91%, 60%)",
      "hsl(38, 92%, 50%)",
      "hsl(0, 84%, 60%)",
      "hsl(270, 70%, 60%)",
      "hsl(142, 71%, 45%)",
      "hsl(340, 82%, 52%)",
    ];
    const config: Record<string, { label: string; color: string }> = {};
    filteredBranches.forEach((b, i) => {
      config[b.branchCode] = {
        label: b.branchName,
        color: BRANCH_COLORS[i % BRANCH_COLORS.length],
      };
    });
    return config as ChartConfig;
  }, [filteredBranches]);

  // Action completion pie
  const actionPieData = useMemo(() => {
    if (!data?.actionCompletion) return [];
    return [
      { name: "completed", value: data.actionCompletion.completed },
      { name: "pending", value: data.actionCompletion.pending },
    ];
  }, [data]);

  if (loading && !data) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Supervisory Dashboard</h1>

      {/* Filters */}
      <Card className="mb-6 py-4">
        <CardContent className="pb-0">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Branches</option>
                {data?.branches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <DatePicker
                label="Date From"
                value={dateFrom}
                onChange={setDateFrom}
                className="min-w-[160px]"
              />
            </div>
            <div>
              <DatePicker
                label="Date To"
                value={dateTo}
                onChange={setDateTo}
                className="min-w-[160px]"
              />
            </div>
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy-light transition-colors cursor-pointer"
            >
              Apply
            </button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stage Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiStages.map((s) => (
          <Card key={s.code} className="py-4">
            <CardContent className="pb-0">
              <StageBadge code={s.code} showFullName />
              <div className="text-3xl font-bold text-gray-800 mt-3">{s.total}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI Summary Cards + Mini Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Left: 2x2 KPI cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Active Cases</p>
              <div className="text-4xl font-bold text-navy mt-2">{data?.totalCases || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {data?.branches.length || 0} branches
              </p>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Action Completion</p>
              <div className="text-4xl font-bold mt-2" style={{ color: "hsl(142, 71%, 45%)" }}>
                {data?.actionCompletion?.total
                  ? `${Math.round((data.actionCompletion.completed / data.actionCompletion.total) * 100)}%`
                  : "0%"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data?.actionCompletion?.completed || 0} of {data?.actionCompletion?.total || 0} actions done
              </p>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Actions</p>
              <div className="text-4xl font-bold mt-2 text-orange-500">
                {(data?.actionCompletion?.total || 0) - (data?.actionCompletion?.completed || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting completion
              </p>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Branches</p>
              <div className="text-4xl font-bold mt-2 text-slate-700">{data?.branches.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active units
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Stage Distribution Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Stage Distribution</CardTitle>
            <CardDescription>Overall case status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="mx-auto aspect-[4/2] max-h-[200px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_FILLS[i % PIE_FILLS.length]} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="text-2xl font-bold fill-foreground">
                              {data?.totalCases || 0}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="text-xs fill-muted-foreground">
                              Total
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Stacked Bar + Area Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Stacked Bar Chart — Branch-wise */}
        <Card>
          <CardHeader>
            <CardTitle>Cases by Branch</CardTitle>
            <CardDescription>Stacked by case stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="max-h-[320px] w-full">
              <BarChart data={barChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="branch" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="UI" stackId="a" fill={STAGE_COLORS.UI} radius={[0, 0, 0, 0]} />
                <Bar dataKey="PT" stackId="a" fill={STAGE_COLORS.PT} radius={[0, 0, 0, 0]} />
                <Bar dataKey="HC" stackId="a" fill={STAGE_COLORS.HC} radius={[0, 0, 0, 0]} />
                <Bar dataKey="SC" stackId="a" fill={STAGE_COLORS.SC} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Area Chart — Monthly Registration Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Registration Trend</CardTitle>
            <CardDescription>Cases registered over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="max-h-[320px] w-full">
              <AreaChart data={data?.monthlyTrend || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <defs>
                  <linearGradient id="fillUI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.UI} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.UI} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillPT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.PT} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.PT} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillHC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.HC} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.HC} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillSC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.SC} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.SC} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="UI" stroke={STAGE_COLORS.UI} fill="url(#fillUI)" stackId="1" />
                <Area type="monotone" dataKey="PT" stroke={STAGE_COLORS.PT} fill="url(#fillPT)" stackId="1" />
                <Area type="monotone" dataKey="HC" stroke={STAGE_COLORS.HC} fill="url(#fillHC)" stackId="1" />
                <Area type="monotone" dataKey="SC" stroke={STAGE_COLORS.SC} fill="url(#fillSC)" stackId="1" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Radar + Progress Activity Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart — Branch Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Branch Comparison Profile</CardTitle>
            <CardDescription>Comparative view across stages per branch</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[320px]">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {filteredBranches.map((b, i) => {
                  const BRANCH_COLORS = [
                    "hsl(217, 91%, 60%)",
                    "hsl(38, 92%, 50%)",
                    "hsl(0, 84%, 60%)",
                    "hsl(270, 70%, 60%)",
                    "hsl(142, 71%, 45%)",
                    "hsl(340, 82%, 52%)",
                  ];
                  return (
                    <Radar
                      key={b.branchCode}
                      dataKey={b.branchCode}
                      fill={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                      fillOpacity={0.15}
                      stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                      strokeWidth={2}
                    />
                  );
                })}
                <ChartLegend content={<ChartLegendContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Line Chart — Progress Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Activity Trend</CardTitle>
            <CardDescription>Officer productivity — entries logged per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={progressChartConfig} className="max-h-[320px] w-full">
              <LineChart data={data?.monthlyProgress || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="entries"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "hsl(217, 91%, 60%)" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Case Age Radial + Action Completion Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radial Bar — Case Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Case Age Distribution</CardTitle>
            <CardDescription>Age of active cases since registration</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ageChartConfig} className="mx-auto aspect-square max-h-[300px]">
              <RadialBarChart
                data={(data?.caseAgeDistribution || []).map((d, i) => ({ ...d, fill: AGE_COLORS[i] }))}
                innerRadius={30}
                outerRadius={130}
                startAngle={180}
                endAngle={0}
              >
                <ChartTooltip content={<ChartTooltipContent nameKey="bracket" />} />
                <RadialBar dataKey="count" background cornerRadius={6} />
              </RadialBarChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {(data?.caseAgeDistribution || []).map((d, i) => (
                <div key={d.bracket} className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AGE_COLORS[i] }} />
                  {d.bracket}: <span className="font-semibold">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart — Action Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Action Completion Rate</CardTitle>
            <CardDescription>Completed vs pending action items</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={actionChartConfig} className="mx-auto aspect-square max-h-[300px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={actionPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={4}
                >
                  <Cell fill="hsl(142, 71%, 45%)" />
                  <Cell fill="hsl(0, 84%, 60%)" />
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        const pct = data?.actionCompletion?.total
                          ? Math.round((data.actionCompletion.completed / data.actionCompletion.total) * 100)
                          : 0;
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="text-3xl font-bold fill-foreground">
                              {pct}%
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="text-sm fill-muted-foreground">
                              Done
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 4: Officer Workload + Top Sections of Law */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Horizontal Bar — Officer Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Officer Workload</CardTitle>
            <CardDescription>Top officers by case assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={officerChartConfig} className="max-h-[350px] w-full">
              <BarChart data={data?.officerWorkload || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="officer" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cases" fill="hsl(262, 83%, 58%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bar Chart — Top Sections of Law */}
        <Card>
          <CardHeader>
            <CardTitle>Top Sections of Law</CardTitle>
            <CardDescription>Most common crime sections across cases</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sectionChartConfig} className="max-h-[350px] w-full">
              <BarChart data={data?.topSections || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="section" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Branch-wise Summary Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Branch wise Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Branch</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">UI</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">PT</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">HC</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">SC</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredBranches.map((b) => (
                  <tr key={b.branchId} className="border-b border-gray-50">
                    <td className="py-2 px-3 font-medium">{b.branchName}</td>
                    {["UI", "PT", "HC", "SC"].map((code) => (
                      <td key={code} className="py-2 px-3 text-center">
                        {b.stages.find((s) => s.stageCode === code)?.count || 0}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center font-semibold">{b.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Progress Details (when date range is selected) */}
      {data?.progressEntries && data.progressEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Details ({dateFrom} to {dateTo})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Case UID</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Branch</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Progress</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Action To Be Taken</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.progressEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-50">
                      <td className="py-2 px-3 font-medium">{entry.case.uid}</td>
                      <td className="py-2 px-3">{entry.case.branch.name}</td>
                      <td className="py-2 px-3">{new Date(entry.progressDate).toLocaleDateString("en-IN")}</td>
                      <td className="py-2 px-3 max-w-xs truncate">{entry.progressDetails}</td>
                      <td className="py-2 px-3 max-w-xs">
                        {entry.case.actions.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5">
                            {entry.case.actions.map((a) => (
                              <li key={a.id}>{a.description}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3">{entry.createdBy.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return user.isSupervisory ? <SupervisoryDashboard /> : <CaseHolderDashboard />;
}
