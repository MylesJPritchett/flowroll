# Flowroll

Flowroll lets a Brazilian Jiu-Jitsu practitioner map their game as a graph: the States they end up in, the Actions they can take from each one, and where those Actions lead. Notes, or a YouTube instructional, can be turned into a graph with AI-assisted import. Built with Next.js, React Flow and Supabase.

<!-- ![Flowroll graph editor](docs/screenshot.gif) -->

## What it does

- Build a graph of States (a Position plus the Conditions each person has, e.g. Half Guard with a knee shield and an underhook) and Actions (Sweep, Hip Escape, Rear Naked Choke) on a pan/zoom canvas.
- Drag out from an Action and Flowroll suggests the resulting State, with Conditions already worked out from what the Action adds and removes.
- Actions warn when the State before them doesn't meet their requirements, or has a Condition they forbid.
- Attach images, YouTube clips (with start and end times) or text notes to any State or Action.
- Paste notes, or a YouTube link, into Import. Claude converts them into Flowroll's notation, you check and edit the result, and importing it creates the Positions, Conditions, Actions and States, plus a Graph for each Flow.
- Each imported Flow gets its own Graph. "Merge" combines those Graphs into one Merged Graph, joining identical States.
- Select with click and drag to copy, cut, paste or delete parts of a graph.
- A Database view for managing Positions, Condition Groups, Actions and named States, and which Conditions apply to each Position and role.
- Sign in with GitHub. Your graphs autosave.

## How it works

Next.js App Router: client components render the graph editor, and every read and write goes through server actions (`app/actions/`) that check the session and use a server-only Supabase client. `proxy.ts` redirects anyone without a session to `/login`. The rules (Conditions, Action effects, notation parsing) are plain functions in `lib/` with no dependencies on React or the database, so they're unit-tested on their own.

**Actions are written from the actor's point of view, not as fixed roles.** Each Position has two named roles (Closed Guard: Bottom / Top). An Action like "Hip Escape" could be done by either one, so its requirements and effects are stored relative to the person doing it (`underhook (actor)`, `crossface (opponent)`) and only resolved to role A or B once it's placed on the graph (`resolveConditionRole` in `lib/concepts.ts`). `computeActionEffects` then applies the Action to the State before it: it takes away what the Action removes, and for anything it adds, it replaces whatever that person had in the same Condition Group. That gives the suggested next State, and the same rules produce the requires/forbids warnings.

**The AI writes text, not database rows.** Instead of having the model call tools or return JSON for the database, `translateToNotation` (`app/actions/ai-translate.ts`) has Claude write a small line-based notation (`position:`, `action:`, `state:`, `flow: A → B → C`). The prompt includes the current taxonomy so the model reuses existing names exactly. You can read and edit the result before importing. It then goes through a deterministic parser (`lib/import-parser.ts`, unit-tested) and importer (`app/actions/import.ts`), which match names case-insensitively, create only what's missing, and fix up Flows that don't alternate correctly by inserting `?` placeholders between two States or two Actions in a row. For a YouTube link, the server fetches the timestamped transcript first (via the `youtube-transcript-api` Python package) so the model can attach clips with start and end times to each Action.

**Merging Graphs means deciding which States are the same.** Each imported Flow is its own small Graph. To merge them, `handleMergeFlows` (`app/components/Workspace.tsx`) treats two States as the same when they have the same Position and the same sorted set of Conditions, merges those, re-IDs every Action and skips duplicate edges. The Merged Graph is then laid out by depth from its starting nodes (a breadth-first search), since the separate Graphs' layouts have nothing to do with each other. Action nodes aren't deduplicated, so the same Action out of the same State in two Graphs shows up twice.

Graphs are saved by deleting and rewriting all of a graph's nodes and edges, debounced to 1.5 s after the last edit. That keeps the client simple, but the delete and insert aren't one transaction.

## Stack

Next.js 16 (App Router, server actions), React 19, TypeScript, React Flow (`@xyflow/react`), Tailwind CSS 4, Supabase (Postgres), NextAuth v5 (GitHub), the Anthropic SDK, Vitest.

## Getting started

Requires Node 24 and pnpm 12 (pinned in `package.json`), Docker and the Supabase CLI. Python 3 is only needed for YouTube import: on first use it creates a venv at `/tmp/yt-venv` and installs `youtube-transcript-api`.

```sh
pnpm install
supabase start                  # local Postgres + REST API, applies supabase/migrations
```

Create `.env.local`:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=...   # SERVICE_ROLE_KEY from `supabase status -o env`
AUTH_SECRET=...                 # `openssl rand -base64 33`
AUTH_GITHUB_ID=...              # GitHub OAuth app, callback http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_SECRET=...
ANTHROPIC_API_KEY=...           # only needed for AI import
```

AI import can also use an `ant auth login` profile instead of an API key: leave `ANTHROPIC_API_KEY` out of `.env.local` entirely, since even an empty value takes precedence.

```sh
pnpm dev                        # http://localhost:3000
```

The first migration seeds the official Positions, Condition Groups and Actions.

## Testing

```sh
pnpm lint               # ESLint, including the React Compiler rules
pnpm test               # Vitest unit tests: notation parser, Condition logic, graph serialization
pnpm test:integration   # server actions against local Supabase (needs `supabase start`)
pnpm check              # tsc --noEmit + next build
```

`pnpm test:integration` needs local Supabase running with every migration applied. After pulling new migrations, run `supabase db reset` before the integration tests.

Integration tests stub NextAuth with a fake user and delete everything that user created between tests.
