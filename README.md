# Customer Complaint Navigator — State Bank of Faridabad

**Version 1.0 · 02 September 2026**
**Confidential — For Evaluation by Bank Technology Team Only**

Browser-based digital banking service desk: omni-channel complaint intake, four rule-driven
service agents, RBI/board-policy redress engine, human-in-the-loop control, audit trail and
regulatory reporting.

---

## 1. Architecture overview

```
 Channels                     Application (React / TanStack Start)
 ---------                    ------------------------------------
 Branch      \                 src/routes/*            UI routes (dashboard, cases,
 Contact ctr  \                                        agents, routing, desk, hitl,
 Email         >--- intake --> src/components/app/*    audit, reports, policy, portal)
 Digital      /                        |
 Portal      /                         v
                               src/lib/domain/
                                 agents.ts      classification, markers, PII redaction
                                 policy.ts      structured regulatory rule base
                                 engine.ts      case state machine + guards
                                 store.ts       persistence, assignment, HITL, audit
                                 metrics.ts     dashboard / report analytics
                                 simulation.ts  live case generator for training
                                 customers.ts   portal accounts (unique ID + PIN)
                                        |
                                        v
                               Storage adapter -> browser localStorage (evaluation)
                                                -> managed Postgres (production profile)
```

Case state machine: `NEW → TRIAGED → IN_PROGRESS → GHO_REVIEW → HITL_REQUIRED → RESOLVED → CLOSED`
with explicit transition guards; invalid transitions are rejected, never silently applied.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19, TanStack Start v1, TanStack Router (file-based routes) |
| Build | Vite 7, Bun, TypeScript (strict, `exactOptionalPropertyTypes`) |
| Styling | Tailwind CSS v4 with semantic tokens in `src/styles.css` |
| UI | shadcn-style components in `src/components/ui`, Recharts, lucide-react |
| Domain | Pure TypeScript modules in `src/lib/domain` (no framework coupling) |
| Persistence | Browser localStorage in this build; single adapter to swap for a database |

Brand palette: primary `#B02A30`, secondary `#F99D27`, accent `#005B75`, off-white neutrals.

## 3. Run locally

```bash
bun install       # or: npm install
bun run dev       # http://localhost:8080
bun run build     # production build
```

Demo sign-in: pick any listed staff identity on the login screen and enter the shown PIN.
Customers self-register in the portal (`/portal`) and receive a unique `CUST-…` ID.

## 4. Deploy

- Static/edge deployment of the Vite build output; no backend is required for the evaluation build.
- Publish from Lovable, or serve `dist/` behind the bank's reverse proxy / CDN.
- Production profile: replace the storage adapter in `src/lib/domain/store.ts` with a database
  client, place the app behind the bank's SSO, and enable server-side audit persistence.

## 5. Environment variables

The evaluation build needs none. For the production profile:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the bank's case API |
| `DATABASE_URL` | Server-side database connection string |
| `SESSION_SECRET` | Session signing secret |
| `SSO_ISSUER`, `SSO_CLIENT_ID` | Enterprise identity provider |

Client-visible values must use the `VITE_` prefix; everything else stays server-side.

## 6. Security notes

- Role-based route guards; unauthorised roles are redirected before data loads.
- PII redaction (account, card, mobile, e-mail) in narratives, traces and exports.
- Mandatory human review for S1/S2, fraud, vulnerability, conduct and high-value redress.
- Append-only audit log of every state change, assignment, tool call and override.
- Overrides require a written justification recorded against the officer (four-eyes).
- No third-party analytics, no outbound calls; this build contacts no external service.
- Demo identities and seeded cases must be removed before any production use.

## 7. Mapping to the specification

| Spec section | Where implemented |
|---|---|
| 2 Banking needs | `src/lib/domain/policy.ts`, `seed.ts` |
| 3.1 Key features | `src/routes/*`, `src/lib/domain/*` |
| 3.2 User journeys | `portal.tsx`, `desk.tsx`, `hitl.tsx`, `cases.$caseId.tsx` |
| 3.3 Role-based access | `src/lib/useAuthGuard.ts`, `AppShell.tsx` |
| 3.5 Security controls | `agents.ts` (redaction), `store.ts` (guards, audit) |
| 3.6 Audit & reporting | `audit.tsx`, `reports.tsx`, `metrics.ts` |
| 4 Administrator guide | Routing desk, policy library, reports, audit screens |

## 8. Companion artefacts

- `Digital_Banking_Specification.docx` — product specification and administrator guide
- `Digital_Banking_Offline_Demo.html` — single-file offline demo
- `Digital_Banking_Codebase.zip` — full source bundle
- `Digital_Banking_Codebase_Manifest.json` — every source file with path and content

---
*Confidential — For Evaluation by Bank Technology Team Only · v1.0 · 02 September 2026*
