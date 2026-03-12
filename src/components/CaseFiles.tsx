"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CaseFileRecord {
  id: number;
  r2Key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { fullName: string };
}

interface StorageInfo {
  used: number;
  cap: number;
  usedFormatted: string;
  capFormatted: string;
  remainingFormatted: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}

function fileIcon(contentType: string): string {
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType === "application/pdf") return "📄";
  if (contentType.includes("word")) return "📝";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "📊";
  return "📎";
}

// Types that can be previewed inline in the browser
function isViewable(contentType: string): boolean {
  return (
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    contentType === "text/plain"
  );
}

// ── Lightbox modal for image preview ────────────────────────────────────────
function ImageLightbox({
  src,
  fileName,
  onClose,
}: {
  src: string;
  fileName: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-white rounded-t-xl px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-800 truncate">{fileName}</span>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors ml-4"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={fileName}
          className="w-full max-h-[80vh] object-contain rounded-b-xl bg-gray-50"
        />
      </div>
    </div>
  );
}

export default function CaseFiles({ caseId }: { caseId: number }) {
  const [files, setFiles] = useState<CaseFileRecord[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/files`);
      const json = await res.json();
      if (json.success) {
        setFiles(json.data.files);
        setStorage(json.data.storage);
      }
    } catch {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Close lightbox on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size is 5 MB" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (storage && storage.used + file.size > storage.cap) {
      toast.error("Storage quota exceeded", {
        description: `Only ${storage.remainingFormatted} remaining. This file is ${formatBytes(file.size)}.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/cases/${caseId}/files`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error("Upload failed", { description: json.error || "Unknown error" });
        return;
      }

      toast.success("File uploaded", { description: file.name });
      await fetchFiles();
    } catch {
      toast.error("Upload failed", { description: "Network error" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;

    setDeleting(fileId);
    try {
      const res = await fetch(`/api/cases/${caseId}/files?fileId=${fileId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error("Delete failed", { description: json.error });
        return;
      }

      toast.success("File deleted");
      await fetchFiles();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const getPresignedUrl = async (fileId: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/cases/${caseId}/files/${fileId}/download`);
      const json = await res.json();
      if (!res.ok) {
        toast.error("Failed to get file URL", { description: json.error });
        return null;
      }
      return json.data.url as string;
    } catch {
      toast.error("Network error");
      return null;
    }
  };

  const handleView = async (f: CaseFileRecord) => {
    const url = await getPresignedUrl(f.id);
    if (!url) return;

    if (f.contentType.startsWith("image/")) {
      // Show inline lightbox for images
      setLightbox({ src: url, fileName: f.fileName });
    } else {
      // Open PDF / text in a new browser tab
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    const url = await getPresignedUrl(fileId);
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const usedPercent = storage ? Math.min(100, (storage.used / storage.cap) * 100) : 0;
  const isNearLimit = usedPercent > 80;
  const isAtLimit = usedPercent > 95;

  return (
    <>
      {/* Image lightbox */}
      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          fileName={lightbox.fileName}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Case Documents ({files.length})
          </h2>
          <label
            className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
              uploading || isAtLimit
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-navy text-white hover:bg-navy-light"
            }`}
          >
            {uploading ? "Uploading…" : "Upload File"}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || isAtLimit}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
            />
          </label>
        </div>

        {/* Storage quota bar */}
        {storage && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{storage.usedFormatted} used</span>
              <span>{storage.remainingFormatted} remaining</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isAtLimit
                    ? "bg-red-500"
                    : isNearLimit
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="text-right text-xs text-gray-400 mt-0.5">
              {storage.capFormatted} total
            </div>
          </div>
        )}

        {/* File list */}
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading files…</div>
        ) : files.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
            <p className="text-gray-300 text-xs mt-1">
              Upload PDF, images, or documents (max 5 MB each)
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-3 group">
                <span className="text-xl" title={f.contentType}>
                  {fileIcon(f.contentType)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {f.fileName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatBytes(f.sizeBytes)} · {f.uploadedBy.fullName} ·{" "}
                    {new Date(f.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* View — only for PDF, images, text */}
                  {isViewable(f.contentType) && (
                    <button
                      onClick={() => handleView(f)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                      title="View"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                  {/* Download */}
                  <button
                    onClick={() => handleDownload(f.id, f.fileName)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 5v14m0 0l-4-4m4 4l4-4M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(f.id, f.fileName)}
                    disabled={deleting === f.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}