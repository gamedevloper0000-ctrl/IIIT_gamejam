import { GameClock } from "./clock.js";
import { state, TICK_MS, ORDERS, BUILDING, getPlot, ownedBuildings, selectedPlot, selectPlot,
  hasRun, startRun, updateSettings, checkpoint, finishConversation, claimCommission,
  previewTwist, commitTwist, startCoffeeChallenge, tapCoffeeBeat, finishCoffeeChallenge,
  advanceCoffee, pressurePosition, deliverCoffee, saleValue, purchaseCost } from "./state.js";
import { renderTitle, renderPause, renderSettings, renderCredits, renderJournal, renderDialogue,
  renderEnding, renderTwistPreview, DIALOGUES } from "./jam-ui.js";
import { setSoundEnabled, refreshVolumes, playSound } from "./audio.js";

// This controller owns every pause reason and every timed player interaction.
export function createSession({ navigate, restart, results, soundChanged }) {
  const dialog = document.querySelector("#game-dialog");
  const clock = new GameClock(TICK_MS);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let mode = "title", parent = "title", conversation = null, page = 0;
  let preview = null, turning = null, handoff = null, pouring = false, savedAt = 0;
  let returnFocus = null, lastBeat = -1;
  const reduced = () => state.settings.reducedMotion ?? motion.matches;
  const applyMotion = () => document.body.classList.toggle("reduce-motion", reduced());
  applyMotion();
  motion.addEventListener("change", applyMotion);

  function show(next) {
    if (turning) return;
    pouring = false;
    if (!dialog.open) returnFocus = document.activeElement;
    mode = next;
    clock.pause("overlay");
    const content = {
      title: () => renderTitle(hasRun()), pause: renderPause, settings: () => renderSettings(reduced()),
      credits: renderCredits, journal: renderJournal, dialogue: () => renderDialogue(conversation, page),
      ending: renderEnding, preview: () => renderTwistPreview(preview),
      confirm: () => `<div class="jam-dialog-content"><span class="jam-kicker">A FRESH START</span><h2 id="game-dialog-title">Start a new story?</h2><p>This replaces your saved money, land, team, and car. Your sound and motion settings stay.</p><div class="menu-actions"><button class="primary" data-jam="restart">START NEW GAME</button><button class="secondary" data-jam="title" autofocus>KEEP MY SAVE</button></div></div>`
    };
    dialog.className = `jam-modal mode-${next}`;
    dialog.innerHTML = content[next]();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector("[autofocus], button")?.focus();
  }
  function close() {
    dialog.close();
    clock.resume("overlay");
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function checkStory() {
    if (clock.paused || dialog.open || !hasRun()) return;
    const next = state.conversations.pending[0];
    if (!next) return;
    if (next === "roadster") { show("ending"); return; }
    conversation = next; page = 0; show("dialogue");
  }
  function endConversation() {
    const wasEnding = conversation === "roadster";
    finishConversation(conversation);
    close();
    if (wasEnding) results();
    else checkStory();
  }
  function openPreview() {
    if (clock.paused || state.story.chapter < 2) return;
    preview = previewTwist();
    if (preview) show("preview");
  }
  function beginTurn() {
    if (turning || !preview || state.story.twistCharges < 1) return;
    const transaction = preview;
    close();
    clock.pause("twist");
    turning = { preview: transaction, elapsed: 0, duration: reduced() ? 0 : 650 };
    document.body.classList.add("turning");
    document.querySelector(".canvas-frame").scrollIntoView({ block: "center", behavior: "instant" });
    playSound("turn-start");
  }
  function beginHandoff() {
    if (clock.paused || state.coffeeShopProgress.step !== "completed") return;
    clock.pause("handoff");
    handoff = { elapsed: 0, duration: reduced() ? 0 : 650 };
    document.querySelector(".shop-scene")?.classList.add("handing-off");
    document.querySelectorAll("[data-customer], [data-action=deliver]").forEach(button => { button.disabled = true; });
  }
  function brew(kind) {
    const coffee = state.coffeeShopProgress;
    if (clock.paused || coffee.step !== "prepared") return;
    if (!coffee.challenge.started) { lastBeat = -1; startCoffeeChallenge(); return; }
    if (kind === "rhythm") tapCoffeeBeat();
    if (kind === "pressure") finishCoffeeChallenge();
  }
  function startPour() {
    if (clock.paused || state.coffeeShopProgress.step !== "prepared") return;
    pouring = true;
    if (!state.coffeeShopProgress.challenge.started) startCoffeeChallenge();
  }
  function stopPour() {
    if (!pouring) return;
    pouring = false;
    if (!clock.paused) finishCoffeeChallenge();
  }
  function followObjective(task) {
    if (task.startsWith("claim-")) { claimCommission(task.slice(6)); return; }
    if (task === "coffee" || (task === "station-twist" && !state.story.twistCharges)) { navigate("coffee"); return; }
    if (task === "goal") { navigate("goal"); return; }
    const owned = state.plots.filter(plot => plot.owner === "player");
    const station = owned.find(plot => plot.building);
    let plot;
    if (task === "marked") plot = getPlot(state.story.anomalyId);
    if (task === "first-twist") plot = owned.find(plot => plot.deedId === state.story.anomalyId) || owned[0];
    if (task === "station") plot = owned.find(plot => !plot.building);
    if (task === "station-twist") plot = station;
    if (task === "neighbor" || (task === "best-sale" && !owned.length)) {
      const source = station || state.plots.find(plot => plot.building);
      // Pick a neighbor that will ALSO be in reach after the proposed station turn.
      if (source) {
        selectPlot(source.id);
        const next = previewTwist()?.moves.find(move => move.from === source.id)?.after || source;
        plot = state.plots.filter(candidate => !candidate.owner && candidate.id !== next.id &&
          Math.abs(candidate.x - next.x) + Math.abs(candidate.y - next.y) <= BUILDING.radius &&
          Math.abs(candidate.x - source.x) + Math.abs(candidate.y - source.y) <= BUILDING.radius)
          .sort((a, b) => purchaseCost(a) - purchaseCost(b))[0];
      }
    }
    if (task === "best-sale" && owned.length) plot = owned.sort((a, b) =>
      Number(b.buildingEffects > b.effectsAtPurchase) - Number(a.buildingEffects > a.effectsAtPurchase) ||
      (saleValue(b) - b.costBasis) - (saleValue(a) - a.costBasis))[0];
    if (plot) selectPlot(plot.id);
    navigate(task === "station" ? "buildings" : "land");
    if (["first-twist", "station-twist"].includes(task) && plot) openPreview();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-jam]");
    if (!button || button.disabled || turning || handoff) return;
    const action = button.dataset.jam;
    if (action === "new") { if (hasRun()) show("confirm"); else restart(); }
    if (action === "restart") restart();
    if (action === "continue") { startRun(); close(); checkStory(); }
    if (action === "resume") { close(); checkStory(); }
    if (action === "title" || action === "pause") show(action);
    if (["settings", "credits", "journal"].includes(action)) { parent = dialog.open ? mode : "game"; show(action); }
    if (action === "back") { if (parent === "game") { close(); checkStory(); } else show(parent); }
    if (action === "dialogue-next") { if (++page < DIALOGUES[conversation].length) show("dialogue"); else endConversation(); }
    if (action === "dialogue-skip") endConversation();
    if (action === "trunk") { conversation = "roadster"; page = 0; show("dialogue"); }
    if (action === "twist-confirm") beginTurn();
    if (action === "objective" && !clock.paused) followObjective(button.dataset.task);
  });
  dialog.addEventListener("input", event => {
    const control = event.target;
    if (control.id === "setting-sound") { setSoundEnabled(control.checked); soundChanged(); }
    if (control.id === "setting-motion") { updateSettings({ reducedMotion: control.checked }); applyMotion(); }
    if (["setting-music", "setting-sfx"].includes(control.id)) {
      const key = control.id.slice(8);
      updateSettings({ [key]: Number(control.value) / 100 }); refreshVolumes();
      dialog.querySelector(`#${key}-value`).textContent = `${control.value}%`;
    }
  });
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (["title", "dialogue", "ending", "confirm"].includes(mode)) return;
    if (["settings", "credits", "journal"].includes(mode) && parent !== "game") show(parent);
    else { close(); checkStory(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !dialog.open && !clock.paused) { event.preventDefault(); show("pause"); }
  });
  document.addEventListener("visibilitychange", () => {
    pouring = false;
    if (document.hidden) { checkpoint(); clock.pause("hidden"); }
    else clock.resume("hidden");
  });
  window.addEventListener("pagehide", checkpoint);

  return {
    clock, reduced, show, openPreview, beginHandoff, brew, startPour, stopPour, checkStory,
    get turning() { return turning; },
    reset() { turning = null; handoff = null; pouring = false; preview = null; savedAt = 0; lastBeat = -1; clock.resume("twist"); clock.resume("handoff"); clock.reset(); close(); applyMotion(); },
    frame(rawDelta) {
      if (document.hidden) return;
      if (turning) {
        turning.elapsed += rawDelta;
        if (turning.elapsed >= turning.duration) {
          const transaction = turning.preview;
          turning = null;
          commitTwist(transaction);
          clock.resume("twist");
          document.body.classList.remove("turning");
          checkStory();
        }
      }
      if (handoff) {
        handoff.elapsed += rawDelta;
        if (handoff.elapsed >= handoff.duration) {
          handoff = null;
          deliverCoffee(ORDERS[state.coffeeShopProgress.orderIndex % ORDERS.length].customer);
          clock.resume("handoff");
          checkStory();
        }
      }
    },
    advance(delta) {
      advanceCoffee(delta, pouring);
      const coffee = state.coffeeShopProgress, c = coffee.challenge;
      if (coffee.step !== "prepared") { pouring = false; return; }
      if (clock.elapsed - savedAt > 1000) { checkpoint(); savedAt = clock.elapsed; }
      const fill = document.querySelector("#pour-fill");
      if (fill) { fill.style.height = `${c.fill}%`; document.querySelector("#pour-percent").textContent = `${Math.round(c.fill)}%`; }
      const needle = document.querySelector("#brew-needle");
      if (needle) needle.style.left = `${pressurePosition(c.elapsed)}%`;
      if (c.kind === "rhythm" && c.started) {
        document.querySelectorAll("[data-beat]").forEach((beat, i) => {
          const remaining = (i + 1) * 1000 - c.elapsed;
          beat.classList.toggle("on-beat", Math.abs(remaining) < 150);
          beat.classList.toggle("tapped", c.taps.length > i);
          beat.querySelector("i").style.transform = `scale(${reduced() ? 1 : 1 + Math.max(0, Math.min(1, remaining / 1000)) * .9})`;
          beat.querySelector("b").textContent = reduced() ? remaining > 150 ? Math.ceil(remaining / 1000) : remaining > -150 ? "NOW" : "·" : i + 1;
        });
        const beat = Math.floor(c.elapsed / 1000);
        if (beat > lastBeat) { lastBeat = beat; if (beat > 0 && beat < 4) playSound("beat"); }
        const feedback = document.querySelector("#rhythm-feedback");
        if (feedback) feedback.textContent = `${c.taps.length} / 3 TAPS`;
      }
    }
  };
}
