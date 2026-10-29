import { useState } from "react";
import { processImage } from "../lib/process-image";

type Existing = { key: string; ext: string; w: number; h: number } | null;

export function PhotoField({
  prefix,
  kind,
  owner,
  existing,
}: {
  prefix: "photo" | "fitPic";
  kind: "item" | "fit";
  owner: string;
  existing: Existing;
}) {
  const [photo, setPhoto] = useState(existing);
  const [status, setStatus] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus("Preparing photo…");
    try {
      const processed = await processImage(file);
      const body = new FormData();
      body.set("kind", kind);
      body.set("owner", owner);
      body.set("w", String(processed.w));
      body.set("h", String(processed.h));
      body.set("small", processed.small, `small.${processed.ext}`);
      body.set("large", processed.large, `large.${processed.ext}`);
      const response = await fetch("/admin/uploads", { method: "POST", body });
      const json = (await response.json()) as { key?: string; ext?: string; w?: number; h?: number; error?: string };
      if (!response.ok || !json.key || !json.ext || !json.w || !json.h) {
        throw new Error(json.error ?? "Upload failed");
      }
      setPhoto({ key: json.key, ext: json.ext, w: json.w, h: json.h });
      setStatus("Photo ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    }
  }

  return (
    <div>
      <input type="hidden" name={`${prefix}Key`} value={photo?.key ?? ""} />
      <input type="hidden" name={`${prefix}Ext`} value={photo?.ext ?? ""} />
      <input type="hidden" name={`${prefix}W`} value={photo?.w ?? ""} />
      <input type="hidden" name={`${prefix}H`} value={photo?.h ?? ""} />
      <input
        type="file"
        accept="image/*"
        className="block w-full text-sm"
        onChange={(event) => void onFile(event.currentTarget.files?.[0])}
      />
      {photo ? <p className="mt-2 text-sm text-muted">A photo is attached.</p> : null}
      {status ? <p className="mt-1 text-sm text-muted">{status}</p> : null}
      {photo ? (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name={prefix === "photo" ? "removePhoto" : "removeFitPic"} />
          Remove photo
        </label>
      ) : (
        <p className="mt-2 text-sm text-muted">Photos are resized in the browser. The form still saves without one.</p>
      )}
    </div>
  );
}
