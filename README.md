# Quiro Physics

**Understand physics, one step at a time.**

An AI physics tutor that answers from your uploaded textbooks and from general physics knowledge. It has PDF upload, physics-aware retrieval-augmented generation (RAG), layered conversation memory, LaTeX equation rendering, step-by-step problem solving, and token-by-token streaming. Chat history is saved to your account. It's built to run on the **Vercel Hobby (free) tier**.

> **Status:** Phase 2 (accounts, saved chats, the real streaming tutor on Groq, guest limits, history and memory) is built and tested, and awaiting review. Without any keys the app still runs: guest mode with a demo tutor and a local database. See [Project Status](#project-status) and [Run it](#run-it).

---

## Features
- **Guest mode**: ask physics questions without an account, up to 6 turns per question thread.
- **Textbook-grounded answers** with validated citations (document + page) once signed in.
- **PDF library**: 3 uploads per rolling 7 days, 5 active PDFs at a time, with live processing status.
- **Physics-aware parsing and chunking** that keeps equations with their variable definitions and worked examples with their solutions.
- **Hybrid retrieval**: pgvector similarity + Postgres full-text search, fused with RRF.
- **Layered memory**: recent turns, rolling summary, structured physics facts (active problem, symbols, level).
- **Streaming** token by token, with a separate "thinking" block, a stop button and honest handling of interruptions.
- **Step-by-step solutions**: Given → Find → Concepts → Equations → Solution → Boxed result → Check.
- **Stays on topic**: physics and the maths it needs; other requests get a friendly redirect.
- **Physics-inspired UI**: particle-field background, spring physics motion, orbit/wave indicators, Dark Matter and Lab Light themes, fully responsive and accessible.

## Tech Stack
| Area | Technology |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Motion, Vaul, cmdk |
| Maths rendering | Streamdown + remark-math + rehype-katex (KaTeX) |
| Validation | Zod, React Hook Form |
| Auth | Clerk |
| Database | Neon Postgres + pgvector (`halfvec(768)`) |
| ORM | Drizzle ORM |
| Object storage | Vercel Blob (client uploads) |
| Cache / limits | Upstash Redis |
| LLMs | Groq — `gpt-oss-120b`, `llama-3.3-70b-versatile`, `gpt-oss-20b`, `llama-3.1-8b-instant` (configurable) |
| Embeddings | Google `gemini-embedding-001` (768 dims) |
| RAG orchestration | LangChain.js |
| Streaming | Vercel AI SDK (UI message stream, `useChat`) |
| PDF | unpdf |
| Testing | Vitest, React Testing Library, MSW, Playwright |

Full rationale and free-tier limits: [techstack.md](techstack.md).

## Architecture
```
Browser ──► /api/chat ──► limits ─► router chain ─► hybrid retrieval ─► Groq stream ─► citations ─► Neon
        └─► Blob (direct upload) ─► /complete ─► resumable job: extract → normalise → chunk → embed → ready
```
Details: [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md).

## Getting Started
Prerequisites: Node.js LTS, pnpm, accounts for Clerk, Neon, Groq, Google AI Studio, Upstash and Vercel.

```bash
git clone <your-repo-url>
cd physics-rag-chatbot
pnpm install
cp .env.example .env.local   # Phase 1: values can stay empty
pnpm dev
```
Open http://localhost:3000. Environment variables are listed in [techstack.md §7](techstack.md#7-environment-variables). From Phase 2 on, also run `pnpm db:migrate`.

Run the tests: `pnpm test` (unit/component), `pnpm test:e2e` (first run `pnpm exec playwright install chromium webkit`), or one section at a time with `pnpm test:section p1-s3`.

## Usage Limits
| Limit | Default |
| --- | --- |
| Guest turns per question thread | 6 |
| Guest question threads per day | 3 |
| Signed-in messages per day | 50 |
| PDF uploads per rolling 7 days | 3 (deleting a PDF does not refund this) |
| Active PDFs | 5 (deleting a PDF frees a slot) |
| PDF size / pages | 10 MB / 300 pages |

## Scripts
`dev` · `build` · `start` · `lint` · `format` · `typecheck` · `test` · `test:e2e` · `test:section <id>` · `test:phase <n>` · `test:all-sections` · `db:generate` · `db:migrate` · `eval`

## Deployment
Vercel Hobby + Neon Free + Upstash Free + Groq Free. Steps and the free-tier budget: [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md). Hobby is for non-commercial personal use only.

## Project Docs
| Doc | Purpose |
| --- | --- |
| [plan.md](plan.md) | 4 phases × 6 steps with approval gates |
| [soul.md](soul.md) | Product persona, answer style, UI principles |
| [techstack.md](techstack.md) | Technology choices and free-tier constraints |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | File-level build blueprint and per-step prompts |
| [INSTRUCTION.md](INSTRUCTION.md) | Rules for contributors and coding agents |
| [documentation/](documentation/README.md) | Deep design docs |
| [navigation/](navigation/PROJECT_MAP.md) | Where code lives and how to change it |
| [track/](track/README.md) | Per-prompt change records |
| [test-cases/](test-cases/README.md) | Per-section test specs: automated (A) and manual (M) |

> Per the project `.gitignore`, everything except this README stays local and isn't pushed to GitHub.

## Run it
```powershell
pnpm install
pnpm dev                 # http://localhost:3000, works with no keys (demo tutor, local PGlite database, guest mode)
```
Add keys to `.env.local` (names in `.env.example`; setup steps in documentation/DEPLOYMENT.md "Phase 2 setup") to switch on the real tutor (Groq), accounts (Clerk), Neon and Upstash. Then:
```powershell
pnpm db:migrate          # once, when DATABASE_URL points at Neon
pnpm smoke:models        # every configured Groq model answers, with first-token times
pnpm test:phase 2        # Phase 2 gate (offline: mocks, PGlite, demo tutor)
```

## Project Status
| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Planning docs | 🟩 Done |
| 1 | Foundation and physics-inspired UI shell | 🟩 Approved |
| 2 | Auth, DB, streaming chat, guest limits, history, memory | 🟨 Built and tested (315 unit/integration + 36 e2e); awaiting review |
| 3 | PDF ingestion and physics-aware RAG | ⬜ Not started |
| 4 | Interactive lab, evaluation, hardening, deployment | ⬜ Not started |

## Known Limitations
- Groq free-tier tokens per minute allow only a few concurrent answers; the router spreads load across models.
- Scanned PDFs: OCR is off by default (optional, limited OCR via Gemini vision).
- Original PDFs are deleted after indexing by default (`RETAIN_PDF=false`) to stay within 1 GB of Blob storage.

## License
Add a license (e.g. MIT) and a `LICENSE` file.
