interface Props {
  ratio: number;
  label: string;
  achieved?: boolean;
  /** Optional marker (0-1) for where the ideal pace is today. */
  marker?: number | null;
}

export function ProgressBar({ ratio, label, achieved, marker }: Props) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="relative h-3 w-full overflow-hidden rounded-full bg-progress-track"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${achieved ? 'bg-good' : 'bg-progress'}`}
        style={{ width: `${pct}%`, minWidth: pct > 0 ? '12px' : 0 }}
      />
      {marker !== null && marker !== undefined && marker > 0 && marker < 1 && (
        <div
          className="absolute top-0 h-full w-[2px] rounded-full bg-ink/50"
          style={{ left: `calc(${marker * 100}% - 1px)` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
