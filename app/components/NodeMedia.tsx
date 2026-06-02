"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/graph";
import YouTubeEmbed from "./YouTubeEmbed";

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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface NodeMediaProps {
  media: MediaItem[];
}

export default function NodeMedia({ media }: NodeMediaProps) {
  if (media.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1.5">
      {media.map((item, i) => (
        <div key={i}>
          {item.type === "youtube" && <YouTubeThumbnail item={item} />}
          {item.type === "image" && <ImageThumbnail item={item} />}
          {item.type === "text" && item.caption && (
            <div className="rounded bg-zinc-800/50 px-2 py-1.5">
              <span className="text-[9px] text-zinc-300 whitespace-pre-wrap break-words">{item.caption}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function YouTubeThumbnail({ item }: { item: MediaItem }) {
  const [playing, setPlaying] = useState(false);
  const videoId = extractYouTubeId(item.url);
  if (!videoId) return null;

  const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return (
    <div>
      {playing ? (
        <div className="rounded overflow-hidden nodrag nopan nowheel">
          <YouTubeEmbed url={item.url} start={item.start} end={item.end} />
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPlaying(true); }}
          className="block relative rounded overflow-hidden group w-full text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl}
            alt={item.caption ?? "YouTube video"}
            className="w-full object-cover"
            draggable={false}
          />
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white ml-0.5" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}
      {(item.caption || item.start !== undefined) && (
        <div className="mt-0.5">
          {item.start !== undefined && (
            <span className="text-[9px] text-zinc-500">
              {formatTime(item.start)}{item.end !== undefined ? `–${formatTime(item.end)}` : ""}
            </span>
          )}
          {item.caption && (
            <span className="text-[9px] text-zinc-400 whitespace-pre-wrap break-words block">{item.caption}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ImageThumbnail({ item }: { item: MediaItem }) {
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.caption ?? ""}
        className="w-full rounded object-contain max-h-[160px]"
        draggable={false}
      />
      {item.caption && (
        <span className="text-[9px] text-zinc-400 mt-0.5 block whitespace-pre-wrap break-words">{item.caption}</span>
      )}
    </div>
  );
}
