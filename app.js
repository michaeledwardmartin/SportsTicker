const ticker = document.getElementById("ticker-content");
const checkboxes = document.querySelectorAll("#controls input[type=checkbox]");
const bostonToggle = document.getElementById("bostonMode");
const liveOnlyToggle = document.getElementById("liveOnly");
const HOURS_AFTER_FINAL = 18;

const BOSTON_TEAMS = ["Patriots","Bruins","Red Sox","Celtics","Revolution"];
const BOSTON_ORDER = { "Bruins":1, "Red Sox":2, "Patriots":3, "Celtics":4, "Revolution":5 };

// Universal Status Formatter
function formatStatus(competition, sportName) {
  const state = competition?.status?.type?.state || "";
  let statusText = competition?.status?.type?.shortDetail || "";

  if(state !== "in") return statusText;

  const period = competition?.status?.period;
  const clock = competition?.status?.displayClock;

  switch(sportName) {
    case "Basketball":
    case "Football":
      return `Q${period} • ${clock}`;
    case "Hockey":
      return `${period} • ${clock}`;
    case "Baseball":
      return competition?.status?.type?.detail || "";
    case "Soccer":
    case "Racing":
    case "MMA":
    case "Golf":
      return statusText;
    default:
      return statusText;
  }
}

async function loadScores() {
  let text = "";
  let bostonGames = [];
  const selectedLeagues = Array.from(checkboxes)
    .filter(cb => cb.checked && cb.value)
    .map(cb => cb.value);
  const bostonOnly = bostonToggle.checked;

  for(const league of selectedLeagues) {

    // ==== NCAA College Hockey Special Case ====
    if(league === "ncaa/icehockey-men-d1") {
      try {
        const now = new Date();
        const YYYY = now.getFullYear();
        const MM = String(now.getMonth()+1).padStart(2,"0");
        const DD = String(now.getDate()).padStart(2,"0");
        const ncaaUrl = `https://data.ncaa.com/casablanca/scoreboard/icehockey-men/d1/${YYYY}/${MM}/${DD}/scoreboard.json`;

        const res = await fetch(ncaaUrl);
        if(!res.ok) continue;
        const ncaaData = await res.json();

        (ncaaData.games || []).forEach(g => {
          const home = g.home || {};
          const away = g.away || {};

          if(bostonOnly && !BOSTON_TEAMS.includes(home.team_name) && !BOSTON_TEAMS.includes(away.team_name)) return;

          const statusText = g.status || "";
          const gameHtml = `
            <span class="upcoming" style="display:inline-flex; align-items:center; margin-right:10px;">
              ${away.team_abbrev ?? ""} ${away.score ?? ""}
              <span style="margin:0 4px;">-</span>
              ${home.team_abbrev ?? ""} ${home.score ?? ""}
              (${statusText})
            </span>
          `;

          if(bostonOnly) {
            const team = BOSTON_ORDER[home.team_name] ? home.team_name :
                         BOSTON_ORDER[away.team_name] ? away.team_name : null;
            if(team) bostonGames.push({ order:BOSTON_ORDER[team], html:gameHtml });
          } else {
            text += gameHtml;
          }
        });

      } catch(err) {
        console.error("Error loading NCAA college hockey:", err);
      }
      continue;
    }

    // ==== ESPN API Leagues ====
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard`);
      if(!res.ok) continue;
      const data = await res.json();
      const sportName = data.leagues?.[0]?.sport?.name || "";
      if(!data.events) continue;

      data.events.forEach(event => {
        const competition = event.competitions[0];
        if(!competition?.competitors) return;

        const isTeamSport = competition.competitors.some(c => c.homeAway);
        let gameHtml = "";

        if(isTeamSport) {
          const home = competition.competitors.find(c => c.homeAway==="home");
          const away = competition.competitors.find(c => c.homeAway==="away");

          const homeName = home.team.name;
          const awayName = away.team.name;
          if(bostonOnly && !BOSTON_TEAMS.includes(homeName) && !BOSTON_TEAMS.includes(awayName)) return;

          let stateClass="upcoming";
          const state = competition.status.type.state;
          const gameTime = new Date(competition.date);
          const now = new Date();

          if(state==="pre" && gameTime.toDateString()!==now.toDateString()) return;
          if(liveOnlyToggle.checked && state!=="in") return;
          if(state==="in") stateClass="live";
          else if(state==="post") stateClass="final";

          const statusText = formatStatus(competition,sportName);
          const homeLogo = home.team.logo;
          const awayLogo = away.team.logo;

          gameHtml = `
            <span class="${stateClass}" style="display:inline-flex; align-items:center; margin-right:10px;">
              <img src="${awayLogo}" style="height:20px; margin-right:4px;">
              ${away.team.abbreviation} ${away.score ?? ""}
              <span style="margin:0 4px;">-</span>
              <img src="${homeLogo}" style="height:20px; margin-right:4px;">
              ${home.team.abbreviation} ${home.score ?? ""}
              (${statusText})
            </span>
          `;
        } else {
          // Leaderboard sports like F1
          const statusText = formatStatus(competition,sportName);
          const topCompetitors = competition.competitors.slice(0,3);
          const competitorsHtml = topCompetitors.map(c=>{
            const name=c.athlete?.displayName||c.team?.abbreviation||"";
            return `${name} ${c.score??""}`;
          }).join(" • ");

          gameHtml = `
            <span class="upcoming" style="display:inline-flex; align-items:center; margin-right:10px;">
              ${competition.name} — ${statusText} • ${competitorsHtml}
            </span>
          `;
        }

        if(bostonOnly) {
          let team = null;
          if(isTeamSport) {
            team = BOSTON_ORDER[competition.competitors[0].team?.name] ? competition.competitors[0].team.name :
                   BOSTON_ORDER[competition.competitors[1]?.team?.name] ? competition.competitors[1].team.name : null;
          }
          if(team) bostonGames.push({ order:BOSTON_ORDER[team], html:gameHtml });
        } else {
          text += gameHtml;
        }

      });

    } catch(err) {
      console.error("Error loading league:",league,err);
    }
  }

  if(bostonOnly) bostonGames.sort((a,b)=>a.order-b.order).forEach(g=>text+=g.html);

  ticker.innerHTML = text || "No games match your selection";
}

// Event listeners
document.querySelectorAll("#controls input").forEach(el=>el.addEventListener("change", loadScores));
loadScores();
setInterval(loadScores,60000);

async function loadBruinsGame() {
  const statusEl = document.getElementById("bruins-status");
  statusEl.textContent = "Updating…";
  if (!statusEl) return;

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard"
    );
    const data = await res.json();

    const bruinsGame = data.events.find(event =>
      event.competitions[0].competitors.some(c =>
        c.team.displayName === "Boston Bruins"
      )
    );

    if (!bruinsGame) {
      statusEl.textContent = "No game today";
      return;
    }

    const game = bruinsGame.competitions[0];
    const home = game.competitors.find(c => c.homeAway === "home");
    const away = game.competitors.find(c => c.homeAway === "away");

    const state = game.status.type.state;
    const clock = game.status.displayClock || "";
    const period = game.status.period || "";

    let statusText = "";

    if (state === "in") {
      statusText = `${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation} | P${period} ${clock}`;
    } else if (state === "post") {
      statusText = `FINAL: ${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation}`;
    } else {
      statusText = `Upcoming: ${away.team.abbreviation} @ ${home.team.abbreviation}`;
    }

    statusEl.textContent = statusText;

  } catch (err) {
    statusEl.textContent = "Error loading game";
    console.error(err);
  }
}

// load once on page load
loadBruinsGame();
setInterval(loadBruinsGame, 120000);


async function loadBruinsStandings() {
  const container = document.getElementById("bruins-standings");
  container.textContent = "Loading standings…";
  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/hockey/nhl/standings"
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    // Find Bruins and calculate division rank
    let bruinsData = null;
    let divisionRank = "?";
    let atlanticTeams = [];
    
    if (data.children) {
      for (const conf of data.children) {
        for (const entry of conf.standings?.entries || []) {
          // Collect all Atlantic division teams (added TB)
          const teamAbbr = entry.team?.abbreviation;
          if (["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TB", "TOR"].includes(teamAbbr)) {
            atlanticTeams.push(entry);
          }
          
          // Find Bruins
          if (teamAbbr === "BOS") {
            bruinsData = entry;
          }
        }
      }
    }

    if (!bruinsData) {
      container.textContent = "Bruins not found";
      return;
    }

    // Sort Atlantic teams by points (descending)
    atlanticTeams.sort((a, b) => {
      const aPoints = a.stats?.find(s => s.name === "points")?.value || 0;
      const bPoints = b.stats?.find(s => s.name === "points")?.value || 0;
      return bPoints - aPoints;
    });

    // DEBUG: Log the sorted standings
    console.log("Atlantic Division Standings:");
    atlanticTeams.forEach((team, idx) => {
      const pts = team.stats?.find(s => s.name === "points")?.value || 0;
      console.log(`${idx + 1}. ${team.team?.abbreviation} - ${pts} pts`);
    });

    divisionRank = atlanticTeams.findIndex(t => 
      t.team?.abbreviation === "BOS"
    ) + 1;

    // Extract stats
    const stats = {};
    for (const s of bruinsData.stats || []) {
      stats[s.name] = s.value;
    }

    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const ot = stats.otLosses || stats.overtimeLosses || 0;
    const points = stats.points || 0;
    const playoffSeed = stats.playoffSeed || "?";

    container.innerHTML = `
      <strong>#${divisionRank} Atlantic Division• #${playoffSeed} East</strong><br>
      ${wins}-${losses}-${ot} • ${points} pts
    `;
  } catch (err) {
    console.error("Standings error:", err);
    container.innerHTML = `<strong>Bruins</strong> • Check ESPN`;
  }
}

// call it once
loadBruinsStandings();

// Call once on page load
//loadBruinsStandings();


async function loadRedSoxGame() {
  const statusEl = document.getElementById("redsox-status");
  if (!statusEl) return;

  statusEl.textContent = "Updating…";

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"
    );
    const data = await res.json();

    const redsoxGame = data.events.find(event =>
      event.competitions[0].competitors.some(c =>
        c.team.displayName === "Boston Red Sox"
      )
    );

    if (!redsoxGame) {
      statusEl.textContent = "No game today";
      return;
    }

    const game = redsoxGame.competitions[0];
    const home = game.competitors.find(c => c.homeAway === "home");
    const away = game.competitors.find(c => c.homeAway === "away");

    const state = game.status.type.state;
    const detail = game.status.type.detail; // ⭐ KEY FIX

    let statusText = "";

    if (state === "in") {
      // Example: "Top 7th"
      statusText =
        `${away.team.abbreviation} ${away.score} – ` +
        `${home.score} ${home.team.abbreviation} | ${detail}`;
    }
    else if (state === "post") {
      statusText =
        `FINAL: ${away.team.abbreviation} ${away.score} – ` +
        `${home.score} ${home.team.abbreviation}`;
    }
    else {
      const startTime = game.status.type.shortDetail;
      statusText =
        `Upcoming: ${away.team.abbreviation} @ ${home.team.abbreviation} (${startTime})`;
    }

    statusEl.textContent = statusText;

  } catch (err) {
    statusEl.textContent = "Error loading game";
    console.error(err);
  }
}

// load once on page load
loadRedSoxGame();
setInterval(loadRedSoxGame, 120000);

async function loadRedSoxStandings() {
  const container = document.getElementById("redsox-standings");
  container.textContent = "Loading standings…";
  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings"
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    // Find Red Sox in standings
    let redSoxData = null;
    let divisionName = "";
    let divisionRank = "?";
    
    if (data.children) {
      for (const conf of data.children) {
        for (const div of conf.standings?.entries || []) {
          // Check for "Red Sox" in team name
          if (div.team?.displayName?.includes("Red Sox") || 
              div.team?.name?.includes("Red Sox") ||
              div.team?.abbreviation === "BOS") {
            redSoxData = div;
            divisionName = "AL East";
            // Count position within this division
            const divEntries = div.standings?.entries || conf.standings?.entries || [];
            divisionRank = divEntries.findIndex(e => 
              e.team?.abbreviation === "BOS" || 
              e.team?.displayName?.includes("Red Sox")
            ) + 1;
            console.log("Found Red Sox! Division Rank:", divisionRank);
            break;
          }
        }
        if (redSoxData) break;
      }
    }

    if (!redSoxData) {
      container.textContent = "Red Sox not found";
      return;
    }

    // Extract stats
    const stats = {};
    for (const s of redSoxData.stats || []) {
      stats[s.name] = s.value;
      console.log(s.name, s.value); // DEBUG
    }

    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const gb = stats.gamesBehind || 0;

    container.innerHTML = `
      <strong>#${divisionRank} ${divisionName}</strong> • ${wins}-${losses} • ${gb} GB
    `;
  } catch (err) {
    console.error("Standings error:", err);
    container.innerHTML = `<strong>Red Sox</strong> • Check ESPN`;
  }
}

// call it once
loadRedSoxStandings();

async function loadPatriotsGame() {
  const statusEl = document.getElementById("patriots-status");
  statusEl.textContent = "Updating…";
  if (!statusEl) return;

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );
    const data = await res.json();

    const patriotsGame = data.events.find(event =>
      event.competitions[0].competitors.some(c =>
        c.team.displayName === "New England Patriots"
      )
    );

    if (!patriotsGame) {
      statusEl.textContent = "No game today";
      return;
    }

    const game = patriotsGame.competitions[0];
    const home = game.competitors.find(c => c.homeAway === "home");
    const away = game.competitors.find(c => c.homeAway === "away");

    const state = game.status.type.state;  //Update me!
    const clock = game.status.displayClock || "";
    const period = game.status.period || "";

    let statusText = "";

    if (state === "in") {
      statusText = `${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation} | Qtr${period} ${clock}`;
    } else if (state === "post") {
      statusText = `FINAL: ${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation}`;
    } else {
      statusText = `Upcoming: ${away.team.abbreviation} @ ${home.team.abbreviation}`;
    }

    statusEl.textContent = statusText;

  } catch (err) {
    statusEl.textContent = "Error loading game";
    console.error(err);
  }
}

// load once on page load
loadPatriotsGame();
setInterval(loadPatriotsGame, 120000);

async function loadPatriotsStandings() {
  const container = document.getElementById("patriots-standings");
  container.textContent = "Loading standings…";
  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings"
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    // Find Patriots in standings
    let patriotsData = null;
    let divisionName = "";
    let divisionRank = "?";
    
    if (data.children) {
      for (const conf of data.children) {
        for (const div of conf.standings?.entries || []) {
          // Check for "Patriots" in team name
          if (div.team?.displayName?.includes("Patriots") || 
              div.team?.name?.includes("Patriots") ||
              div.team?.abbreviation === "NE") {
            patriotsData = div;
            divisionName = "AFC East";
            // Count position within this division
            const divEntries = div.standings?.entries || conf.standings?.entries || [];
            divisionRank = divEntries.findIndex(e => 
              e.team?.abbreviation === "NE" || 
              e.team?.displayName?.includes("Patriots")
            ) + 1;
            console.log("Found Patriots! Division Rank:", divisionRank);
            break;
          }
        }
        if (patriotsData) break;
      }
    }

    if (!patriotsData) {
      container.textContent = "Patriots not found";
      return;
    }

    // Extract stats
    const stats = {};
    for (const s of patriotsData.stats || []) {
      stats[s.name] = s.value;
    }

    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const ties = stats.ties || 0;
    const rank = divisionRank;

    // Show ties only if they exist
    const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;

    container.innerHTML = `
      <strong>#${rank} ${divisionName}</strong> • ${record}
    `;
  } catch (err) {
    console.error("Standings error:", err);
    container.innerHTML = `<strong>Patriots</strong> • Check ESPN`;
  }
}

// call it once
loadPatriotsStandings();

async function loadCelticsGame() {
  const statusEl = document.getElementById("celtics-status");
  statusEl.textContent = "Updating…";
  if (!statusEl) return;

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
    );
    const data = await res.json();

    const celticsGame = data.events.find(event =>
      event.competitions[0].competitors.some(c =>
        c.team.displayName === "Boston Celtics"
      )
    );

    if (!celticsGame) {
      statusEl.textContent = "No game today";
      return;
    }

    const game = celticsGame.competitions[0];
    const home = game.competitors.find(c => c.homeAway === "home");
    const away = game.competitors.find(c => c.homeAway === "away");

    const state = game.status.type.state;  //Update me!
    const clock = game.status.displayClock || "";
    const period = game.status.period || "";

    let statusText = "";

    if (state === "in") {
      statusText = `${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation} | Qtr${period} ${clock}`;
    } else if (state === "post") {
      statusText = `FINAL: ${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation}`;
    } else {
      statusText = `Upcoming: ${away.team.abbreviation} @ ${home.team.abbreviation}`;
    }

    statusEl.textContent = statusText;

  } catch (err) {
    statusEl.textContent = "Error loading game";
    console.error(err);
  }
}

// load once on page load
loadCelticsGame();
setInterval(loadCelticsGame, 120000);

async function loadCelticsStandings() {
  const container = document.getElementById("celtics-standings");
  container.textContent = "Loading standings…";
  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings"
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    // Find Celtics in standings and calculate division rank
    let celticsData = null;
    let divisionName = "";
    let divisionRank = "?";
    
    if (data.children) {
      for (const conf of data.children) {
        // Look for divisions within conference
        for (const divOrEntry of conf.standings?.entries || []) {
          // Check if this IS the Celtics entry directly
          if (divOrEntry.team?.abbreviation === "BOS" || 
              divOrEntry.team?.displayName?.includes("Celtics")) {
            celticsData = divOrEntry;
            divisionName = "Atlantic";
            
            // Find division rank by checking stats
            const stats = {};
            for (const s of divOrEntry.stats || []) {
              stats[s.name] = s.value;
            }
            // Use divisionWinPercent to calculate rank manually if needed
            divisionRank = stats.playoffSeed || "3";
            console.log("Found Celtics! Playoff Seed:", stats.playoffSeed);
            break;
          }
        }
        if (celticsData) break;
      }
    }

    if (!celticsData) {
      container.textContent = "Celtics not found";
      return;
    }

    // Extract stats
    const stats = {};
    for (const s of celticsData.stats || []) {
      stats[s.name] = s.value;
    }

    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const gb = stats.gamesBehind || 0;

    container.innerHTML = `
      <strong>#${divisionRank} ${divisionName} Division</strong> • ${wins}-${losses} • ${gb} GB
    `;
  } catch (err) {
    console.error("Standings error:", err);
    container.innerHTML = `<strong>Celtics</strong> • Check ESPN`;
  }
}
// call it once
loadCelticsStandings();



///Revolution
async function loadrevolutionGame() {
  const statusEl = document.getElementById("revolution-status");
  statusEl.textContent = "Updating…";
  if (!statusEl) return;

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard"
    );
    const data = await res.json();

    const revolutionGame = data.events.find(event =>
      event.competitions[0].competitors.some(c =>
        c.team.displayName === "New England Revolution"
      )
    );

    if (!revolutionGame) {
      statusEl.textContent = "No game today";
      return;
    }

    const game = revolutionGame.competitions[0];
    const home = game.competitors.find(c => c.homeAway === "home");
    const away = game.competitors.find(c => c.homeAway === "away");

    const state = game.status.type.state;  //Update me!
    const clock = game.status.displayClock || "";
    const period = game.status.period || "";

    let statusText = "";

    if (state === "in") {
      statusText = `${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation} | H${period} ${clock}`;
    } else if (state === "post") {
      statusText = `FINAL: ${away.team.abbreviation} ${away.score} – ${home.score} ${home.team.abbreviation}`;
    } else {
      statusText = `Upcoming: ${away.team.abbreviation} @ ${home.team.abbreviation}`;
    }

    statusEl.textContent = statusText;

  } catch (err) {
    statusEl.textContent = "Error loading game";
    console.error(err);
  }
}

// load once on page load
loadrevolutionGame();
setInterval(loadrevolutionGame, 120000);

async function loadrevolutionStandings() {
  const container = document.getElementById("revolution-standings");
  container.textContent = "Loading standings…";

  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/soccer/usa.1/standings"
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    let revolutionData = null;
    let divisionName = "";
    let divisionRank = "?";

    // MLS = conferences (East / West)
    for (const conf of data.children || []) {

      const entries = conf.standings?.entries || [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (
          entry.team?.abbreviation === "NE" ||
          entry.team?.displayName === "New England Revolution"
        ) {
          revolutionData = entry;
          divisionRank = i + 1;     // ✅ REAL RANK
		  
		  let rankClass = "rank-out"; //added for playoff 

			if (divisionRank <= 7) {
			  rankClass = "rank-playoff";
			} else if (divisionRank <= 9) {
			  rankClass = "rank-playin";
			}
		  
          divisionName = conf.name; // Eastern Conference
          break;
        }
      }

      if (revolutionData) break;
    }

    if (!revolutionData) {
      container.textContent = "Revolution not found";
      return;
    }

    // Extract stats
    const stats = {};
    for (const s of revolutionData.stats || []) {
      stats[s.name] = s.value;
    }

    const wins = stats.wins ?? 0;
    const losses = stats.losses ?? 0;
    const gb = stats.gamesBehind ?? 0;

    container.innerHTML = `
      <strong>#${divisionRank} ${divisionName}</strong>
      • ${wins}-${losses}
      • ${gb} GB
    `;

  } catch (err) {
    console.error("Standings error:", err);
    container.innerHTML = `<strong>Revolution</strong> • Check ESPN`;
  }
}
// call it once
loadrevolutionStandings();