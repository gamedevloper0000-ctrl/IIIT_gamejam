// Deterministic pacing estimate, not a substitute for first-time human playtests.
import { readFileSync, writeFileSync } from "node:fs";
globalThis.localStorage = { getItem: () => null, setItem() {} };
const source = readFileSync(new URL("../src/state.js", import.meta.url)).toString("base64");
const g = await import(`data:text/javascript;base64,${source}`);
let seconds = 0, remainder = 0;
const report = {};
function spend(time, paused = false) {
  seconds += time;
  if (paused) return;
  remainder += time;
  while (remainder >= 3.5) { g.tick(); remainder -= 3.5; }
}
function coffee() {
  const o = g.ORDERS[g.state.coffeeShopProgress.orderIndex % g.ORDERS.length];
  o.ingredients.forEach(g.prepareCoffee);
  spend(20);
  // Every fourth order is good rather than perfect: no assumed permanent max streak.
  g.completeCoffee(g.state.coffeeShopProgress.orderIndex % 4 === 3 ? 1 : 2);
  g.deliverCoffee(o.customer); spend(.65, true);
  if (!report.firstOrderSeconds) report.firstOrderSeconds = seconds;
}
g.startRun(); coffee(); coffee(); spend(18, true);
g.finishConversation("deeds"); g.selectPlot(g.state.story.anomalyId); spend(6); g.buySelected();
spend(16, true); g.finishConversation("turntable"); spend(6.65, true); g.twistSelected();
report.firstTwistSeconds = seconds;
g.claimCommission("mara"); spend(8); g.buildSelected();
const station = g.selectedPlot();
g.selectPlot("2-0");
while (g.state.money < g.purchaseCost(g.selectedPlot())) coffee();
g.buySelected(); spend(6); g.selectPlot(station.id); spend(6.65, true); g.twistSelected(); spend(3.5);
if (!g.claimCommission("dax")) throw Error("Dax route failed");
spend(20, true); g.finishConversation("neighborhood");
const neighbor = g.getPlot("2-0");
while (g.saleValue(neighbor) - neighbor.costBasis < 100 && seconds < 600) coffee();
g.selectPlot(neighbor.id); spend(4); g.sellSelected();
if (!g.claimCommission("nell")) throw Error("Nell route failed");
report.allCommissionsSeconds = seconds;
while (g.state.money < 3900 && seconds < 1200) coffee();
spend(6); if (!g.purchaseCar()) throw Error("Car route failed");
report.carSeconds = Math.round(seconds);
report.orders = g.state.coffeeShopProgress.served;
report.commissions = g.state.finance.commissionEarnings;
report.cashAfterCar = g.state.money;
report.note = "Model rehearsal: 20 seconds per order, every fourth brew graded good, explicit reading pauses. Human playtest pending.";
console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("../submission/pacing-report.json", import.meta.url), JSON.stringify(report, null, 2));
