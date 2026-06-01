"use client";

import { useState } from "react";
import { translateToNotation } from "../actions/ai-translate";
import { importNotation, type ImportResult } from "../actions/import";
import { parseNotation, type ParseResult } from "@/lib/import-parser";

type Step = "input" | "notation" | "result";

export default function ImportView({ onImported }: { onImported: () => void }) {
  const [step, setStep] = useState<Step>("input");
  const [freeText, setFreeText] = useState("");
  const [notation, setNotation] = useState("");
  const [translating, setTranslating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const handleTranslate = async () => {
    if (!freeText.trim()) return;
    setTranslating(true);
    setError("");
    try {
      const translated = await translateToNotation(freeText);
      setNotation(translated);
      setPreview(parseNotation(translated));
      setStep("notation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  };

  const handleUseNotation = () => {
    // User typed notation directly, skip AI
    setPreview(parseNotation(notation));
    setStep("notation");
  };

  const handleNotationChange = (value: string) => {
    setNotation(value);
    setPreview(parseNotation(value));
  };

  const handleImport = async () => {
    if (!notation.trim()) return;
    setImporting(true);
    setError("");
    try {
      const importResult = await importNotation(notation);
      setResult(importResult);
      setStep("result");
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("input");
    setFreeText("");
    setNotation("");
    setPreview(null);
    setResult(null);
    setError("");
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Import</h2>
          <div className="flex gap-1 text-xs text-zinc-500">
            <span className={step === "input" ? "text-zinc-200 font-medium" : ""}>Input</span>
            <span>→</span>
            <span className={step === "notation" ? "text-zinc-200 font-medium" : ""}>Review</span>
            <span>→</span>
            <span className={step === "result" ? "text-zinc-200 font-medium" : ""}>Done</span>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === "input" && (
          <div className="space-y-4">
            {/* Free text input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Paste your notes, transcript, or description
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder={"From closed guard bottom, if I have an underhook on the near arm, I can hip escape to get to open guard with a knee shield. If they have heavy pressure from top, I need to frame first before escaping..."}
                rows={8}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500 resize-y"
              />
              <button
                onClick={handleTranslate}
                disabled={translating || !freeText.trim()}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {translating ? "Translating..." : "Translate with AI"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-xs text-zinc-500">or write notation directly</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            {/* Direct notation input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Flowroll notation
              </label>
              <textarea
                value={notation}
                onChange={(e) => setNotation(e.target.value)}
                placeholder={"position: Closed Guard (Bottom / Top)\n  description: Hips close, break posture first\n\naction: Hip Escape\n  description: Create angle, shrimp away\n  requires: Near Arm = underhook (actor)\n  adds: Legs = knee shield (actor)"}
                rows={8}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500 resize-y"
              />
              <button
                onClick={handleUseNotation}
                disabled={!notation.trim()}
                className="rounded border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review notation
              </button>
            </div>

            {/* Format reference */}
            <details className="rounded border border-zinc-800 bg-zinc-900/50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300">
                Format reference
              </summary>
              <pre className="px-3 pb-3 text-xs text-zinc-500 overflow-x-auto">{`# Positions (with optional description)
position: Closed Guard (Bottom / Top)
  description: Hips close, break posture first

# Conditions (group > options)
condition: Near Arm > underhook, overhook, whizzer
condition: Grip > collar grip [gi], sleeve grip [gi], wrist grip

# Actions (with optional description and condition effects)
action: Hip Escape
  description: Create angle by shrimping away from opponent
  gi/nogi: both
  requires: Near Arm = underhook (actor)
  forbids: Head Control = crossface (opponent)
  adds: Legs = knee shield (actor)
  removes: Near Arm = overhook (opponent)

# States (position + conditions snapshot, "as" for display name)
state: Closed Guard
  description: My A-game starting point
  role A (Bottom): Near Arm = underhook, Legs = butterfly hooks
  role B (Top): Posture = postured up
  gi/nogi: nogi
state: Mount as High Mount
  role A (Top): Weight = heavy pressure

# Flows (state → action → state, use named states for sub-positions)
flow: Closed Guard → Hip Escape → Open Guard
flow: Turtle → Establish Seatbelt → Back Mount (Seatbelt) → Insert Hooks → Back Mount (Hooks In)
flow: Mount → Armbar → Submitted`}</pre>
            </details>
          </div>
        )}

        {step === "notation" && (
          <div className="space-y-4">
            {/* Editable notation */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Review and edit notation
              </label>
              <textarea
                value={notation}
                onChange={(e) => handleNotationChange(e.target.value)}
                rows={12}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-100 outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            {/* Preview */}
            {preview && (
              <div className="space-y-3 rounded border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="text-xs font-medium text-zinc-400">Preview</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <PreviewSection
                    title="Positions"
                    items={preview.positions.map((p) => `${p.name} (${p.roleA} / ${p.roleB})`)}
                  />
                  <PreviewSection
                    title="Condition Groups"
                    items={preview.conditionGroups.map((g) => `${g.name}: ${g.options.map((o) => o.label).join(", ")}`)}
                  />
                  <PreviewSection
                    title="Actions"
                    items={preview.actions.map((a) => a.name + (a.giNogi ? ` [${a.giNogi}]` : ""))}
                  />
                  <PreviewSection
                    title="States"
                    items={preview.states.map((s) => s.label ? `${s.label} (${s.positionName})` : s.positionName)}
                  />
                  {preview.flows.length > 0 && (
                    <PreviewSection
                      title="Flows"
                      items={preview.flows.map((f) => f.steps.map((s) => s.label).join(" → "))}
                    />
                  )}
                </div>
                {preview.warnings.length > 0 && (
                  <div className="text-xs text-yellow-400">
                    {preview.warnings.map((w, i) => (
                      <div key={i}>⚠ {w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("input")}
                className="rounded border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !notation.trim()}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="rounded border border-green-800 bg-green-950/50 p-4 space-y-2">
              <div className="text-sm font-medium text-green-300">Import complete</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-green-200/80">
                {result.positionsCreated > 0 && <div>{result.positionsCreated} position(s) created</div>}
                {result.conditionGroupsCreated > 0 && <div>{result.conditionGroupsCreated} condition group(s) created</div>}
                {result.conditionOptionsCreated > 0 && <div>{result.conditionOptionsCreated} condition option(s) created</div>}
                {result.actionsCreated > 0 && <div>{result.actionsCreated} action(s) created</div>}
                {result.statesCreated > 0 && <div>{result.statesCreated} state(s) created</div>}
                {result.flowsCreated > 0 && <div>{result.flowsCreated} flow(s) created</div>}
                {result.positionsCreated === 0 &&
                  result.conditionGroupsCreated === 0 &&
                  result.conditionOptionsCreated === 0 &&
                  result.actionsCreated === 0 &&
                  result.statesCreated === 0 &&
                  result.flowsCreated === 0 && (
                    <div className="col-span-2 text-zinc-400">
                      No new items created — everything already exists
                    </div>
                  )}
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded border border-yellow-800 bg-yellow-950/50 p-3 space-y-1">
                <div className="text-xs font-medium text-yellow-300">Warnings</div>
                {result.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-yellow-200/70">{w}</div>
                ))}
              </div>
            )}

            <button
              onClick={handleReset}
              className="rounded border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Import more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="font-medium text-zinc-300 mb-1">{title}</div>
      {items.map((item, i) => (
        <div key={i} className="text-zinc-400">{item}</div>
      ))}
    </div>
  );
}
