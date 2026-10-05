import { state, TYPES, ORDERS, CUSTOMERS, COMMISSIONS, activeCommission, getPlot, saleValue,
  ownedBuildings, getPlayerHairColor, BUILDING } from "./state.js";
import { renderCar } from "./car.js";

const dollars = value => `${value < 0 ? "−" : ""}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
export const parcelName = plot => `${String.fromCharCode(65 + plot.x)}${plot.y + 1}`;
export function portrait(id = "joe", mood = "happy") {
  return `<span class="portrait portrait-${id} mood-${mood}" style="--hair:${id === "joe" ? getPlayerHairColor() : id === "mara" ? "#805543" : id === "dax" ? "#b77d49" : "#433d45"}" aria-hidden="true"><i class="portrait-head"></i><i class="portrait-body"></i><i class="portrait-face"></i></span>`;
}
const titleBoard = () => `<div class="title-machine" aria-hidden="true"><div class="machine-ring"></div><div class="title-quartet">${TYPES.map((type, index) => `<span class="title-parcel parcel-${index}"><i>${["☀", "✿", "⌂", "≈"][index]}</i></span>`).join("")}</div><b>⟳</b><span class="machine-label">THE TOWN IS IN YOUR HANDS</span></div>`;

export function renderTitle(canContinue) {
  return `<div class="title-layout"><div class="title-copy"><span class="jam-kicker">A VALLEY EXCHANGE STORY</span><h1 id="game-dialog-title">PLOT<br><em>TWIST.</em></h1><p class="title-hook">A cup of coffee.<br>A strange old deed.<br>A town that can turn.</p><p class="title-description">Make coffee, grow a neighborhood, and earn Joe's dream roadster. Then discover what's in its trunk.</p><div class="title-actions">${canContinue ? `<button class="primary" data-jam="continue" autofocus>CONTINUE YOUR STORY →</button>` : ""}<button class="${canContinue ? "secondary" : "primary"}" data-jam="new" ${canContinue ? "" : "autofocus"}>${canContinue ? "NEW GAME" : "OPEN THE COFFEE SHOP →"}</button></div><div class="title-links"><button data-jam="settings">SETTINGS</button><button data-jam="credits">CREDITS</button></div><small>8–12 MINUTES · MOUSE / TOUCH / KEYBOARD · AUTOSAVE</small></div><div class="title-art">${titleBoard()}<div class="title-joe">${portrait("joe")}<span>JOE'S CORNER CUP<br><b>YOUR FIRST SHIFT STARTS HERE</b></span></div><div class="title-car">${renderCar("title")}<span>THE DREAM / ${dollars(state.carGoal.price)}</span></div></div></div>`;
}

export function renderSettings(reduced) {
  return `<div class="jam-dialog-content"><span class="jam-kicker">MAKE YOURSELF AT HOME</span><h2 id="game-dialog-title">Settings</h2><label class="setting-toggle"><span>Game sound</span><input id="setting-sound" type="checkbox" ${state.settings.sound ? "checked" : ""}></label><label class="setting-range" for="setting-music">Music <output id="music-value">${Math.round(state.settings.music * 100)}%</output></label><input id="setting-music" type="range" min="0" max="100" value="${Math.round(state.settings.music * 100)}"><label class="setting-range" for="setting-sfx">Sound effects <output id="sfx-value">${Math.round(state.settings.sfx * 100)}%</output></label><input id="setting-sfx" type="range" min="0" max="100" value="${Math.round(state.settings.sfx * 100)}"><label class="setting-toggle"><span>Reduced motion<small>Gentle fades, no shake or moving particles.</small></span><input id="setting-motion" type="checkbox" ${reduced ? "checked" : ""}></label><div class="controls-note"><b>KEYBOARD</b><p>Tab to a control, Enter to choose. Arrow keys select land. Space operates the focused brewing control: hold to pour, tap to stir, press to stop pressure. Escape opens the pause menu.</p></div><button class="primary" data-jam="back" autofocus>DONE</button><p class="dialog-foot">Game and brewing timers are paused here.</p></div>`;
}

export function renderPause() {
  return `<div class="jam-dialog-content"><span class="jam-kicker">TAKE A BREATHER</span><h2 id="game-dialog-title">The valley can wait.</h2><p>Every parcel, cup, and bill is paused.</p><div class="menu-actions"><button class="primary" data-jam="resume" autofocus>RESUME →</button><button class="secondary" data-jam="journal">COMMISSION JOURNAL</button><button class="secondary" data-jam="settings">SETTINGS & CONTROLS</button><button class="text-button" data-jam="title">TITLE SCREEN</button></div></div>`;
}

export function renderCredits() {
  return `<div class="jam-dialog-content"><span class="jam-kicker">MADE WITH SMALL THINGS</span><h2 id="game-dialog-title">Credits</h2><p>Game, original portraits, roadster, and original “Corner Cup” synth music created for Plot Twist.</p><p>Town scenery: <a href="https://kenney.nl/assets/tiny-town" target="_blank" rel="noopener noreferrer">Kenney Tiny Town</a> · CC0. Ground artwork: project-owner supplied export.png.</p><p>“Step dirt (Cozy Game SFX Free)” by <a href="https://freesound.org/people/heyheytheree/sounds/872597/" target="_blank" rel="noopener noreferrer">heyheytheree</a> · CC BY 4.0. “Pouring coffee” by <a href="https://freesound.org/people/Maajora/sounds/432775/" target="_blank" rel="noopener noreferrer">Maajora</a> · CC0. “Tea cup set down.mp3” by <a href="https://freesound.org/people/TheHiraHira/sounds/460242/" target="_blank" rel="noopener noreferrer">TheHiraHira</a> · CC0.</p><p>Submission cover: AI-generated key art. Gameplay screenshots show the actual game.</p><button class="primary" data-jam="back" autofocus>BACK</button></div>`;
}

export const DIALOGUES = {
  deeds: [
    ["mara", "Mara · Surveyor", "That coffee is exactly what I needed. But look at this deed: the address has moved. Houses don't usually do that."],
    ["nell", "Nell · Courier", "My deliveries keep ending up one street over. There's a spiral stamped on the cheap Sunfield parcel. I've marked it for you."],
    ["joe", "Joe", "Coffee money for a piece of the mystery. I'll buy that parcel and take a closer look."]
  ],
  turntable: [
    ["dax", "Dax · Mechanic", "That isn't a desk under the survey map. It's a machine. Four plots fit on each turning plate."],
    ["mara", "Mara · Surveyor", "The speculators scrambled the deeds. Turn the plate and the land moves with them. Buildings too!"],
    ["joe", "Joe", "So the plot twist is… an actual plot twist. Let's see where everything lands."]
  ],
  neighborhood: [
    ["dax", "Dax · Mechanic", "The field station is finally helping its neighbors. That's what this machine was built for."],
    ["nell", "Nell · Courier", "Let that neighborhood grow, then make a profitable sale. I'll pay a bonus for putting these deeds back to work."],
    ["joe", "Joe", "Coffee, a little patience, and a town that works together. That roadster is getting closer."]
  ],
  roadster: [
    ["mara", "Mara · Surveyor", "Those keys belonged to the town's first surveyor. Open the trunk, Joe."],
    ["nell", "Nell · Courier", "The original deeds! We spent all this time chasing the map… and the answer was in your dream car."],
    ["dax", "Dax · Mechanic", "You earned your way out of town. Turns out, you also gave us a reason to stay."],
    ["joe", "Joe", "One roadster. One very strange neighborhood. And tomorrow, the coffee's on me."]
  ]
};

export function renderDialogue(id, page) {
  const lines = DIALOGUES[id], [person, name, line] = lines[page];
  return `<div class="conversation"><span class="jam-kicker">THE VALLEY HAS A STORY / ${page + 1} OF ${lines.length}</span><div class="conversation-character">${portrait(person, id === "roadster" ? "happy" : "surprised")}<h2 id="game-dialog-title">${name}</h2></div><p class="conversation-line">“${line}”</p><div class="conversation-actions"><button class="primary" data-jam="dialogue-next" autofocus>${page === lines.length - 1 ? id === "roadster" ? "SEE YOUR RUN REPORT →" : "LET'S DO IT →" : "NEXT →"}</button><button class="text-button" data-jam="dialogue-skip">Skip conversation</button></div><small>Take your time. The game is paused.</small></div>`;
}

export function renderEnding() {
  const helped = COMMISSIONS.filter(({ id }) => state.commissions[id].claimed);
  return `<div class="ending"><span class="jam-kicker">YOU EARNED THE KEYS</span><h2 id="game-dialog-title">The long drive home.</h2><div class="ending-street"><span class="ending-houses">▥ &nbsp; ⌂ &nbsp; ▥ &nbsp; ⌂ &nbsp; ▥</span><div class="ending-car">${renderCar("ending")}<i class="headlight"></i></div></div><div class="ending-friends">${CUSTOMERS.map(person => `<div>${portrait(person.id)}<b>${person.name}</b><small>${helped.some(job => job.id === person.id) ? "COMMISSION COMPLETE" : "A FRIEND AT THE COUNTER"}</small></div>`).join("")}</div><p>You started with a coffee counter. Look how far you've come.</p><button class="primary" data-jam="trunk" autofocus>OPEN THE TRUNK →</button></div>`;
}

export function renderTwistPreview(preview) {
  const movedStations = preview.moves.filter(move => move.before.owner === "player" && move.before.building);
  const influence = movedStations.map(move => {
    const before = preview.beforeInfluence.find(station => station.id === move.from)?.neighbors || 0;
    const after = preview.afterInfluence.find(station => station.id === move.to)?.neighbors || 0;
    return `<p>Station ${parcelName(move.before)} → ${parcelName(move.after)}: <b>${before} → ${after} owned neighbors</b> in range.</p>`;
  }).join("");
  return `<div class="jam-dialog-content twist-preview"><span class="jam-kicker">LOOK BEFORE YOU TURN</span><h2 id="game-dialog-title">A quarter turn. A new town.</h2><div class="preview-grid">${preview.moves.map((move, i) => `<div style="--tile:${TYPES[move.before.type].color};--place:${[1, 2, 4, 3][i]}"><span>${TYPES[move.before.type].name}</span><b>${parcelName(move.before)} → ${parcelName(move.after)}</b><small>${move.before.building ? "FIELD STATION MOVES" : move.before.owner === "player" ? "YOUR DEED MOVES" : "AVAILABLE DEED"}</small></div>`).join("")}</div><p>All four parcels rotate clockwise. Ownership, buildings, and purchase costs travel with their deeds.</p><div class="preview-gain"><span>YOUR IMMEDIATE SURVEY GAIN</span><b>+${dollars(preview.gain)}</b></div>${influence || `<p>Build a field station on owned land to make future twists help nearby parcels.</p>`}<div class="action-row"><button class="primary" data-jam="twist-confirm" autofocus ${state.story.twistCharges < 1 ? "disabled" : ""}>TURN THE PLOTS · 1 CHARGE</button><button class="secondary" data-jam="resume">CANCEL</button></div></div>`;
}

export function objective() {
  const coffee = state.coffeeShopProgress;
  if (state.story.chapter === 0) return { title: "Start with a good cup.", text: `Serve two customers to hear the rumor. ${coffee.correctDeliveries}/2 served correctly.`, action: "coffee", label: "WORK THE COUNTER →" };
  if (state.story.chapter === 1) return { title: "A strange deed. A small investment.", text: `Mara marked parcel ${parcelName(getPlot(state.story.anomalyId))}. Buy it with your coffee earnings.`, action: "marked", label: "INSPECT MARKED PARCEL →" };
  const contract = activeCommission();
  if (contract && state.commissions[contract.id].complete) return { title: `${CUSTOMERS.find(person => person.id === contract.id).name}'s commission is complete!`, text: contract.name, action: `claim-${contract.id}`, label: `COLLECT ${dollars(contract.reward)} →` };
  if (contract?.id === "mara") return { title: "The town can turn.", text: "Preview your first twist. Watch the owned deed move with the land.", action: "first-twist", label: "PREVIEW THE TURN →" };
  if (contract?.id === "dax") {
    if (!ownedBuildings()) return { title: "Give the neighborhood a heart.", text: `Dax offers $700. Build a ${dollars(BUILDING.cost)} field station on owned land.`, action: "station", label: "SELECT YOUR BUILDING SITE →" };
    if (state.ownedPlots.length < 2) return { title: "A station needs a neighbor.", text: "Buy a parcel beside your station, then preview a turn of the station's block.", action: "neighbor", label: "FIND A NEIGHBORING PARCEL →" };
    return { title: "Put your station to work.", text: "Twist your station within 2 tiles of another owned parcel. Wait one day for a value gain. The preview shows its reach.", action: "station-twist", label: state.story.twistCharges ? "PREVIEW YOUR STATION'S TURN →" : "EARN A TURN AT THE COUNTER →" };
  }
  if (contract?.id === "nell") {
    const best = state.plots.filter(plot => plot.owner === "player").sort((a, b) => saleValue(b) - b.costBasis - (saleValue(a) - a.costBasis))[0];
    return { title: "Let the neighborhood grow.", text: `Nell offers $1,100 for a developed parcel sold at $100+ net profit.${best ? ` Your best margin is ${dollars(saleValue(best) - best.costBasis)}.` : " Buy near a field station to gain value."} Work coffee orders while the station helps your land.`, action: "best-sale", label: "REVIEW YOUR BEST PARCEL →" };
  }
  return { title: state.carGoal.purchased ? "A new chapter, whenever you like." : "The open road is getting closer.", text: state.carGoal.purchased ? "Keep growing the valley or revisit your run report." : `Save ${dollars(Math.max(0, state.carGoal.price - state.money))} more. Trade developed land, make coffee, or hire help.`, action: "goal", label: state.carGoal.purchased ? "YOUR ROADSTER →" : "CHECK THE ROADSTER →" };
}
export function renderObjective() {
  const task = objective();
  return `<div class="objective-head"><span>YOUR NEXT MOVE</span><button data-jam="journal">JOURNAL ↗</button></div><strong>${task.title}</strong><p>${task.text}</p><button class="objective-action" data-jam="objective" data-task="${task.action}">${task.label}</button>`;
}
export function renderJournal() {
  return `<div class="jam-dialog-content"><span class="jam-kicker">GOOD WORK TRAVELS FAST</span><h2 id="game-dialog-title">People of the valley</h2>${COMMISSIONS.map((job, index) => `<article class="journal-job">${portrait(job.id)}<div><span>${String(index + 1).padStart(2, "0")} / ${job.id.toUpperCase()}</span><h3>${job.name}</h3><p>${job.text}</p><b>${state.commissions[job.id].claimed ? "✓ PAID" : state.commissions[job.id].complete ? "READY TO CLAIM" : "IN PROGRESS"} · ${dollars(job.reward)}</b></div></article>`).join("")}<button class="primary" data-jam="back" autofocus>BACK TO THE VALLEY</button></div>`;
}

export function renderChallenge(coffee, order) {
  const challenge = coffee.challenge;
  if (challenge.kind === "pour") return `<div class="arcade-label">02 / POUR TO THE LINE <span>HOLD, THEN RELEASE</span></div><div class="pour-scene"><div class="pour-cup"><div id="pour-fill" style="height:${challenge.fill}%"></div><span class="pour-target" style="bottom:${order.target}%">TARGET</span><i></i></div><div><strong id="pour-percent">${Math.round(challenge.fill)}%</strong><p>Hold the button to pour.<br>Release inside the gold band.<br>Space works too.</p></div></div><button class="primary brew-control" data-brew="pour">HOLD TO POUR</button>`;
  if (challenge.kind === "rhythm") return `<div class="arcade-label">02 / STIR WITH THE BEAT <span>THREE GOLD PULSES</span></div><p class="arcade-instruction">Start the rhythm. Tap when each ring meets its center. Follow the gold pulse with sound on or off.</p><div class="rhythm-beats">${[0, 1, 2].map(i => `<span class="rhythm-beat" data-beat="${i}"><i></i><b>${i + 1}</b></span>`).join("")}</div><button class="primary brew-control" data-brew="rhythm">${challenge.started ? "TAP THE BEAT · SPACE" : "START THE RHYTHM"}</button><p class="arcade-feedback" id="rhythm-feedback">${challenge.taps.length} / 3 TAPS</p>`;
  return `<div class="arcade-label">02 / TIME THE PRESSURE <span>HIT THE GOLD ZONE</span></div><p class="arcade-instruction">Start the shot. Press again when the needle enters the gold window. Space works too.</p><div class="brew-meter" role="img" aria-label="Pressure needle and gold target"><div class="brew-zone" style="left:${order.target - 8}%"></div><div class="brew-needle" id="brew-needle"></div></div><div class="brew-scale"><span>UNDER</span><span>SWEET SPOT</span><span>OVER</span></div><button class="primary brew-control" data-brew="pressure">${challenge.started ? "STOP THE SHOT · SPACE" : "START THE SHOT"}</button>`;
}
