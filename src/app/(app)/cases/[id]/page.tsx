"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StageBadge from "@/components/ui/StageBadge";
import Spinner from "@/components/ui/Spinner";

interface CaseDetail {
  id: number;
  uid: string;
  psLimit: string;
  crimeNumber: string;
  sectionOfLaw: string;
  dateOfOccurrence: string;
  dateOfRegistration: string;
  complainantName: string;
  accusedDetails: string;
  gist: string;
  createdAt: string;
  stage: { code: string; name: string };
  branch: { code: string; name: string };
  assignedOfficer: { id: number; fullName: string; username: string };
  createdBy: { fullName: string };
  actions: {
    id: number;
    description: string;
    isCompleted: boolean;
    completedAt: string | null;
    createdAt: string;
  }[];
  progressEntries: {
    id: number;
    progressDate: string;
    progressDetails: string;
    reminderDate: string | null;
    furtherAction: string | null;
    remarks: string | null;
    createdBy: { fullName: string };
  }[];
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setError(json.message || "Failed to load case");
        } else {
          setCaseData(json.data);
        }
      })
      .catch(() => setError("Failed to load case"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner className="py-20" />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!caseData) return null;

  const pendingActions = caseData.actions.filter((a) => !a.isCompleted);
  const completedActions = caseData.actions.filter((a) => a.isCompleted);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{caseData.uid}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registered on {new Date(caseData.createdAt).toLocaleDateString("en-IN")}
            {" by "}{caseData.createdBy.fullName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StageBadge code={caseData.stage.code} showFullName />
          <Link
            href={`/cases/${caseData.id}/progress`}
            className="px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy-light transition-colors"
          >
            Update Progress
          </Link>
        </div>
      </div>

      {/* Case Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
          Case Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <InfoRow label="PS Limit" value={caseData.psLimit} />
          <InfoRow label="Crime Number" value={caseData.crimeNumber} />
          <InfoRow label="Section of Law" value={caseData.sectionOfLaw} />
          <InfoRow label="Branch" value={caseData.branch.name} />
          <InfoRow label="Date of Occurrence" value={new Date(caseData.dateOfOccurrence).toLocaleDateString("en-IN")} />
          <InfoRow label="Date of Registration" value={new Date(caseData.dateOfRegistration).toLocaleDateString("en-IN")} />
          <InfoRow label="Complainant" value={caseData.complainantName} />
          <InfoRow label="Assigned Officer" value={`${caseData.assignedOfficer.fullName} (${caseData.assignedOfficer.username})`} />
          <div className="md:col-span-2">
            <InfoRow label="Details of Accused" value={caseData.accusedDetails} />
          </div>
          <div className="md:col-span-2">
            <InfoRow label="Gist" value={caseData.gist} />
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
          Pending Actions ({pendingActions.length})
        </h2>
        {pendingActions.length === 0 ? (
          <p className="text-sm text-gray-500">No pending actions.</p>
        ) : (
          <ul className="space-y-2">
            {pendingActions.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <span className="text-amber-500 mt-0.5">⬜</span>
                <span className="text-sm text-gray-800">{a.description}</span>
              </li>
            ))}
          </ul>
        )}

        {completedActions.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-gray-500  cursor-pointer">
              Show {completedActions.length} completed action(s)
            </summary>
            <ul className="mt-2 space-y-2">
              {completedActions.map((a) => (
                <li key={a.id} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                  <span className="text-green-500 mt-0.5">✅</span>
                  <div>
                    <span className="text-sm text-gray-600 line-through">{a.description}</span>
                    {a.completedAt && (
                      <span className="block text-xs text-gray-400 mt-0.5">
                        Completed {new Date(a.completedAt).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Progress History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
          Progress History ({caseData.progressEntries.length})
        </h2>
        {caseData.progressEntries.length === 0 ? (
          <p className="text-sm text-gray-500">No progress entries yet.</p>
        ) : (
          <div className="space-y-4">
            {caseData.progressEntries.map((entry) => (
              <div key={entry.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-800">
                    {new Date(entry.progressDate).toLocaleDateString("en-IN")}
                  </span>
                  <span className="text-xs text-gray-400">by {entry.createdBy.fullName}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{entry.progressDetails}</p>
                {entry.furtherAction && (
                  <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                    <span className="font-medium">Further Action:</span> {entry.furtherAction}
                  </p>
                )}
                {entry.reminderDate && (
                  <p className="text-xs text-gray-500 mt-2">
                    Reminder: {new Date(entry.reminderDate).toLocaleDateString("en-IN")}
                  </p>
                )}
                {entry.remarks && (
                  <p className="text-xs text-gray-500 mt-1">
                    Remarks: {entry.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}
