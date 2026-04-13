# System Architecture: AI Adversarial Protocol

This document serves as the technical map for the repository, defining module responsibilities, data flow, and design patterns to ensure AI agents maintain architectural alignment.

## 1. Module Responsibilities

### 1.1 Feature Modules (`src/lib/features/`)
The project follows a **Modular Feature Pattern**. Each directory in `src/lib/features/` is a self-contained capability.

| Feature | Responsibility | Key Components |
| :--- | :--- | :--- |
| **Audit Metrics** | Reliability scoring & tracking | `calculator.ts` (Score logic), `storage.ts` |
| **Voting** | Multi-AI consensus mechanism | `calculator.ts` (Algorithms), `prompt.ts` |
| **Auto-Challenge** | Automated issue detection in outputs | `prompt.ts` (Audit prompts), `parser.ts` |
| **Serial Reference** | Sequential AI dialogue orchestration | `utils.ts` (Dialogue chaining) |
| **Thinking Vis** | Reasoning process extraction & display | `parser.ts` (Tag extraction), `highlight.ts` |

### 1.2 Core Infrastructure (`src/lib/`)
- **State Management**: `store.ts` (Zustand) - The single source of truth for `debateState` and `settings`, persisted via LocalStorage.
- **API Clients**: `claude-client.ts`, `openai-client.ts`, etc. - Unified streaming wrappers for various LLM providers.
- **Configuration**: `config.ts` - Layered priority: `LocalStorage` $\rightarrow$ `.env` $\rightarrow$ `Auto-detect` $\rightarrow$ `Defaults`.
- **Types**: `types.ts` - Global interface definitions for `Message`, `Challenge`, and `DebateState`.

---

## 2. Dependency Topology

### 2.1 Architectural Layers
`UI Layer (page.tsx)` $\rightarrow$ `State Layer (store.ts)` $\rightarrow$ `Feature Layer (lib/features/*)` $\rightarrow$ `Client Layer (lib/clients/*)` $\rightarrow$ `External APIs`

### 2.2 Feature Interaction Flow
1. **Trigger**: User submits a question.
2. **Execution**: `page.tsx` triggers parallel streaming calls to `/api/claude` and `/api/openai`.
3. **Post-Processing**: Once streams complete, the system optionally triggers:
   - `Auto-Challenge` $\rightarrow$ AI critiques opponent's output.
   - `Voting` $\rightarrow$ Multiple AIs reach a consensus on the best answer.
4. **Metric Update**: `Audit Metrics` is updated automatically whenever a message or challenge is recorded in `store.ts`.

---

## 3. Core Design Patterns

### 3.1 State Persistence
Uses **Zustand with Persist Middleware**. All conversation history and configuration are synced to `localStorage` under the key `ai-adversarial-storage`.

### 3.2 API Streaming (SSE)
All API routes in `src/app/api/` use **Server-Sent Events (SSE)**. 
- Client: Uses `fetch` with a readable stream.
- Server: Returns a `Response` with `Content-Type: text/event-stream`.

### 3.3 Configuration Priority
To ensure flexibility across environments, the system resolves settings in this order:
1. **User-defined LocalStorage** (Highest priority)
2. **Environment Variables** (`.env`)
3. **Automatic Detection** (Local tool configs)
4. **Hard-coded Defaults** (Lowest priority)

---

## 4. Next.js App Router Structure

### 4.1 API Route Map
- `/api/claude` & `/api/openai`: Primary chat streams.
- `/api/auto-challenge`: Orchestrates the `auto-challenge` feature.
- `/api/voting`: Orchestrates the `voting` feature.
- `/api/audit-metrics`: Retrieves reliability scores.
- `/api/serial-reference`: Handles sequential AI turn-taking.

### 4.2 Component Hierarchy
- `MainLayout.tsx`: Orchestrates the overall conversation view.
- `SettingsPanel.tsx`: Manages API keys and feature toggles.
- `ThinkingBlock.tsx`: Specialized renderer for AI reasoning process.
- `Feature Panels`: (`AuditDashboard`, `VotingResultPanel`, etc.) each map 1:1 to a feature in `src/lib/features/`.
