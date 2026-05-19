import Image from "next/image";
import type { Team } from "@/lib/types";

export function TeamBadge({
  team,
  fallbackLabel,
  size = "md",
  reverse = false,
  showFullName = false,
}: {
  team: Team | null;
  fallbackLabel?: string;
  size?: "sm" | "md" | "lg";
  reverse?: boolean;
  showFullName?: boolean;
}) {
  const sizes = { sm: 22, md: 30, lg: 38 };
  const px = sizes[size];

  if (!team) {
    return (
      <div className={`flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""}`}>
        <div
          className="rounded-sm bg-gray-100 border border-gray-200 flex-shrink-0"
          style={{ width: px, height: px }}
        />
        <span className="text-sm text-gray-500" title={fallbackLabel}>
          {fallbackLabel ?? "TBD"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 ${reverse ? "flex-row-reverse" : ""}`}
      title={team.name}
    >
      <div
        className="relative rounded-sm overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm"
        style={{ width: px, height: px }}
      >
        <Image
          src={team.flag_url}
          alt={team.name}
          fill
          className="object-cover"
        />
      </div>
      {showFullName ? (
        <div className={`flex flex-col ${reverse ? "items-end" : "items-start"} min-w-0`}>
          <span className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {team.name}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 leading-tight">
            {team.short_code}
          </span>
        </div>
      ) : (
        <span className="text-sm font-semibold text-gray-900">{team.short_code}</span>
      )}
    </div>
  );
}
