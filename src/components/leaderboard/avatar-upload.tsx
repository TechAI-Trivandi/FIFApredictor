"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export function AvatarUpload({
  userId,
  currentUrl,
}: {
  userId: string;
  currentUrl: string | null;
}) {
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("Image must be under 4 MB");
      return;
    }
    setUploading(true);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);

    setUrl(publicUrl);
    setUploading(false);
  }

  return (
    <label className="inline-flex items-center gap-1.5 ml-0 px-2 py-1 border border-dashed border-blue-brand text-blue-brand mono text-[9px] font-semibold tracking-[0.12em] uppercase cursor-pointer hover:bg-blue-brand/[0.08] transition-colors">
      {uploading ? "Uploading…" : url ? "✓ Photo" : "↑ Add photo"}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        disabled={uploading}
      />
      {/* hidden preview not used, but we could show one */}
      {url && (
        <span className="hidden">
          <Image src={url} alt="" width={1} height={1} />
        </span>
      )}
    </label>
  );
}
