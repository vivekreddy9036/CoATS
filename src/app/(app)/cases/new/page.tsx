"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { toast } from "sonner";

interface UserOption {
  id: number;
  fullName: string;
  username: string;
  branch: { id: number; code: string; name: string };
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
}

interface StageOption {
  id: number;
  code: string;
  name: string;
}

export default function CreateCasePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [officers, setOfficers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState({
    psLimit: "",
    crimeNumber: "",
    sectionOfLaw: "",
    dateOfOccurrence: "",
    dateOfRegistration: "",
    complainantName: "",
    accusedDetails: "",
    gist: "",
    stageId: "",
    assignedOfficerId: "",
    branchId: "",
    actions: [""],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, branchesRes, stagesRes] = await Promise.all([
          fetch("/api/users?roleType=case-holder").then((r) => r.ok ? r.json() : { data: [] }),
          fetch("/api/branches").then((r) => r.ok ? r.json() : { data: [] }),
          fetch("/api/stages").then((r) => r.ok ? r.json() : { data: [] }),
        ]);

        setOfficers(usersRes.data || []);
        setBranches(branchesRes.data || []);
        setStages(stagesRes.data || []);

        // Default branch to user's branch
        if (user?.branchId) {
          setForm((f) => ({ ...f, branchId: String(user.branchId) }));
        }
      } catch (err) {
        console.error("Failed to fetch form data:", err);
      }
    };

    fetchData();
  }, [user]);

  const setField = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleActionChange = (idx: number, value: string) => {
    const updated = [...form.actions];
    updated[idx] = value;
    setForm((f) => ({ ...f, actions: updated }));
  };

  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, ""] }));

  const removeAction = (idx: number) =>
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          stageId: parseInt(form.stageId, 10),
          assignedOfficerId: parseInt(form.assignedOfficerId, 10),
          branchId: parseInt(form.branchId, 10),
          actions: form.actions.filter((a) => a.trim()),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json.error || json.message || "Failed to create case";
        setError(msg);
        toast.error("Failed to create case", { description: msg });
        return;
      }

      toast.success("Case registered", {
        description: `Case ${json.data.uid} created. You can now upload documents on the case page.`,
      });
      router.push(`/cases/${json.data.id}`);
    } catch {
      setError("Something went wrong");
      toast.error("Something went wrong", { description: "Please try again or contact support." });
    } finally {
      setLoading(false);
    }
  };

  // Filter officers based on selected branch
  const filteredOfficers = form.branchId
    ? officers.filter((o) => o.branch.id === parseInt(form.branchId, 10))
    : officers;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Register New Case</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Case Identification */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Case Identification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PS Limit *</label>
              <input
                type="text"
                value={form.psLimit}
                onChange={(e) => setField("psLimit", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crime Number *</label>
              <input
                type="text"
                value={form.crimeNumber}
                onChange={(e) => setField("crimeNumber", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Section of Law *</label>
              <input
                type="text"
                value={form.sectionOfLaw}
                onChange={(e) => setField("sectionOfLaw", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                required
              />
            </div>
            <div>
              <DatePicker
                label="Date of Occurrence"
                value={form.dateOfOccurrence}
                onChange={(val) => setField("dateOfOccurrence", val)}
                required
              />
            </div>
            <div>
              <DatePicker
                label="Date of Registration"
                value={form.dateOfRegistration}
                onChange={(val) => setField("dateOfRegistration", val)}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Individuals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Individuals
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name of the Complainant *</label>
              <input
                type="text"
                value={form.complainantName}
                onChange={(e) => setField("complainantName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Details of the Accused *</label>
              <textarea
                value={form.accusedDetails}
                onChange={(e) => setField("accusedDetails", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-y"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 3: Case Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Case Summary
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gist of the Case *</label>
              <textarea
                value={form.gist}
                onChange={(e) => setField("gist", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-y"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Stage *</label>
                <select
                  value={form.stageId}
                  onChange={(e) => setField("stageId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                  required
                >
                  <option value="">Select stage</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setField("branchId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                  required
                >
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Holding Officer *</label>
                <select
                  value={form.assignedOfficerId}
                  onChange={(e) => setField("assignedOfficerId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                  required
                >
                  <option value="">Select officer</option>
                  {filteredOfficers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName} ({o.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Action To Be Taken */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Action To Be Taken
          </h2>
          <div className="space-y-3">
            {form.actions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={action}
                  onChange={(e) => handleActionChange(idx, e.target.value)}
                  placeholder={`Action item ${idx + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
                {form.actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAction(idx)}
                    className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-md text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addAction}
              className="text-sm text-navy hover:underline cursor-pointer"
            >
              + Add another action
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-navy text-white font-medium rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Registering..." : "Register Case"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
