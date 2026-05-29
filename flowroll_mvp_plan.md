# Flowroll — MVP Plan

## Overview
Flowroll is a visual knowledge system for Brazilian Jiu-Jitsu (BJJ) that models positions, reactions, and techniques as a connected graph.

Instead of rigid categories (positions, transitions, techniques), everything is represented as flexible nodes connected by relationships.

The goal is to capture:
- Reactions ("if their knee points outward...")
- Micro-adjustments
- Threats and counters
- Positional flows
- Concepts and principles

All as a navigable graph.

---

## Core Idea

BJJ is not a linear system — it is a network of decisions.

So the system treats everything as:

### Node
A piece of grappling knowledge:
- Position
- Concept
- Reaction
- Cue
- Submission
- Escape
- Grip idea

### Edge
A relationship between nodes:
- leads to
- counters
- creates
- prevents
- responds to
- threatens

---

## MVP Features

### 1. Graph Editor
- Create nodes
- Drag nodes around
- Connect nodes with edges
- Label edges (relationship type)

### 2. Persistence
- Save graph to database
- Load graph on refresh

### 3. Basic Node Data
Each node contains:
- title
- description (markdown/text)
- optional tags

### 4. Visual Navigation
- Pan / zoom graph
- Click node to view/edit details

---

## Tech Stack

### Frontend
- Next.js (React)
- React Flow (graph UI)

### Backend
- Supabase (Postgres + Auth)

### Database
- Postgres with JSONB support

### Hosting
- Vercel (frontend)
- Supabase (backend)

---

## Data Model (Simple)

### Nodes
```
id: uuid
title: text
description: text
metadata: jsonb
```

### Edges
```
id: uuid
source_node_id: uuid
target_node_id: uuid
relationship: text
metadata: jsonb
```

---

## MVP Build Steps

### Step 1 — UI Scaffold
- Next.js app setup
- Install React Flow
- Render empty graph

### Step 2 — Basic Interaction
- Add node button
- Drag nodes
- Connect nodes with edges

### Step 3 — Persistence
- Connect Supabase
- Save nodes/edges
- Load graph on page load

### Step 4 — Node Editor
- Click node opens panel
- Edit title + description

---

## Design Principles

### 1. No rigid taxonomy
Everything is a node — avoid early categorization.

### 2. Optimize for exploration
The value is in navigating relationships, not storing perfect data.

### 3. Fast iteration over correctness
The schema will evolve based on usage.

### 4. Graph first UX
The graph view is the primary interface, not a secondary visualization.

---

## Future Ideas (Not MVP)

- AI-suggested counters
- Common escape paths
- Video embedding per node
- Training session planner
- Heatmap of commonly used transitions
- Collaborative graphs
- Study mode (spaced repetition on nodes)

---

## Goal

Build a system where:

> "If I understand one position or reaction, I can navigate the entire web of responses from it."

