/**
 * Parser for the Flowroll notation format.
 *
 * Format:
 *   position: Name (Role A / Role B)
 *     description: optional notes about this position
 *   condition: Group > option1, option2 [gi], option3
 *   action: Name
 *     description: optional notes about this action
 *     gi/nogi: both|gi|nogi
 *     requires: Group = value (actor|opponent)
 *     forbids: Group = value (actor|opponent)
 *     adds: Group = value (actor|opponent)
 *     removes: Group = value (actor|opponent)
 *   state: Position Name
 *   state: Position Name as Display Name
 *     description: optional contextual notes
 *     role A: Group = value, Group = value
 *     role B: Group = value, Group = value
 *     gi/nogi: gi|nogi|both
 *   flow: State Label → Action Name → State Label
 */

export interface ParsedPosition {
  name: string;
  description: string;
  roleA: string;
  roleB: string;
}

export interface ParsedConditionOption {
  label: string;
  giOnly: boolean;
}

export interface ParsedConditionGroup {
  name: string;
  options: ParsedConditionOption[];
}

export interface ParsedConditionRef {
  group: string; // group name
  value: string; // option label
  role: "actor" | "opponent";
}

export interface ParsedMedia {
  type: "image" | "youtube";
  url: string;
  caption?: string;
  start?: number; // seconds
  end?: number;   // seconds
}

export interface ParsedAction {
  name: string;
  description: string;
  giNogi: "" | "gi" | "nogi";
  requires: ParsedConditionRef[];
  forbids: ParsedConditionRef[];
  adds: ParsedConditionRef[];
  removes: ParsedConditionRef[];
  media: ParsedMedia[];
}

export interface ParsedStateCondition {
  group: string;
  value: string;
}

export interface ParsedState {
  label: string;
  positionName: string;
  roleA: ParsedStateCondition[];
  roleB: ParsedStateCondition[];
  giNogi: "" | "gi" | "nogi";
  description: string;
  media: ParsedMedia[];
}

export interface ParsedFlowStep {
  label: string;
  type: "state" | "action" | "finish" | "unknown";
}

export interface ParsedFlow {
  steps: ParsedFlowStep[];
}

export interface ParseResult {
  positions: ParsedPosition[];
  conditionGroups: ParsedConditionGroup[];
  actions: ParsedAction[];
  states: ParsedState[];
  flows: ParsedFlow[];
  warnings: string[];
}

function parseConditionRefs(text: string): ParsedConditionRef[] {
  if (!text || text === "—" || text === "-") return [];
  const refs: ParsedConditionRef[] = [];
  // Split by comma, but be careful of commas inside parentheses — there shouldn't be any
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    // Format: Group = value (actor|opponent)
    const match = part.match(/^(.+?)\s*=\s*(.+?)\s*\((actor|opponent)\)\s*$/);
    if (match) {
      refs.push({
        group: match[1].trim(),
        value: match[2].trim(),
        role: match[3] as "actor" | "opponent",
      });
    }
  }
  return refs;
}

function parseStateConditions(text: string): ParsedStateCondition[] {
  if (!text || text === "—" || text === "-") return [];
  const conditions: ParsedStateCondition[] = [];
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^(.+?)\s*=\s*(.+)$/);
    if (match) {
      conditions.push({
        group: match[1].trim(),
        value: match[2].trim(),
      });
    }
  }
  return conditions;
}

/** Parse a time string like "1:30" or "1:02:30" or "90" into seconds */
function parseTimeToSeconds(s: string): number | undefined {
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

/**
 * Parse a media line like:
 *   media: https://youtube.com/watch?v=xxx 1:30 2:45 "Hip escape demo"
 *   media: https://example.com/image.jpg "Caption text"
 */
function parseMediaLine(text: string): ParsedMedia | null {
  text = text.trim();
  if (!text) return null;

  // Extract URL (first non-space token)
  const spaceIdx = text.indexOf(" ");
  if (spaceIdx === -1) {
    // URL only
    const isYt = /youtube\.com|youtu\.be/.test(text);
    return { type: isYt ? "youtube" : "image", url: text };
  }

  const url = text.slice(0, spaceIdx);
  const rest = text.slice(spaceIdx + 1).trim();
  const isYt = /youtube\.com|youtu\.be/.test(url);

  if (isYt) {
    // Try to parse: START END "caption" or START END or "caption"
    const match = rest.match(/^(\d[\d:]*)\s+(\d[\d:]*)\s*(?:"(.+)")?$/);
    if (match) {
      return {
        type: "youtube",
        url,
        start: parseTimeToSeconds(match[1]),
        end: parseTimeToSeconds(match[2]),
        ...(match[3] ? { caption: match[3] } : {}),
      };
    }
    // Just START "caption"
    const match2 = rest.match(/^(\d[\d:]*)\s*(?:"(.+)")?$/);
    if (match2) {
      return {
        type: "youtube",
        url,
        start: parseTimeToSeconds(match2[1]),
        ...(match2[2] ? { caption: match2[2] } : {}),
      };
    }
    // Just "caption"
    const captionMatch = rest.match(/^"(.+)"$/);
    if (captionMatch) {
      return { type: "youtube", url, caption: captionMatch[1] };
    }
    return { type: "youtube", url };
  }

  // Image URL
  const captionMatch = rest.match(/^"(.+)"$/);
  return { type: "image", url, ...(captionMatch ? { caption: captionMatch[1] } : {}) };
}

function parseGiNogi(text: string): "" | "gi" | "nogi" {
  const v = text.trim().toLowerCase();
  if (v === "gi") return "gi";
  if (v === "nogi" || v === "no-gi") return "nogi";
  return ""; // "both" or anything else
}

export function parseNotation(input: string): ParseResult {
  const lines = input.split("\n");
  const result: ParseResult = {
    positions: [],
    conditionGroups: [],
    actions: [],
    states: [],
    flows: [],
    warnings: [],
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) {
      i++;
      continue;
    }

    // Position (multi-line block)
    if (line.startsWith("position:")) {
      const rest = line.slice("position:".length).trim();
      const match = rest.match(/^(.+?)\s*\((.+?)\s*\/\s*(.+?)\)\s*$/);
      const pos: ParsedPosition = match
        ? { name: match[1].trim(), description: "", roleA: match[2].trim(), roleB: match[3].trim() }
        : { name: rest, description: "", roleA: "A", roleB: "B" };
      i++;
      // Read indented sub-lines
      while (i < lines.length) {
        const sub = lines[i];
        if (!sub.match(/^\s/) || sub.trim() === "") break;
        const trimmed = sub.trim();
        if (trimmed.startsWith("description:")) {
          pos.description = trimmed.slice("description:".length).trim();
        }
        i++;
      }
      result.positions.push(pos);
      continue;
    }

    // Condition
    if (line.startsWith("condition:")) {
      const rest = line.slice("condition:".length).trim();
      const sepIdx = rest.indexOf(">");
      if (sepIdx !== -1) {
        const groupName = rest.slice(0, sepIdx).trim();
        const optionsStr = rest.slice(sepIdx + 1).trim();
        const options: ParsedConditionOption[] = optionsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const giOnly = /\[gi\]/i.test(s);
            const label = s.replace(/\s*\[gi\]\s*/i, "").trim();
            return { label, giOnly };
          });
        result.conditionGroups.push({ name: groupName, options });
      } else {
        result.warnings.push(`Line ${i + 1}: condition missing '>' separator`);
      }
      i++;
      continue;
    }

    // Action (multi-line block)
    if (line.startsWith("action:")) {
      const name = line.slice("action:".length).trim();
      const action: ParsedAction = {
        name,
        description: "",
        giNogi: "",
        requires: [],
        forbids: [],
        adds: [],
        removes: [],
        media: [],
      };
      i++;
      // Read indented sub-lines
      while (i < lines.length) {
        const sub = lines[i];
        if (!sub.match(/^\s/) || sub.trim() === "") break;
        const trimmed = sub.trim();
        if (trimmed.startsWith("gi/nogi:")) {
          action.giNogi = parseGiNogi(trimmed.slice("gi/nogi:".length));
        } else if (trimmed.startsWith("description:")) {
          action.description = trimmed.slice("description:".length).trim();
        } else if (trimmed.startsWith("requires:")) {
          action.requires = parseConditionRefs(trimmed.slice("requires:".length));
        } else if (trimmed.startsWith("forbids:")) {
          action.forbids = parseConditionRefs(trimmed.slice("forbids:".length));
        } else if (trimmed.startsWith("adds:")) {
          action.adds = parseConditionRefs(trimmed.slice("adds:".length));
        } else if (trimmed.startsWith("removes:")) {
          action.removes = parseConditionRefs(trimmed.slice("removes:".length));
        } else if (trimmed.startsWith("media:")) {
          const m = parseMediaLine(trimmed.slice("media:".length));
          if (m) action.media.push(m);
        }
        i++;
      }
      result.actions.push(action);
      continue;
    }

    // State (multi-line block)
    if (line.startsWith("state:")) {
      const raw = line.slice("state:".length).trim();
      // Support "Position as Label" syntax
      const asMatch = raw.match(/^(.+?)\s+as\s+(.+)$/i);
      const positionName = asMatch ? asMatch[1].trim() : raw;
      const stateLabel = asMatch ? asMatch[2].trim() : "";
      const state: ParsedState = {
        label: stateLabel,
        positionName,
        roleA: [],
        roleB: [],
        giNogi: "",
        description: "",
        media: [],
      };
      i++;
      while (i < lines.length) {
        const sub = lines[i];
        if (!sub.match(/^\s/) || sub.trim() === "") break;
        const trimmed = sub.trim();
        if (trimmed.startsWith("role A")) {
          // role A (Label): conditions or role A: conditions
          const colonIdx = trimmed.indexOf(":");
          if (colonIdx !== -1) {
            state.roleA = parseStateConditions(trimmed.slice(colonIdx + 1));
          }
        } else if (trimmed.startsWith("role B")) {
          const colonIdx = trimmed.indexOf(":");
          if (colonIdx !== -1) {
            state.roleB = parseStateConditions(trimmed.slice(colonIdx + 1));
          }
        } else if (trimmed.startsWith("gi/nogi:")) {
          state.giNogi = parseGiNogi(trimmed.slice("gi/nogi:".length));
        } else if (trimmed.startsWith("description:")) {
          state.description = trimmed.slice("description:".length).trim();
        } else if (trimmed.startsWith("media:")) {
          const m = parseMediaLine(trimmed.slice("media:".length));
          if (m) state.media.push(m);
        }
        i++;
      }
      result.states.push(state);
      continue;
    }

    // Flow
    if (line.startsWith("flow:")) {
      const rest = line.slice("flow:".length).trim();
      // Split by → or ->
      const steps = rest.split(/\s*(?:→|->)\s*/).map((s) => s.trim()).filter(Boolean);
      if (steps.length >= 2) {
        const finishLabels = new Set(["submitted", "submission", "finish", "tap"]);
        // Parse steps as unknown — type resolution happens at import time
        // using taxonomy to distinguish positions from actions.
        const flowSteps: ParsedFlowStep[] = steps.map((label) => {
          if (finishLabels.has(label.toLowerCase())) {
            return { label, type: "finish" as const };
          }
          return { label, type: "unknown" as const };
        });
        result.flows.push({ steps: flowSteps });
      }
      i++;
      continue;
    }

    // Unknown line
    i++;
  }

  return result;
}
