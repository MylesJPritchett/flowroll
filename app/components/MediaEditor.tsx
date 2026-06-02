"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/graph";
import YouTubeEmbed from "./YouTubeEmbed";

/** Extract YouTube video ID from various URL formats */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Parse time string like "1:30" or "90" into seconds */
function parseTime(s: string): number | undefined {
  s = s.trim();
  if (!s) return undefined;
  if (s.includes(":")) {
    const parts = s.split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  const n = Number(s);
  return isNaN(n) ? undefined : n;
}

/** Format seconds to mm:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface MediaEditorProps {
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
}

export default function MediaEditor({ media, onChange }: MediaEditorProps) {
  const [adding, setAdding] = useState<false | "url" | "text">(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const isYouTube = !!extractYouTubeId(url);
  const isImage = !isYouTube && /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url);
  const isValidUrl = isYouTube || isImage;

  const resetForm = () => { setAdding(false); setUrl(""); setCaption(""); setStartTime(""); setEndTime(""); };

  const addMedia = () => {
    if (adding === "text") {
      if (!caption.trim()) return;
      onChange([...media, { type: "text", url: "", caption: caption.trim() }]);
      resetForm();
      return;
    }
    if (!url.trim()) return;
    const item: MediaItem = isYouTube
      ? {
          type: "youtube",
          url: url.trim(),
          ...(caption.trim() ? { caption: caption.trim() } : {}),
          ...(parseTime(startTime) !== undefined ? { start: parseTime(startTime) } : {}),
          ...(parseTime(endTime) !== undefined ? { end: parseTime(endTime) } : {}),
        }
      : {
          type: "image",
          url: url.trim(),
          ...(caption.trim() ? { caption: caption.trim() } : {}),
        };
    onChange([...media, item]);
    resetForm();
  };

  const removeMedia = (index: number) => {
    onChange(media.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">Media</label>

      {/* Existing media items */}
      {media.length > 0 && (
        <div className="space-y-2 mb-2">
          {media.map((item, i) => (
            <div key={i} className="rounded-md border border-zinc-700 bg-zinc-900 overflow-hidden">
              {item.type === "youtube" && (
                <YouTubeEmbed url={item.url} start={item.start} end={item.end} />
              )}
              {item.type === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.caption ?? ""}
                  className="w-full max-h-48 object-contain bg-black"
                />
              )}
              <div className="flex items-start justify-between px-2 py-1.5 gap-1">
                <span className="text-[10px] text-zinc-400 flex-1 whitespace-pre-wrap break-words">
                  {item.type === "text" && (
                    <span className="text-zinc-300">{item.caption}</span>
                  )}
                  {item.type !== "text" && (
                    <>
                      {item.caption || (item.type === "youtube" ? "YouTube video" : "Image")}
                      {item.type === "youtube" && item.start !== undefined && (
                        <span className="ml-1 text-zinc-500">
                          {formatTime(item.start)}{item.end !== undefined ? `–${formatTime(item.end)}` : ""}
                        </span>
                      )}
                    </>
                  )}
                </span>
                <button
                  onClick={() => removeMedia(i)}
                  className="shrink-0 text-zinc-500 hover:text-red-400 text-[10px] transition-colors"
                >
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add media form */}
      {adding === "url" && (
        <div className="rounded-md border border-zinc-700 bg-zinc-900 p-2 space-y-2">
          <input
            type="text"
            autoFocus
            value={url}
            placeholder="YouTube URL or image URL..."
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValidUrl) { e.preventDefault(); addMedia(); }
              if (e.key === "Escape") resetForm();
            }}
            className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {url.trim() && !isValidUrl && (
            <div className="text-[10px] text-amber-400">
              Enter a YouTube URL or image URL (.jpg, .png, .gif, .webp, .svg)
            </div>
          )}
          {isYouTube && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500">Start time</label>
                <input
                  type="text"
                  value={startTime}
                  placeholder="0:00"
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500">End time</label>
                <input
                  type="text"
                  value={endTime}
                  placeholder="0:00"
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
          <textarea
            value={caption}
            placeholder="Caption (optional)"
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") resetForm(); }}
            rows={2}
            className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
          />
          <div className="flex gap-1">
            <button onClick={addMedia} disabled={!isValidUrl}
              className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Add
            </button>
            <button onClick={resetForm} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-1">Cancel</button>
          </div>
        </div>
      )}
      {adding === "text" && (
        <div className="rounded-md border border-zinc-700 bg-zinc-900 p-2 space-y-2">
          <textarea
            autoFocus
            value={caption}
            placeholder="Write a note or explanation..."
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") resetForm(); }}
            rows={3}
            className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
          />
          <div className="flex gap-1">
            <button onClick={addMedia} disabled={!caption.trim()}
              className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Add
            </button>
            <button onClick={resetForm} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-1">Cancel</button>
          </div>
        </div>
      )}
      {!adding && (
        <div className="flex gap-1">
          <button
            onClick={() => setAdding("url")}
            className="flex-1 rounded-md border border-dashed border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            + Image / Video
          </button>
          <button
            onClick={() => setAdding("text")}
            className="flex-1 rounded-md border border-dashed border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            + Note
          </button>
        </div>
      )}
    </div>
  );
}
