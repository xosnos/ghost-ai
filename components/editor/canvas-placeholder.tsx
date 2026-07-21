export function CanvasPlaceholder() {
  return (
    <div
      className="flex flex-1 items-center justify-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        Canvas will appear here
      </p>
    </div>
  );
}
