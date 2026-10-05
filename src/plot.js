import { drawgrid, convert, highlight } from "./grid.js";
import { playSound, resumeSound, setSoundEnabled, soundEnabled } from "./audio.js";
import { renderOffice, renderAdvisorTips, renderBillPreview } from "./office.js";
import { ParticleSystem } from "./effects.js";
import { renderCar } from "./car.js";
import { renderResults } from "./results.js";
import { createSession } from "./session.js";
import { renderObjective, renderChallenge, portrait } from "./jam-ui.js";
import {
  COLS, ROWS, TICK_MS, TYPES, ORDERS, CUSTOMERS, INGREDIENTS, BUILDING, TWIST_BONUS, state, getPlot, selectedPlot,
  ownedValue, ownedBuildings, plotId, isRoad, subscribe, selectPlot,
  buySelected, sellSelected, buildSelected, getTwistBlock, twistSelected, tick, prepareCoffee,
  completeCoffee, deliverCoffee, purchaseCar, resetGame, purchaseCost, saleValue, employeeLevel,
  EMPLOYEES, upgradeEmployee, daysUntilBill, monthlyBillQuote, marketChange, getPlayerHairColor, getPlayerHairStatus
} from "./state.js";

const $ = selector => document.querySelector(selector);
const canvas = $("#mycanvas");
const ctx = canvas.getContext("2d");
const view = $("#view");
const moneyNode = $("#money");
const popup = $("#map-popup");
const resultsDialog = $("#results-dialog");
const sprite = new Image();
sprite.src = "public/assets/images/tiny-town.png";
const exportImg = new Image();
exportImg.src = "public/assets/images/export.png";
sprite.onload = () => { if (canvasWidth) drawMap(performance.now()); };
exportImg.onload = () => { if (canvasWidth) drawMap(performance.now()); };
const groundSprite = exportImg;

const money = amount => `${amount < 0 ? "−" : ""}$${Math.round(Math.abs(amount)).toLocaleString("en-US")}`;
const signedMoney = amount => `${amount >= 0 ? "+" : "−"}${money(Math.abs(amount))}`;
const coordinate = plot => `${String.fromCharCode(65 + plot.x)}${plot.y + 1}`;

let route = "land";
let hoverId = null;
let canvasWidth = 0;
let canvasHeight = 0;
let tileSize = 0;
let originX = 0;
let originY = 0;
let lastFrame = 0;
let builtAt = 0;
let lastEventToken = state.lastEvent?.token || null;
const particles = new ParticleSystem();
let mapGlows = [];
let resetArmed = false;
let resultsResetArmed = false;
let brewStart = 0;
let twistAt = 0;
let twistedCells = [];
let session;
let visualTime = 0;
let previousFrame = 0;
let suppressPourClickUntil = 0;
let pourPointerActive = false;

const headings = {
  land: ["The land ledger", "Select a parcel. Some deeds hide more than a price.", "01 / LAND"],
  market: ["Market watch", "Four terrains, four different price cycles.", "02 / MARKET"],
  coffee: ["Corner coffee", "A small ritual. A good cup. A familiar face.", "03 / WORK"],
  buildings: ["Build & grow", "A building lifts the value of nearby land each day.", "04 / BUILD"],
  goal: ["The long drive", "The red roadster is waiting for its next owner.", "06 / GOAL"]
};

function sectionHeading(page) {
  const [title, description, index] = headings[page];
  return `<div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div><span class="section-index">${index}</span></div>`;
}

function renderStory() {
  const story = state.story;
  const marked = getPlot(story.anomalyId);
  const beats = [
    ["THE STRANGE DEED", "Two customers know why the survey map has a spiral stamped on it. Serve them well to hear the full rumor."],
    ["A MARK ON THE MAP", `Mara's clue points to parcel ${coordinate(marked)}. Buy the pulsing tile to open the old survey case.`],
    ["PLOT TWIST UNLOCKED", "The deed numbers were mounted on a rotating plate. Select a tile and turn its four-plot block."],
    ["THE MAP WAS THE MACHINE", "The speculators hid value in movable deeds. Turn them to uncover a survey premium and change a building's reach."]
  ];
  const [title, text] = beats[Math.min(story.chapter, 3)];
  return `<div class="story-strip ${story.chapter >= 2 ? "revealed" : ""}"><div class="story-symbol">${story.chapter >= 2 ? "⟳" : "?"}</div><div><span>CASE FILE / ${String(story.chapter + 1).padStart(2, "0")}</span><strong>${title}</strong><p>${text}</p></div></div>`;
}

function renderTwistControl() {
  if (state.story.chapter < 2) return "";
  const block = getTwistBlock();
  const charges = state.story.twistCharges;
  return `<div class="twist-console"><div class="twist-console-head"><span>◫ &nbsp; ZONING TURNTABLE</span><strong>${charges} TURN${charges === 1 ? "" : "S"} LEFT</strong></div>
    <p>${block.length ? `Selected block: ${block.map(coordinate).join(" · ")}.` : "Select any parcel to outline a four-plot block."} Deeds, buildings, and ownership rotate clockwise. Each owned deed gains a ${money(TWIST_BONUS)} survey premium.</p>
    <button class="twist-button" data-action="twist" ${!block.length || charges < 1 ? "disabled" : ""}>⟳ &nbsp; TWIST THE PLOTS</button>
    <small>Earn another turn after three perfect coffee deliveries.</small></div>`;
}

function renderLand() {
  const plot = selectedPlot();
  if (!plot) return `${sectionHeading("land")}${renderStory()}
    <div class="empty-state"><div class="empty-art">⌑</div><span class="eyebrow-mini">START HERE</span>
    <h3>A plot is waiting.</h3><p>Click a colored square in the valley to see its type, price and outlook.</p>
    <button class="text-button" data-action="coffee-route">Need money? Visit the coffee shop →</button></div>
    <div class="mini-banner"><b>✳</b><span>Prices change every game day. Watch the market, then trade when the time feels right.</span></div>${renderTwistControl()}`;
  const type = TYPES[plot.type];
  const owned = plot.owner === "player";
  const change = state.market[plot.type].movement;
  const profit = owned ? saleValue(plot) - plot.costBasis : 0;
  const cost = purchaseCost(plot);
  const afford = state.money >= cost;
  const canBuild = owned && !plot.building && state.money >= BUILDING.cost;
  return `${sectionHeading("land")}${renderStory()}
    <article class="selected-card">
      <div class="selected-top"><div class="selected-name"><div class="tile-emblem" style="background:${type.color}">${["☀","✿","♠","≈"][plot.type]}</div><div><h3>${type.name}</h3><p>Parcel ${coordinate(plot)} · ${type.note}</p></div></div><span class="status-label ${owned ? "owned" : ""}">${owned ? "YOUR LAND" : "AVAILABLE"}</span></div>
      <div class="price-head"><span>CURRENT LAND VALUE</span><strong>${money(plot.currentValue)}</strong></div>
      <div class="detail-grid">
        <div><span>BASE PRICE</span><strong>${money(plot.basePrice)}</strong></div>
        <div><span>MARKET TODAY</span><strong class="${change >= 0 ? "up" : "down"}">${signedMoney(change)} ${change >= 0 ? "↗" : "↘"}</strong></div>
        <div><span>${owned ? "YOUR PURCHASE" : "PURCHASE PRICE"}</span><strong>${money(owned ? plot.purchasePrice : cost)}</strong></div>
        <div><span>${owned ? "NET SALE PROFIT / LOSS" : "NET SALE VALUE"}</span><strong class="${owned ? (profit >= 0 ? "up" : "down") : ""}">${owned ? signedMoney(profit) : money(saleValue(plot))}</strong></div>
        <div><span>BUILDING</span><strong>${plot.building ? "Field station" : "None"}</strong></div>
        <div><span>IMPROVEMENT LIFT</span><strong class="up">+${money(plot.buildingEffects)}</strong></div>
        <div><span>SURVEY PREMIUM</span><strong class="up">+${money(plot.surveyBonus)}</strong></div>
        <div><span>PRICE RECORDS</span><strong>${plot.priceHistory.length} saved</strong></div>
      </div>
      <div class="action-row">${owned
        ? `<button class="primary" data-action="sell">Sell for ${money(saleValue(plot))} ↗</button><button class="secondary" data-action="build" ${plot.building || !canBuild ? "disabled" : ""}>${plot.building ? "Built" : `Build · ${money(BUILDING.cost)}`}</button>`
        : `<button class="primary" data-action="buy" ${!afford ? "disabled" : ""}>${afford ? `Buy plot · ${money(cost)}` : `Need ${money(cost - state.money)} more`}</button>`}
        ${state.story.chapter >= 2 ? `<button class="secondary" data-action="twist" ${state.story.twistCharges < 1 ? "disabled" : ""}>⟳ Twist · ${state.story.twistCharges}</button>` : ""}
      </div>
      <p class="helper-note">${owned ? "The 5% sale closing fee and construction cost are included in parcel profit. Monthly bills are included in your Office run gain." : employeeLevel("agent") ? `Your agent's ${employeeLevel("agent") * 2}% discount is included. A future sale has a 5% closing fee.` : "Work a coffee order to earn cash. Every land sale has a 5% closing fee, already included in the net sale value."}</p>
    </article>
    <div class="mini-banner"><b>⌁</b><span>${owned ? "Your ownership is marked in gold on the map." : "Prices follow gentle cycles, so holding and timing your sale matters."}</span></div>${renderTwistControl()}`;
}

function sparkline(values, color, label) {
  const points = values.length > 1 ? values : [values[0], values[0]];
  const min = Math.min(...points) - 8;
  const max = Math.max(...points) + 8;
  const coords = points.map((value, index) => [
    2 + index * 106 / (points.length - 1),
    38 - (value - min) / (max - min || 1) * 34
  ]);
  const polyline = coords.map(pair => pair.map(n => n.toFixed(1)).join(",")).join(" ");
  const last = coords.at(-1);
  return `<svg role="img" aria-label="${label} price history" viewBox="0 0 110 42" preserveAspectRatio="none"><title>${label} price history</title><path d="M0 39H110" stroke="#e1dfd2" stroke-width="1"/><polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.2" fill="${color}"/></svg>`;
}

function renderMarket() {
  return `${sectionHeading("market")}
    ${state.story.chapter >= 1 ? `<div class="market-bulletin"><span>◉ &nbsp; LATE EDITION</span><p>The town's survey records were altered. A stamped deed on the map may explain the price swings.</p></div>` : ""}
    <div class="market-list">${TYPES.map((type, index) => {
      const entry = state.market[index];
      const week = marketChange(index);
      return `<div class="market-row"><div class="market-name"><i class="market-dot" style="background:${type.color}"></i><div>${type.name}<small>${type.note}</small></div></div>${sparkline(entry.history, type.color, type.name)}<div class="market-number">${money(entry.currentPrice)}<small class="${entry.movement >= 0 ? "up" : "down"}">${signedMoney(entry.movement)} today</small><small class="${week >= 0 ? "up" : "down"}">${week >= 0 ? "+" : ""}${week.toFixed(1)}% / 7d</small></div></div>`;
    }).join("")}</div>
    <p class="market-foot">Each line shows up to 48 game days. Seven-day moves use all available days at the start of a run. Individual parcels also reflect location and nearby improvements.</p>
    ${renderAdvisorTips()}${renderBillPreview(true)}`;
}

function ingredientChoices(order, orderIndex) {
  const choices = [...new Set(order.ingredients)];
  for (let i = 0; choices.length < 4; i++) {
    const ingredient = INGREDIENTS[(orderIndex * 3 + i + 2) % INGREDIENTS.length];
    if (!choices.includes(ingredient)) choices.push(ingredient);
  }
  return choices.sort((a, b) => ((INGREDIENTS.indexOf(a) + orderIndex * 2) % 7) -
    ((INGREDIENTS.indexOf(b) + orderIndex * 2) % 7));
}

function renderCustomerQueue(coffee) {
  const people = [];
  for (let offset = 0; people.length < 3 && offset < ORDERS.length * 2; offset++) {
    const person = CUSTOMERS.find(entry => entry.id === ORDERS[(coffee.orderIndex + offset) % ORDERS.length].customer);
    if (!people.some(entry => entry.id === person.id)) people.push(person);
  }
  return `<div class="queue-caption">CUSTOMERS WAITING <span>${coffee.step === "completed" ? "READY FOR " + people[0].name.toUpperCase() : "NEXT UP · " + people[0].name.toUpperCase()}</span></div>
    <div class="customer-queue" aria-label="Coffee shop customer line">${people.map((person, index) =>
      `<button class="queue-person ${index === 0 ? "first" : ""} person-${person.id}" type="button" data-customer="${person.id}" aria-label="Serve ${person.name}, ${person.role}" ${coffee.step !== "completed" || index !== 0 ? "disabled" : ""}>
        <span class="pixel-person" aria-hidden="true"><i class="pixel-hair"></i><i class="pixel-face"></i><i class="pixel-shirt"></i><i class="pixel-arm left"></i><i class="pixel-arm right"></i><i class="pixel-legs"></i></span>
        <span class="queue-name">${person.name}<small>${person.role}</small></span></button>`).join("")}</div>`;
}

function renderCoffee() {
  const coffee = state.coffeeShopProgress;
  const order = ORDERS[coffee.orderIndex % ORDERS.length];
  const customer = CUSTOMERS.find(person => person.id === order.customer);
  const step = coffee.step;
  const response = state.lastEvent?.kind === "coffee-ingredient"
    ? (state.lastEvent.correct ? "GOOD MIX · KEEP GOING" : "WRONG INGREDIENT · TIP DOWN") : "FOLLOW THE RECIPE ON THE TICKET";
  const stage = step === "new" ? `<div class="arcade-label">01 / MIX THE ORDER <span>${coffee.mistakes} ${coffee.mistakes === 1 ? "MISTAKE" : "MISTAKES"}</span></div>
      <div class="recipe-track">${order.ingredients.map((ingredient, index) => `<span class="${index < coffee.ingredientIndex ? "filled" : index === coffee.ingredientIndex ? "next" : ""}">${index < coffee.ingredientIndex ? "✓ " : ""}${ingredient}</span>`).join("")}</div>
      <div class="ingredient-pad">${ingredientChoices(order, coffee.orderIndex).map(ingredient => `<button data-ingredient="${ingredient}">${ingredient}</button>`).join("")}</div>
      <p class="arcade-feedback">${response}</p>` : step === "prepared" ? renderChallenge(coffee, order) : `<div class="arcade-label">03 / HAND OVER THE CUP <span>${coffee.brewGrade === 2 ? "PERFECT BREW ★" : coffee.brewGrade === 1 ? "GOOD BREW" : "A LITTLE RUSTIC"}</span></div>
      <div class="handoff-ready">${portrait(customer.id, coffee.brewGrade === 2 ? "happy" : "worried")}<p><strong>${customer.name}'s ready.</strong><br>${coffee.brewGrade === 2 ? "That smells wonderful, Joe." : "A warm cup still makes a good day."}</p></div><button class="primary brew-control" data-action="deliver">SERVE ${customer.name.toUpperCase()} →</button>`;
  return `${sectionHeading("coffee")}
    ${state.lastEvent?.kind === "coffee-deliver" ? `<div class="coffee-receipt"><span>${state.lastEvent.perfect ? "★ PERFECT ORDER" : "THANKS, JOE!"}</span><b>+${money(state.lastEvent.amount)}</b></div>` : ""}
    <div class="shop-scene ${state.lastEvent?.kind === "coffee-deliver" ? "queue-arrived" : ""}"><span class="shop-roof"></span><span class="shop-sign">THE CORNER CUP / OPEN LATE</span><span class="shop-window"></span><span class="shop-door"></span><span class="shop-counter"></span><i class="handoff-cup"></i><span class="shop-steam" aria-hidden="true">⌁</span>${renderCustomerQueue(coffee)}</div>
    <div class="order-paper"><span class="eyebrow-mini">TICKET #${String(coffee.served + 1).padStart(3, "0")} / ${customer.role.toUpperCase()}</span><strong class="order-pay">${money(Math.round(order.pay * (1 + employeeLevel("manager") * .12)))} + TIP</strong><h3>${order.name}</h3><p>FOR ${customer.name.toUpperCase()} &nbsp;·&nbsp; ${order.ingredients.join(" → ")}</p></div>
    <div class="arcade-panel">${stage}</div><div class="streak-strip"><span>★ ${coffee.streak} CLEAN IN A ROW · +${Math.min(5, coffee.streak) * 5}%</span><span>BEST ${coffee.bestStreak}</span></div>
    <div class="coffee-rumor"><span>LAST THING OVERHEARD</span><p>“${state.story.lastLine}”</p></div>
    <p class="shop-tip">${coffee.served} ${coffee.served === 1 ? "order" : "orders"} served · ${coffee.cleanOrders} perfect. ${state.story.chapter >= 2 ? `${coffee.twistPerfectProgress}/3 perfect orders toward your next plot turn.` : "Perfect orders will power the turntable once the secret is found."}</p>
    <button class="text-button" data-jam="credits">ART & SOUND CREDITS</button>`;
}

function renderBuildings() {
  const owned = state.plots.filter(plot => plot.owner === "player");
  const plot = selectedPlot();
  const buildable = plot?.owner === "player" && !plot.building;
  return `${sectionHeading("buildings")}
    <div class="build-hero"><div class="build-icon">▥</div><div><h3>Field station</h3><p>A small local landmark that improves nearby plots over time.</p></div></div>
    <div class="spec-list"><div><span>CONSTRUCTION COST</span><strong>${money(BUILDING.cost)}</strong></div><div><span>INFLUENCE</span><strong>${BUILDING.radius} tiles, walking distance</strong></div><div><span>NEIGHBOR VALUE GAIN</span><strong>+${money(BUILDING.valuePerDay)} / day</strong></div><div><span>HOST PARCEL GAIN</span><strong>+${money(BUILDING.selfValuePerDay)} / day</strong></div><div><span>MAXIMUM LIFT PER PLOT</span><strong>+${money(BUILDING.maxPlotBonus)}</strong></div></div>
    <button class="primary" data-action="build" ${!buildable || state.money < BUILDING.cost ? "disabled" : ""}>${plot?.building ? "Already built here" : buildable ? `Build on ${coordinate(plot)} · ${money(BUILDING.cost)}` : "Select owned land to build"}</button>
    <p class="helper-note">Buy neighboring parcels before building to collect their daily value gains. Buildings remain after a sale; your net profit counts construction cost.</p>
    ${owned.length ? `<div class="holding-list">${owned.map(item => `<button data-select="${item.id}"><span>${TYPES[item.type].name} · ${coordinate(item)}</span><small>${item.building ? "STATION BUILT" : "OPEN SITE"} &nbsp; ${money(item.currentValue)}</small></button>`).join("")}</div>` : `<div class="mini-banner"><b>⌑</b><span>Buy your first plot on the Land tab to unlock construction.</span></div>`}`;
}

function renderGoal() {
  const goal = state.carGoal;
  const won = goal.purchased;
  const ready = !won && state.money >= goal.price;
  const progress = won ? 100 : Math.max(0, Math.min(100, Math.round(state.money / goal.price * 100)));
  return `${sectionHeading("goal")}
    <div class="goal-stage ${won ? "won" : ready ? "available" : "locked"}"><span class="goal-caption">${won ? "CAR PURCHASED / GOAL ACHIEVED" : ready ? "CAR UNLOCKED / AVAILABLE TO PURCHASE" : "CAR LOCKED / THE RED ROADSTER"}</span>${renderCar("goal")}</div>
    <div class="goal-copy"><h3>${won ? "Keys in hand." : ready ? "Ready when you are." : "One day, yours."}</h3><strong>${money(goal.price)}</strong></div>
    <div class="progress-shell" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-label="Car savings progress"><div class="progress-fill" style="width:${progress}%"></div></div>
    <div class="goal-meta"><span>${won ? "GOAL COMPLETE" : `${progress}% OF GOAL SAVED`}</span><strong>${won ? "YOURS TO DRIVE" : ready ? "AVAILABLE NOW" : `${money(Math.max(0, goal.price - state.money))} TO GO`}</strong></div>
    <div class="goal-cash">YOUR CASH <strong>${money(state.money)}</strong></div>
    ${won ? `<button class="primary" data-action="results">View your results</button>` : `<button class="primary goal-buy ${ready ? "ready" : ""}" data-action="goal" ${!ready ? "disabled" : ""}>${ready ? `BUY THE RED ROADSTER · ${money(goal.price)}` : "Keep earning & investing"}</button>`}
    <p class="goal-message">${won ? (state.story.twists > 0 ? "PLOT TWIST: the roadster was the surveyor's old field car. Its trunk holds the original deeds. You can redraw the valley's future." : "The glove box holds a spiral-stamped deed. The valley still has a secret for you to find.") : ready ? "You made it. The keys are waiting at the exchange. Buy the car when you are ready to celebrate." : "Work a shift. Buy a parcel. Build up the neighborhood. Watch your bills, then sell at the right time."}</p>
    <button class="text-button" data-action="reset">${resetArmed ? "Click again to erase this run" : "Start a new run"}</button>`;
}

const renderers = { land: renderLand, market: renderMarket, coffee: renderCoffee, buildings: renderBuildings, office: renderOffice, goal: renderGoal };
function renderView() {
  const openDetails = [...view.querySelectorAll("details")].map(detail => detail.open);
  const ledgerScroll = view.querySelector(".ledger-rows")?.scrollTop || 0;
  const focused = document.activeElement;
  const focusables = "button, summary, input, a[href], [tabindex]";
  const focusIndex = [...view.querySelectorAll(focusables)].indexOf(focused);
  const focusKey = focused && view.contains(focused) ? [...focused.attributes].find(attr => attr.name.startsWith("data-")) : null;
  view.innerHTML = renderers[route]();
  view.querySelectorAll("details").forEach((detail, index) => { detail.open = Boolean(openDetails[index]); });
  const ledger = view.querySelector(".ledger-history");
  if (ledger?.open) {
    ledger.querySelector(".ledger-rows").scrollTop = ledgerScroll;
  }
  if (focusKey) view.querySelector(`[${focusKey.name}="${CSS.escape(focusKey.value)}"]`)?.focus({ preventScroll: true });
  else if (focusIndex >= 0) view.querySelectorAll(focusables)[focusIndex]?.focus({ preventScroll: true });
}
function updateChrome() {
  moneyNode.textContent = money(state.money);
  $("#portfolio-value").textContent = money(ownedValue());
  $("#plots-owned").textContent = String(state.ownedPlots.length);
  $("#buildings-owned").textContent = String(ownedBuildings());
  const day = `DAY ${String(state.gameTime + 1).padStart(2, "0")}`;
  $("#game-day").textContent = day;
  $("#top-day").textContent = day;
  $("#bill-countdown").textContent = `Bill in ${daysUntilBill()} ${daysUntilBill() === 1 ? "day" : "days"}`;
  $("#bill-countdown").title = `Current estimate: ${money(monthlyBillQuote().total)}. One day passes every 3.5 seconds.`;
  document.querySelector('[data-route="goal"]').classList.toggle("goal-ready", !state.carGoal.purchased && state.money >= state.carGoal.price);

  const hairColor = getPlayerHairColor(state.gameTime);
  document.querySelectorAll(".player-portrait").forEach(el => el.style.setProperty("--hair-color", hairColor));
  const objectiveNode = $("#objective");
  const nextObjective = renderObjective();
  if (objectiveNode.innerHTML !== nextObjective) {
    const focused = objectiveNode.contains(document.activeElement) ? document.activeElement.dataset.jam : null;
    objectiveNode.innerHTML = nextObjective;
    if (focused) objectiveNode.querySelector(`[data-jam="${focused}"]`)?.focus({ preventScroll: true });
  }
  const unlocks = { coffee: true, goal: true, land: state.story.chapter > 0 || state.ownedPlots.length > 0,
    market: state.ownedPlots.length > 0 || state.story.chapter > 1,
    buildings: state.story.twists > 0 || ownedBuildings() > 0,
    office: state.commissions.mara.claimed || Object.values(state.employees).some(level => level > 0) };
  document.querySelectorAll("[data-route]").forEach(button => { button.hidden = !unlocks[button.dataset.route]; });
}

function setRoute(next) {
  route = renderers[next] ? next : "land";
  document.body.classList.toggle("route-coffee", route === "coffee");
  if (route !== "goal") resetArmed = false;
  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.route === route;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  view.classList.remove("route-view");
  void view.offsetWidth;
  view.classList.add("route-view");
  renderView();
}

function notify(message, detail = "", negative = false) {
  const toast = document.createElement("div");
  toast.className = `toast${negative ? " negative" : ""}`;
  toast.textContent = message;
  if (detail) { const small = document.createElement("small"); small.textContent = detail; toast.append(small); }
  $("#toast-stack").append(toast);
  setTimeout(() => toast.remove(), 3300);
}

function notifyCarAvailable() {
  const toast = document.createElement("div");
  toast.className = "toast car-unlock-toast";
  toast.innerHTML = `<strong>CAR AVAILABLE!</strong><small>You have enough money for the red roadster.</small><button type="button">PURCHASE CAR →</button>`;
  toast.querySelector("button").addEventListener("click", () => { location.hash = "goal"; toast.remove(); });
  $("#toast-stack").append(toast);
  setTimeout(() => toast.remove(), 10000);
  flashStory("CAR UNLOCKED");
  playSound("car-available");
}

function openResults() {
  if (!state.carGoal.purchased || resultsDialog.open) return;
  session.clock.pause("results");
  resultsResetArmed = false;
  resultsDialog.innerHTML = renderResults();
  resultsDialog.classList.remove("closing");
  resultsDialog.showModal();
  document.body.classList.add("results-open");
  resultsDialog.querySelector('[data-result="continue"]').focus();
}

function closeResults() {
  if (resultsDialog.classList.contains("closing")) return;
  resultsDialog.classList.add("closing");
  setTimeout(() => { resultsDialog.close(); resultsDialog.classList.remove("closing"); }, 180);
}

function restartRun() {
  resetArmed = false;
  resultsResetArmed = false;
  if (resultsDialog.open) resultsDialog.close();
  particles.clear();
  mapGlows = [];
  brewStart = 0;
  twistedCells = [];
  popup.classList.remove("show");
  popup.textContent = "";
  $("#story-flash").classList.remove("show");
  $("#story-flash").textContent = "";
  $("#toast-stack").replaceChildren();
  resetGame();
  session.reset();
  location.hash = "coffee";
  setRoute("coffee");
}

function mapPoint(id) {
  const plot = getPlot(id);
  return plot ? { x: originX + (plot.x + .5) * tileSize, y: originY + (plot.y + .5) * tileSize } : null;
}
function spawnParticles(event) {
  const point = mapPoint(event.plotId);
  if (!point) return;
  particles.burst(event.kind, point.x, point.y);
  mapGlows.push({ id: event.plotId, start: visualTime, duration: 1050 });
  popup.textContent = event.kind === "sell" ? `${signedMoney(event.profit)} NET` : `−${money(event.amount)}`;
  popup.style.left = `${point.x / canvasWidth * 100}%`;
  popup.style.top = `${point.y / canvasHeight * 100}%`;
  popup.classList.remove("show");
  void popup.offsetWidth;
  popup.classList.add("show");
}

function flashStory(text) {
  const flash = $("#story-flash");
  flash.textContent = text;
  flash.classList.remove("show");
  void flash.offsetWidth;
  flash.classList.add("show");
  setTimeout(() => flash.classList.remove("show"), 1450);
}

function handleEvent(event) {
  if (!event || event.token === lastEventToken) return;
  lastEventToken = event.token;
  playSound(event.kind, event);
  if (event.carAvailable) notifyCarAvailable();
  if (event.kind === "select") return;
  if (event.kind === "build") builtAt = visualTime;
  const messages = {
    buy: ["LAND ACQUIRED", `${money(event.amount)} invested in your estate.`],
    sell: ["PLOT SOLD", `${money(event.amount)} received · ${signedMoney(event.profit)} net.`],
    build: ["FIELD STATION BUILT", "Nearby parcels gain value each day."],
    "no-money": ["NOT ENOUGH CASH", `${money(event.amount)} more needed.`],
    commission: ["COMMISSION PAID", `${money(event.amount)} from ${event.commissionId?.toUpperCase()}.`],
    "month-bill": [`MONTH ${event.month} CLOSED`, `Insurance ${money(event.insurance)} + tax ${money(event.tax)} = ${money(event.total)} paid.`],
    "employee-upgrade": ["TEAM UPGRADED", `${EMPLOYEES.find(employee => employee.id === event.employeeId)?.name || "Employee"} is now level ${event.level}.`],
    twist: ["THE PLOTS TURNED", "Four deeds rotated clockwise."],
    goal: ["GOAL COMPLETE", "The valley roadster is yours."],
    reset: ["NEW RUN STARTED", "The valley is yours to explore again."]
  };
  if (messages[event.kind]) notify(...messages[event.kind], event.kind === "no-money");
  if (event.storyBeat === "lead") {
    notify("A DEED HAS BEEN MARKED", "Find the pulsing plot on the valley map.");
    flashStory("A CLUE IN THE MAP");
  }
  if (event.storyBeat === "reveal") {
    notify("PLOT TWIST UNLOCKED", "The survey board can rotate land deeds.");
    flashStory("PLOT TWIST!");
  }
  if (event.chargeEarned) notify("TURN EARNED", "Perfect coffee work earned a new plot twist.");
  if (["buy", "sell", "build"].includes(event.kind)) spawnParticles(event);
  if (event.kind === "twist") {
    twistAt = visualTime;
    twistedCells = event.block;
    flashStory("THE PLOTS TURN!");
    for (const id of event.block) {
      const point = mapPoint(id);
      if (point) particles.burst("twist", point.x, point.y);
    }
  }
  if (["buy", "sell", "coffee-deliver", "goal"].includes(event.kind)) {
    moneyNode.classList.add("bump");
    setTimeout(() => moneyNode.classList.remove("bump"), 400);
  }
  if (event.kind === "goal") {
    particles.celebrate(canvasWidth);
    session.show("ending");
  }
  if (event.kind === "coffee-deliver" && event.perfect) {
    view.classList.add("perfect-order");
    setTimeout(() => view.classList.remove("perfect-order"), 950);
    const point = mapPoint(state.selectedId || state.story.anomalyId);
    if (point) particles.burst("perfect", point.x, point.y);
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  tileSize = Math.min((canvasWidth - 34) / COLS, (canvasHeight - 34) / ROWS);
  originX = (canvasWidth - tileSize * COLS) / 2;
  originY = (canvasHeight - tileSize * ROWS) / 2;
}

function tileRect(x, y) { return [originX + x * tileSize, originY + y * tileSize, tileSize]; }
function tinyTile(index, x, y, width, height = width) {
  if (sprite.complete && sprite.naturalWidth === 192) {
    ctx.drawImage(sprite, (index % 12) * 16, Math.floor(index / 12) * 16, 16, 16, x, y, width, height);
  }
}

function exportTile(sx, sy, sw, sh, x, y, width, height = width) {
  if (groundSprite.complete && groundSprite.naturalWidth === 145) {
    ctx.drawImage(groundSprite, sx, sy, sw, sh, x, y, width, height);
  } else { ctx.fillStyle = "#bdce73"; ctx.fillRect(x, y, width, height); }
}

function drawRoad(x, y) {
  const [px, py, s] = tileRect(x, y);
  ctx.fillStyle = "#7eaa64"; ctx.fillRect(px, py, s + .5, s + .5);
  tinyTile(43, px, py, s + .5, s + .5);
  if (x === 5 && y === 4) tinyTile(95, px + s * .3, py + s * .06, s * .42);
}

function drawTerrainDetail(plot) {
  if (!plot) return;
  const [x, y, s] = tileRect(plot.x, plot.y);

  if (!exportImg.complete || !exportImg.naturalWidth) {
    ctx.fillStyle = plot.type === 3 ? "#5c9ebb" : "#5c8756";
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
    return;
  }

  const seed = (plot.x * 73856093 ^ plot.y * 19349663 ^ state.seed) >>> 0;

  // Waterfront (plot.type === 3): Completely blue tile using a single image reference (sx=0, sy=0)
  if (plot.type === 3) {
    ctx.fillStyle = "#5c9ebb";
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
    ctx.drawImage(exportImg, 0, 0, 31, 12, x, y, s + 0.5, s + 0.5);
    ctx.fillStyle = "rgba(70, 150, 180, 0.20)";
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
    ctx.fillStyle = "rgba(224,249,211,.34)";
    const shimmer = session?.reduced() ? 0 : Math.sin(visualTime / 1800 + seed) * s * .05;
    ctx.fillRect(x + s * .2 + shimmer, y + s * .3, s * .2, Math.max(1, s * .025));
    ctx.fillRect(x + s * .6 - shimmer, y + s * .68, s * .16, Math.max(1, s * .025));
    return;
  }

  // 1. Draw base grass ground for non-waterfront plots from export.png (y=13 to 43, height=30px)
  const gsx = (seed % 3) * 31;
  ctx.drawImage(exportImg, gsx, 13, 31, 30, x, y, s + 0.5, s + 0.5);

  // 2. Render plot-type features for Meadow, Sunfield, and Grove
  if (plot.type === 1) {
    // Meadow: Green meadow grass & flower detail
    if (seed % 3 === 0) tinyTile(29, x + s * 0.5, y + s * 0.45, s * 0.36);
    ctx.fillStyle = "rgba(118, 185, 93, 0.15)";
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
  } else if (plot.type === 0) {
    // Sunfield: Sunny warm yellow tint & wheat accent
    ctx.fillStyle = "rgba(240, 195, 75, 0.30)";
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
    ctx.fillStyle = "#e4d991";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + s * (0.2 + i * 0.22), y + s * 0.56, Math.max(1, s * 0.035), s * 0.13);
    }
  } else if (plot.type === 2) {
    // Grove: Deep green grove tint
    ctx.fillStyle = "rgba(42, 85, 50, 0.18)";
    ctx.fillRect(x, y, s + 0.5, s + 0.5);
  }
}

function drawBuilding(plot, now) {
  const [x, y, s] = tileRect(plot.x, plot.y);
  const age = Math.max(0, (now - builtAt) / 400);
  const bounce = !session?.reduced() && state.lastEvent?.kind === "build" && state.lastEvent.plotId === plot.id && age < 1 ? 1 + Math.sin(age * Math.PI) * .2 : 1;
  ctx.save(); ctx.translate(x + s * .5, y + s * .52); ctx.scale(bounce, bounce);
  ctx.fillStyle = "rgba(20,47,34,.36)"; ctx.fillRect(-s * .31, s * .24, s * .65, s * .08);
  const part = s * .35;
  tinyTile(64, -part, -part * .82, part, part);
  tinyTile(65, 0, -part * .82, part, part);
  tinyTile(76, -part, part * .18, part, part);
  tinyTile(77, 0, part * .18, part, part);
  tinyTile(85, -part * .8, part * .25, part * .45, part * .45);
  tinyTile(86, part * .38, part * .25, part * .45, part * .45);
  ctx.restore();
}

function drawMap(now) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#193b33"; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#345c4b"; ctx.fillRect(originX - 6, originY - 6, COLS * tileSize + 12, ROWS * tileSize + 12);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (isRoad(x, y)) drawRoad(x, y);
    else { const plot = getPlot(plotId(x, y)); if (!session?.turning?.preview.block.includes(plot.id)) drawTerrainDetail(plot); }
  }
  drawgrid(ctx, originX, originY, COLS, ROWS, tileSize, "rgba(27,59,43,.10)");
  mapGlows = mapGlows.filter(glow => now - glow.start < glow.duration);
  for (const glow of mapGlows) {
    const plot = getPlot(glow.id);
    if (!plot) continue;
    const [x, y, s] = tileRect(plot.x, plot.y);
    const fade = 1 - (now - glow.start) / glow.duration;
    ctx.save();
    ctx.fillStyle = `rgba(255,235,159,${fade * .48})`;
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = `rgba(255,247,199,${fade})`;
    ctx.lineWidth = Math.max(2, s * .06);
    ctx.shadowColor = "#ffe49b"; ctx.shadowBlur = 20 * fade;
    ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    ctx.restore();
  }
  if (state.story.chapter === 1) {
    const marked = getPlot(state.story.anomalyId);
    const [x, y, s] = tileRect(marked.x, marked.y);
    const pulse = session?.reduced() ? .85 : .62 + Math.sin(now / 260) * .25;
    ctx.fillStyle = `rgba(252,217,117,${pulse * .22})`; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = `rgba(255,235,156,${pulse})`; ctx.lineWidth = Math.max(2, s * .055);
    ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
    ctx.fillStyle = "#253c35"; ctx.fillRect(x + s * .65, y + s * .08, s * .25, s * .28);
    ctx.fillStyle = "#ffe6a1"; ctx.font = `bold ${Math.max(11, s * .22)}px Consolas, monospace`;
    ctx.textAlign = "center"; ctx.fillText("?", x + s * .775, y + s * .3);
  }
  const selected = selectedPlot();
  if (state.story.chapter >= 2 && selected && !session?.turning) {
    for (const plot of getTwistBlock()) {
      highlight(ctx, plot.x, plot.y, originX, originY, tileSize, "rgba(255,220,119,.12)");
      const [x, y, s] = tileRect(plot.x, plot.y);
      ctx.strokeStyle = "rgba(255,226,143,.55)"; ctx.lineWidth = Math.max(1, s * .025);
      ctx.setLineDash([s * .13, s * .1]); ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
      ctx.setLineDash([]);
    }
  }
  if (selected && (selected.building || route === "buildings")) {
    for (const neighbor of state.plots) {
      const distance = Math.abs(selected.x - neighbor.x) + Math.abs(selected.y - neighbor.y);
      if (distance > 0 && distance <= BUILDING.radius) highlight(ctx, neighbor.x, neighbor.y, originX, originY, tileSize, "rgba(241,219,135,.12)");
    }
  }
  for (const plot of state.plots) {
    if (session?.turning?.preview.block.includes(plot.id)) continue;
    const [x, y, s] = tileRect(plot.x, plot.y);
    if (plot.owner === "player") {
      ctx.strokeStyle = "#f6db9d"; ctx.lineWidth = Math.max(2, s * .065);
      ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
      ctx.fillStyle = "#fff0b7"; ctx.beginPath(); ctx.moveTo(x + s - 2, y + 2); ctx.lineTo(x + s * .72, y + 2); ctx.lineTo(x + s - 2, y + s * .3); ctx.fill();
    }
    if (plot.building) drawBuilding(plot, now);
  }
  if (hoverId && hoverId !== state.selectedId) {
    const plot = getPlot(hoverId);
    if (plot) { const [x, y, s] = tileRect(plot.x, plot.y); ctx.fillStyle = "rgba(255,247,190,.18)"; ctx.fillRect(x, y, s, s); }
  }
  if (selected && !session?.turning) {
    const [x, y, s] = tileRect(selected.x, selected.y);
    const pulse = session?.reduced() ? 1 : 1 + Math.sin(now / 280) * .05;
    ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.scale(pulse, pulse);
    ctx.strokeStyle = "#fff4c5"; ctx.lineWidth = Math.max(2, s * .07);
    ctx.shadowColor = "#fff1ba"; ctx.shadowBlur = 10;
    ctx.strokeRect(-s * .52, -s * .52, s * 1.04, s * 1.04);
    ctx.restore();
  }
  if (now - twistAt < 700) {
    const alpha = 1 - (now - twistAt) / 700;
    for (const id of twistedCells) {
      const plot = getPlot(id);
      const [x, y, s] = tileRect(plot.x, plot.y);
      ctx.strokeStyle = `rgba(255,239,158,${alpha})`;
      ctx.lineWidth = Math.max(2, s * .1 * alpha);
      ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    }
  }
  if (session?.turning) drawTurningParcels(session.turning, now);
  particles.reduced = session?.reduced() || false;
  particles.draw(ctx, now);
}

function drawTurningParcels(turn, now) {
  const moves = turn.preview.moves;
  const cx = moves.reduce((sum, move) => sum + move.before.x + .5, 0) / 4;
  const cy = moves.reduce((sum, move) => sum + move.before.y + .5, 0) / 4;
  const progress = Math.min(1, turn.elapsed / (turn.duration || 1));
  const ease = progress * progress * (3 - 2 * progress);
  const angle = ease * Math.PI / 2;
  const centerX = originX + cx * tileSize, centerY = originY + cy * tileSize;
  for (const { before: plot } of moves) {
    const dx = (plot.x + .5 - cx) * tileSize, dy = (plot.y + .5 - cy) * tileSize;
    const tx = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
    const ty = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);
    const [x, y, s] = tileRect(plot.x, plot.y);
    ctx.save();
    ctx.strokeStyle = "rgba(255,227,143,.55)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(centerX, centerY, Math.hypot(dx, dy), Math.atan2(dy, dx), Math.atan2(dy, dx) + angle); ctx.stroke();
    ctx.translate(tx - x - s / 2, ty - y - s / 2);
    ctx.shadowColor = "#071e1b88"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    drawTerrainDetail(plot); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = plot.owner === "player" ? "#ffeab0" : "#678458"; ctx.lineWidth = plot.owner === "player" ? 3 : 1;
    ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    if (plot.building) drawBuilding(plot, now);
    ctx.fillStyle = "#fff2bd";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + s * .15 + i * s * .25, y + s - 3 + Math.sin(progress * 9 + i) * 3, 2, 2);
    ctx.restore();
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const rawDelta = previousFrame ? Math.min(100, now - previousFrame) : 0;
  previousFrame = now;
  session.frame(rawDelta);
  const { delta, ticks } = session.clock.advance(now);
  session.advance(delta);
  for (let i = 0; i < ticks; i++) tick();
  if (!session.clock.paused || session.turning) visualTime += document.hidden ? 0 : rawDelta;
  if (now - lastFrame < 32) return;
  lastFrame = now;
  drawMap(visualTime);
}

function tileFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const cell = convert(event.clientX - rect.left, event.clientY - rect.top, originX, originY, tileSize);
  if (cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS || isRoad(cell.x, cell.y)) return null;
  return plotId(cell.x, cell.y);
}

canvas.addEventListener("pointermove", event => { hoverId = tileFromPointer(event); canvas.style.cursor = hoverId ? "pointer" : "default"; });
canvas.addEventListener("pointerleave", () => { hoverId = null; });
canvas.addEventListener("click", event => {
  if (session.clock.paused) return;
  const id = tileFromPointer(event);
  if (!id) return;
  selectPlot(id);
  if (route !== "land") location.hash = "land";
});
canvas.tabIndex = 0;
canvas.addEventListener("keydown", event => {
  if (session.clock.paused) return;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const current = selectedPlot() || state.plots[0];
  const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
  let x = current.x, y = current.y;
  for (let i = 0; i < Math.max(COLS, ROWS); i++) {
    x += delta[0]; y += delta[1];
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) break;
    if (!isRoad(x, y)) { selectPlot(plotId(x, y)); if (route !== "land") location.hash = "land"; break; }
  }
});

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  if (session.clock.paused) return;
  playSound("navigate");
  location.hash = button.dataset.route;
  if (route === button.dataset.route) setRoute(route);
}));
const soundButton = $("#sound-toggle");
function updateSoundButton() {
  const on = soundEnabled();
  soundButton.textContent = on ? "♪ SOUND ON" : "♪ SOUND OFF";
  soundButton.setAttribute("aria-pressed", String(on));
  soundButton.setAttribute("aria-label", on ? "Turn game sound off" : "Turn game sound on");
}
soundButton.addEventListener("click", () => { setSoundEnabled(!soundEnabled()); updateSoundButton(); });
document.addEventListener("pointerdown", resumeSound, { once: true });
window.addEventListener("hashchange", () => setRoute(location.hash.slice(1)));
view.addEventListener("click", event => {
  // A touch release must not click the new handoff button that replaced the pour button.
  if (performance.now() < suppressPourClickUntil) { event.preventDefault(); return; }
  if (session.clock.paused) return;
  const choice = event.target.closest("[data-select]");
  if (choice) { selectPlot(choice.dataset.select); location.hash = "land"; return; }
  const ingredient = event.target.closest("[data-ingredient]")?.dataset.ingredient;
  if (ingredient) { prepareCoffee(ingredient); return; }
  const customer = event.target.closest("[data-customer]")?.dataset.customer;
  if (customer) { session.beginHandoff(); return; }
  const brew = event.target.closest("[data-brew]")?.dataset.brew;
  if (brew && brew !== "pour") { session.brew(brew); return; }
  const employee = event.target.closest("[data-employee]")?.dataset.employee;
  if (employee) { upgradeEmployee(employee); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "deliver") { session.beginHandoff(); return; }
  if (action === "reset") {
    if (!resetArmed) { resetArmed = true; renderView(); return; }
    restartRun();
    return;
  }
  ({ buy: buySelected, sell: sellSelected, build: buildSelected, twist: () => session.openPreview(),
    goal: purchaseCar, results: openResults, "coffee-route": () => { location.hash = "coffee"; },
    "office-route": () => { location.hash = "office"; } })[action]?.();
});

// Stable container capture survives the challenge-start render on a held pointer.
view.addEventListener("pointerdown", event => {
  if (event.target.closest('[data-brew="pour"]') && !session.clock.paused) {
    event.preventDefault();
    pourPointerActive = true;
    view.setPointerCapture(event.pointerId);
    session.startPour();
    view.querySelector('[data-brew="pour"]')?.focus({ preventScroll: true });
  }
});
view.addEventListener("pointerup", () => {
  if (!pourPointerActive) return;
  pourPointerActive = false; suppressPourClickUntil = performance.now() + 350; session.stopPour();
});
view.addEventListener("pointercancel", () => { pourPointerActive = false; session.stopPour(); });
view.addEventListener("keydown", event => {
  const control = event.target.closest("[data-brew]");
  if (!control || !["Space", "Enter"].includes(event.code)) return;
  event.preventDefault();
  if (event.repeat) return;
  if (control.dataset.brew === "pour") session.startPour();
  else session.brew(control.dataset.brew);
});
view.addEventListener("keyup", event => {
  if (event.target.closest("[data-brew]") && ["Space", "Enter"].includes(event.code)) {
    event.preventDefault(); session.stopPour();
  }
});

resultsDialog.addEventListener("click", event => {
  const action = event.target.closest("[data-result]")?.dataset.result;
  if (action === "continue") closeResults();
  if (action === "restart") {
    if (resultsResetArmed) { restartRun(); return; }
    resultsResetArmed = true;
    resultsDialog.innerHTML = renderResults(true);
    resultsDialog.querySelector('[data-result="restart"]').focus();
  }
  if (action === "cancel") {
    resultsResetArmed = false;
    resultsDialog.innerHTML = renderResults();
    resultsDialog.querySelector('[data-result="continue"]').focus();
  }
});
resultsDialog.addEventListener("cancel", event => { event.preventDefault(); closeResults(); });
resultsDialog.addEventListener("close", () => { document.body.classList.remove("results-open"); session.clock.resume("results"); });

session = createSession({ navigate(next) { location.hash = next; setRoute(next); }, restart: restartRun, results: openResults, soundChanged: updateSoundButton });
function placeObjective() {
  const anchor = matchMedia("(min-width:761px)").matches ? $(".world-heading") : $(".main-nav");
  if (anchor.nextElementSibling !== $("#objective")) anchor.after($("#objective"));
}
placeObjective();
window.addEventListener("resize", placeObjective);
document.addEventListener("visibilitychange", () => { previousFrame = 0; });
subscribe((_, kind) => {
  updateChrome();
  if ((kind && !(kind === "month-bill" && route === "coffee")) || ["land", "market", "buildings", "office"].includes(route)) renderView();
  handleEvent(state.lastEvent);
  queueMicrotask(() => session.checkStory());
});
const observer = new ResizeObserver(resizeCanvas);
observer.observe(canvas);
resizeCanvas();
setRoute(location.hash.slice(1) || "coffee");
updateChrome();
updateSoundButton();
session.show("title");
requestAnimationFrame(animate);
