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

// ─── Case Holder Dashboard ─────────────────────────

function CaseHolderDashboard() {
  const [cases, setCases] = useState<{ stage: { code: string; name: string } }[]>([]);
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

      {/* Charts Row */}
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
                  {(cases as Array<{
                    id: number;
                    uid: string;
                    crimeNumber: string;
                    stage: { code: string; name: string };
                  }>).slice(0, 10).map((c) => (
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

      {/* Total Cases Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Active Cases</p>
            <div className="text-4xl font-bold text-navy mt-2">{data?.totalCases || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {data?.branches.length || 0} branches
            </p>
          </CardContent>
        </Card>

        {/* Mini Donut Card */}
        <Card className="lg:col-span-3">
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

      {/* Charts Row: Stacked Bar + Area Trend */}
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

        {/* Area Chart — Monthly Trend */}
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

      {/* Branch-wise Summary Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Branch-wise Summary</CardTitle>
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
