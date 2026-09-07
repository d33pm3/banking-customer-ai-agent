/* Offline demo UI — runs on the SAME localStorage schema as the live app. */
(function () {
"use strict";
var C = window.CCN;
var K = { cases: "acrs.cases.v1", audit: "acrs.audit.v1", session: "acrs.demo.session.v1" };

function read(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
var sameOrigin = location.protocol !== "file:";

var USERS = {
  "asha@demo":    { pin: "1234", name: "Asha Rao",        role: "Retail customer",       key: "customer" },
  "rm@demo":      { pin: "1234", name: "Vikram Singh",    role: "Relationship manager",  key: "staff" },
  "gho@demo":     { pin: "1234", name: "Anil Chauhan",    role: "Grievance Handling Officer", key: "staff" },
  "admin@demo":   { pin: "1234", name: "D. Mendiratta",   role: "System administrator",  key: "admin" }
};

var ACCOUNTS = [
  { no: "XXXX4417", type: "Savings", branch: "Faridabad Sector 16", bal: 284310.55 },
  { no: "XXXX9902", type: "Current", branch: "Faridabad NIT", bal: 918450.00 },
  { no: "XXXX3311", type: "Term deposit", branch: "Ballabgarh", bal: 100109.80 }
];
var TXNS = [
  { d: "2026-09-01", t: "UPI/Grocery Mart", a: -1240 , s: "Posted" },
  { d: "2026-08-31", t: "Salary credit", a: 96500, s: "Posted" },
  { d: "2026-08-30", t: "NEFT to Ramesh Kumar", a: -15000, s: "Posted" },
  { d: "2026-08-29", t: "Card annual fee", a: -999, s: "Disputed" }
];

var state = { user: null, view: "dash", selected: null, flash: null };

/* ------------------------- shared case store ------------------------- */
function ensureCases() {
  var cases = read(K.cases, []);
  if (cases && cases.length) return cases;
  var raws = C.DEMO_CASES.concat(C.generateExtraCases(18));
  cases = raws.map(C.processCase);
  write(K.cases, cases);
  return cases;
}
function getCases() { return read(K.cases, []); }
function saveCases(c) { write(K.cases, c); }
function logAudit(actor, action, caseId, details) {
  var a = read(K.audit, []);
  a.push({ id: "AUD-" + Date.now() + "-" + Math.floor(Math.random() * 9999), at: new Date().toISOString(),
    actor: actor, action: action, case_id: caseId || null, details: details || {}, ip: "offline-demo" });
  write(K.audit, a.slice(-2000));
}

/* ------------------------------ helpers ------------------------------ */
var inr = function (n) { return (n < 0 ? "-" : "") + "\u20B9" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };
var kpi = function (l, v, c) { return '<div class="card kpi ' + (c || "") + '"><small>' + l + "</small><strong>" + v + "</strong></div>"; };
var sevPill = function (s) { return '<span class="pill p-' + String(s || "").toLowerCase() + '">' + esc(s || "—") + "</span>"; };

/* ------------------------------- views ------------------------------- */
function loginView() {
  return '<div class="login-wrap card"><h1>Sign in</h1><p class="sub">Demo credentials — PIN <b>1234</b> for every account.</p>' +
    '<div class="field"><label>User</label><select id="uid">' +
    Object.keys(USERS).map(function (u) { return '<option value="' + u + '">' + u + " — " + USERS[u].role + "</option>"; }).join("") +
    '</select></div><div class="field"><label>PIN</label><input id="pin" type="password" value="1234" /></div>' +
    '<button class="btn" type="submit">Sign in</button>' +
    '<p class="small" style="margin-top:14px">' + (sameOrigin
      ? "Connected to the live application's browser storage — cases you raise here appear in the main app."
      : "Opened as a standalone file, so this copy keeps its own snapshot. Use <b>Import</b> in the header to load a snapshot exported from the live app.") +
    "</p></div>";
}

function dashView() {
  var cases = getCases();
  var s = C.summarise(cases);
  var open = cases.filter(function (c) { return c.status !== "CLOSED_DEMO"; }).length;
  var hitl = cases.filter(function (c) { return c.status === "HITL_REQUIRED"; }).length;
  var breached = cases.filter(function (c) { return C.isBreached(c); }).length;
  var bySeverity = C.byField(cases, function (c) { return c.severity; });
  var byStatus = C.byField(cases, function (c) { return c.status; });
  var stats = C.agentStats(cases);
  var max = Math.max.apply(null, byStatus.map(function (r) { return r.value; }).concat([1]));
  return '<h1>Good day, ' + esc(state.user.name.split(" ")[0]) + "</h1>" +
    '<p class="sub">Live grievance metrics, computed from the same case store as the main application.</p>' +
    '<div class="grid g4">' +
      kpi("Total cases", cases.length) + kpi("Open", open, "o") +
      kpi("Awaiting human review", hitl, "a") + kpi("SLA breached", breached, breached ? "" : "g") +
    "</div>" +
    '<div class="grid g2" style="margin-top:16px">' +
      '<div class="card"><h2>Pipeline by state</h2>' +
        byStatus.map(function (r) {
          return '<div class="barrow"><span>' + esc(r.name.replace(/_/g, " ").toLowerCase()) + "</span><b>" + r.value + "</b></div>" +
            '<div class="bar"><i style="width:' + Math.round((r.value / max) * 100) + '%"></i></div>';
        }).join("") + "</div>" +
      '<div class="card"><h2>Severity mix &amp; agent load</h2><table><thead><tr><th>Severity</th><th>Cases</th></tr></thead><tbody>' +
        bySeverity.map(function (r) { return "<tr><td>" + sevPill(r.name) + "</td><td>" + r.value + "</td></tr>"; }).join("") +
        '</tbody></table><table style="margin-top:12px"><thead><tr><th>Agent</th><th>Cases</th><th>Avg mins</th></tr></thead><tbody>' +
        stats.map(function (a) { return "<tr><td>" + esc(a.label || a.agent) + "</td><td>" + a.total + "</td><td>" + (a.avgMinutes != null ? a.avgMinutes.toFixed(1) : "—") + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
    "</div>" +
    '<p class="small" style="margin-top:12px">SLA compliance <b>' + s.slaCompliance.toFixed(1) + "%</b> · classification accuracy <b>" +
    s.accuracy.toFixed(0) + "%</b> · refusals applied <b>" + s.refusals + "</b> · PII redacted in <b>" + s.piiRedacted + "</b> cases.</p>";
}

function queueView() {
  var cases = getCases().slice().sort(function (a, b) { return (b.received_at || "").localeCompare(a.received_at || ""); });
  if (state.selected) return caseDetail(state.selected);
  return "<h1>Case queue</h1><p class=\"sub\">Every case in the shared store, exactly as the four agents left it.</p>" +
    '<div class="card"><table><thead><tr><th>Case</th><th>Product</th><th>Class</th><th>Severity</th><th>State</th><th>Redress</th><th></th></tr></thead><tbody>' +
    cases.slice(0, 40).map(function (c) {
      var r = redressOf(c);
      return "<tr><td class=\"mono\">" + esc(c.case_id) + "</td><td>" + esc(c.product) + "</td><td>" + esc(c.classification || "—") +
        "</td><td>" + sevPill(c.severity) + "</td><td>" + esc(String(c.status).replace(/_/g, " ").toLowerCase()) + "</td><td>" +
        (r ? inr(r.calculated_amount) : "—") + '</td><td><button class="btn ghost" data-case="' + esc(c.case_id) + '">Open</button></td></tr>';
    }).join("") + "</tbody></table></div>";
}

function redressOf(c) {
  var out = (c.agent_outputs || []).filter(function (o) { return o && o.redress; });
  return out.length ? out[out.length - 1].redress : null;
}

function caseDetail(id) {
  var c = getCases().filter(function (x) { return x.case_id === id; })[0];
  if (!c) return "<p>Case not found.</p>";
  var r = redressOf(c);
  var last = (c.agent_outputs || [])[c.agent_outputs.length - 1] || {};
  return '<button class="btn ghost" id="backq">&larr; Back to queue</button><h1 style="margin-top:10px">' + esc(c.case_id) + "</h1>" +
    '<p class="sub">' + esc(c.product) + " · " + esc(c.source_channel) + " · received " + esc((c.received_at || "").slice(0, 10)) + "</p>" +
    '<div class="grid g2"><div class="card"><h2>Assessment</h2><table><tbody>' +
      row("Classification", esc(c.classification || "—")) + row("Severity", sevPill(c.severity)) +
      row("State", esc(String(c.status).replace(/_/g, " ").toLowerCase())) +
      row("Assigned agent", esc(C.AGENT_LABEL[c.assigned_agent] || c.assigned_agent || "—")) +
      row("Deadline", c.deadline ? esc(c.deadline.date.slice(0, 10)) + " <span class=\"small\">(" + esc(c.deadline.source_rule) + ")</span>" : "—") +
      row("Human review", c.hitl_required ? '<span class="pill p-warn">Required</span>' : '<span class="pill p-ok">Not required</span>') +
      "</tbody></table>" +
      '<h2 style="margin-top:14px">Narrative (PII redacted)</h2><p class="small">' + esc(c.narrative) + "</p></div>" +
    '<div class="card"><h2>Redress workings</h2>' +
      (r ? '<table><tbody>' + row("Policy version", esc(r.policy_version)) + row("Event type", esc(r.event_type)) +
            row("Amount", "<b>" + inr(r.calculated_amount) + "</b>") + "</tbody></table>" +
            "<ul class=\"clean small\">" + (r.components || []).map(function (x) {
              return "<li><b>" + esc(x.label) + "</b> — " + inr(x.amount) + "<br/>" + esc(x.working) + " <span class=\"mono\">" + esc(x.rule) + "</span></li>";
            }).join("") + "</ul>"
        : '<p class="small">No monetary redress computed under the approved policy.</p>') +
      '<h2 style="margin-top:14px">Drafted decision</h2><p class="small">' +
      esc((last.resolution && (last.resolution.decision || last.resolution.summary)) || "Pending agent decision.") + "</p></div></div>" +
    '<div class="card" style="margin-top:16px"><h2>Audit timeline</h2><table><thead><tr><th>When</th><th>Actor</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>' +
    (c.traces || []).map(function (t) {
      return "<tr><td class=\"small\">" + esc(new Date(t.event_at).toLocaleString()) + "</td><td>" + esc(t.actor) + "</td><td class=\"small\">" +
        esc(t.state_before) + "</td><td class=\"small\">" + esc(t.state_after) + "</td><td class=\"small\">" + esc(t.reason) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
}
function row(k, v) { return "<tr><td>" + k + "</td><td style=\"text-align:right\">" + v + "</td></tr>"; }

function accountsView() {
  return "<h1>Accounts overview</h1><p class=\"sub\">Illustrative relationship data for the signed-in customer.</p>" +
    '<div class="grid g2"><div class="card"><h2>Accounts</h2><table><thead><tr><th>Account</th><th>Type</th><th>Branch</th><th style="text-align:right">Balance</th></tr></thead><tbody>' +
    ACCOUNTS.map(function (a) { return '<tr><td class="mono">' + a.no + "</td><td>" + a.type + "</td><td>" + a.branch + '</td><td style="text-align:right">' + inr(a.bal) + "</td></tr>"; }).join("") +
    '</tbody></table></div><div class="card"><h2>Recent transactions</h2><table><thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>' +
    TXNS.map(function (t) { return "<tr><td>" + t.d + "</td><td>" + t.t + '</td><td style="text-align:right;color:' + (t.a < 0 ? "var(--primary)" : "var(--ok)") + '">' + inr(t.a) + '</td><td><span class="pill ' + (t.s === "Disputed" ? "p-warn" : "p-ok") + '">' + t.s + "</span></td></tr>"; }).join("") +
    "</tbody></table></div></div>";
}

function transferView() {
  var t = C.getThresholds();
  return "<h1>Funds transfer</h1><p class=\"sub\">Mock transfer — no money moves. Daily limit enforced from the administrator configuration.</p>" +
    '<div class="grid g2"><div class="card"><div class="field"><label>From account</label><select id="from">' +
    ACCOUNTS.map(function (a) { return '<option value="' + a.no + '">' + a.no + " — " + a.type + " (" + inr(a.bal) + ")</option>"; }).join("") +
    '</select></div><div class="field"><label>Beneficiary</label><input id="ben" value="Ramesh Kumar" /></div>' +
    '<div class="field"><label>Amount (INR)</label><input id="amt" type="number" value="2500" /></div>' +
    '<div class="field"><label>Mode</label><select id="mode"><option>IMPS</option><option>NEFT</option><option>UPI</option></select></div>' +
    '<button class="btn" type="submit">Transfer</button></div>' +
    '<div class="card"><h2>Limits in force</h2><table><tbody>' + row("Daily transfer limit (retail)", inr(200000)) +
    row("Auto-approval redress ceiling", inr(t.auto_approve_ceiling)) + row("Acknowledgement SLA", t.ack_sla_days + " working day(s)") +
    "</tbody></table><div id=\"tout\"></div></div></div>";
}

function serviceView() {
  var prods = C.getProducts().filter(function (p) { return p.enabled; });
  return "<h1>Service request / complaint</h1><p class=\"sub\">Submitted through the real agent pipeline — the case is written to the shared store with its full audit trail.</p>" +
    '<div class="grid g2"><div class="card">' +
    '<div class="field"><label>Product</label><select id="prod">' + prods.map(function (p) { return '<option value="' + p.value + '">' + esc(p.label) + "</option>"; }).join("") + "</select></div>" +
    '<div class="field"><label>Channel</label><select id="chan">' + C.CHANNELS.map(function (c) { return '<option value="' + c.value + '">' + esc(c.label) + "</option>"; }).join("") + "</select></div>" +
    '<div class="field"><label>Incident date</label><input id="idate" type="date" value="' + new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10) + '" /></div>' +
    '<div class="field"><label>Describe the issue</label><textarea id="desc" rows="5">\u20B94,500 was debited for a UPI payment on 28 August but the beneficiary never received it. No reversal so far.</textarea></div>' +
    '<button class="btn" type="submit">Submit request</button></div>' +
    '<div class="card" id="triage"><h2>Agent outcome</h2><p class="small">Submit the form to run the branch / contact centre / digital agent and the grievance officer.</p></div></div>';
}

function policyView() {
  return "<h1>Policy library &amp; redress calculator</h1><p class=\"sub\">The same rule book the live application uses, including any administrator amendments stored in this browser.</p>" +
    '<div class="grid g2"><div class="card"><h2>Calculator</h2>' +
    '<div class="field"><label>Event</label><select id="cev"><option value="failed_payment">Failed payment</option><option value="unauthorised_transaction">Unauthorised transaction</option><option value="delay">Service delay</option><option value="fee">Wrong fee</option></select></div>' +
    '<div class="field"><label>Product</label><select id="cpr">' + C.PRODUCTS.map(function (p) { return '<option value="' + p.value + '">' + esc(p.label) + "</option>"; }).join("") + "</select></div>" +
    '<div class="field"><label>Amount</label><input id="cam" type="number" value="4500" /></div>' +
    '<div class="field"><label>Delay (days)</label><input id="cdl" type="number" value="6" /></div>' +
    '<div class="field"><label>Reported after (days)</label><input id="crp" type="number" value="3" /></div>' +
    '<button class="btn" id="calc" type="button">Calculate</button><div id="cout"></div></div>' +
    '<div class="card"><h2>Approved documents</h2><ul class="clean small">' +
    C.POLICY_DB.map(function (d) { return "<li><b>" + esc(d.doc_id) + "</b> — " + esc(d.title) + '<br/><span class="mono">' + esc(d.reference) + "</span> · " + (d.approved ? "approved" : "withdrawn") + "</li>"; }).join("") +
    "</ul></div></div>";
}

function adminView() {
  var staff = C.getStaff(), prods = C.getProducts(), th = C.getThresholds(), branches = C.getBranches();
  var audit = read(K.audit, []).slice(-8).reverse();
  return "<h1>Admin panel</h1><p class=\"sub\">Reads and writes the same administration configuration as the live console.</p>" +
    '<div class="grid g4">' + kpi("Staff", staff.length, "a") + kpi("Branches", branches.length, "o") +
    kpi("Products enabled", prods.filter(function (p) { return p.enabled; }).length) + kpi("Audit events", audit.length, "g") + "</div>" +
    '<div class="card" style="margin-top:16px"><h2>Users and roles</h2><table><thead><tr><th>User</th><th>Role</th><th>Branch</th><th>Status</th><th></th></tr></thead><tbody>' +
    staff.slice(0, 12).map(function (s) {
      return '<tr><td class="mono">' + esc(s.user_id) + "</td><td>" + esc(C.ROLE_LABEL[s.role] || s.role) + "</td><td>" + esc(s.branch_code) +
        '</td><td><span class="pill ' + (s.active ? "p-ok" : "p-red") + '">' + (s.active ? "Active" : "Disabled") +
        '</span></td><td><button class="btn ghost" data-staff="' + esc(s.user_id) + '">' + (s.active ? "Disable" : "Enable") + "</button></td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Products &amp; SLA</h2><table><thead><tr><th>Product</th><th>Resolution SLA</th><th></th></tr></thead><tbody>' +
    prods.map(function (p) {
      return "<tr><td>" + esc(p.label) + "</td><td>" + p.resolution_sla_days + ' days</td><td><button class="btn ghost" data-prod="' + esc(p.value) + '">' + (p.enabled ? "Disable" : "Enable") + "</button></td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<div class="card"><h2>Limits &amp; approvals</h2><div class="field"><label>Auto-approval redress ceiling (INR)</label><input id="ceil" type="number" value="' + th.auto_approve_ceiling + '" /></div>' +
    '<div class="field"><label>Acknowledgement SLA (days)</label><input id="ack" type="number" value="' + th.ack_sla_days + '" /></div>' +
    '<button class="btn" id="savelim" type="button">Save limits</button>' +
    '<h2 style="margin-top:14px">Recent audit</h2><ul class="clean small">' +
    audit.map(function (a) { return "<li>" + esc(new Date(a.at).toLocaleString()) + " · <b>" + esc(a.actor) + "</b> · " + esc(a.action) + (a.case_id ? " · " + esc(a.case_id) : "") + "</li>"; }).join("") +
    "</ul></div></div>";
}

/* ------------------------------- routing ------------------------------ */
var PAGES = {
  dash:     { label: "Dashboard",  view: dashView,     roles: ["customer", "staff", "admin"] },
  accounts: { label: "Accounts",   view: accountsView, roles: ["customer", "staff", "admin"] },
  transfer: { label: "Funds transfer", view: transferView, roles: ["customer", "staff", "admin"] },
  service:  { label: "Service request", view: serviceView, roles: ["customer", "staff", "admin"] },
  queue:    { label: "Case queue", view: queueView,    roles: ["staff", "admin"] },
  policy:   { label: "Policy & redress", view: policyView, roles: ["staff", "admin"] },
  admin:    { label: "Admin panel", view: adminView,   roles: ["admin"] }
};

function render() {
  var appbar = document.getElementById("appbar"), main = document.getElementById("main");
  if (!state.user) {
    appbar.hidden = true;
    main.innerHTML = '<form id="loginform">' + loginView() + "</form>";
  } else {
    appbar.hidden = false;
    var keys = Object.keys(PAGES).filter(function (k) { return PAGES[k].roles.indexOf(state.user.key) >= 0; });
    if (keys.indexOf(state.view) < 0) state.view = "dash";
    document.getElementById("nav").innerHTML = keys.map(function (k) {
      return '<button data-nav="' + k + '"' + (state.view === k ? ' aria-current="page"' : "") + ">" + PAGES[k].label + "</button>";
    }).join("");
    document.getElementById("who").innerHTML = "<b>" + esc(state.user.name) + "</b><br/>" + esc(state.user.role) +
      ' <button class="btn ghost" id="logout">Sign out</button>';
    main.innerHTML = '<form id="pageform">' + (state.flash || "") + PAGES[state.view].view() + "</form>";
    state.flash = null;
  }
  document.getElementById("source").textContent = sameOrigin
    ? "Shared storage: live application data"
    : "Standalone file: local snapshot";
  wire();
}

/* -------------------------------- wiring ------------------------------ */
function wire() {
  var lf = document.getElementById("loginform");
  if (lf) {
    lf.onsubmit = function (e) {
      e.preventDefault();
      var id = document.getElementById("uid").value, pin = document.getElementById("pin").value;
      if (!USERS[id] || USERS[id].pin !== pin) { alert("Invalid demo credentials — the PIN is 1234."); return; }
      state.user = USERS[id]; state.view = "dash";
      write(K.session, { id: id });
      ensureCases();
      logAudit(USERS[id].name, "demo_sign_in", null, { role: USERS[id].role });
      render();
    };
    return;
  }
  var nav = document.getElementById("nav");
  if (nav) nav.onclick = function (e) {
    var b = e.target.closest("[data-nav]"); if (!b) return;
    state.view = b.getAttribute("data-nav"); state.selected = null; render();
  };
  var out = document.getElementById("logout");
  if (out) out.onclick = function () { logAudit(state.user.name, "demo_sign_out", null, {}); state.user = null; localStorage.removeItem(K.session); render(); };

  var form = document.getElementById("pageform");
  if (!form) return;
  form.onsubmit = function (e) { e.preventDefault(); submitPage(); };
  form.onclick = function (e) {
    var openBtn = e.target.closest("[data-case]");
    if (openBtn) { state.selected = openBtn.getAttribute("data-case"); render(); return; }
    if (e.target.id === "backq") { state.selected = null; render(); return; }
    var st = e.target.closest("[data-staff]");
    if (st) {
      var rows = C.getStaff().map(function (s) { return s.user_id === st.getAttribute("data-staff") ? Object.assign({}, s, { active: !s.active }) : s; });
      C.setStaff(rows); logAudit(state.user.name, "admin_user_toggled", null, { user_id: st.getAttribute("data-staff") }); render(); return;
    }
    var pr = e.target.closest("[data-prod]");
    if (pr) {
      var ps = C.getProducts().map(function (p) { return p.value === pr.getAttribute("data-prod") ? Object.assign({}, p, { enabled: !p.enabled }) : p; });
      C.setProducts(ps); logAudit(state.user.name, "admin_product_toggled", null, { product: pr.getAttribute("data-prod") }); render(); return;
    }
    if (e.target.id === "savelim") {
      C.setThresholds({ auto_approve_ceiling: Number(document.getElementById("ceil").value) || 0,
                        ack_sla_days: Number(document.getElementById("ack").value) || 1 });
      logAudit(state.user.name, "admin_threshold_updated", null, {});
      state.flash = '<div class="ok-msg">Limits saved — new cases use them immediately.</div>'; render(); return;
    }
    if (e.target.id === "calc") { runCalc(); return; }
  };
}

function submitPage() {
  if (state.view === "transfer") {
    var amt = Number(document.getElementById("amt").value) || 0;
    var ben = document.getElementById("ben").value;
    var box = document.getElementById("tout");
    if (amt <= 0) { box.innerHTML = '<div class="notice">Enter an amount greater than zero.</div>'; return; }
    if (amt > 200000) { box.innerHTML = '<div class="notice">Above the ' + inr(200000) + " daily limit for retail customers.</div>"; return; }
    var ref = "TXN" + Math.floor(Math.random() * 9e7 + 1e7);
    logAudit(state.user.name, "funds_transfer_mock", null, { ref: ref, amount: amt, to: ben });
    box.innerHTML = '<div class="ok-msg">Mock transfer <b>' + ref + "</b> of " + inr(amt) + " to " + esc(ben) + " accepted. No real money moved.</div>";
    return;
  }
  if (state.view === "service") {
    var product = document.getElementById("prod").value;
    var channel = document.getElementById("chan").value;
    var narrative = document.getElementById("desc").value.trim();
    var incident = document.getElementById("idate").value;
    if (narrative.length < 15) { document.getElementById("triage").innerHTML = '<h2>Agent outcome</h2><div class="notice">Please describe the issue in a little more detail.</div>'; return; }
    var id = "UCN-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9e5 + 1e5));
    var raw = {
      case_id: id, source_channel: channel, received_at: new Date().toISOString(),
      customer_token: "CUST-" + (state.user.name.split(" ")[0] || "DEMO").toUpperCase(),
      language: "en", product: product, narrative: narrative,
      incident_date: incident ? new Date(incident).toISOString() : null,
      attachment_refs: [], authority_status: "self", consent_status: "granted"
    };
    var rec = C.processCase(raw);
    var all = getCases(); all.unshift(rec); saveCases(all);
    (rec.traces || []).forEach(function (t, i) { logAudit(t.actor, "state_" + String(t.state_after).toLowerCase(), id, { from: t.state_before, to: t.state_after, reason: t.reason }); });
    var r = redressOf(rec);
    document.getElementById("triage").innerHTML = "<h2>Agent outcome</h2>" +
      '<div class="ok-msg">Case <b>' + esc(id) + "</b> created and processed by " + esc(C.AGENT_LABEL[rec.assigned_agent] || rec.assigned_agent) + ".</div>" +
      "<table><tbody>" + row("Classification", esc(rec.classification || "—")) + row("Severity", sevPill(rec.severity)) +
      row("State", esc(String(rec.status).replace(/_/g, " ").toLowerCase())) +
      row("Deadline", rec.deadline ? esc(rec.deadline.date.slice(0, 10)) : "—") +
      row("Indicative redress", r ? "<b>" + inr(r.calculated_amount) + "</b>" : "—") +
      row("Policy applied", r ? esc(r.policy_version) : "—") +
      row("Human review", rec.hitl_required ? '<span class="pill p-warn">Required</span>' : '<span class="pill p-ok">Not required</span>') +
      "</tbody></table>" +
      (r ? '<ul class="clean small">' + (r.components || []).map(function (x) { return "<li>" + esc(x.label) + " — " + inr(x.amount) + "<br/>" + esc(x.working) + "</li>"; }).join("") + "</ul>" : "") +
      '<p class="small">' + (sameOrigin ? "This case is now visible in the live application's case list." : "Export the snapshot from the header to load this case into the live application.") + "</p>";
    return;
  }
}

function runCalc() {
  var ev = document.getElementById("cev").value, pr = document.getElementById("cpr").value;
  var out = document.getElementById("cout");
  try {
    var res = C.computeRedress({
      case_id: "CALC", event_type: ev, product: pr, policy_version: C.policyVersionFor(ev, pr),
      amount: Number(document.getElementById("cam").value) || 0,
      delay_days: Number(document.getElementById("cdl").value) || 0,
      reported_after_days: Number(document.getElementById("crp").value) || 0
    });
    out.innerHTML = '<div class="ok-msg">Indicative redress <b>' + inr(res.calculated_amount) + "</b> under " + esc(res.policy_version) + "</div>" +
      '<ul class="clean small">' + (res.components || []).map(function (c) { return "<li><b>" + esc(c.label) + "</b> — " + inr(c.amount) + "<br/>" + esc(c.working) + ' <span class="mono">' + esc(c.rule) + "</span></li>"; }).join("") + "</ul>";
  } catch (err) { out.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; }
}

/* --------------------------- import / export -------------------------- */
function exportSnapshot() {
  var snap = {};
  ["acrs.cases.v1", "acrs.audit.v1", "acrs.admin.staff.v1", "acrs.admin.branches.v1",
   "acrs.admin.products.v1", "acrs.admin.thresholds.v1", "acrs.admin.policy.v1"].forEach(function (k) {
    var v = localStorage.getItem(k); if (v) snap[k] = v;
  });
  var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "complaint-navigator-snapshot.json"; a.click();
}
function importSnapshot(file) {
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var snap = JSON.parse(fr.result);
      Object.keys(snap).forEach(function (k) { localStorage.setItem(k, snap[k]); });
      C.applyPolicyOverrides();
      alert("Snapshot imported — " + getCases().length + " cases loaded.");
      render();
    } catch (e) { alert("That file is not a valid snapshot."); }
  };
  fr.readAsText(file);
}

/* --------------------------------- boot ------------------------------- */
window.addEventListener("DOMContentLoaded", function () {
  C.applyPolicyOverrides();
  var s = read(K.session, null);
  if (s && USERS[s.id]) { state.user = USERS[s.id]; ensureCases(); }
  document.getElementById("exp").onclick = exportSnapshot;
  document.getElementById("imp").onclick = function () { document.getElementById("impf").click(); };
  document.getElementById("impf").onchange = function (e) { if (e.target.files[0]) importSnapshot(e.target.files[0]); };
  window.addEventListener("storage", function () { if (state.user) render(); });
  render();
});
})();
