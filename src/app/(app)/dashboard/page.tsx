"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState, useCallback } from "react";
import StageBadge from "@/components/ui/StageBadge";
import Spinner from "@/components/ui/Spinner";
import Link from "next/link";

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
  progressEntries: ProgressEntry[] | null;
}

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

  if (loading) return <Spinner className="py-20" />;

  const stageCounts = ["UI", "PT", "HC", "SC"].map((code) => ({
    code,
    count: cases.filter((c) => c.stage.code === code).length,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stageCounts.map((s) => (
          <div key={s.code} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <StageBadge code={s.code} showFullName />
            <div className="text-3xl font-bold text-gray-800 mt-3">{s.count}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Cases</h2>
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
      </div>
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

  if (loading && !data) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Supervisory Dashboard</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
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
            <label className="block text-xs text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy-light transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Stage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {["UI", "PT", "HC", "SC"].map((stageCode) => {
          const total =
            data?.branches
              .filter((b) => !branchFilter || b.branchId === parseInt(branchFilter))
              .reduce(
                (sum, b) =>
                  sum + (b.stages.find((s) => s.stageCode === stageCode)?.count || 0),
                0
              ) || 0;

          return (
            <div key={stageCode} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <StageBadge code={stageCode} showFullName />
              <div className="text-3xl font-bold text-gray-800 mt-3">{total}</div>
            </div>
          );
        })}
      </div>

      {/* Branch-wise Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Branch-wise Summary</h2>
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
              {data?.branches
                .filter((b) => !branchFilter || b.branchId === parseInt(branchFilter))
                .map((b) => (
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
      </div>

      {/* Progress Details (when date range is selected) */}
      {data?.progressEntries && data.progressEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Progress Details ({dateFrom} to {dateTo})
          </h2>
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
        </div>
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
