/*
=========================================================
BOSTON SPORTS DASHBOARD
Part 1: Configuration, shared utilities, and ticker
=========================================================
*/

const ticker = document.getElementById("ticker-content");
const controls = document.getElementById("controls");
const bostonToggle = document.getElementById("bostonMode");
const liveOnlyToggle = document.getElementById("liveOnly");

const SCORE_REFRESH_INTERVAL = 60_000;
const HOURS_AFTER_FINAL = 18;

/*
---------------------------------------------------------
Boston team configuration
---------------------------------------------------------
*/

const BOSTON_TEAMS = [
  {
    name: "Boston Bruins",
    shortName: "Bruins",
    abbreviation: "BOS",
    order: 1
  },
  {
    name: "Boston Red Sox",
    shortName: "Red Sox",
    abbreviation: "BOS",
    order: 2
  },
  {
    name: "New England Patriots",
    shortName: "Patriots",
    abbreviation: "NE",
    order: 3
  },
  {
    name: "Boston Celtics",
    shortName: "Celtics",
    abbreviation: "BOS",
    order: 4
  },
  {
    name: "New England Revolution",
    shortName: "Revolution",
    abbreviation: "NE",
    order: 5
  }
];

/*
---------------------------------------------------------
League configuration

The checkbox values in your HTML should match these keys:

football/nfl
hockey/nhl
baseball/mlb
basketball/nba
soccer/usa.1
---------------------------------------------------------
*/

const LEAGUES = {
  "hockey/nhl": {
    sportName: "Hockey"
  },
  "baseball/mlb": {
    sportName: "Baseball"
  },
  "football/nfl": {
    sportName: "Football"
  },
  "basketball/nba": {
    sportName: "Basketball"
  },
  "soccer/usa.1": {
    sportName: "Soccer"
  }
};

/*
---------------------------------------------------------
Shared utility functions
---------------------------------------------------------
*/

function getCheckedLeagues() {
  return Array.from(
    document.querySelectorAll("#controls input[type='checkbox']")
  )
    .filter(checkbox => {
      return checkbox.checked && LEAGUES[checkbox.value];
    })
    .map(checkbox => checkbox.value);
}

function getCompetition(event) {
  return event?.competitions?.[0] || null;
}

function getHomeAndAway(competition) {
  const competitors = competition?.competitors || [];

  return {
    home: competitors.find(team => team.homeAway === "home") || null,
    away: competitors.find(team => team.homeAway === "away") || null
  };
}

function getTeamName(competitor) {
  return (
    competitor?.team?.displayName ||
    competitor?.team?.name ||
    competitor?.team?.shortDisplayName ||
    ""
  );
}

function getTeamLogo(competitor) {
  return competitor?.team?.logo || "";
}

function getTeamAbbreviation(competitor) {
  return (
    competitor?.team?.abbreviation ||
    competitor?.team?.shortDisplayName ||
    getTeamName(competitor)
  );
}

function findBostonTeam(home, away) {
  const homeName = getTeamName(home);
  const awayName = getTeamName(away);

  return (
    BOSTON_TEAMS.find(team => {
      return team.name === homeName || team.name === awayName;
    }) || null
  );
}

function isBostonGame(home, away) {
  return Boolean(findBostonTeam(home, away));
}

function isToday(dateValue) {
  if (!dateValue) return false;

  const gameDate = new Date(dateValue);
  const today = new Date();

  return (
    gameDate.getFullYear() === today.getFullYear() &&
    gameDate.getMonth() === today.getMonth() &&
    gameDate.getDate() === today.getDate()
  );
}

function isRecentFinal(competition) {
  const state = competition?.status?.type?.state;

  if (state !== "post") return false;

  const competitionDate = new Date(competition?.date);

  if (Number.isNaN(competitionDate.getTime())) {
    return true;
  }

  const ageInHours =
    (Date.now() - competitionDate.getTime()) / (1000 * 60 * 60);

  return ageInHours <= HOURS_AFTER_FINAL;
}

function shouldShowCompetition(competition) {
  const state = competition?.status?.type?.state || "";
  const gameDate = competition?.date;

  if (liveOnlyToggle?.checked) {
    return state === "in";
  }

  if (state === "in") {
    return true;
  }

  if (state === "post") {
    return isRecentFinal(competition);
  }

  if (state === "pre") {
    return isToday(gameDate);
  }

  return false;
}

function formatStatus(competition, sportName) {
  const status = competition?.status;
  const state = status?.type?.state || "";
  const shortDetail = status?.type?.shortDetail || "";
  const detail = status?.type?.detail || shortDetail;
  const period = status?.period || "";
  const clock = status?.displayClock || "";

  if (state === "post") {
    return "Final";
  }

  if (state === "pre") {
    return shortDetail;
  }

  if (state !== "in") {
    return shortDetail;
  }

  switch (sportName) {
    case "Basketball":
      return period && clock
        ? `Q${period} • ${clock}`
        : detail;

    case "Football":
      return period && clock
        ? `Q${period} • ${clock}`
        : detail;

    case "Hockey":
      return period && clock
        ? `P${period} • ${clock}`
        : detail;

    case "Baseball":
      return detail;

    case "Soccer":
      return shortDetail || detail;

    default:
      return detail;
  }
}

function getStateClass(competition) {
  const state = competition?.status?.type?.state;

  if (state === "in") return "live";
  if (state === "post") return "final";

  return "upcoming";
}

function createLogoHtml(competitor) {
  const logo = getTeamLogo(competitor);
  const abbreviation = getTeamAbbreviation(competitor);

  if (!logo) return "";

  return `
    <img
      src="${logo}"
      alt="${abbreviation}"
      class="ticker-team-logo"
      style="height:20px; width:20px; object-fit:contain; margin-right:4px;"
      onerror="this.style.display='none'"
    >
  `;
}

function createGameHtml(competition, sportName) {
  const { home, away } = getHomeAndAway(competition);

  if (!home || !away) {
    return "";
  }

  const stateClass = getStateClass(competition);
  const statusText = formatStatus(competition, sportName);

  const awayAbbreviation = getTeamAbbreviation(away);
  const homeAbbreviation = getTeamAbbreviation(home);

  const awayScore = away?.score ?? "";
  const homeScore = home?.score ?? "";

  return `
    <span
      class="${stateClass}"
      style="display:inline-flex; align-items:center; margin-right:18px;"
    >
      ${createLogoHtml(away)}
      <span>${awayAbbreviation} ${awayScore}</span>

      <span style="margin:0 5px;">–</span>

      ${createLogoHtml(home)}
      <span>${homeAbbreviation} ${homeScore}</span>

      <span style="margin-left:6px;">
        (${statusText})
      </span>
    </span>
  `;
}

/*
---------------------------------------------------------
ESPN data loader
---------------------------------------------------------
*/

async function fetchScoreboard(league) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${league}/scoreboard`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ESPN scoreboard request failed for ${league}: ` +
      `HTTP ${response.status}`
    );
  }

  return response.json();
}

/*
---------------------------------------------------------
Ticker loader
---------------------------------------------------------
*/

let scoresAreLoading = false;

async function loadScores() {
  if (!ticker || scoresAreLoading) {
    return;
  }

  scoresAreLoading = true;

  const selectedLeagues = getCheckedLeagues();
  const bostonOnly = Boolean(bostonToggle?.checked);

  if (selectedLeagues.length === 0) {
    ticker.textContent = "Select at least one league";
    scoresAreLoading = false;
    return;
  }

  const regularGames = [];
  const bostonGames = [];

  try {
    const leagueRequests = selectedLeagues.map(async league => {
      try {
        const data = await fetchScoreboard(league);

        return {
          league,
          sportName:
            data?.leagues?.[0]?.sport?.name ||
            LEAGUES[league]?.sportName ||
            "",
          events: data?.events || []
        };
      } catch (error) {
        console.error(error);

        return {
          league,
          sportName: LEAGUES[league]?.sportName || "",
          events: []
        };
      }
    });

    const leagueResults = await Promise.all(leagueRequests);

    for (const leagueResult of leagueResults) {
      const { sportName, events } = leagueResult;

      for (const event of events) {
        const competition = getCompetition(event);

        if (!competition) continue;
        if (!shouldShowCompetition(competition)) continue;

        const { home, away } = getHomeAndAway(competition);

        if (!home || !away) continue;

        const bostonTeam = findBostonTeam(home, away);

        if (bostonOnly && !bostonTeam) {
          continue;
        }

        const gameHtml = createGameHtml(
          competition,
          sportName
        );

        if (!gameHtml) continue;

        if (bostonOnly && bostonTeam) {
          bostonGames.push({
            order: bostonTeam.order,
            html: gameHtml
          });
        } else {
          regularGames.push(gameHtml);
        }
      }
    }

    if (bostonOnly) {
      bostonGames.sort((a, b) => a.order - b.order);

      ticker.innerHTML =
        bostonGames.map(game => game.html).join("") ||
        "No Boston games match your selection";
    } else {
      ticker.innerHTML =
        regularGames.join("") ||
        "No games match your selection";
    }
  } catch (error) {
    console.error("Unexpected ticker error:", error);
    ticker.textContent = "Unable to load scores";
  } finally {
    scoresAreLoading = false;
  }
}

/*
---------------------------------------------------------
Ticker controls and refresh timer
---------------------------------------------------------
*/

controls?.addEventListener("change", loadScores);

loadScores();

setInterval(loadScores, SCORE_REFRESH_INTERVAL);


const TEAM_CARDS = [
    {
        id: "bruins",
        displayName: "Boston Bruins",
        league: "hockey/nhl",
        sport: "Hockey"
    },
    {
        id: "redsox",
        displayName: "Boston Red Sox",
        league: "baseball/mlb",
        sport: "Baseball"
    },
    {
        id: "patriots",
        displayName: "New England Patriots",
        league: "football/nfl",
        sport: "Football"
    },
    {
        id: "celtics",
        displayName: "Boston Celtics",
        league: "basketball/nba",
        sport: "Basketball"
    },
    {
        id: "revolution",
        displayName: "New England Revolution",
        league: "soccer/usa.1",
        sport: "Soccer"
    }
];

async function loadTeamGame(team) {

    const statusEl = document.getElementById(`${team.id}-status`);

    if (!statusEl) return;

    statusEl.className = "team-status";
	statusEl.textContent = "Updating…";

    try {

        const data = await fetchScoreboard(team.league);

        const event = (data.events || []).find(e => {
		  const competition = getCompetition(e);

		  if (!competition) return false;
		  if (!isToday(competition.date) && !isRecentFinal(competition)) return false;

		  return competition.competitors?.some(
			competitor => getTeamName(competitor) === team.displayName
		  );
		});

        if (!event) {
            statusEl.classList.add("status-offseason");
			statusEl.textContent = "No Game Scheduled Today";
            return;
        }

        const competition = getCompetition(event);

        const { home, away } = getHomeAndAway(competition);
			if (!home || !away) {
			  statusEl.textContent = "Game data unavailable";
			 return;
}

        const state = competition.status.type.state;

        let text = "";

        if (state === "in") {
		  statusEl.classList.add("status-live");

		  text =
			`${getTeamAbbreviation(away)} ${away.score ?? 0} – ` +
			`${home.score ?? 0} ${getTeamAbbreviation(home)} | ` +
			`${formatStatus(competition, team.sport)}`;

		} else if (state === "post") {
		  statusEl.classList.add("status-final");

		  text =
			`FINAL: ${getTeamAbbreviation(away)} ${away.score ?? 0} – ` +
			`${home.score ?? 0} ${getTeamAbbreviation(home)}`;

		} else {
		  statusEl.classList.add("status-upcoming");

		  const startTime =
			competition?.status?.type?.shortDetail ||
			"Time TBD";

		  text =
			`${getTeamAbbreviation(away)} at ` +
			`${getTeamAbbreviation(home)} • ${startTime}`;
		}

        statusEl.textContent = text;

    } catch (err) {

        console.error(team.displayName, err);

        statusEl.classList.add("status-error");
		statusEl.textContent = "Unable to load game information";
    }

}

async function loadAllTeamGames() {

    await Promise.all(
        TEAM_CARDS.map(loadTeamGame)
    );

}

loadAllTeamGames();

setInterval(loadAllTeamGames, 120000);

/*
=========================================================
TEAM STANDINGS
=========================================================
*/

const STANDINGS_REFRESH_INTERVAL = 15 * 60 * 1000;

const STANDINGS_CONFIG = [
  {
    id: "bruins",
    teamName: "Boston Bruins",
    abbreviation: "BOS",
    league: "hockey/nhl",
    groupName: "Atlantic Division",
    groupTeams: [
      "BOS",
      "BUF",
      "DET",
      "FLA",
      "MTL",
      "OTT",
      "TB",
      "TOR"
    ],
    rankStat: "points",
    rankDirection: "descending",
    format: "hockey"
  },

  {
    id: "redsox",
    teamName: "Boston Red Sox",
    abbreviation: "BOS",
    league: "baseball/mlb",
    groupName: "AL East",
    groupTeams: [
      "BAL",
      "BOS",
      "NYY",
      "TB",
      "TOR"
    ],
    rankStat: "divisionGamesBehind",
    rankDirection: "ascending",
    format: "baseball"
  },

  {
    id: "patriots",
    teamName: "New England Patriots",
    abbreviation: "NE",
    league: "football/nfl",
    groupName: "AFC East",
    groupTeams: [
      "BUF",
      "MIA",
      "NE",
      "NYJ"
    ],
    rankStat: ["winPercent", "winPercentage"],
    rankDirection: "descending",
    format: "football"
  },

  {
    id: "celtics",
    teamName: "Boston Celtics",
    abbreviation: "BOS",
    league: "basketball/nba",
    groupName: "Atlantic Division",
    groupTeams: [
      "BOS",
      "BKN",
      "NY",
      "PHI",
      "TOR"
    ],
    rankStat: ["winPercent", "winPercentage"],
    rankDirection: "descending",
    format: "basketball"
  },

  {
    id: "revolution",
    teamName: "New England Revolution",
    abbreviation: "NE",
    league: "soccer/usa.1",
    groupName: "Eastern Conference",
    format: "soccer"
  }
];

/*
---------------------------------------------------------
Standings helpers
---------------------------------------------------------
*/

async function fetchStandings(league) {
  const url =
    `https://site.web.api.espn.com/apis/v2/sports/` +
    `${league}/standings`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ESPN standings request failed for ${league}: ` +
      `HTTP ${response.status}`
    );
  }

  return response.json();
}

function getStatsObject(entry) {
  const stats = {};

  for (const stat of entry?.stats || []) {
    if (!stat?.name) continue;

    stats[stat.name] =
      stat.value ??
      stat.displayValue ??
      null;
  }

  return stats;
}

function getStatValue(entry, statNames, fallback = 0) {
 const names = Array.isArray(statNames)
  ? statNames
  : [statNames];

  const stat = entry?.stats?.find(item =>
    names.includes(item.name)
  );

  if (!stat) {
    return fallback;
  }

  const value = stat.value ?? stat.displayValue;

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numberValue = Number(value);

  return Number.isNaN(numberValue)
    ? value
    : numberValue;
}

/*
ESPN uses slightly different nesting for different leagues.
This recursively collects every standings entry that contains
a team object.
*/

function collectStandingsEntries(node, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectStandingsEntries(item, results);
    }

    return results;
  }

  if (node.team && Array.isArray(node.stats)) {
    results.push(node);
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      collectStandingsEntries(value, results);
    }
  }

  return results;
}

function removeDuplicateEntries(entries) {
  const uniqueEntries = new Map();

  for (const entry of entries) {
    const key =
      entry?.team?.id ||
      entry?.team?.uid ||
      entry?.team?.displayName ||
      entry?.team?.abbreviation;

    if (!key) continue;

    if (!uniqueEntries.has(key)) {
      uniqueEntries.set(key, entry);
    }
  }

  return Array.from(uniqueEntries.values());
}

function findTeamEntry(entries, config) {
  return entries.find(entry => {
    const abbreviation = entry?.team?.abbreviation;
    const displayName = entry?.team?.displayName;
    const name = entry?.team?.name;

    return (
      abbreviation === config.abbreviation &&
      (
        displayName === config.teamName ||
        displayName?.includes(
          config.teamName.split(" ").at(-1)
        ) ||
        name?.includes(
          config.teamName.split(" ").at(-1)
        )
      )
    );
  });
}

function getGroupEntries(entries, config) {
  if (!config.groupTeams) {
    return entries;
  }

  return entries.filter(entry =>
    config.groupTeams.includes(
      entry?.team?.abbreviation
    )
  );
}

function sortGroupEntries(entries, config) {
  const sortedEntries = [...entries];

  sortedEntries.sort((a, b) => {
    const aValue = getStatValue(
      a,
      config.rankStat,
      config.rankDirection === "ascending"
        ? 999
        : 0
    );

    const bValue = getStatValue(
      b,
      config.rankStat,
      config.rankDirection === "ascending"
        ? 999
        : 0
    );

    if (config.rankDirection === "ascending") {
      return aValue - bValue;
    }

    return bValue - aValue;
  });

  return sortedEntries;
}

function getTeamRank(entries, config) {
  const sortedEntries = sortGroupEntries(
    entries,
    config
  );

  const index = sortedEntries.findIndex(entry => {
    const abbreviation =
      entry?.team?.abbreviation;

    const displayName =
      entry?.team?.displayName;

    return (
      abbreviation === config.abbreviation &&
      displayName === config.teamName
    );
  });

  return index >= 0 ? index + 1 : "?";
}

/*
---------------------------------------------------------
League-specific display formatting
---------------------------------------------------------
*/

const NHL_EAST_DIVISIONS = {
  atlantic: [
    "BOS",
    "BUF",
    "DET",
    "FLA",
    "MTL",
    "OTT",
    "TB",
    "TOR"
  ],

  metropolitan: [
    "CAR",
    "CBJ",
    "NJ",
    "NYI",
    "NYR",
    "PHI",
    "PIT",
    "WSH"
  ]
};

	function calculateHockeyWildCard(allEntries, teamAbbreviation) {
	  const easternAbbreviations = [
		...NHL_EAST_DIVISIONS.atlantic,
		...NHL_EAST_DIVISIONS.metropolitan
	  ];

	  const easternTeams = allEntries.filter(entry =>
		easternAbbreviations.includes(
		  entry?.team?.abbreviation
		)
	  );

	  function getPoints(entry) {
		return Number(
		  getStatValue(entry, "points", 0)
		);
	  }

	  function sortByStandings(a, b) {
		const pointsDifference =
		  getPoints(b) - getPoints(a);

		if (pointsDifference !== 0) {
		  return pointsDifference;
		}

		/*
		Tie-breaking helpers. ESPN may provide one or more
		of these fields depending on the season.
		*/

		const aRegulationWins = Number(
		  getStatValue(
			a,
			["regulationWins", "regulationWin"],
			0
		  )
		);

		const bRegulationWins = Number(
		  getStatValue(
			b,
			["regulationWins", "regulationWin"],
			0
		  )
		);

		if (bRegulationWins !== aRegulationWins) {
		  return bRegulationWins - aRegulationWins;
		}

		const aRow = Number(
		  getStatValue(
			a,
			["regulationOvertimeWins", "row"],
			0
		  )
		);

		const bRow = Number(
		  getStatValue(
			b,
			["regulationOvertimeWins", "row"],
			0
		  )
		);

		return bRow - aRow;
	  }

	  const atlanticTeams = easternTeams
		.filter(entry =>
		  NHL_EAST_DIVISIONS.atlantic.includes(
			entry?.team?.abbreviation
		  )
		)
		.sort(sortByStandings);

	  const metropolitanTeams = easternTeams
		.filter(entry =>
		  NHL_EAST_DIVISIONS.metropolitan.includes(
			entry?.team?.abbreviation
		  )
		)
		.sort(sortByStandings);

	  /*
	  The top three teams in each division qualify through
	  their division and are removed from the wildcard race.
	  */

	  const divisionQualifiers = [
		...atlanticTeams.slice(0, 3),
		...metropolitanTeams.slice(0, 3)
	  ];

	  const divisionQualifierAbbreviations =
		divisionQualifiers.map(
		  entry => entry?.team?.abbreviation
		);

	  if (
		divisionQualifierAbbreviations.includes(
		  teamAbbreviation
		)
	  ) {
		return "Division spot";
	  }

	  const wildCardTeams = easternTeams
		.filter(entry =>
		  !divisionQualifierAbbreviations.includes(
			entry?.team?.abbreviation
		  )
		)
		.sort(sortByStandings);

	  const teamIndex = wildCardTeams.findIndex(
		entry =>
		  entry?.team?.abbreviation ===
		  teamAbbreviation
	  );

	  if (teamIndex === 0) {
		return "WC1";
	  }

	  if (teamIndex === 1) {
		return "WC2";
	  }

	  const teamEntry = wildCardTeams[teamIndex];
	  const secondWildCard = wildCardTeams[1];

	  if (!teamEntry || !secondWildCard) {
		return "WC unavailable";
	  }

	  const teamPoints = getPoints(teamEntry);
	  const cutoffPoints = getPoints(secondWildCard);
	  const pointsOut = cutoffPoints - teamPoints;

	  if (pointsOut <= 0) {
		return "Tied for WC2";
	  }

	  return `${pointsOut} pts out of WC`;
	}

function formatHockeyStandings(
  entry,
  divisionRank,
  config,
  allEntries
) {
  const stats = getStatsObject(entry);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;

  const overtimeLosses =
    stats.otLosses ??
    stats.overtimeLosses ??
    0;

  const points = stats.points ?? 0;

  const wildCardText =
    calculateHockeyWildCard(
      allEntries,
      config.abbreviation
    );

  return `
    <strong>
      #${divisionRank} ${config.groupName}
      • ${wildCardText}
    </strong>
    <br>
    ${wins}-${losses}-${overtimeLosses}
    • ${points} pts
  `;
}

const MLB_AL_DIVISIONS = {
  east: ["BAL", "BOS", "NYY", "TB", "TOR"],

  central: ["CWS", "CLE", "DET", "KC", "MIN"],

  west: ["ATH", "HOU", "LAA", "SEA", "TEX"]
};

function calculateBaseballWildCard(
  allEntries,
  teamAbbreviation
) {
  const americanLeagueTeams = [
    ...MLB_AL_DIVISIONS.east,
    ...MLB_AL_DIVISIONS.central,
    ...MLB_AL_DIVISIONS.west
  ];

  const alEntries = allEntries.filter(entry =>
    americanLeagueTeams.includes(
      entry?.team?.abbreviation
    )
  );

  function getWins(entry) {
    return Number(
      getStatValue(entry, "wins", 0)
    );
  }

  function getLosses(entry) {
    return Number(
      getStatValue(entry, "losses", 0)
    );
  }

  function getWinPercentage(entry) {
    const winPercentage = getStatValue(
      entry,
      ["winPercent", "winPercentage"],
      null
    );

    if (winPercentage !== null) {
      return Number(winPercentage);
    }

    const wins = getWins(entry);
    const losses = getLosses(entry);
    const totalGames = wins + losses;

    return totalGames > 0
      ? wins / totalGames
      : 0;
  }

  function sortTeams(a, b) {
    const percentageDifference =
      getWinPercentage(b) -
      getWinPercentage(a);

    if (percentageDifference !== 0) {
      return percentageDifference;
    }

    return getWins(b) - getWins(a);
  }

  function getDivisionTeams(
    divisionAbbreviations
  ) {
    return alEntries
      .filter(entry =>
        divisionAbbreviations.includes(
          entry?.team?.abbreviation
        )
      )
      .sort(sortTeams);
  }

  const eastTeams =
    getDivisionTeams(MLB_AL_DIVISIONS.east);

  const centralTeams =
    getDivisionTeams(MLB_AL_DIVISIONS.central);

  const westTeams =
    getDivisionTeams(MLB_AL_DIVISIONS.west);

  /*
  MLB division winners qualify automatically.
  Remove the three division leaders from the
  wildcard standings.
  */

  const divisionWinners = [
    eastTeams[0],
    centralTeams[0],
    westTeams[0]
  ].filter(Boolean);

  const divisionWinnerAbbreviations =
    divisionWinners.map(entry =>
      entry?.team?.abbreviation
    );

  if (
    divisionWinnerAbbreviations.includes(
      teamAbbreviation
    )
  ) {
    return {
      text: "Division spot",
      className: "badge-playoff"
    };
  }

  const wildCardTeams = alEntries
    .filter(entry =>
      !divisionWinnerAbbreviations.includes(
        entry?.team?.abbreviation
      )
    )
    .sort(sortTeams);

  const teamIndex = wildCardTeams.findIndex(
    entry =>
      entry?.team?.abbreviation ===
      teamAbbreviation
  );

  if (teamIndex === -1) {
    return {
      text: "WC unavailable",
      className: "badge-out"
    };
  }

  /*
  MLB currently has three wildcard teams
  per league.
  */

  if (teamIndex <= 2) {
    return {
      text: `WC${teamIndex + 1}`,
      className: "badge-playoff"
    };
  }

  const teamEntry =
    wildCardTeams[teamIndex];

  const thirdWildCard =
    wildCardTeams[2];

  if (!teamEntry || !thirdWildCard) {
    return {
      text: "WC unavailable",
      className: "badge-out"
    };
  }

  /*
  Games behind approximation:
  ((cutoff wins - team wins) +
  (team losses - cutoff losses)) / 2
  */

  const gamesOut =
    (
      (
        getWins(thirdWildCard) -
        getWins(teamEntry)
      ) +
      (
        getLosses(teamEntry) -
        getLosses(thirdWildCard)
      )
    ) / 2;

  if (gamesOut <= 0) {
    return {
      text: "Tied for WC3",
      className: "badge-playin"
    };
  }

  return {
    text: `${gamesOut} GB WC`,
    className: "badge-out"
  };
}

function formatBaseballStandings(
  entry,
  divisionRank,
  config,
  allEntries
) {
  const stats = getStatsObject(entry);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;

  const gamesBehind =
    stats.divisionGamesBehind ??
    stats.gamesBehind ??
    0;

  const divisionText =
    Number(gamesBehind) === 0
      ? "Division leader"
      : `${gamesBehind} GB`;

  const wildCard =
    calculateBaseballWildCard(
      allEntries,
      config.abbreviation
    );

  return `
    <strong>
      #${divisionRank} ${config.groupName}
    </strong>

    <span class="standings-badge ${wildCard.className}">
      ${wildCard.text}
    </span>

    <br>

    ${wins}-${losses}
    • ${divisionText}
  `;
}

function formatFootballStandings(
  entry,
  divisionRank,
  config
) {
  const stats = getStatsObject(entry);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const ties = stats.ties ?? 0;

  const record =
    Number(ties) > 0
      ? `${wins}-${losses}-${ties}`
      : `${wins}-${losses}`;

  return `
    <strong>
      #${divisionRank} ${config.groupName}
    </strong>
    • ${record}
  `;
}

function formatBasketballStandings(
  entry,
  divisionRank,
  config
) {
  const stats = getStatsObject(entry);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;

  const gamesBehind =
    stats.divisionGamesBehind ??
    stats.gamesBehind ??
    0;

  const gamesBehindText =
    Number(gamesBehind) === 0
      ? "Division leader"
      : `${gamesBehind} GB`;

  return `
    <strong>
      #${divisionRank} ${config.groupName}
    </strong>
    • ${wins}-${losses}
    • ${gamesBehindText}
  `;
}

function formatSoccerStandings(
  entry,
  conferenceRank,
  config
) {
  const stats = getStatsObject(entry);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const ties = stats.ties ?? 0;
  const points = stats.points ?? 0;

  let badgeClass = "badge-out";
  let badgeText = "OUT";

  if (conferenceRank <= 7) {
    badgeClass = "badge-playoff";
    badgeText = "PLAYOFF";
  } else if (conferenceRank <= 9) {
    badgeClass = "badge-playin";
    badgeText = "PLAY-IN";
  }

  return `
    <strong>
      #${conferenceRank} ${config.groupName}
    </strong>

    <span class="standings-badge ${badgeClass}">
      ${badgeText}
    </span>

    <br>

    ${wins}-${losses}-${ties}
    • ${points} pts
  `;
}

function formatStandings(
  entry,
  rank,
  config,
  allEntries
) {
  switch (config.format) {
    case "hockey":
  return formatHockeyStandings(
    entry,
    rank,
    config,
    allEntries
  );

    case "baseball":
  return formatBaseballStandings(
    entry,
    rank,
    config,
    allEntries
  );

    case "football":
      return formatFootballStandings(
        entry,
        rank,
        config
      );

    case "basketball":
      return formatBasketballStandings(
        entry,
        rank,
        config
      );

    case "soccer":
      return formatSoccerStandings(
        entry,
        rank,
        config
      );

    default:
      return `<strong>#${rank} ${config.groupName}</strong>`;
  }
}

/*
---------------------------------------------------------
Generic standings loader
---------------------------------------------------------
*/

async function loadTeamStandings(config) {
  const container = document.getElementById(
    `${config.id}-standings`
  );

  if (!container) {
    return;
  }

  container.textContent = "Loading standings…";

  try {
    const data = await fetchStandings(
      config.league
    );

    const allEntries = removeDuplicateEntries(
      collectStandingsEntries(data)
    );

    const teamEntry = findTeamEntry(
      allEntries,
      config
    );

    if (!teamEntry) {
      container.textContent =
        `${config.teamName} not found`;

      return;
    }

    let groupEntries;

    /*
    For MLS, use the conference containing the Revolution
    when ESPN provides conference children.
    */

    if (config.format === "soccer") {
      groupEntries = findSoccerConferenceEntries(
        data,
        config
      );
    } else {
      groupEntries = getGroupEntries(
        allEntries,
        config
      );
    }

    const rank = getTeamRank(
      groupEntries,
      config
    );

    container.innerHTML = formatStandings(
	  teamEntry,
	  rank,
	  config,
	  allEntries
	);
  } catch (error) {
    console.error(
      `${config.teamName} standings error:`,
      error
    );

    container.innerHTML =
      `<strong>${config.teamName}</strong> • Check ESPN`;
  }
}

/*
---------------------------------------------------------
MLS conference helper
---------------------------------------------------------
*/

function findSoccerConferenceEntries(
  data,
  config
) {
  for (const conference of data?.children || []) {
    const entries = removeDuplicateEntries(
      collectStandingsEntries(
        conference?.standings?.entries || []
      )
    );

    const containsTeam = entries.some(entry =>
      entry?.team?.displayName ===
        config.teamName ||
      entry?.team?.abbreviation ===
        config.abbreviation
    );

    if (containsTeam) {
      config.groupName =
        conference?.name ||
        config.groupName;

      return entries;
    }
  }

  return removeDuplicateEntries(
    collectStandingsEntries(data)
  );
}

/*
---------------------------------------------------------
Load and refresh every team's standings
---------------------------------------------------------
*/

let standingsAreLoading = false;

async function loadAllStandings() {
  if (standingsAreLoading) {
    return;
  }

  standingsAreLoading = true;

  try {
    await Promise.all(
      STANDINGS_CONFIG.map(
        loadTeamStandings
      )
    );
  } finally {
    standingsAreLoading = false;
  }
}

loadAllStandings();

setInterval(
  loadAllStandings,
  STANDINGS_REFRESH_INTERVAL
);