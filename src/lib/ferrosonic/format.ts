export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatQuality(np: {
  codec?: string | null;
  bitDepth?: number | null;
  sampleRate?: number | null;
  channels?: string | null;
  bitrateKbps?: number | null;
}): string | null {
  const parts: string[] = [];
  if (np.codec) parts.push(np.codec.toUpperCase());
  if (np.bitDepth) parts.push(`${np.bitDepth}-bit`);
  if (np.sampleRate) {
    const khz = np.sampleRate >= 1000 ? `${(np.sampleRate / 1000).toFixed(1)} kHz` : `${np.sampleRate} Hz`;
    parts.push(khz);
  }
  if (np.channels) parts.push(np.channels);
  if (np.bitrateKbps) parts.push(`${np.bitrateKbps} kbps`);
  return parts.length ? parts.join(" · ") : null;
}

export function nextRepeatMode(mode: "Off" | "One" | "All"): "Off" | "One" | "All" {
  if (mode === "Off") return "One";
  if (mode === "One") return "All";
  return "Off";
}
