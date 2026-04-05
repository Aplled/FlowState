# FlowState - Product Requirements Document

**Version 1.4 | Draft**
**Author:** Yogi Singh
**Date:** March 31, 2026

**Changelog:** v1.1 added Folders and folder-level sharing. v1.2 added Google Calendar sync, Browser Node, Split Screen, and External App Embedding. v1.3 clarified Browser Node as both a canvas node and a persistent standalone tab decoupled from any workspace. v1.4 added Draw Node, removed Gmail/Mail Node flows, clarified native desktop launch on macOS and Windows, removed monetization, and specified Supabase as the backend.

## 1. Overview

### 1.1 Product Summary

FlowState is an all-in-one productivity and ideation platform built around infinite, node-based workspaces. It launches first as a native desktop app for macOS and Windows, giving individuals and teams unified control over their ideas, tasks, documents, events, and workflows in one visual environment. Where tools like Notion are document-first and tools like Miro are canvas-first, FlowState is neither: it is node-first, meaning every piece of information is a living, connectable object.

### 1.2 Problem Statement

Professionals and students today juggle an average of 4-7 productivity tools simultaneously. Context-switching between these tools is expensive, and relationships between pieces of information are lost. There is no single tool that lets users see how ideas connect, what they need to do, and when they need to do it all in one place.

### 1.3 Vision Statement

> 'One canvas. Every thought. Every task. Every connection.'

### 1.4 Target Users

- **Primary:** Students, indie developers, solo creators, and researchers
- **Secondary:** Small teams (2-10)
- **Tertiary:** Power users migrating from Notion, Obsidian, or Miro

## 2. Core Architecture

### 2.1 Organizational Hierarchy

```
Folders
└── Dynamic Tabs (Workspaces)
    └── Nodes
```

### 2.2 Folders

Organizational containers with sharing and permissions

### 2.3 Dynamic Tabs (Workspaces)

Infinite canvas whiteboard environments

### 2.4 Nodes

Atomic units of FlowState

## 3. Node Types

### 3.1 Tab Node

Portal to another workspace

### 3.2 Grouple Container

Group container for organizing nodes visually

### 3.3 Task Node

Tasks with due dates, priority, recurrence, and AI tags

### 3.4 Note Node

Lightweight text notes

### 3.5 Doc Node

Full document editor

### 3.6 Table Node

Spreadsheet-style grid

### 3.7 Event Node

Calendar events synced with Google Calendar

### 3.8 Browser Node

Embedded browser with standalone tab support

### 3.9 Draw Node

A Draw Node is a free-draw, pen-based whiteboard surface embedded directly on the canvas.

**Supports:**
- Freehand drawing (mouse, trackpad, stylus)
- Multiple colors
- Variable stroke thickness
- Eraser tool
- Undo / Redo
- Resizable canvas
- Locking

**Use cases:**
- Brainstorming
- Diagrams
- Visual annotations
- Scratch work

Expanded Mode allows focused drawing. Exports as vector or raster depending on format.

## 4. Connections

Directed or undirected edges between nodes with labels, styles, and weights

## 5. Auto Sort Bucket (ASB)

### 5.1 Concept

Central intelligent inbox for routing nodes

### 5.2 Sorting Logic
- Semantic similarity
- AI tag matching
- Folder affinity
- Node type bias (Tasks, Events, Draw Nodes)
- Connection topology
- User feedback

### 5.3 Sort Modes

Suggest, Auto, Manual

### 5.4 Capture Methods
- Drag into ASB
- Global shortcut
- Google Calendar sync

## 6. Integrations

### 6.1 Google Calendar Event Sync
- OAuth connection
- Bidirectional sync
- Event Nodes auto-created
- Recurring support
- Conflict resolution
- Metadata tagging

### 6.2 AI Tagging
- Category, Project, Action tags
- Editable by user
- Confidence-based suggestions
- Ephemeral processing

## 7. Split Screen

Multiple panes for simultaneous workflows

## 8. Global Views
- Task List
- Calendar
- Search
- Graph View
- Recents
- Shared with Me
- Integrations Feed

## 9. Additional Features
- Command Palette
- Version History
- Themes
- Export
- API + Webhooks

## 10. Platform and Technical Constraints

**Platforms at launch:** Native desktop app for macOS and Windows

**Backend:** Supabase
- Auth
- Postgres database
- Realtime
- Storage

**Offline support:** Local-first with sync

**Performance target:** 60fps with 2000 nodes

**Security:**
- Sandboxed browser nodes
- Minimal OAuth scopes

## 11. Success Metrics
- Activation
- Retention
- Integration adoption
- AI tag acceptance
- ASB usage

## 12. Out of Scope (v1.0)
- Mobile canvas editing
- AI content generation
- Plugin marketplace
- Non-Google integrations

## 13. Open Questions
- ASB UI structure
- Graph scaling
- Editor choice
- Export behavior
- Browser persistence
