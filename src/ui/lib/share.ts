export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands a generated file to iOS: the Share Sheet (Save to Files, AirDrop, …) when the
 * Web Share API supports files, otherwise a standard download. Works in Safari and in
 * the home-screen (standalone) app without any computer.
 */
export async function shareOrDownload(name: string, type: string, content: string): Promise<ExportResult> {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError etc. → fall back to a normal download below.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

export function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });
}
