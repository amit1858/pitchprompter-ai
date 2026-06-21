// TEMPORARY debug panel for Voice Follow. Mount only when
// isVoiceFollowDebugEnabled() returns true (URL ?vfdebug=1).
// Delete with voiceFollowDebug.ts once root cause is fixed.

import { useVoiceFollowDebug } from "./voiceFollowDebug";

export function VoiceFollowDebugPanel() {
  const d = useVoiceFollowDebug();
  const sinceSpeech = d.speechAt ? Math.round(performance.now() - d.speechAt) : null;
  const sinceAlign = d.alignAt ? Math.round(performance.now() - d.alignAt) : null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        width: 360,
        maxHeight: "60vh",
        overflow: "auto",
        zIndex: 999999,
        background: "rgba(10,10,14,0.92)",
        color: "#e6f0ff",
        border: "1px solid rgba(120,160,255,0.4)",
        borderRadius: 8,
        padding: "10px 12px",
        font: '11px/1.45 ui-monospace,Menlo,Consolas,monospace',
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, letterSpacing: 0.4 }}>
        VF DEBUG · status: <span style={{ color: statusColor(d.status) }}>{d.status}</span>
      </div>

      <Section title="Speech">
        <Row k="lastTranscript" v={`"${d.lastTranscript}"`} />
        <Row k="normalized" v={`"${d.normalizedTranscript}"`} />
        <Row k="newTokens" v={String(d.newTokensThisEvent)} />
        <Row k="isFinal" v={String(d.lastIsFinal)} />
        <Row k="events" v={String(d.speechEventCount)} />
        <Row k="bufferCount" v={String(d.bufferTokenCount)} />
        <Row k="buffer" v={d.bufferTokens.join(" ") || "(empty)"} />
        {sinceSpeech !== null && <Row k="ageMs" v={`${sinceSpeech}`} />}
      </Section>

      <Section title="Alignment">
        <Row k="matched" v={String(d.matched)} highlight={d.matched ? "ok" : "warn"} />
        <Row k="alignedCount" v={String(d.alignedCount)} />
        <Row k="scriptIndex" v={String(d.alignedScriptIndex)} />
        <Row k="cursor" v={String(d.cursorIndex)} />
        <Row k="window" v={`[${d.windowStart}..${d.windowEnd}) of ${d.scriptTokenCount}`} />
        <Row k="recent" v={d.recentWindow.join(" ") || "(empty)"} />
        <Row k="attempts/matches" v={`${d.alignAttemptCount} / ${d.alignMatchCount}`} />
        {sinceAlign !== null && <Row k="ageMs" v={`${sinceAlign}`} />}
      </Section>

      <Section title="Transitions">
        <div style={{ color: "#9fb3d8" }}>
          {d.statusTransitions.length === 0
            ? "(none yet — engine never left idle/listening)"
            : d.statusTransitions.join("  ·  ")}
        </div>
      </Section>

      <div style={{ marginTop: 8, color: "#7a8aa3", fontSize: 10 }}>
        Temporary panel. Disable with ?vfdebug=0 or remove localStorage pp.vfdebug.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(120,160,255,0.18)" }}>
      <div style={{ color: "#8fb3ff", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: "ok" | "warn" }) {
  const color = highlight === "ok" ? "#7CFFA8" : highlight === "warn" ? "#FFC56B" : "#e6f0ff";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: "#7a8aa3", minWidth: 96 }}>{k}</span>
      <span style={{ color, wordBreak: "break-all", flex: 1 }}>{v}</span>
    </div>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case "following": return "#7CFFA8";
    case "listening": return "#8fb3ff";
    case "low-confidence": return "#FFC56B";
    case "error": return "#ff7a7a";
    default: return "#9fb3d8";
  }
}
