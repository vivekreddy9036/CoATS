const stageColors: Record<string, string> = {
  UI: "bg-blue-100 text-blue-800",
  PT: "bg-amber-100 text-amber-800",
  HC: "bg-red-100 text-red-800",
  SC: "bg-purple-100 text-purple-800",
};

const stageLabels: Record<string, string> = {
  UI: "Under Investigation",
  PT: "Pending Trial",
  HC: "High Court",
  SC: "Supreme Court",
};

interface StageBadgeProps {
  code: string;
  showFullName?: boolean;
}

export default function StageBadge({ code, showFullName = false }: StageBadgeProps) {
  const color = stageColors[code] || "bg-gray-100 text-gray-800";
  const label = showFullName ? stageLabels[code] || code : code;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
