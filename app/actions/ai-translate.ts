"use server";

import Anthropic from "@anthropic-ai/sdk";
import { loadTaxonomy } from "./taxonomy";
import { fetchTranscript, formatTranscript } from "@/lib/youtube-transcript";

const client = new Anthropic();

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

export async function translateToNotation(freeText: string): Promise<string> {
  const taxonomy = await loadTaxonomy();
  if (!taxonomy) throw new Error("Failed to load taxonomy");

  // Build context about existing taxonomy items
  const positionsList = taxonomy.positions
    .map((p) => `  - ${p.name} (${p.role_a} / ${p.role_b})`)
    .join("\n");

  const conditionsList = taxonomy.conditionGroups
    .map((g) => {
      const opts = g.options
        .map((o) => o.label + (o.gi_only ? " [gi]" : ""))
        .join(", ");
      return `  - ${g.name} > ${opts}`;
    })
    .join("\n");

  const actionsList = taxonomy.actions.map((a) => `  - ${a.name}`).join("\n");

  // Check if input contains a YouTube URL — if so, fetch transcript
  let inputText = freeText;
  let videoUrl: string | null = null;
  const urlMatch = freeText.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}[^\s]*/);
  if (urlMatch && extractYouTubeId(urlMatch[0])) {
    videoUrl = urlMatch[0];
    try {
      const segments = await fetchTranscript(videoUrl);
      const transcript = formatTranscript(segments);
      // Replace URL in input with the fetched transcript
      const otherText = freeText.replace(urlMatch[0], "").trim();
      inputText = otherText
        ? `${otherText}\n\n--- Video Transcript (from ${videoUrl}) ---\n${transcript}`
        : `--- Video Transcript (from ${videoUrl}) ---\n${transcript}`;
    } catch (e) {
      // If transcript fetch fails, pass through the URL as-is for context
      inputText = freeText + `\n\n(Note: Could not fetch transcript from ${videoUrl}: ${e instanceof Error ? e.message : "unknown error"})`;
    }
  }

  const mediaInstructions = videoUrl
    ? `
6. **Media** — since this input comes from a video, attach media references to actions and states:
   For actions and states, add a media sub-line referencing the source video with timestamps:
     media: ${videoUrl} START END "caption"
   - START and END are timestamps in m:ss or h:mm:ss format marking where that technique/position is demonstrated
   - "caption" is a brief description of what's shown at that timestamp
   - Use the transcript timestamps [m:ss] to determine accurate start/end times
   - Group related segments: if a technique is explained from 1:30 to 2:45, use those as start/end
   - Every action and state that is discussed in the video should have a media line
   - Omit media for items not actually demonstrated in the video`
    : "";

  const systemPrompt = `You convert BJJ (Brazilian Jiu-Jitsu) notes, transcripts, or descriptions into a structured notation format. Output ONLY the notation — no explanation, no markdown fences.

## Existing taxonomy (reuse these names exactly when they match):

### Positions:
${positionsList}

### Condition Groups and Options:
${conditionsList}

### Actions:
${actionsList}

## Output format rules:

1. **Positions** — only include if the text describes a position not in the existing list above:
   position: Name (Role A Label / Role B Label)
     description: optional notes about this position
   - Include description if the text provides useful context about the position

2. **Conditions** — only include if the text describes condition options not in the existing list above:
   condition: Group Name > option1, option2, option3 [gi]
   - Use [gi] suffix for gi-only options
   - If the group already exists, only list NEW options

3. **Actions** — include all techniques/moves mentioned:
   action: Name
     description: optional notes about setup, key details, or common mistakes
     gi/nogi: both|gi|nogi
     requires: Group = value (actor|opponent), Group = value (actor|opponent)
     forbids: Group = value (actor|opponent)
     adds: Group = value (actor|opponent)
     removes: Group = value (actor|opponent)
   - "actor" = the person performing the action
   - "opponent" = the person the action is performed on
   - Omit requires/forbids/adds/removes lines if empty or unknown
   - Match existing action names when the technique is the same

4. **States** — include when the text describes specific positional situations with conditions:
   state: Position Name
   state: Position Name as Display Name
     description: optional contextual notes about this specific state
     role A: Group = value, Group = value
     role B: Group = value, Group = value
     gi/nogi: gi|nogi|both
   - Use "as" to give a named variant — this is how you express sub-positions
   - A sub-position is when you're technically in the same position but with different conditions that practitioners give a distinct name to
   - Examples:
     - "High Mount" = Mount with high positioning → state: Mount as High Mount
     - "Back Mount with hooks" = Back Mount with hooks inserted → state: Back Mount as Back Mount (Hooks In)
     - "Deep Half Guard" is already its own position in the taxonomy, but "Lockdown Half Guard" is Half Guard with lockdown → state: Half Guard as Lockdown Half Guard
   - ALWAYS define states for sub-positions referenced in flows so they get proper conditions
   - Role A/B map to the position's first/second role
   - Omit role lines if no conditions specified for that role

5. **Flows** — include when the text describes sequences/transitions:
   flow: Position/State → Action → Position/State → Action → Position/State
   - Use → between steps
   - IMPORTANT: Steps MUST alternate between states and actions. Every action must have a state before and after it.
   - States are WHERE you are: a position or named sub-position (e.g. Closed Guard, Mount, High Mount, Back Mount (Hooks In))
   - Actions are WHAT you do: techniques, moves, transitions (e.g. Hip Escape, Sweep, Pass Guard, Insert Hooks, Establish Seatbelt)
   - A flow should read like: "I'm in [state], I do [action], now I'm in [state]"
   - When someone transitions through variations of the same position, use named states:
     GOOD: Turtle → Establish Seatbelt → Back Mount (Seatbelt) → Insert Hooks → Back Mount (Hooks In) → Rear Naked Choke → Submitted
     BAD:  Turtle → Establish Seatbelt → Insert Hooks → Back Control (missing states between actions)
   - End with "Submitted" for submission finishes
   - Use existing position and action names from the taxonomy when they match
   - State names in flows should match either a position name or a "Display Name" from a state definition
${mediaInstructions}

## Important:
- Reuse existing position, condition, and action names EXACTLY (case-sensitive) when they match
- Only create new taxonomy items when the text describes something not in the existing lists
- When in doubt about actor vs opponent, use context clues (who is performing the technique)
- Keep action names concise (2-4 words typically)
- For transcripts, focus on the techniques and positions being discussed, ignore filler
- When you see sub-positions or variants mentioned, ALWAYS create state definitions with the "as" syntax AND use the display name in flows`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: inputText,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
