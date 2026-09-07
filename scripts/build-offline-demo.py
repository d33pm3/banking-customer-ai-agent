import pathlib
core = pathlib.Path('/tmp/gen/ccn-core.js').read_text()
ui = pathlib.Path('/tmp/gen/demo-ui.js').read_text()
css = """
:root{--primary:#B02A30;--secondary:#F99D27;--accent:#005B75;--bg:#FAF8F6;--panel:#fff;--text:#1B1B1F;--muted:#5F6470;--border:#E6E1DC;--ok:#1F7A4D;--warn:#8A5A00;}
*{box-sizing:border-box}body{margin:0;font-family:"Plus Jakarta Sans",system-ui,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text)}
header.top{background:var(--primary);color:#fff;padding:10px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header.top .mark{width:38px;height:38px;border-radius:10px;background:#fff;color:var(--primary);display:grid;place-items:center;font-weight:900}
header.top h1{font-size:15px;margin:0;font-weight:800}header.top p{margin:0;font-size:12px;opacity:.85}
header.top .spacer{flex:1}#source{font-size:11px;background:rgba(255,255,255,.16);padding:4px 8px;border-radius:999px}
#appbar{display:flex;gap:14px;align-items:center;background:var(--panel);border-bottom:1px solid var(--border);padding:8px 18px;flex-wrap:wrap}
#nav{display:flex;gap:6px;flex-wrap:wrap}#nav button{border:1px solid transparent;background:transparent;padding:7px 12px;border-radius:8px;font:inherit;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}
#nav button[aria-current]{background:var(--primary);color:#fff}#nav button:hover{border-color:var(--border)}
#who{margin-left:auto;font-size:12px;text-align:right;color:var(--muted)}
main{max-width:1180px;margin:0 auto;padding:22px 18px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px;color:var(--muted)}
p.sub{margin:0 0 16px;color:var(--muted);font-size:13px}.small{font-size:12px;color:var(--muted)}.mono{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:12px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px}
.grid{display:grid;gap:14px}.g2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}.g4{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.kpi small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.kpi strong{font-size:26px;display:block;margin-top:6px}
.kpi.o{border-left:4px solid var(--accent)}.kpi.a{border-left:4px solid var(--secondary)}.kpi.g{border-left:4px solid var(--ok)}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--border)}
td{padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;background:#EEE;color:#333}
.p-s1,.p-red{background:#FBE7E8;color:#8C1F24}.p-s2,.p-warn{background:#FDF0DC;color:var(--warn)}.p-s3{background:#E3F0F4;color:var(--accent)}.p-s4,.p-ok{background:#E4F3EA;color:var(--ok)}
.btn{background:var(--primary);color:#fff;border:0;border-radius:9px;padding:9px 14px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn.ghost{background:transparent;color:var(--primary);border:1px solid var(--border);padding:5px 10px}
.field{margin-bottom:12px}.field label{display:block;font-size:12px;font-weight:700;margin-bottom:4px}
input,select,textarea{width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font:inherit;font-size:13px;background:#fff;color:var(--text)}
.ok-msg{background:#E4F3EA;border:1px solid #B9E0C8;color:#14663C;padding:10px 12px;border-radius:10px;font-size:13px;margin:10px 0}
.notice{background:#FDF0DC;border:1px solid #F2D6A6;color:var(--warn);padding:10px 12px;border-radius:10px;font-size:13px;margin:10px 0}
ul.clean{list-style:none;padding:0;margin:10px 0 0}ul.clean li{padding:7px 0;border-bottom:1px solid var(--border)}
.bar{height:7px;background:#EFEAE5;border-radius:99px;overflow:hidden;margin-bottom:9px}.bar i{display:block;height:100%;background:var(--accent)}
.barrow{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px}
.login-wrap{max-width:420px;margin:60px auto}
footer{max-width:1180px;margin:0 auto;padding:0 18px 40px;font-size:11px;color:var(--muted)}
"""
html = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Customer Complaint Navigator — State Bank of Faridabad (Offline demo)</title>
<meta name="description" content="Self-contained offline demo of the Customer Complaint Navigator, sharing the live application's browser storage for cases, policies and metrics." />
<style>{css}</style>
</head><body>
<header class="top">
  <span class="mark">SBF</span>
  <div><h1>Customer Complaint Navigator</h1><p>State Bank of Faridabad · offline demonstration build</p></div>
  <span class="spacer"></span>
  <span id="source">…</span>
  <button class="btn ghost" id="exp" style="color:#fff;border-color:rgba(255,255,255,.5)" type="button">Export</button>
  <button class="btn ghost" id="imp" style="color:#fff;border-color:rgba(255,255,255,.5)" type="button">Import</button>
  <input id="impf" type="file" accept="application/json" hidden />
</header>
<div id="appbar" hidden><div id="nav"></div><div id="who"></div></div>
<main id="main"></main>
<footer>Synthetic data only. No money movement, no legal advice. Runs entirely in your browser; when opened from the application origin it reads and writes the same case, audit and administration storage as the live app.</footer>
<script>{core}</script>
<script>{ui}</script>
</body></html>
"""
for out in ['/mnt/documents/Digital_Banking_Offline_Demo.html', '/dev-server/public/demo.html']:
    pathlib.Path(out).write_text(html)
print(len(html))
