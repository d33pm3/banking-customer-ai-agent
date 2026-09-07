**STATE BANK OF FARIDABAD**

**Customer Complaint Navigator**

Digital Banking Service & Grievance Platform --- Product Specification
and Administrator Guide

  -----------------------------------------------------------------------
  **Field**             **Value**
  --------------------- -------------------------------------------------
  Document title        Digital Banking Specification --- Customer
                        Complaint Navigator

  Version               1.1

  Date                  02 September 2026

  Owner                 Digital Channels & Customer Service Technology

  Status                For evaluation

  Classification        Confidential --- For Evaluation by Bank
                        Technology Team Only

  Companion artefacts   Digital_Banking_Offline_Demo.html,
                        Digital_Banking_Codebase.zip,
                        Digital_Banking_Codebase_Manifest.json, README.md
  -----------------------------------------------------------------------

Table of Contents

*Field-based contents. In Word press Ctrl+A then F9 (or right-click →
Update Field) to populate page numbers.*

1\. Product Overview

1.1 What the product is

Customer Complaint Navigator is a browser-based digital banking service
desk for State Bank of Faridabad. It receives customer complaints and
service requests from every channel, classifies and prioritises them
with four rule-driven AI agents, applies the bank\'s board-approved and
RBI-mandated redress rules, and routes anything sensitive to a human
officer before a decision reaches the customer.

1.2 Value proposition

*"Every customer grievance, from any channel, triaged in seconds,
redressed by real regulatory rules, and provable in an audit trail."*

1.3 Target users

  ------------------------------------------------------------------------
  **User**           **Primary need**                **Where they work**
  ------------------ ------------------------------- ---------------------
  Retail customer /  Raise a complaint, get a        Customer portal
  complainant        reference number, track status  
                     and compensation                

  Relationship       Handle branch-walk-in           Agent workbench
  manager / branch   complaints assigned to them     
  officer                                            

  Contact centre &   Handle phone, email, app and    Agent workbench
  digital desk       internet-banking complaints     
  officer                                            

  Grievance Handling Investigate escalations, apply  GHO workbench, policy
  Officer (GHO)      redress policy, draft           library
                     resolutions                     

  Branch admin       Assign and rebalance queues,    Routing desk,
                     monitor SLA in their branch     dashboard

  Compliance officer Review human-in-the-loop        HITL queue, audit,
                     decisions, audit trail,         reports
                     regulatory reports              

  System             Users, roles, products, limits, Admin console
  administrator      thresholds, monitoring, backups 
  ------------------------------------------------------------------------

1.4 Scope of this release

- In scope: complaint intake (branch, contact centre, email, digital,
  portal), AI triage, severity and SLA management, GHO redress
  calculation, human review, audit trail, reporting, admin
  configuration, live simulation for training.

- Out of scope for v1.0: core banking posting of compensation entries,
  outbound SMS/e-mail gateway, Ombudsman API filing, vernacular language
  packs.

2\. Banking Needs Addressed

The platform is organised around the products and service events that
generate the bank\'s complaint volume.

  -----------------------------------------------------------------------
  **Banking       **Typical customer        **How the platform handles
  domain**        issue**                   it**
  --------------- ------------------------- -----------------------------
  Savings &       Wrong charges, dormant    Auto-classified as service
  current         account reactivation,     failure; charge-refund
  accounts        statement errors,         workings computed from the
                  minimum-balance disputes  fee schedule

  Payments (UPI / Debit without credit,     RBI Harmonisation of TAT 2019
  IMPS / NEFT)    failed transfer, delayed  applied: T+1 auto-reversal,
                  reversal                  ₹100 per day of delay
                                            compensation

  Deposits        Premature closure         Deceased-claim master
                  penalty, interest         circular: 15-day TAT with
                  miscalculation,           penal interest above the
                  deceased-claim settlement applicable rate
                  delay                     

  Loans           Penal charge disputes,    Penal Charges in Loan
                  foreclosure statement     Accounts 2023: no
                  delay, recovery-agent     capitalisation, refund of
                  conduct                   excess; Fair Practices Code
                                            conduct investigation

  Cards           Unauthorised transaction, Limiting Liability 2017 (zero
                  closure delay, reward or  / capped / full liability by
                  chargeback dispute        reporting delay) and Card
                                            Master Direction 2022 (₹500
                                            per day closure delay)

  Cheques &       Delayed collection or     Cheque Collection Policy:
  collections     credit of instruments     interest at savings rate plus
                                            a spread for the delay period

  Service         Address / mobile update,  Logged as a request type with
  requests        chequebook, certificate   its own SLA clock and closure
                  requests                  evidence

  Grievance       Unsatisfactory response,  Escalation ladder with
  handling &      escalation to Nodal       deadlines, refusal reasons,
  escalation      Officer / Ombudsman       Ombudsman Scheme 2021
                                            signposting

  Compliance &    Regulator or internal     Immutable append-only audit
  audit           audit asks who decided    log of every state change,
                  what and why              tool call and human override
  -----------------------------------------------------------------------

3\. How the Product Solves These Problems

3.1 Key features

**Omni-channel intake**

Branch, contact centre, e-mail, mobile/internet banking and a public
customer portal all create one unified case number (UCN).

**Four-agent triage**

Branch Level, Contact Centre, Digital Desk and Grievance Handling
Officer agents each classify, score severity S1--S4, detect
vulnerability, fraud and staff-conduct markers, and set the SLA.

**Policy-driven redress engine**

Compensation is computed from a structured rule base, never a fixed
number; each amount carries its formula, inputs and citation.

**Human-in-the-loop control**

Any S1/S2, fraud, vulnerability, conduct or high-value case is held for
an authorised officer to approve, amend or reject with a mandatory
comment.

**Routing desk**

Manual and bulk assignment of cases to a named agent or team with full
audit of the reassignment.

**Customer portal**

Self-registration with a unique customer ID and PIN, complaint
submission, live status, timeline and redress visibility.

**Reporting**

Daily, weekly and monthly packs: volume by channel, agent productivity,
SLA compliance, refusals; CSV and PDF export.

**Simulation mode**

Replays real cases through the pipeline at 1x--8x speed for training,
UAT and demonstration without touching production data.

3.2 Core user journeys

3.2.1 Complaint lifecycle

Customer / channel

\|

v

\[ INTAKE \] classify -\> severity -\> markers -\> SLA clock starts

\|

+\--\> low risk, in policy \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--+

\| \|

v \|

\[ GHO REVIEW \] evidence + policy + redress calc \|

\| \|

v \|

\[ HITL \] human approve / amend / reject \|

\| \|

+\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--+\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--+

v

\[ RESOLVED \] -\> customer reply -\> \[ CLOSED \]

\|

+\--\> escalation -\> Nodal Officer -\> Ombudsman

3.2.2 Journey summaries

  -----------------------------------------------------------------------
  **Journey**        **Steps**                        **Outcome**
  ------------------ -------------------------------- -------------------
  Customer raises a  Register or sign in → choose     UCN issued
  complaint          product and channel → describe   instantly, SLA
                     issue → submit                   start time shown

  Agent works a case Open workbench queue → review    Case advances to
                     narrative and evidence → confirm the next valid
                     or override classification,      state only
                     severity, redress → submit       

  GHO decides        Retrieve policy → run calculator Non-binding redress
  redress            → review itemised workings →     with citations
                     draft decision and customer      attached to the
                     reply                            case

  Compliance reviews Open HITL queue → read agent     Decision and
                     findings → approve / amend /     comment written to
                     reject with comment              the audit log

  Admin reports      Choose period and agents →       Board /
                     generate → export                regulator-ready
                                                      pack in CSV or PDF
  -----------------------------------------------------------------------

3.3 Role-based access control

  ------------------------------------------------------------------------------------------------
  **Capability**        **Customer**   **Agent**   **GHO**   **Branch   **Compliance**   **Sys
                                                             admin**                     admin**
  --------------------- -------------- ----------- --------- ---------- ---------------- ---------
  Submit complaint      C              C           --        C          --               C

  View own case only    R              --          --        --         --               --

  Work assigned queue   --             RU          RU        R          R                R

  Compute / amend       --             --          RU        --         R                R
  redress                                                                                

  Approve HITL decision --             --          --        A          A                A

  Reassign / route      --             --          --        RU         R                RU
  cases                                                                                  

  Read audit trail      --             --          R         R          R                R

  Generate reports      --             --          R         R          R                R

  Configure users,      --             --          --        --         --               CRUD
  roles, limits                                                                          
  ------------------------------------------------------------------------------------------------

*Legend: C create, R read, U update, A approve, CRUD full control, -- no
access.*

3.4 RACI for grievance handling

  --------------------------------------------------------------------------------------
  **Activity**        **Responsible**   **Accountable**   **Consulted**   **Informed**
  ------------------- ----------------- ----------------- --------------- --------------
  Complaint capture   Channel agent     Branch admin      Customer        Customer
  and acknowledgement                                                     

  Classification and  AI triage agent   GHO               Channel agent   Branch admin
  severity                                                                

  Evidence collection Channel agent     GHO               Operations      Compliance

  Redress computation GHO               Compliance        Policy owner    Branch admin
                                        officer                           

  Human review of     Compliance        Principal Nodal   GHO             Customer
  sensitive cases     officer           Officer                           

  Customer            Channel agent     GHO               Compliance      Customer
  communication                                                           

  Escalation to       Principal Nodal   Head of Customer  Legal           Board
  Ombudsman           Officer           Service                           committee

  Policy rule change  Policy owner      Compliance        Technology      All agents
                                        officer                           
  --------------------------------------------------------------------------------------

3.5 Security and compliance controls

- Role-based route guards on every screen; a session without the
  required role is redirected before data loads.

- PII redaction: account numbers, card numbers, mobile numbers and
  e-mail addresses are masked in agent narratives, tool traces and
  exports.

- Human-in-the-loop gate: no S1/S2, fraud, vulnerability or conduct case
  can auto-close.

- State-machine guards reject any invalid transition, so a case cannot
  be closed, decided twice, or stranded between stages.

- Append-only audit log: actor, role, action, case, before/after state
  and timestamp for every event, exportable for inspection.

- Four-eyes principle on overrides: an override requires a mandatory
  free-text justification recorded against the officer.

- Regulatory alignment: RBI Harmonisation of TAT 2019, Limiting
  Liability 2017, Deceased Claims master circular, Card Master Direction
  2022, Fair Practices Code, Cheque Collection Policy, Penal Charges in
  Loan Accounts 2023, Integrated Ombudsman Scheme 2021.

- Data residency: the evaluation build keeps all data in the browser\'s
  local storage; the production profile targets an in-country managed
  database with encryption at rest and TLS 1.2+ in transit.

3.6 Audit logging and reporting

  ------------------------------------------------------------------------
  **Log / report**  **Contents**                           **Retention**
  ----------------- -------------------------------------- ---------------
  Case audit trail  Every state change, tool call,         10 years
                    assignment, override and comment       

  Access log        Sign-in, role assumed, screens         3 years
                    accessed                               

  Configuration log Rule, limit, threshold and user-role   10 years
                    changes with before/after              

  Daily summary     Volume, HITL pending, SLA breaches,    Rolling 24
                    refusals                               months

  Weekly            Agent productivity, average handling   Rolling 24
  performance       time, accuracy, HITL rate              months

  Monthly           Root-cause categories, redress paid,   10 years
  compliance pack   escalations, Ombudsman cases           
  ------------------------------------------------------------------------

4\. Administrator Guide

This section is the step-by-step operating manual for running the entire
web application. Perform each procedure with a system administrator
session unless stated otherwise.

4.1 First-time setup

1.  Open the application URL and sign in with the bootstrap
    administrator identity and PIN issued during handover.

2.  Change the bootstrap PIN immediately under Admin → Users → My
    credentials.

3.  Register the bank entity details: legal name, Nodal Officer,
    Principal Nodal Officer and Ombudsman office contact.

4.  Load the branch and department master before creating any user.

5.  Load the product master, then the policy rule set, then SLA
    thresholds.

6.  Create real user accounts and assign roles; disable all demo
    identities.

7.  Run one test complaint end to end and confirm it appears in the
    audit trail.

4.2 User and role management

1.  Go to Admin → Users. Select Add user and enter staff ID, full name,
    official e-mail, branch and department.

2.  Assign exactly one primary role: agent (branch / contact centre /
    digital), GHO, branch admin, compliance officer or system
    administrator.

3.  Set the queue membership that determines which cases the user can be
    assigned.

4.  Issue the initial PIN; the user must change it at first sign-in.

5.  To revoke access, set the user to Inactive --- never delete, because
    audit references must remain resolvable.

6.  Review the role register quarterly and record the review in the
    configuration log.

4.3 Branch and department setup

1.  Admin → Organisation → Branches: add branch code, name, region, IFSC
    and escalation contact.

2.  Create departments (Retail Operations, Cards, Digital Banking,
    Recovery, Deceased Claims) and map each to a default queue.

3.  Map each complaint category to the owning department so routing
    defaults are correct.

4.  Nominate a branch admin and a backup for every branch; queues must
    never have a single owner.

4.4 Product configuration

1.  Admin → Products: enable the products in use (savings, current, term
    deposit, loan, credit card, debit card, UPI, NEFT/IMPS/RTGS,
    lockers, cheque collection).

2.  For each product set the complaint categories, the responding
    department and the resolution SLA in working days.

3.  Attach the fee and charge schedule used by the refund workings.

4.  Publish the change; the version and effective date are stamped
    automatically.

4.5 Limits, thresholds and approvals

  -------------------------------------------------------------------------
  **Parameter**         **Default**        **Where set**  **Who may
                                                          change**
  --------------------- ------------------ -------------- -----------------
  Auto-approval redress ₹5,000             Admin → Limits System admin with
  ceiling                                                 compliance
                                                          sign-off

  Mandatory HITL        S1 and S2          Admin → Limits Compliance
  severity                                                officer

  Fraud / vulnerability Always HITL        Locked         Board policy only
  / conduct marker                                        

  SLA for               1 working day      Admin → SLA    Head of Customer
  acknowledgement                                         Service

  SLA for resolution    S1 3 days, S2 7    Admin → SLA    Head of Customer
                        days, S3 15 days,                 Service
                        S4 30 days                        

  Escalation trigger    80% of SLA elapsed Admin → SLA    Branch admin

  Bulk assignment cap   50 cases per       Admin → Limits System admin
                        action                            
  -------------------------------------------------------------------------

*Every limit change requires a maker and a separate checker; the
platform blocks self-approval.*

4.6 Policy and content management

1.  Open Policy Library to review the active rule set; each rule shows
    its identifier, formula, parameters and source citation.

2.  To amend a rule, create a new version with an effective date ---
    never edit history, because past cases must remain reproducible.

3.  Use the built-in calculator to test the amended rule against at
    least three historical cases before publishing.

4.  Update customer-facing content (portal help text, acknowledgement
    and closure templates, refusal reasons) under Admin → Content, and
    have Compliance approve the wording.

4.7 Monitoring and alerts

1.  Watch the dashboard tiles daily: open cases, HITL pending, SLA
    breaches, high-severity volume.

2.  Configure alerts for: SLA breach imminent, HITL queue older than 24
    hours, redress above the ceiling, agent queue over capacity, failed
    intake submissions.

3.  Review the agent leaderboard weekly for accuracy and handling-time
    outliers.

4.  Investigate any case that stays in one state longer than its stage
    threshold.

4.8 Backup and restore

1.  Evaluation build: use Admin → Data → Export snapshot to download the
    full case, audit and configuration set as JSON. Do this before any
    configuration change and at end of day.

2.  To restore, use Import snapshot and select the JSON file; the
    platform validates schema version before applying.

3.  Production profile: nightly full database backup plus continuous
    transaction-log shipping, encrypted, with a monthly restore
    rehearsal recorded in the change log.

4.9 Disaster recovery

  -----------------------------------------------------------------------
  **Item**                     **Target**
  ---------------------------- ------------------------------------------
  Recovery Point Objective     15 minutes
  (RPO)                        

  Recovery Time Objective      4 hours
  (RTO)                        

  Standby                      Warm standby in a second in-country region

  Failover test                Half-yearly, results filed with Compliance

  Degraded mode                Intake continues offline in the browser
                               and syncs when service returns
  -----------------------------------------------------------------------

4.10 Change management

1.  Raise a change request describing the change, risk, rollback and
    test evidence.

2.  Obtain approval from the application owner and, for policy or limit
    changes, from Compliance.

3.  Deploy to the staging environment and run the regression pack,
    including the twelve reference cases.

4.  Deploy to production in the approved window; record the version
    number in the release register.

5.  Verify post-deployment health checks and close the change with
    evidence attached.

4.11 Daily administrator checklist

- [ ] Overnight alerts reviewed and cleared

- [ ] HITL queue below the agreed age limit

- [ ] SLA breach list actioned

- [ ] Failed intake submissions retried

- [ ] Snapshot / backup verified

- [ ] User access requests processed

- [ ] Configuration changes logged

4.12 Monthly compliance checklist

- [ ] Monthly compliance pack generated and signed

- [ ] Redress paid reconciled with finance

- [ ] Role register reviewed

- [ ] Policy versions verified against the latest circulars

- [ ] Restore rehearsal completed

- [ ] Ombudsman cases reconciled

- [ ] Open audit findings tracked

4.13 Administration console as built

The administration console is implemented in the codebase at
`src/routes/admin.tsx`, backed by `src/lib/domain/admin.ts`. It is visible only to
users holding the `admin` role and is reached from the sidebar item
**Administration**. Configuration is stored in the browser storage adapter under the
`acrs.admin.*` keys and is read by the live workflow engine on every case.

  ------------------------------------------------------------------------
  **Tab**            **What it controls**              **Effect on processing**
  ------------------ --------------------------------- ---------------------------
  Users & roles      Staff records: user ID, display    Disabled staff cannot sign
                     name, role, branch, active flag    in; the sign-in list hides
                                                        them and the attempt is
                                                        written to the audit log

  Branches           Branch code, name, region          Drives ownership of branch
                                                        channel cases and reporting

  Products & SLA     Product enablement and             Disabled products disappear
                     resolution SLA in days             from the staff intake form
                                                        and the customer portal; a
                                                        tighter SLA shortens the
                                                        computed deadline

  Limits & approvals Auto-approval redress ceiling,     Any GHO estimate above the
                     acknowledgement SLA, mandatory     ceiling, or any case in a
                     review severities                  mandatory-review severity,
                                                        is forced into the human
                                                        review queue

  Policy             Approval or withdrawal of a        Withdrawn documents are
  administration     circular and live editing of rule  rejected by the redress
                     parameters (for example the TAT    engine; amended parameters
                     compensation rate)                 change every subsequent
                                                        calculation and are cited in
                                                        the workings
  ------------------------------------------------------------------------

Every change is applied through `applyPolicyOverrides()`, which re-projects the
administrator amendments onto the in-memory rule book at application start, so a
reload never silently reverts a configuration change. Amendments are additive
overrides: the shipped regulatory baseline remains in the codebase and can be
restored by clearing the override record.

4.14 Offline demo data sharing

`Digital_Banking_Offline_Demo.html` embeds the compiled domain layer of the
application — the same agent pipeline, policy database and metric functions — and
reads and writes the same storage keys (`acrs.cases.v1`, `acrs.audit.v1`,
`acrs.admin.*`). When the file is served from the application origin (for example
`/demo.html`), it shows the live case list, live metrics and the live administration
configuration, and any complaint raised inside the demo appears in the main
application. When the file is opened directly from disk, the browser gives it a
separate storage origin; the header therefore offers **Export** and **Import** so a
snapshot can be moved between the two.



5\. Technical Summary

  ------------------------------------------------------------------------
  **Layer**      **Technology**               **Notes**
  -------------- ---------------------------- ----------------------------
  Frontend       React 19, TanStack Start v1, File-based routing under
                 TanStack Router              src/routes

  Styling        Tailwind CSS v4 with         Brand palette: #B02A30,
                 semantic tokens in           #F99D27, #005B75
                 src/styles.css               

  Charts         Recharts                     Dashboard and report
                                              visualisations

  Domain logic   TypeScript modules under     agents, engine, policy,
                 src/lib/domain               store, metrics, simulation

  Persistence    Browser local storage        Single storage adapter to
                 (evaluation) / managed       swap
                 Postgres (production         
                 profile)                     

  Build          Vite 7, bun                  bun install; bun run dev;
                                              bun run build
  ------------------------------------------------------------------------

5.1 Mapping to companion artefacts

  ----------------------------------------------------------------------------------------
  **Artefact**                             **Purpose**                  **Maps to**
  ---------------------------------------- ---------------------------- ------------------
  Digital_Banking_Specification.docx       This document                All sections

  Digital_Banking_Offline_Demo.html        Single-file offline demo of  Sections 3.1, 3.2
                                           login, dashboard, accounts,  
                                           transfer, service request,   
                                           admin                        

  Digital_Banking_Codebase.zip             Full reviewable source       Section 5

  Digital_Banking_Codebase_Manifest.json   Path + content listing of    Section 5
                                           every source file            

  README.md                                Architecture, run, deploy,   Sections 3.5, 5
                                           environment, security        
  ----------------------------------------------------------------------------------------

*Version 1.1 --- 02 September 2026 --- Confidential --- For Evaluation
by Bank Technology Team Only*
