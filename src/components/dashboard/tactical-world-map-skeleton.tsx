export function TacticalWorldMapSkeleton({ dense = false }: { dense?: boolean }) {
  const heightClass = dense ? "h-[360px]" : "h-[220px]";
  return (
    <div
      className={`relative w-full animate-pulse overflow-hidden rounded-xs bg-[#050505] ${heightClass}`}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
    </div>
  );
}
