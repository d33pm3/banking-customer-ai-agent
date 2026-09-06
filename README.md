# Customer Complaint Navigator — State Bank of Faridabad (Dummy Bank Name)

**Version 1.0 · Initial Release Demo**
**Demo Version Only — For Evaluation by Bank Technology Team Only**

Dummy bank only. This is not SBI software and not RBI software.

The four service agents are **rule-driven TypeScript** (`src/lib/domain/agents.ts`). This build makes no live LLM calls and contacts no external model API.

Browser-based digital banking service desk: omni-channel complaint intake, four rule-driven service agents, RBI/board-policy redress engine, human-in-the-loop control, audit trail and regulatory reporting.

The product specification on this tree is [`specification.md`](specification.md).

## This is / this is not

**This is** an unofficial evaluation demo of a bank complaint / grievance desk (dummy: State Bank of Faridabad).
**This is** a local React / TanStack app with four rule-driven service agents, a case state machine, HITL, and an audit log.
**This is** an eval build that stores cases in browser `localStorage`.
**This is not** SBI, RBI, or any real bank’s production system.
**This is not** a live LLM or multi-model agent platform — no outbound model calls in this build.
**This is not** a hosted SaaS or a customer-facing bank portal on the internet.
**This is not** a regulatory filing, ombudsman decision, or compliance conclusion.
**This is not** a complete `src/` tree on `main` — the runnable source is in `Codebase.zip`.

## Where the source is

The **complete application source** is in [`Codebase.zip`](Codebase.zip), under:

- `4_Bank Customer Support Agent/src/`
- `4_Bank Customer Support Agent/public/`

There is no `src/` on `main`. Extract the zip before `bun run dev`.

## Run the eval build

Requires Node.js 18+ and Bun or npm. Dev server: http://localhost:8080. The evaluation build needs no environment variables.

```bash
git clone https://github.com/d33pm3/banking-customer-ai-agent.git
cd banking-customer-ai-agent
unzip -o Codebase.zip
cp -a "4_Bank Customer Support Agent/src/." src/
cp -a "4_Bank Customer Support Agent/public/." public/
bun install       # or: npm install
bun run dev       # http://localhost:8080
bun run build
```

After extract, `src/lib/domain/agents.ts` must exist. If it does not, the zip did not unpack.

Demo sign-in: pick any listed staff identity on the login screen and enter the shown PIN. Customers self-register in the portal (`/portal`) and receive a unique `CUST-…` ID.

## What is not deployed

- There is no hosted URL, GitHub Pages site, or Vercel project in this repository.
- This build does not call a live LLM, a bank core, or any external API.
- Persistence is browser `localStorage` only. Postgres / SSO / `DATABASE_URL` are a production *profile*, not this package.
- Do not treat cases, TAT, or redress amounts as a bank record or a regulatory filing.
- Demo identities and seeded cases must be removed before any production use.

To serve the eval build yourself after `bun run build`, host `dist/` behind your own reverse proxy or CDN. Swapping `src/lib/domain/store.ts` for a database client is a separate hardening step.

## Architecture overview

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

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19, TanStack Start v1, TanStack Router (file-based routes) |
| Build | Vite 7, Bun, TypeScript (strict, `exactOptionalPropertyTypes`) |
| Styling | Tailwind CSS v4 with semantic tokens in `src/styles.css` |
| UI | shadcn-style components in `src/components/ui`, Recharts, lucide-react |
| Domain | Pure TypeScript modules in `src/lib/domain` (no framework coupling) |
| Persistence | Browser localStorage in this build; single adapter to swap for a database |

Brand palette: primary `#B02A30`, secondary `#F99D27`, accent `#005B75`, off-white neutrals.

## Environment variables

The evaluation build needs none. A future production profile might use:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of a case API |
| `DATABASE_URL` | Server-side database connection string |
| `SESSION_SECRET` | Session signing secret |
| `SSO_ISSUER`, `SSO_CLIENT_ID` | Enterprise identity provider |

Those variables are **not wired in this demo**. Client-visible values must use the `VITE_` prefix; everything else stays server-side.

## Security notes

- Role-based route guards; unauthorised roles are redirected before data loads.
- PII redaction (account, card, mobile, e-mail) in narratives, traces and exports.
- Mandatory human review for S1/S2, fraud, vulnerability, conduct and high-value redress.
- Append-only audit log of every state change, assignment, tool call and override.
- Overrides require a written justification recorded against the officer (four-eyes).
- No third-party analytics, no outbound calls; this build contacts no external service.

## Mapping to the specification

| Spec section | Where implemented |
|---|---|
| 2 Banking needs | `src/lib/domain/policy.ts`, `seed.ts` |
| 3.1 Key features | `src/routes/*`, `src/lib/domain/*` |
| 3.2 User journeys | `portal.tsx`, `desk.tsx`, `hitl.tsx`, `cases.$caseId.tsx` |
| 3.3 Role-based access | `src/lib/useAuthGuard.ts`, `AppShell.tsx` |
| 3.5 Security controls | `agents.ts` (redaction), `store.ts` (guards, audit) |
| 3.6 Audit & reporting | `audit.tsx`, `reports.tsx`, `metrics.ts` |
| 4 Administrator guide | Routing desk, policy library, reports, audit screens |

## License

MIT. See `LICENSE`.

You may use this code; this is not a bank production system and not a regulatory filing.
