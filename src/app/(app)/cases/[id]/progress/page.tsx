"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import { DatePicker } from "@/components/ui/DatePicker";

interface PendingAction {
  id: number;
  description: string;
  isCompleted: boolean;
}

interface CaseBasic {
  id: number;
  uid: string;
  crimeNumber: string;
  actions: PendingAction[];
}

export default function ProgressUpdatePage() {
  const { id } = useParams();
  const router = useRouter();

  const [caseData, setCaseData] = useState<CaseBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [progressDate, setProgressDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [progressDetails, setProgressDetails] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [furtherAction, setFurtherAction] = useState("");
  const [remarks, setRemarks] = useState("");
  const [completedActionIds, setCompletedActionIds] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setCaseData(json.data);
        } else {
          setError(json.message || "Failed to load case");
        }
      })
      .catch(() => setError("Failed to load case"))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleAction = (actionId: number) => {
    setCompletedActionIds((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/cases/${id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progressDate,
          progressDetails,
          reminderDate: reminderDate || undefined,
          furtherAction: furtherAction || undefined,
          remarks: remarks || undefined,
          completedActionIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || "Failed to add progress");
        return;
      }

      router.push(`/cases/${id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (error && !caseData) return <div className="text-red-600 p-4">{error}</div>;
  if (!caseData) return null;

  const pendingActions = caseData.actions.filter((a) => !a.isCompleted);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Progress Update</h1>
        <p className="text-sm text-gray-500 mt-1">
          {caseData.uid} — Crime No. {caseData.crimeNumber}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pending Actions checklist */}
        {pendingActions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              Action To Be Taken — Mark Completed
            </h2>
            <div className="space-y-2">
              {pendingActions.map((action) => (
                <label
                  key={action.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={completedActionIds.includes(action.id)}
                    onChange={() => toggleAction(action.id)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                  />
                  <span className="text-sm text-gray-800">{action.description}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Progress Entry Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Progress Details
          </h2>
          <div className="space-y-4">
            <div>
              <DatePicker
                label="Date of Progress"
                value={progressDate}
                onChange={setProgressDate}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Details of Progress *</label>
              <textarea
                value={progressDetails}
                onChange={(e) => setProgressDetails(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-y"
                required
              />
            </div>

            <div>
              <DatePicker
                label="Reminder Date"
                value={reminderDate}
                onChange={setReminderDate}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Further Action To Be Taken</label>
              <textarea
                value={furtherAction}
                onChange={(e) => setFurtherAction(e.target.value)}
                rows={2}
                placeholder="This will become a new action item for the next progress update"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-y"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-navy text-white font-medium rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit Progress"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/cases/${id}`)}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
