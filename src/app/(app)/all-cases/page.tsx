"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StageBadge from "@/components/ui/StageBadge";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

interface CaseListItem {
  id: number;
  uid: string;
  crimeNumber: string;
  complainantName: string;
  dateOfRegistration: string;
  stage: { code: string; name: string };
  branch: { code: string; name: string };
  assignedOfficer: { fullName: string };
}

export default function AllCasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stageFilter, setStageFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && !user.isSupervisory) router.push("/cases");
  }, [user, router]);

  const fetchCases = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (stageFilter) params.set("stageId", stageFilter);
    if (branchFilter) params.set("branchId", branchFilter);
    if (search) params.set("search", search);

    fetch(`/api/cases?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setCases(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [page, stageFilter, branchFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  if (!user?.isSupervisory) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">All Cases</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by UID, crime no., complainant..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <select
          value={branchFilter}
          onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Branches</option>
          <option value="1">Headquarters</option>
          <option value="2">Chennai</option>
          <option value="3">Madurai</option>
          <option value="4">Coimbatore</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Stages</option>
          <option value="1">Under Investigation</option>
          <option value="2">Pending Trial</option>
          <option value="3">High Court</option>
          <option value="4">Supreme Court</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <Spinner className="py-20" />
        ) : cases.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-20">No cases found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Case UID</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Crime No.</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Branch</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Complainant</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Date of Reg.</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Stage</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Officer</th>
                    <th className="text-center py-3 px-4 text-gray-600 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-navy">{c.uid}</td>
                      <td className="py-3 px-4">{c.crimeNumber}</td>
                      <td className="py-3 px-4">{c.branch.name}</td>
                      <td className="py-3 px-4">{c.complainantName}</td>
                      <td className="py-3 px-4">{new Date(c.dateOfRegistration).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 px-4"><StageBadge code={c.stage.code} /></td>
                      <td className="py-3 px-4">{c.assignedOfficer.fullName}</td>
                      <td className="py-3 px-4 text-center">
                        <Link href={`/cases/${c.id}`} className="text-navy hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
