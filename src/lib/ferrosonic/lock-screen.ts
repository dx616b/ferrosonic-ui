/** One second of silence so the phone keeps this page as the active media app. */

let silenceUrl: string | null = null;

export function lockScreenSilenceUrl(): string {
  if (typeof window === "undefined") return "";
  if (silenceUrl) return silenceUrl;
  const samples = 8000;
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  silenceUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silenceUrl;
}
