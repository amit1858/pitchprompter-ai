interface Props {
  active: boolean;
  label?: string;
  tone?: "info" | "warn";
}

// Visible indicator any time an AI/network call is in flight. Privacy-first UX.
export function PrivacyBadge({ active, label, tone = "info" }: Props) {
  if (!active) {
    return (
      <span className="privacy-banner" title="All processing is local">
        ● Local-only
      </span>
    );
  }
  return (
    <span className={`privacy-banner ${tone === "warn" ? "warn" : ""}`} title="A network call is in progress">
      ● {label ?? "Network call in progress"}
    </span>
  );
}
