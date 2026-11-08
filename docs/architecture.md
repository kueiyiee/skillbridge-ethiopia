For detailed responsibilities, see this document. For route access and response behavior, see [docs/api-reference.md](api-reference.md).
# SKILLBRIDGE: System Architecture Specification

## Project Title
**SKILLBRIDGE: An AI-Powered Platform for Skill-Based Job Matching, Skill-Gap Analysis, and Employer Performance Evaluation in Ethiopia.**

---

## 1. System Overview & Problem Statement

In Ethiopia's expanding digital economy, traditional resume-centric recruitment causes two major bottlenecks:
1. **Skill Mismatch & Inflation**: Traditional degrees don't convey verified practical competence, leaving youth graduates unemployed while tech firms struggle with talent shortages.
2. **Opaque Skill Gaps**: Candidates receive binary rejections without knowing *why* they missed out or *what* specific competency (e.g., PostgreSQL query optimization vs. basic CRUD) they lack.
3. **Unverified Employers**: Job scams and phantom listings create distrust for fresh graduates.

SKILLBRIDGE bridges this chasm through:
- **Skill-Based Weighted Vector Matching**: Deterministic requirement matching calibrated with skill weights and proficiency scales.
- **Deep Skill-Gap Diagnostics**: Clear comparison of candidate competencies vs. job demands with actionable roadmaps.
- **AI-Augmented Learning Guidance**: A server-side unified OpenAI/Gemini service generates contextual upskilling roadmaps relevant to Ethiopian tech ecosystems (FinTech, Telecom, AgriTech, GovTech), with schema validation and bounded fallback. Gemini structured generation uses the Google GenAI SDK Interactions API.
- **Employer Performance Evaluation Loop**: 360-degree post-hire reviews to monitor hiring quality and calibrate future job skill requirements.

---

## 2. Multi-Tier Architecture

```
[ Client Layer (React 19 + TypeScript + Tailwind CSS) ]
                        │
                        ▼ (HTTP REST / JSON API)
[ Node.js + Express Application Gateway (Port 3000) ]
        ├── Auth & Role-Based Access Control (Job Seeker / Employer / Admin)
        ├── Algorithmic Matcher & Weighted Skill-Gap Engine
        ├── Unified OpenAI / Gemini AI Service
        └── Drizzle ORM Data Access Layer
                        │
                        ▼
[ Primary Database: MySQL (Relational Schemas & Migrations) ]
                        ▲
                        │ (Future ML Extension)
[ Python Scikit-Learn Microservice (Candidate-Job Ranker & NLP) ]
```

---

## 3. Machine Learning Extension Roadmap (Python / scikit-learn)

SKILLBRIDGE is designed with modular feature extraction to enable plug-and-play connection to a Python/scikit-learn microservice:
- **Feature Vector**:
  - $x_1$: Cosine similarity between candidate skill vector and job requirement vector.
  - $x_2$: Experience level ratio $\min(1.0, \text{exp}_{\text{cand}} / \text{exp}_{\text{req}})$.
  - $x_3$: Weighted mandatory skill coverage score.
  - $x_4$: Historical employer performance rating factor.
- **Model**: Random Forest Regressor & Gradient Boosting Ranker trained on hiring outcomes.
- See `ml_service/` for the Python implementation code and data schemas. The current API does not invoke this service; matching currently uses the deterministic TypeScript implementation.

---

## 4. Physical Project Structure

```text
.
├── backend/src/             # Active Express backend implementation
│   ├── app.ts
│   ├── server.ts
│   ├── config/              # CORS and security settings
│   ├── infrastructure/      # Drizzle database adapter and migration runner
│   ├── middleware/          # Auth, errors, request IDs, logging
│   ├── modules/             # Feature API routers
│   ├── services/            # Shared backend operations
│   └── validation/          # Zod schemas
├── src/                     # React application and frontend services
├── shared/types/            # Frontend/backend API contracts
├── prisma/                  # Retained MySQL baseline SQL and legacy schema reference
├── tests/integration/       # Isolated MySQL workflow tests
├── deployment/              # Passenger and cPanel packaging
├── docs/                    # Operational and architecture guides
├── server.ts                # Root compatibility launcher
└── index.html               # Root Vite entry document
```

## 5. Dependency and Request Flow

```text
React feature page -> api-client -> same-origin REST API
server.ts -> backend/src/server.ts -> environment validation -> Drizzle connect -> backend/src/app.ts
HTTP request -> feature route + middleware -> controller -> service -> repository -> Drizzle adapter -> MySQL
app.ts -> modules/index.ts -> feature router + middleware -> controller -> service -> repository -> Drizzle adapter -> MySQL
frontend + backend -> shared/types
```

Keep `index.html`, `src/main.tsx`, the root `server.ts` compatibility launcher, generated root `server.js`, and the retained SQL baseline at the project root boundary expected by Vite and Passenger. The active backend source is `backend/src/`. The cPanel deployment does not automatically migrate or seed the existing production database.

For route access and response behavior, see [docs/api-reference.md](api-reference.md).
