"use server";

import Anthropic from "@anthropic-ai/sdk";
import { loadTaxonomy } from "./taxonomy";

const client = new Anthropic();

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
     description: optional contextual notes about this specific state
     role A: Group = value, Group = value
     role B: Group = value, Group = value
     gi/nogi: gi|nogi|both
   - Role A/B map to the position's first/second role
   - Omit role lines if no conditions specified for that role

5. **Flows** — include when the text describes sequences/transitions:
   flow: State/Position → Action → State/Position → Action → State/Position
   - Use → between steps
   - Alternates: state, action, state, action...
   - Use position names or brief descriptions for states

## Important:
- Reuse existing position, condition, and action names EXACTLY (case-sensitive) when they match
- Only create new taxonomy items when the text describes something not in the existing lists
- When in doubt about actor vs opponent, use context clues (who is performing the technique)
- Keep action names concise (2-4 words typically)
- For transcripts, focus on the techniques and positions being discussed, ignore filler`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: freeText,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
