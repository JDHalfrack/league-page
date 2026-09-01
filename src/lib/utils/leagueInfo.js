/*   STEP 1   */
export const leagueID = "1312126115816415232"; // your league ID
export const leagueName = "USCCFFL"; // your league name
export const dues = 50; // (optional) used in template constitution page
export const dynasty = true; // true for dynasty leagues, false for redraft and keeper
export const enableBlog = false; // requires VITE_CONTENTFUL_ACCESS_TOKEN and VITE_CONTENTFUL_SPACE environment variables

/*   STEP 2   */
export const homepageText = `
  <h1>Welcome to the USCCFFL</h1>

  <h3>The United St. Charles County Fantasy Football League</h3>

  <p>
    The United St. Charles County Fantasy Football League is more than a fantasy football league. It is a history.
  </p>

  <p>
    Seasons come and go. NFL careers begin and end. First-round picks become superstars, busts, or punchlines. Contenders fall apart. Rebuilding teams suddenly arrive years ahead of schedule. Trades that once seemed ridiculous eventually become brilliant—or somehow look even worse. Through all of it, the <strong>USCCFFL keeps going</strong>.
  </p>

  <p>
    The league's surviving Sleeper record alone stretches from <strong>2019 through the present</strong>, preserving season after season of competition between twelve franchises divided between the <strong>Haak and Bredow Divisions</strong>. That record represents only the digital portion of a league whose identity has been built over years of championships, rivalries, draft-day decisions, questionable trades, improbable playoff runs, and arguments that have lasted considerably longer than the players involved.
  </p>

  <h2>Built for the Long Game</h2>

  <p>
    The USCCFFL has never been about assembling a lineup for one Sunday and forgetting about it Monday morning.
  </p>

  <p>
    This is a league built around consequences.
  </p>

  <p>
    With substantial roster retention, annual rookie drafts, tradable future draft picks, free-agent budgets, injured reserve decisions, and a long-established twelve-team structure, every move can affect far more than the upcoming week. A championship roster may have been constructed years earlier. A disastrous decision can take just as long to escape.
  </p>

  <p>
    That creates something a redraft league cannot easily reproduce: <strong>franchise history</strong>.
  </p>

  <p>
    Players become associated with particular teams. Draft classes become part of league mythology. Managers inherit the consequences of their own decisions. Rebuilds have beginnings, middles, and—occasionally—ends. A trade is not simply judged when it happens; the USCCFFL gets the luxury of judging it again six months later, three years later, and apparently forever.
  </p>

  <h2>Haak vs. Bredow</h2>

  <p>
    Across the entire surviving Sleeper archive, the league has maintained its two-division identity: <strong>Haak and Bredow</strong>.
  </p>

  <p>
    Those divisions provide the structure, but the history belongs to the franchises and managers within them. Every season adds another set of results to a record that now spans hundreds of matchups.
  </p>

  <p>
    Division races become playoff races. Playoff races become championship runs. And every December, twelve different versions of what “should have happened” eventually give way to one actual champion.
  </p>

  <p>
    The format has evolved as the NFL has evolved. The USCCFFL has adjusted playoff calendars, roster rules, injured-reserve capacity, deadlines, scoring details, and other league mechanics over the years. What has not changed is the expectation that a championship has to be earned against the same collection of people who will absolutely remember how it happened.
  </p>

  <h2>Championships Are Permanent</h2>

  <p>
    Fantasy football is temporary by nature. A matchup disappears from the front page after a week. A season resets every fall. Rosters that once seemed unbeatable eventually look like archaeological records.
  </p>

  <p>
    The purpose of this site is to make sure the <strong>league itself does not reset</strong>.
  </p>

  <p>
    The USCCFFL archive preserves the seasons that built the league: standings, matchups, rosters, drafts, transactions, playoff results, records, awards, and championships. The current season matters because of everything that came before it.
  </p>

  <p>
    A great year is more meaningful when it can be compared with seven, ten, or eventually twenty others. Records matter because somebody held them before you. Rivalries matter because the next matchup is connected to all the previous ones. Championships matter because there is a list—and your name is either on it or it isn't.
  </p>

  <p>
    Even the less distinguished accomplishments deserve preservation.
  </p>

  <p>
    The USCCFFL has, after all, maintained an official <strong>Habermaas Bowl</strong> designation in its league history. History should record the great and the terrible with equal care.
  </p>

  <h2>A League That Evolves Without Starting Over</h2>

  <p>
    Looking through the league's Sleeper history reveals something unusual: continuity.
  </p>

  <p>
    The same USCCFFL name.<br>
    The same twelve-team foundation.<br>
    The same Haak and Bredow divisions.<br>
    The same basic competitive structure.
  </p>

  <p>
    But not stagnation.
  </p>

  <p>
    The league has changed where it made sense to change. The schedule expanded with the NFL. Playoffs shifted accordingly. Reserve rules changed. Scoring was refined. League administration evolved. The game being played today is recognizably the same USCCFFL recorded in 2019, but it is not frozen in 2019.
  </p>

  <p>
    That balance is part of what gives a long-running league legitimacy. Rules can change. Owners can change. Team names can change. Players certainly change.
  </p>

  <p>
    <strong>The history remains.</strong>
  </p>

  <h2>The Record Continues</h2>

  <p>
    The 2026 season is not a new league.
  </p>

  <p>
    It is the next chapter.
  </p>

  <p>
    Another rookie class enters the system. Another set of draft picks changes hands. Another contender decides the future can wait. Another rebuilding franchise insists that <em>this</em> is finally the year the plan starts making sense. Twelve teams begin with twelve different paths to the same trophy.
  </p>

  <p>
    By the end of the season there will be another champion, another playoff bracket, another collection of wins and losses, another set of records, and another year permanently added to the USCCFFL ledger.
  </p>

  <p>
    That is what this site is intended to preserve.
  </p>

  <p>
    Not simply who is winning now, but <strong>who won before them, how they got there, who they beat, what changed afterward, and where every franchise fits into the larger history of the United St. Charles County Fantasy Football League.</strong>
  </p>

  <h3>Twelve franchises. Two divisions. One history.</h3>

  <p>
    <strong>Welcome to the USCCFFL.</strong>
  </p>
`;

/*   STEP 3   */
/*
3 managers as an example. Uncomment (remove the //) before each line to make it live code
If you're having trouble, reference the Training Wheels' Manager Section
https://github.com/nmelhado/league-page/blob/master/TRAINING_WHEELS.md#ii-adding-managers-and-changing-the-homepage-text
*/

// To omit an optional field, set it's value to null

export const managers = [];
  
  
  /*   !!  !!  IMPORTANT  !!  !! */
  /*
  Below is the most up to-date version of a manager. Please leave this commented out
  and don't delete it. This will be updated if any fields are added, removed or changed
  and will allow updates without causing merge conflicts
  */
  
    // {
    //   "roster": 3,  // (DEPRECATED! Don't use this anymore) ID of the roster that the manager manages (look at the order of the power rankings graph)
    //   "managerID": "12345678",  // the user's manager ID, go to https://api.sleeper.app/v1/league/<your_league_id>/users to find user IDs (you can use older leagueIDs to find user IDs for managers that are no longer in the league)
    //   "name": "Your Name",
    //   "tookOver": 2020, // (DEPRECATED! You don't need to use this anymore) (optional) used if a manager took over a team, delete this line or change to null otherwise
    //   "location": "Brooklyn", // (optional)
    //   "bio": "Lorem ipsum...",
    //   "photo": "/managers/name.jpg", // square ratio recommended (no larger than 500x500)
    //   "fantasyStart": 2014, // (optional) when did the manager start playing fantasy football
    //   "favoriteTeam": "nyj", // (optional) favorite NFL team, (follows convention: nyj, sea, mia, etc.) MUST BE LOWERCASE
    //   "mode": "Win Now", // (optional) 'Win Now', 'Dynasty', or 'Rebuild' (anything else and you will need to add a new png to /static/ similar to the 'Rebuild.png' and 'Win Now.png' currently in there)
    //   "rival": {
    //     name: "Rival", // Can be anything (usually your rival's name)
    //     link: 6, // manager array number within this array, or null to link back to all managers page
    //     image: "/managers/rival.jpg", // either a specific manager photo or '/managers/everyone.png' or '/managers/question.png'
    //   },
    //   "favoritePlayer": 1426, // (optional) this corresponds to the Sleeper player ID (https://api.sleeper.app/v1/players/nfl)
    //   "valuePosition": "WR", // (optional) Favorite position (QB, WR, RB, TE, etc.)
    //   "rookieOrVets": "Rookies", // (optional) 'Rookies' or 'Vets' (anything else and you will need to add a new png to /static/ similar to the 'Rookies.png' and 'Vets.png' currently in there)
    //   "philosophy": "Your fantasy team's philosophy", // (optional)
    //   "tradingScale": 10, // 1 - 10 (optional)
    //   "preferredContact": "Text",  // (optional) 'Text', 'WhatsApp', 'Sleeper', 'Email', 'Phone', 'Discord', and 'Carrier Pigeon' are currently supplied in the template
    // },
    
