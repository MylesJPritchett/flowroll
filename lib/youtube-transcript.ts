/**
 * Fetch YouTube video transcript/captions.
 * Uses youtube-transcript-api Python package via subprocess.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

export interface TranscriptSegment {
  text: string;
  start: number; // seconds
  duration: number; // seconds
}

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

// Find the Python binary with youtube-transcript-api installed
function findPython(): string {
  const venvPython = "/tmp/yt-venv/bin/python3";
  if (existsSync(venvPython)) return venvPython;
  return "python3";
}

async function ensureVenv(): Promise<string> {
  const venvPython = "/tmp/yt-venv/bin/python3";
  if (existsSync(venvPython)) {
    // Check if youtube-transcript-api is installed
    try {
      await execFileAsync(venvPython, ["-c", "import youtube_transcript_api"]);
      return venvPython;
    } catch {
      // Need to install
    }
  }

  // Create venv and install
  await execFileAsync("python3", ["-m", "venv", "/tmp/yt-venv"]);
  await execFileAsync("/tmp/yt-venv/bin/pip", ["install", "-q", "youtube-transcript-api"]);
  return venvPython;
}

export async function fetchTranscript(videoUrl: string): Promise<TranscriptSegment[]> {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const python = await ensureVenv();

  const script = `
import json
from youtube_transcript_api import YouTubeTranscriptApi
ytt = YouTubeTranscriptApi()
try:
    t = ytt.fetch("${videoId}")
    segments = [{"text": s.text, "start": s.start, "duration": s.duration} for s in t.snippets]
    print(json.dumps(segments))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const { stdout, stderr } = await execFileAsync(python, ["-c", script], {
    timeout: 30000,
  });

  if (!stdout.trim()) {
    throw new Error(stderr?.trim() || "No output from transcript fetcher");
  }

  const result = JSON.parse(stdout.trim());

  if (result.error) {
    throw new Error(result.error);
  }

  return result as TranscriptSegment[];
}

/** Format transcript segments into a readable text with timestamps */
export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const mins = Math.floor(s.start / 60);
      const secs = Math.floor(s.start % 60);
      const ts = `${mins}:${String(secs).padStart(2, "0")}`;
      return `[${ts}] ${s.text}`;
    })
    .join("\n");
}
