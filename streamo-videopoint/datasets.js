// Preparation status — hand-maintained inventory of the 465K + Molmo + VideoTrack sources.
const DATA_VERSION = "videopoint-diverse-points-20260703";
const STATUS = [
  ["QVHighlight · narration", "proactive narration", "11,052", "100%", "ready"],
  ["QVHighlight · event_caption", "dense events", "2,469", "100%", "ready"],
  ["QueryD · event_grounding", "temporal grounding", "4,267", "82%", "ready"],
  ["COIN · action_caption", "step captions", "5,598", "~22%", "ready"],
  ["Molmo2-VideoPoint", "pointing / counting", "658k", "videos ✓", "ready"],
  ["VideoTrack · personpath22", "per-frame tracking", "smoke", "frames ✓", "ready"],
  ["Live-WhisperX · MMDuet2", "proactive video QA", "48,732", "HDF5/videos ✓", "ready"],
  ["how_to_caption · action", "step captions", "—", "1,934 vids", "convertible"],
  ["LLaVA-Video (caption/qa)", "caption / qa", "large", "symlink ✓", "convertible"],
  ["QVHighlight · event_grounding", "grounding", "9k+", "100%", "convertible"],
  ["DiDeMo · event_grounding", "temporal grounding", "33,000", "8,394/8,394 vids", "ready"],
  ["ActivityNet (narr/grnd/qa)", "multiple", "13k+", "~10% vids", "partial"],
  ["VideoTrack · 15 other sources", "tracking", "—", "not prepared", "todo"],
  ["Koala / tacos / ego_timeqa", "caption/grnd/qa", "tens of k", "0 videos", "missing"],
];
const SC = { ready: "ok", convertible: "warn", partial: "warn", todo: "muted", missing: "bad" };

async function load() {
  const D = await (await fetch(`data/datasets_preview.json?v=${DATA_VERSION}`)).json();
  try {
    const S = await (await fetch(`data/stream_sources.json?v=${DATA_VERSION}`)).json();
    renderSources(S);
  } catch (e) { console.warn("stream_sources.json missing", e); }
  try {
    const J = await (await fetch(`data/joyai_breakdown.json?v=${DATA_VERSION}`)).json();
    renderJoyAI(J);
  } catch (e) { console.warn("joyai_breakdown.json missing", e); }
  try {
    const VP = await (await fetch(`data/videopoint_category_report.json?v=${DATA_VERSION}`)).json();
    renderVideoPoint(VP);
  } catch (e) { console.warn("videopoint_category_report.json missing", e); }
  renderStatus();
  renderDatasets(D.datasets);
}
function esc(s){return (s==null?"":String(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fmtN(n){return Number(n||0).toLocaleString();}

// ---- All streaming-instruction sources, grouped by family, with S/B/R rhythm ----
const FAM_COLOR = { "V-STAT": "#9b8cff", "Proactive (Streamo-Instruct)": "#f0a868", "VideoTrack (Molmo2)": "#5fd9a6" };
function sbrBar(S, B, R) {
  return `<div class="sbr-bar" title="Silence ${S}% · Standby ${B}% · Response ${R}%">
    <span class="sbr-s" style="width:${S}%">${S>=12?S:''}</span>
    <span class="sbr-b" style="width:${B}%">${B>=12?B:''}</span>
    <span class="sbr-r" style="width:${R}%">${R>=12?R:''}</span></div>`;
}
function renderSources(S) {
  document.getElementById("srcSub").innerHTML =
    `<b>${S.grand_total.toLocaleString()}</b> samples across <b>${S.families.reduce((a,f)=>a+f.sources.length,0)}</b> sources in 3 families. ` +
    `Per-source behavior rhythm: <span class="sbr-key sbr-s">Silence</span> <span class="sbr-key sbr-b">Standby</span> <span class="sbr-key sbr-r">Response</span> (share of assistant turns).`;
  document.getElementById("srcWrap").innerHTML = S.families.map(f => {
    const col = FAM_COLOR[f.family] || "#7c8cff";
    const rows = f.sources.map(s => `<tr>
      <td class="task-col">${esc(s.source)}</td>
      <td class="mono">${s.n.toLocaleString()}</td>
      <td class="mono">${s.fps}</td>
      <td class="mono">${s.avg_frames}</td>
      <td style="min-width:170px">${sbrBar(s.S, s.B, s.R)}</td>
      <td style="color:var(--muted);font-size:.82rem">${esc(s.desc)}</td>
    </tr>`).join("");
    return `<div class="fam-card">
      <div class="fam-head"><span class="fam-dot" style="background:${col}"></span>
        <h3>${esc(f.family)}</h3>
        <span class="fam-meta">${esc(f.kind)} · ${f.fps} fps · <b>${f.total.toLocaleString()}</b> samples · ${f.sources.length} sources</span></div>
      <div class="fam-note">${esc(f.note)}</div>
      <div class="table-card"><table>
        <thead><tr><th class="task-col">Source</th><th>#samples</th><th>fps</th><th>avg frames</th><th>Silence / Standby / Response</th><th>Rhythm</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </div>`;
  }).join("");
  document.getElementById("rhythmNote").innerHTML =
    "<b>Why the rhythm matters:</b> V-STAT is <b>standby-heavy</b> (keep tracking, respond at each counting event). " +
    "Proactive sources are wildly heterogeneous — narration ≈ respond-every-step, grounding ≈ mostly-silent. " +
    "Mixing them teaches the model to associate <b>real-world video → mostly silent</b>, which suppresses VSTAT-style " +
    "speak-up on OOD real videos (engage rate ~7% OOD vs ~80% for VSTAT-only). VideoTrack is 100% Response " +
    "(coordinates every frame) → forces continuous perception, the best OOD transfer of the three.";
}

// ---- JoyAI annotation breakdown: task totals and source-level stacked bars ----
const JOY_COL = {
  chat: "#7c8cff",
  background: "#f0a868",
  narration: "#5fd9a6",
  event_grounding: "#ff6b81"
};
let JOY = null;
let JOY_MODE = "all";

function joySeg(task, n, total) {
  if (!n) return "";
  const pct = total ? (n / total * 100) : 0;
  const label = pct >= 11 ? `${task.replace("_", " ")} ${pct.toFixed(0)}%` : "";
  return `<span class="joy-seg" style="width:${pct}%;background:${JOY_COL[task] || "#8a94ab"}" title="${esc(task)} · ${fmtN(n)}">${esc(label)}</span>`;
}

function renderJoyAI(J) {
  JOY = J;
  const tasks = J.task_totals.map(x => x.task);
  document.getElementById("joyaiSub").innerHTML =
    `<b>${fmtN(J.grand_total)}</b> annotations from <b>${fmtN(J.source_count)}</b> sources. ` +
    `The chart below shows task totals and the top <b>${J.top_sources.length}</b> sources; the complete source breakdown is in ` +
    `<a href="data/joyai_breakdown.json?v=${DATA_VERSION}"><code>data/joyai_breakdown.json</code></a>.`;

  const maxTask = Math.max(...J.task_totals.map(x => x.n));
  document.getElementById("joyaiTaskBars").innerHTML = `<div class="joy-task-grid">` +
    J.task_totals.map(x => `<div class="joy-task-card">
      <div class="joy-task-head"><span class="joy-dot" style="background:${JOY_COL[x.task]}"></span>
        <span>${esc(x.task)}</span><b>${fmtN(x.n)}</b></div>
      <div class="joy-task-track"><span style="width:${x.n / maxTask * 100}%;background:${JOY_COL[x.task]}"></span></div>
    </div>`).join("") + `</div>`;

  document.getElementById("joyaiControls").innerHTML =
    [`all`, ...tasks].map(t => `<button class="joy-btn ${t === JOY_MODE ? "active" : ""}" data-task="${esc(t)}">${esc(t === "all" ? "all tasks" : t)}</button>`).join("");
  document.querySelectorAll(".joy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      JOY_MODE = btn.dataset.task;
      renderJoyAI(JOY);
    });
  });

  const rows = J.top_sources
    .map(r => ({...r, shown: JOY_MODE === "all" ? r.total : (r.counts[JOY_MODE] || 0)}))
    .filter(r => r.shown > 0)
    .sort((a,b) => b.shown - a.shown);
  const maxSource = Math.max(...rows.map(r => r.shown), 1);
  document.getElementById("joyaiSourceBars").innerHTML = `<div class="joy-source-list">` +
    rows.map((r, i) => {
      const total = JOY_MODE === "all" ? r.total : r.shown;
      const bar = JOY_MODE === "all"
        ? tasks.map(t => joySeg(t, r.counts[t] || 0, r.total)).join("")
        : `<span class="joy-seg" style="width:${r.shown / maxSource * 100}%;background:${JOY_COL[JOY_MODE] || "#8a94ab"}"></span>`;
      const detail = tasks.map(t => `${t}: ${fmtN(r.counts[t] || 0)}`).join(" · ");
      return `<div class="joy-row">
        <div class="joy-rank">${i + 1}</div>
        <div class="joy-name" title="${esc(r.source)}">${esc(r.source)}</div>
        <div class="joy-total mono">${fmtN(total)}</div>
        <div class="joy-bar" title="${esc(detail)}">${bar}</div>
      </div>`;
    }).join("") + `</div>`;
}

function renderStatus() {
  let h = `<table><thead><tr><th class="task-col">Dataset</th><th>Task</th><th>#ann</th><th>Videos</th><th>Status</th></tr></thead><tbody>`;
  for (const [ds, task, n, vid, st] of STATUS) {
    h += `<tr><td class="task-col">${esc(ds)}</td><td style="color:var(--muted)">${esc(task)}</td>
      <td class="mono">${esc(n)}</td><td class="mono">${esc(vid)}</td>
      <td><span class="pill ${SC[st]}">${st}</span></td></tr>`;
  }
  h += `</tbody></table>`;
  document.getElementById("statusTable").innerHTML = h;
}

const VP_CLASS = {
  "event/action count": "ok",
  "object set count": "warn",
  "object/entity set count": "warn",
  "single-object localization": "muted",
  "single-object/part localization": "muted",
  "generated anomaly localization": "muted",
  "spatial/reference grounding": "muted",
  "mixed aggregate": "muted",
  "mixed aggregate rows": "muted"
};

function pct(part, total) {
  return total ? `${(part / total * 100).toFixed(1)}%` : "0.0%";
}

function compactHist(obj, limit=5) {
  return Object.entries(obj || {})
    .sort((a,b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([k,v]) => `${esc(k)}:${fmtN(v)}`)
    .join(" · ");
}

function sampleTimes(ts) {
  const vals = (ts || []).slice(0, 8).map(t => Number(t).toFixed(1));
  return vals.join(", ") + ((ts || []).length > vals.length ? " ..." : "");
}

function samplePoints(points, timestamps) {
  const frames = points || [];
  return frames.map((frame, i) => {
    const pts = (frame || []).slice(0, 3).map(p => `(${Number(p.x).toFixed(1)},${Number(p.y).toFixed(1)})`).join(" ");
    const t = timestamps?.[i] == null ? `t${i + 1}` : `${Number(timestamps[i]).toFixed(1)}s`;
    const more = (frame || []).length > 3 ? ` +${(frame || []).length - 3}` : "";
    return `${t}: ${pts || "none"}${more}`;
  }).join(" · ");
}

let VP_EVENTS = {};

function vpEvents(s) {
  const ts = s.timestamps || [];
  const pts = s.points_full || s.points_preview || [];
  const n = Math.max(ts.length, pts.length);
  return Array.from({length: n}, (_, i) => ({
    t: ts[i],
    points: pts[i] || [],
  }));
}

function pointText(points) {
  if (!points || !points.length) return "no points";
  return points.map(p => `(${Number(p.x).toFixed(1)},${Number(p.y).toFixed(1)})`).join(" ");
}

function vpTimeline(events, sid) {
  if (!events.length) return `<div class="vp-timeline-empty">no timestamped points</div>`;
  return `<div class="vp-timeline">` + events.map((e, i) => {
    const t = e.t == null ? "" : Number(e.t).toFixed(1);
    return `<button class="vp-trow" type="button" data-vp-sid="${sid}" data-vp-i="${i}">
      <span class="vp-time">${t ? `${t}s` : `frame ${i + 1}`}</span>
      <span class="vp-pcount">${(e.points || []).length} pt</span>
      <span class="vp-pcoords">${esc(pointText(e.points))}</span>
    </button>`;
  }).join("") + `</div>`;
}

function renderVideoPoint(VP) {
  VP_EVENTS = {};
  const catEntries = Object.entries(VP.categories || {});
  const totalRows = catEntries.reduce((a, [,c]) => a + Number(c.rows || 0), 0);
  const totalCovered = catEntries.reduce((a, [,c]) => a + Number(c.covered_rows || 0), 0);
  const action = VP.categories?.action_or_event || {};
  const objectRows = (VP.categories?.object?.rows || 0) + (VP.categories?.animal?.rows || 0);
  document.getElementById("videopointSub").innerHTML =
    `<b>${fmtN(totalRows)}</b> annotations grouped into <b>${catEntries.length}</b> categories; ` +
    `<b>${fmtN(totalCovered)}</b> rows covered by <b>${fmtN(VP.downloaded_mp4)}</b> local YouTube videos when this report was built. ` +
    `Best streaming-count source: <b>action_or_event</b> (${fmtN(action.rows)} rows, ${fmtN(action.multi_timestamp_rows)} multi-timestamp rows). ` +
    `Object/animal rows (${fmtN(objectRows)}) need tracking/dedup before using "first seen" counting.`;

  document.getElementById("videopointWrap").innerHTML = `<div class="vp-grid">` + catEntries.map(([name, c]) => {
    const note = c.note || {};
    const samples = (c.samples || []).slice(0, 4).map((s, si) => {
      const sid = `${name.replace(/[^a-z0-9]+/gi, "_")}_${si}`;
      const events = vpEvents(s);
      VP_EVENTS[sid] = events;
      return `<div class="vp-sample" data-vp-sid="${sid}">
      ${s.video_url ? `<div class="vp-video-wrap"><video class="vp-video" src="${esc(s.video_url)}" controls muted playsinline preload="metadata"></video><div class="vp-overlay"></div></div>` : `<div class="vp-novid">no public sample video</div>`}
      <div class="vp-s-title"><code>${esc(s.video_id)}</code><span>${s.downloaded ? "local video ready" : "video missing"}</span></div>
      <div class="vp-q">${esc(s.question)}</div>
      <div class="vp-kv"><b>label</b><span>${esc(s.label)}</span></div>
      <div class="vp-kv"><b>count</b><span>${esc(s.count)} · timestamps ${esc(s.timestamp_count ?? (s.timestamps || []).length)} · point frames ${esc(s.points_count ?? (s.points_full || s.points_preview || []).length)}</span></div>
      <div class="vp-kv"><b>points</b><span class="mono">${esc(samplePoints(s.points_full || s.points_preview, s.timestamps))}</span></div>
      <div class="vp-point-note">${esc(s.points_note || "Points are annotation clicks in x/y percent for each timestamp frame.")}</div>
      ${vpTimeline(events, sid)}
    </div>`;
    }).join("");
    return `<article class="vp-card">
      <div class="vp-head">
        <h3>${esc(name)}</h3>
        <span class="pill ${VP_CLASS[note.class] || "warn"}">${esc(note.class || "unknown")}</span>
      </div>
      <div class="vp-note"><b>Streaming use:</b> ${esc(note.streaming || "")}</div>
      <div class="vp-caveat">${esc(note.caveat || "")}</div>
      <div class="vp-metrics">
        <div><b>${fmtN(c.rows)}</b><span>rows</span></div>
        <div><b>${fmtN(c.unique_video)}</b><span>videos</span></div>
        <div><b>${fmtN(c.covered_rows)}</b><span>covered rows · ${pct(c.covered_rows, c.rows)}</span></div>
        <div><b>${fmtN(c.multi_timestamp_rows)}</b><span>multi-timestamp</span></div>
        <div><b>${fmtN(c.count_timestamp_mismatch_rows)}</b><span>count/time mismatch</span></div>
      </div>
      <div class="vp-mini"><b>point len</b> ${compactHist(c.point_array_len_hist)}</div>
      <div class="vp-mini"><b>source</b> ${compactHist(c.video_sources)}</div>
      <div class="vp-samples">${samples}</div>
    </article>`;
  }).join("") + `</div>`;
  wireVideoPointOverlays();
}

function renderVpDots(sample, idx) {
  const sid = sample.dataset.vpSid;
  const overlay = sample.querySelector(".vp-overlay");
  const video = sample.querySelector("video");
  if (!overlay) return;
  const events = VP_EVENTS[sid] || [];
  const e = events[idx];
  const cw = overlay.clientWidth || 1;
  const ch = overlay.clientHeight || 1;
  let ox = 0, oy = 0, vw = cw, vh = ch;
  if (video?.videoWidth && video?.videoHeight) {
    const scale = Math.min(cw / video.videoWidth, ch / video.videoHeight);
    vw = video.videoWidth * scale;
    vh = video.videoHeight * scale;
    ox = (cw - vw) / 2;
    oy = (ch - vh) / 2;
  }
  overlay.innerHTML = (e?.points || []).map((p, pi) =>
    `<span class="vp-dot" style="left:${ox + Number(p.x) / 100 * vw}px;top:${oy + Number(p.y) / 100 * vh}px">${pi + 1}</span>`
  ).join("");
  sample.querySelectorAll(".vp-trow").forEach((row, i) => row.classList.toggle("active", i === idx));
}

function wireVideoPointOverlays() {
  document.querySelectorAll(".vp-sample[data-vp-sid]").forEach(sample => {
    const video = sample.querySelector("video");
    const events = VP_EVENTS[sample.dataset.vpSid] || [];
    let activeIdx = -1;
    sample.querySelectorAll(".vp-trow").forEach(row => {
      row.addEventListener("click", () => {
        const i = Number(row.dataset.vpI);
        activeIdx = i;
        const t = events[i]?.t;
        if (video && t != null) video.currentTime = Number(t);
        renderVpDots(sample, i);
      });
    });
    if (!video || !events.length) return;
    video.addEventListener("loadedmetadata", () => {
      if (activeIdx >= 0) renderVpDots(sample, activeIdx);
    });
    video.addEventListener("timeupdate", () => {
      let best = -1, bestDist = Infinity;
      events.forEach((e, i) => {
        if (e.t == null) return;
        const dist = Math.abs(Number(e.t) - video.currentTime);
        if (dist < bestDist) { best = i; bestDist = dist; }
      });
      if (best >= 0 && bestDist <= 0.75) {
        activeIdx = best;
        renderVpDots(sample, best);
      }
    });
    window.addEventListener("resize", () => {
      if (activeIdx >= 0) renderVpDots(sample, activeIdx);
    });
  });
}

function renderDatasets(list) {
  document.getElementById("dsWrap").innerHTML = list.map(d => {
    const samples = d.samples.map(s => sampleCard(d, s)).join("");
    return `<div class="ds-card">
      <div class="ds-head"><span class="ds-ico">${d.icon}</span>
        <div><h3>${esc(d.name)}</h3><div class="ds-task">${esc(d.task)} · <code>${esc(d.format)}</code></div></div></div>
      <div class="ds-samples">${samples}</div>
    </div>`;
  }).join("");
}

let UID = 0;
function fmtT(t){ if(t==null) return ""; const m=Math.floor(t/60), s=Math.floor(t%60); return `${m}:${String(s).padStart(2,'0')}`; }

// a timestamped caption line (clickable to seek; highlighted while playing)
function capLine(vid, e){
  const t = e.t;
  const seek = t!=null ? `onclick="document.getElementById('${vid}').currentTime=${t}"` : "";
  const tlabel = t!=null ? `<span class="cap-t">${fmtT(t)}</span>` : "";
  return `<div class="ann-ev cap" data-t="${t==null?'':t}" ${seek}>${tlabel}${esc(e.text)}</div>`;
}

function sampleCard(d, s) {
  const vid = "v" + (UID++);
  const player = s.video ? `<video id="${vid}" src="${s.video}" muted playsinline controls preload="metadata"></video>`
                         : `<div class="novid">clip unavailable</div>`;
  let ann = `<div class="ann-q">${esc(s.question)}</div>`;
  if (s.events) ann += `<div class="ann-lab">${s.n_frames} frames · timestamped responses (click to seek):</div>` +
    `<div class="caps">${s.events.map(e => capLine(vid, e)).join("")}</div>`;
  else if (s.points) ann += `<div class="ann-lab">label: <b>${esc(s.label)}</b> · count: <b>${s.count}</b> · ${esc(s.category)}</div>` +
    `<div class="ann-ev">points (x,y %): ${s.points.map(p=>`(${p.x},${p.y})`).join(" ")}</div>`;
  else if (s.tracks) ann += `<div class="ann-lab">${s.n_frames} frames · per-frame tracks (click to seek):</div>` +
    `<div class="caps">${s.tracks.map(e => capLine(vid, e)).join("")}</div>`;
  return `<div class="ds-sample"><div class="ds-vid">${player}</div><div class="ds-ann">${ann}</div></div>`;
}

// sync: highlight the active caption as each video plays
function wireSync(){
  document.querySelectorAll("video").forEach(v => {
    const caps = [...(v.closest(".ds-sample")?.querySelectorAll(".cap[data-t]") || [])]
      .filter(c => c.dataset.t !== "").map(c => ({el:c, t:parseFloat(c.dataset.t)}))
      .sort((a,b)=>a.t-b.t);
    if (!caps.length) return;
    v.addEventListener("timeupdate", () => {
      const now = v.currentTime; let active = -1;
      for (let i=0;i<caps.length;i++){ if (caps[i].t <= now + 0.3) active = i; else break; }
      caps.forEach((c,i) => c.el.classList.toggle("active", i===active));
      if (active>=0) caps[active].el.scrollIntoView({block:"nearest",behavior:"smooth"});
    });
  });
}

async function start(){ await load(); wireSync(); }
start();
