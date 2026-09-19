"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB - a logo has no business being bigger than this.
const BUCKET = "municipality-logos";

/**
 * Municipality logo picker for EPAS Setup. Uploads straight to the public
 * "municipality-logos" Storage bucket from the browser and drops the
 * resulting public URL into a hidden `muniLogoUrl` field, so the rest of
 * the pipeline (savePolicyConfig, policy.ts, the Sidebar's <img>) is
 * unchanged - it already only ever dealt with a URL string, whether that
 * string came from pasting a link or, now, an upload. Pasting a URL
 * directly is still supported as a fallback (e.g. a logo already hosted
 * elsewhere) via the text field underneath the preview.
 */
export function LogoUploadField({ orgId, defaultValue }: { orgId: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is too large - please use one under 2MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `${orgId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setValue(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed - please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={LABEL_CLASS}>
      Municipality logo
      <input type="hidden" name="muniLogoUrl" value={value} />
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/pasted URL, not a local asset
          <img src={value} alt="Municipality logo" className="h-12 w-12 rounded-md border border-line object-contain bg-white p-1" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-line text-[10px] text-ink2">
            No logo
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-fit rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink disabled:opacity-50"
            >
              {uploading ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => setValue("")}
                className="text-xs font-semibold text-missed hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`${FIELD_CLASS} mt-1`}
        placeholder="or paste an image URL: https://…"
      />
      {error && <span className="text-[11px] font-normal normal-case text-missed">{error}</span>}
    </div>
  );
}
