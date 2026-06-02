"use client";

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

interface YouTubeEmbedProps {
  url: string;
  start?: number;
  end?: number;
}

export default function YouTubeEmbed({ url, start, end }: YouTubeEmbedProps) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const params = new URLSearchParams();
  if (start !== undefined) params.set("start", String(Math.floor(start)));
  if (end !== undefined) params.set("end", String(Math.floor(end)));
  const qs = params.toString();
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}${qs ? `?${qs}` : ""}`;

  return (
    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  );
}
