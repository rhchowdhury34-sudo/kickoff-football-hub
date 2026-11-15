// KickOff frontend — live data via the private Cloudflare Worker.
const API_BASE = "https://kickoff-api.callguard-shield.workers.dev";
const main = document.getElementById("mainContent");
const toastEl = document.getElementById("toast");
let currentPage = "Home";
let activeFilter = "All";
let deferredPrompt = null;
let cache = { live: null, next: null, last: null, at: 0, standings: {} };
let selectedLeague = "39";
const season = new Date().getFullYear();
const leagues = [
  { id: "39", name: "Premier League", country: "England", icon: "🏴" },
  { id: "140", name: "La Liga", country: "Spain", icon: "🇪🇸" },
  { id: "78", name: "Bundesliga", country: "Germany", icon: "🇩🇪" },
  { id: "135", name: "Serie A", country: "Italy", icon: "🇮🇹" },
  { id: "61", name: "Ligue 1", country: "France", icon: "🇫🇷" },
  { id: "2", name: "Champions League", country: "Europe", icon: "⭐" }
];
const news = [
  ["NEWS", "Football news feed not connected yet", "A trusted news source will be added in a later update.", "📰"],
  ["UPDATE", "Live scores and fixtures are powered by API-Football", "Match data availability depends on your API plan.", "⚽"]
];
function toast(message) { toastEl.textContent = message; toastEl.classList.add("show"); setTimeout(() => toastEl.classList.remove("show"), 2600); }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { "Accept": "application/json" } });
  let data;
  try { data = await response.json(); } catch { throw new Error("The football service returned an unreadable response."); }
  if (!response.ok || data.errors && Object.keys(data.errors).length) {
    const detail = data.errors ? Object.values(data.errors).join("; ") : data.message || `HTTP ${response.status}`;
    throw new Error(detail || "Football data request failed.");
  }
  return data;
}
function normalizeFixture(item) {
  const f = item.fixture || {}, t = item.teams || {}, g = item.goals || {}, l = item.league || {};
  const short = f.status?.short || "NS";
  const liveCodes = ["1H","HT","2H","ET","BT","P","LIVE"];
  const finishedCodes = ["FT","AET","PEN"];
  const state = liveCodes.includes(short) ? "Live" : finishedCodes.includes(short) ? "Finished" : "Upcoming";
  const date = f.date ? new Date(f.date) : null;
  const time = state === "Live" ? `${f.status?.elapsed ?? ""}${f.status?.extra ? `+${f.status.extra}` : ""}'` : state === "Finished" ? short : date ? date.toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "TBA";
  return {
    id: f.id,
    league: l.name || "Football",
    home: t.home?.name || "Home",
    away: t.away?.name || "Away",
    homeLogo: t.home?.logo || "",
    awayLogo: t.away?.logo || "",
    h: g.home,
    a: g.away,
    time,
    state,
    minute: f.status?.elapsed
  };
}
function logo(url, name) { return url ? `<img class="team-logo" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="crest">⚽</span>`; }
function matchCard(m) {
  const score = m.state === "Upcoming" ? `<div class="score"><small>${esc(m.time)}</small></div>` : `<div class="score">${m.h ?? "–"} <small>–</small> ${m.a ?? "–"}</div>`;
  return `<article class="match-card"><div class="match-meta"><span>${esc(m.league)}</span><span class="status ${m.state.toLowerCase()}">${m.state === "Live" ? `● LIVE ${m.minute ?? ""}` : m.state.toUpperCase()}</span></div><div class="match-teams"><div class="team">${logo(m.homeLogo,m.home)}<span>${esc(m.home)}</span></div>${score}<div class="team"><span>${esc(m.away)}</span>${logo(m.awayLogo,m.away)}</div></div></article>`;
}
function loading(text="Loading football data…") { return `<div class="empty">${esc(text)}</div>`; }
function errorBox(error) { return `<div class="empty">Could not load football data: ${esc(error.message || error)}<br><br>Check your API plan, Worker Secret and try again.</div>`; }
function filters() { return `<div class="filter-row">${["All","Live","Upcoming","Finished"].map(f=>`<button class="chip ${activeFilter===f?"active":""}" data-filter="${f}">${f}</button>`).join("")}</div>`; }
function filteredMatches(list) { return list.filter(m => activeFilter === "All" || m.state === activeFilter); }
async function loadMatchData(force=false) {
  if (!force && cache.at && Date.now()-cache.at < 45000 && cache.live && cache.next && cache.last) return cache;
  const [live,next,last] = await Promise.all([
    api("/api/live"), api("/api/fixtures?next=10"), api("/api/fixtures?last=10")
  ]);
  cache = { live:(live.response||[]).map(normalizeFixture), next:(next.response||[]).map(normalizeFixture), last:(last.response||[]).map(normalizeFixture), at:Date.now(), standings:cache.standings };
  return cache;
}
function uniqueMatches(data) {
  const map = new Map();
  [...data.live, ...data.next, ...data.last].forEach(m => { if (m.id) map.set(m.id,m); });
  return [...map.values()];
}
function leagueTiles() { return `<div class="league-strip">${leagues.map(l=>`<button class="league-tile" data-league="${l.id}"><span class="league-icon">${l.icon}</span><span><strong>${esc(l.name)}</strong><small>${esc(l.country)}</small></span></button>`).join("")}</div>`; }
function newsHTML() { return `<div class="news-list">${news.map(n=>`<article class="news-card"><div class="news-art">${n[3]}</div><div><small>${n[0]}</small><h3>${esc(n[1])}</h3><p>${esc(n[2])}</p></div></article>`).join("")}</div>`; }
async function renderHome() {
  main.innerHTML = `<section class="hero"><div class="hero-kicker"><span class="pulse-dot"></span> YOUR FOOTBALL CENTRAL</div><h1>The game<br><span class="lime">never stops.</span></h1><p>Scores, fixtures, leagues and stories — all in one place.</p><button class="primary-btn" data-go="Scores">Explore matches <span>→</span></button><div class="hero-ball">⚽</div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">DON'T MISS A MOMENT</p><h2>Match centre</h2></div><button class="text-btn" data-go="Scores">View all ↗</button></div>${filters()}<div class="match-list">${loading()}</div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">FOLLOW THE BIGGEST</p><h2>Top leagues</h2></div><button class="text-btn" data-go="Leagues">All leagues ↗</button></div>${leagueTiles()}</section><section class="section"><div class="section-heading"><div><p class="eyebrow">AROUND THE WORLD</p><h2>Latest stories</h2></div><button class="text-btn" data-go="News">More news ↗</button></div>${newsHTML()}</section>`;
  try { const data=await loadMatchData(); if(currentPage!=="Home")return; const list=filteredMatches(uniqueMatches(data)).slice(0,6); const target=main.querySelector(".match-list"); if(target) target.innerHTML=list.map(matchCard).join("")||loading("No matches found for this filter right now."); }
  catch(e) { const target=main.querySelector(".match-list"); if(target) target.innerHTML=errorBox(e); }
}
async function renderScores() {
  main.innerHTML=`<section class="section" style="padding-top:24px"><p class="eyebrow">ALL THE ACTION</p><h1 class="page-title">Match centre</h1><p class="subcopy">Live scores, upcoming matches and recent results.</p>${filters()}<div class="match-list">${loading()}</div><button class="primary-btn" id="refreshMatches" style="margin-top:14px">Refresh scores ↻</button><p class="subcopy">Data supplied by API-Football. Coverage depends on the provider plan.</p></section>`;
  async function update(force=false){const target=main.querySelector(".match-list");if(target)target.innerHTML=loading();try{const data=await loadMatchData(force);if(currentPage!=="Scores")return;const list=filteredMatches(uniqueMatches(data));if(target)target.innerHTML=list.map(matchCard).join("")||loading("No matches in this category right now.");}catch(e){if(target)target.innerHTML=errorBox(e);}}
  await update(); const btn=document.getElementById("refreshMatches");if(btn)btn.onclick=()=>update(true);
}
async function renderFixtures() {
  main.innerHTML=`<section class="section" style="padding-top:24px"><p class="eyebrow">PLAN YOUR MATCHDAY</p><h1 class="page-title">Fixtures & results</h1><p class="subcopy">Upcoming fixtures and completed matches from the football data provider.</p><h2 style="font-size:17px;margin:20px 0 10px">Upcoming</h2><div id="upcomingList" class="match-list">${loading()}</div><h2 style="font-size:17px;margin:24px 0 10px">Recent results</h2><div id="recentList" class="match-list">${loading()}</div><button class="primary-btn" id="refreshFixtures" style="margin-top:14px">Refresh ↻</button></section>`;
  async function update(force=false){try{const data=await loadMatchData(force);if(currentPage!=="Fixtures")return;document.getElementById("upcomingList").innerHTML=data.next.map(matchCard).join("")||loading("No upcoming fixtures returned.");document.getElementById("recentList").innerHTML=data.last.map(matchCard).join("")||loading("No recent results returned.");}catch(e){document.getElementById("upcomingList").innerHTML=errorBox(e);document.getElementById("recentList").innerHTML="";}}
  await update();const btn=document.getElementById("refreshFixtures");if(btn)btn.onclick=()=>update(true);
}
async function renderStandings() {
  const league=leagues.find(l=>l.id===selectedLeague)||leagues[0];
  main.innerHTML=`<section class="section" style="padding-top:24px"><p class="eyebrow">THE BIG COMPETITIONS</p><h1 class="page-title">League standings</h1>${leagueTiles()}<h2 style="font-size:17px;margin:22px 0 12px">${esc(league.name)} · ${season}</h2><div id="standingsTable">${loading("Loading standings…")}</div><p class="subcopy">Standings coverage depends on your API-Football plan and season availability.</p></section>`;
  try { let rows=cache.standings[selectedLeague];if(!rows){const data=await api(`/api/standings?league=${selectedLeague}&season=${season}`);rows=data.response?.[0]?.league?.standings?.[0]||[];cache.standings[selectedLeague]=rows;}if(currentPage!=="Leagues")return;document.getElementById("standingsTable").innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>#</th><th>CLUB</th><th>P</th><th>W</th><th>D</th><th>L</th><th>PTS</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td class="team-cell">${esc(r.team?.name)}</td><td>${r.all?.played??0}</td><td>${r.all?.win??0}</td><td>${r.all?.draw??0}</td><td>${r.all?.lose??0}</td><td><b>${r.points??0}</b></td></tr>`).join("")}</tbody></table></div>`:loading("No standings data returned for this league and season.");}
  catch(e){const target=document.getElementById("standingsTable");if(target)target.innerHTML=errorBox(e);}
}
function renderPage(page) {
  currentPage=page;document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("selected",b.dataset.page===page));
  if(page==="Home"){renderHome();return;} if(page==="Scores"){renderScores();return;} if(page==="Fixtures"){renderFixtures();return;} if(page==="Leagues"){renderStandings();return;}
  main.innerHTML=`<section class="section" style="padding-top:24px"><p class="eyebrow">THE LATEST FROM THE GAME</p><h1 class="page-title">Football news</h1><p class="subcopy">A verified news provider has not been connected yet.</p>${newsHTML()}</section>`;
}
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]");if(go){renderPage(go.dataset.go);window.scrollTo(0,0);return;}
  const nav=e.target.closest("[data-page]");if(nav){renderPage(nav.dataset.page);window.scrollTo(0,0);return;}
  const filter=e.target.closest("[data-filter]");if(filter){activeFilter=filter.dataset.filter;renderPage(currentPage);return;}
  const league=e.target.closest("[data-league]");if(league){selectedLeague=league.dataset.league;renderPage("Leagues");window.scrollTo(0,0);return;}
});
document.getElementById("searchBtn").addEventListener("click",()=>toast("Search will be enabled in a future update."));
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").hidden=false;});
document.getElementById("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("installBtn").hidden=true;});
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
renderHome();
