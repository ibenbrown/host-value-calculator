const FEE = 0.15;

const STAY_NIGHTS = { entire: 3.5, room: 2.5, unique: 2 };

const MARKET = {
  major: { entire: [180, 280], room: [90, 140], unique: [160, 260] },
  mid: { entire: [120, 190], room: [65, 100], unique: [110, 180] },
  small: { entire: [85, 140], room: [45, 75], unique: [80, 140] },
};

const BENCH = {
  entire: { hire: 3, self: 5.5 },
  room: { hire: 1.5, self: 3 },
  unique: { hire: 3.5, self: 6 },
};

const OCC = {
  "-10": 1.04,
  "-5": 1.02,
  0: 1,
  5: 0.97,
  10: 0.94,
  15: 0.9,
  20: 0.86,
  25: 0.82,
};

const state = {
  step: 1,
  city: "mid",
  property: "entire",
  bedrooms: 2,
  rate: "",
  nights: "",
  before: 1.5,
  during: 0.5,
  after: 2,
  selfClean: true,
  cleanHours: 3,
  cleanCost: 75,
  otherCost: 25,
  priceDelta: 10,
  error: "",
};

const app = document.getElementById("app");

function scenarioRead(pct, newRate, newNights) {
  const pctLabel = pct === 0 ? "Current rate" : `${pct > 0 ? "+" : ""}${pct}%`;
  return `${pctLabel} → ${money(newRate)} / night, about ${newNights.toFixed(1)} nights`;
}

function deltaSentence(delta) {
  if (Math.round(delta) === 0) return "About the same per month";
  const deltaWord = delta > 0 ? "more" : "less";
  return `About ${money(Math.abs(delta))} ${deltaWord} per month`;
}

function money(n) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return sign + "$" + Math.abs(rounded).toLocaleString("en-US");
}

function hourlyText(n) {
  if (!Number.isFinite(n)) return "—";
  return money(n) + "/hr";
}

function choice(name, value, label, current) {
  const pressed = current === value ? "true" : "false";
  return `<button type="button" data-set="${name}" data-value="${value}" aria-pressed="${pressed}">${label}</button>`;
}

function numField(name, label, value, step, min, max) {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${value}" />
    </div>`;
}

function renderStepper() {
  document.querySelectorAll(".steps li").forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle("is-current", n === state.step);
    li.classList.toggle("is-done", n < state.step);
  });
}

function marketBand() {
  const [low, high] = MARKET[state.city][state.property];
  const extra = Math.min(Number(state.bedrooms), 4) - 1;
  const mult = 1 + 0.12 * extra;
  return { low: Math.round(low * mult), high: Math.round(high * mult) };
}

function hoursPerStay() {
  const clean = state.selfClean ? Number(state.cleanHours) || 0 : 0;
  return (Number(state.before) || 0) + (Number(state.during) || 0) + (Number(state.after) || 0) + clean;
}

function monthMath(nightly, nights) {
  const stayLen = STAY_NIGHTS[state.property];
  const stays = nights / stayLen;
  const payout = nightly * nights * (1 - FEE);
  const costs = stays * ((Number(state.cleanCost) || 0) + (Number(state.otherCost) || 0));
  const net = payout - costs;
  const hours = stays * hoursPerStay();
  return { stayLen, stays, payout, costs, net, hours, hourly: hours > 0 ? net / hours : null };
}

function readNumbers() {
  const ids = ["rate", "nights", "before", "during", "after", "cleanHours", "cleanCost", "otherCost"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
}

function validate(step) {
  if (step === 1) {
    const rate = Number(state.rate);
    const nights = Number(state.nights);
    if (state.rate === "" || state.nights === "") return "Add your nightly rate and a normal month of nights.";
    if (!Number.isFinite(rate) || rate < 40 || rate > 1500) return "Use a nightly rate between $40 and $1,500.";
    if (!Number.isFinite(nights) || nights < 0 || nights > 30) return "Nights booked should be between 0 and 30.";
  }
  if (step === 2) {
    for (const id of ["before", "during", "after"]) {
      const n = Number(state[id]);
      if (!Number.isFinite(n) || n < 0 || n > 20) return "Hours need to be between 0 and 20.";
    }
    if (state.selfClean) {
      const n = Number(state.cleanHours);
      if (!Number.isFinite(n) || n < 0 || n > 12) return "Cleaning hours need to be between 0 and 12.";
    }
  }
  if (step === 3) {
    for (const id of ["cleanCost", "otherCost"]) {
      const n = Number(state[id]);
      if (!Number.isFinite(n) || n < 0 || n > 2000) return "Costs need to be between $0 and $2,000 per stay.";
    }
  }
  return "";
}

function render() {
  renderStepper();
  if (state.step === 1) renderListing();
  else if (state.step === 2) renderTime();
  else if (state.step === 3) renderCosts();
  else renderResults();
}

function errorHtml() {
  return state.error ? `<p class="error" role="alert">${state.error}</p>` : "";
}

function renderListing() {
  app.innerHTML = `
    <form class="card" id="form">
      <h2>Your listing</h2>
      <p class="help">Use a normal month, not your best month.</p>
      <div class="field">
        <span class="group-label">Market</span>
        <div class="choices">
          ${choice("city", "major", "Major metro", state.city)}
          ${choice("city", "mid", "Mid-size city", state.city)}
          ${choice("city", "small", "Smaller market", state.city)}
        </div>
      </div>
      <div class="field">
        <span class="group-label">Property</span>
        <div class="choices">
          ${choice("property", "entire", "Entire home", state.property)}
          ${choice("property", "room", "Private room", state.property)}
          ${choice("property", "unique", "Unique stay", state.property)}
        </div>
      </div>
      <div class="field">
        <span class="group-label">Bedrooms</span>
        <div class="choices">
          ${choice("bedrooms", "1", "1", String(state.bedrooms))}
          ${choice("bedrooms", "2", "2", String(state.bedrooms))}
          ${choice("bedrooms", "3", "3", String(state.bedrooms))}
          ${choice("bedrooms", "4", "4+", String(state.bedrooms))}
        </div>
      </div>
      ${numField("rate", "Current nightly rate (USD)", state.rate, "1", "40", "1500")}
      ${numField("nights", "Nights booked in a normal month", state.nights, "1", "0", "30")}
      ${errorHtml()}
      <div class="row">
        <button class="primary" type="submit">Continue</button>
      </div>
      <button class="linkish" type="button" id="example">Load an example host</button>
    </form>`;
}

function renderTime() {
  const clean = state.selfClean
    ? numField("cleanHours", "Extra hours you spend cleaning", state.cleanHours, "0.5", "0", "12")
    : "";
  app.innerHTML = `
    <form class="card" id="form">
      <h2>Time per booked stay</h2>
      <p class="help">Count the time you actually spend, including the texts.</p>
      ${numField("before", "Hours before the stay", state.before, "0.5", "0", "20")}
      ${numField("during", "Hours during the stay", state.during, "0.5", "0", "20")}
      ${numField("after", "Hours after the stay", state.after, "0.5", "0", "20")}
      <div class="field">
        <span class="group-label">Do you do the cleaning yourself?</span>
        <div class="choices">
          ${choice("selfClean", "yes", "Yes", state.selfClean ? "yes" : "no")}
          ${choice("selfClean", "no", "No", state.selfClean ? "yes" : "no")}
        </div>
      </div>
      ${clean}
      ${errorHtml()}
      <div class="row">
        <button class="ghost" type="button" id="back">Back</button>
        <button class="primary" type="submit">Continue</button>
      </div>
    </form>`;
}

function renderCosts() {
  app.innerHTML = `
    <form class="card" id="form">
      <h2>Costs you already feel</h2>
      <p class="help">A flat 15% stands in for host fees. This is a model, not your payout statement.</p>
      ${numField("cleanCost", "Cleaning and supplies per stay (USD)", state.cleanCost, "1", "0", "2000")}
      ${numField("otherCost", "Other costs per stay (restock, laundry, small repairs)", state.otherCost, "1", "0", "2000")}
      ${errorHtml()}
      <div class="row">
        <button class="ghost" type="button" id="back">Back</button>
        <button class="primary" type="submit">See my numbers</button>
      </div>
    </form>`;
}

function effortCopy(hours, typical) {
  if (hours > typical * 1.5) {
    return "You are spending more time per stay than this benchmark. Worth asking which of these hours guests actually notice.";
  }
  if (hours < typical * 0.75) {
    return "You are spending less time than this benchmark. If reviews are strong, the rate may be the lever, not more work.";
  }
  return "Your hours are in a normal range for this kind of listing. The question is whether the rate matches the hours.";
}

function renderResults() {
  const rate = Number(state.rate);
  const nights = Number(state.nights);
  const band = marketBand();
  const current = monthMath(rate, nights);
  const pct = Number(state.priceDelta);
  const factor = OCC[String(pct)];
  const newRate = rate * (1 + pct / 100);
  const newNights = nights * factor;
  const next = monthMath(newRate, newNights);
  const delta = next.net - current.net;
  const hours = hoursPerStay();
  const typical = state.selfClean ? BENCH[state.property].self : BENCH[state.property].hire;

  let place = `Your rate of ${money(rate)} sits inside this simulated band.`;
  if (rate < band.low) place = `Your rate of ${money(rate)} is under this simulated band.`;
  if (rate > band.high) place = `Your rate of ${money(rate)} is above this simulated band.`;

  const hourlyBlock = nights <= 0
    ? `<p class="metric">—</p><p class="metric-label">Add nights from a normal month to see an hourly rate.</p>`
    : current.hourly === null
      ? `<p class="metric">—</p><p class="metric-label">Add your hours to see a rate.</p>`
      : `<p class="metric">${hourlyText(current.hourly)}</p>
         <p class="metric-label">Effective hourly rate this month</p>
         <p class="plain">About ${money(current.net)} after the 15% fee and per-stay costs, spread across ${current.hours.toFixed(1)} hours.</p>`;

  const noisy = nights > 0 && nights < STAY_NIGHTS[state.property]
    ? `<p class="plain">Fewer nights than a typical stay, so this month’s hourly rate is noisy.</p>`
    : "";

  const deltaClass = delta >= 0 ? "up" : "down";

  app.innerHTML = `
    <section class="card">
      <h2>What the current rate pays you</h2>
      ${hourlyBlock}
      ${noisy}

      <div class="block">
        <p class="tag">Simulated</p>
        <h3>Similar listings</h3>
        <p class="band">${money(band.low)}–${money(band.high)} / night</p>
        <p class="plain">${place}</p>
      </div>

      <div class="block">
        <h3>What if the nightly rate moved?</h3>
        <p class="plain" id="slider-read">${scenarioRead(pct, newRate, newNights)}</p>
        <input id="priceDelta" type="range" min="-10" max="25" step="5" value="${pct}" aria-label="Price change" />
        <p class="delta ${deltaClass}" id="delta">${deltaSentence(delta)}</p>
        <p class="plain">Occupancy response is a placeholder. A real test would measure it. This view is here so a higher rate is not automatically more work.</p>
      </div>

      <div class="block">
        <p class="tag">Simulated</p>
        <h3>Time versus a typical host</h3>
        <p class="plain">You logged ${hours.toFixed(1)} hours per stay. The benchmark for this listing is ${typical} hours.</p>
        <p class="plain">${effortCopy(hours, typical)}</p>
      </div>

      <div class="block">
        <p class="plain"><strong>In the product, the next step would be a draft of a new rate the host can accept or ignore.</strong> This prototype stops at the math.</p>
      </div>

      <details class="assumptions">
        <summary>How these numbers are calculated</summary>
        <p>Host payout is nightly rate times nights, minus 15%. Stays are nights divided by ${STAY_NIGHTS[state.property]} (the assumed stay length for this property type). Costs scale with stays. Hourly rate is payout minus costs, divided by hours. The market band starts from a fixed table and rises 12% for each bedroom after the first. Occupancy steps are fixed: +10% price assumes 94% of current nights, +15% assumes 90%, and so on.</p>
      </details>

      <div class="row">
        <button class="ghost" type="button" id="back">Edit answers</button>
        <button class="primary" type="button" id="restart">Start over</button>
      </div>
    </section>`;

  const slider = document.getElementById("priceDelta");
  slider.addEventListener("input", () => {
    state.priceDelta = Number(slider.value);
    paintScenario();
  });
}

function paintScenario() {
  const rate = Number(state.rate);
  const nights = Number(state.nights);
  const pct = Number(state.priceDelta);
  const factor = OCC[String(pct)];
  const newRate = rate * (1 + pct / 100);
  const newNights = nights * factor;
  const current = monthMath(rate, nights);
  const next = monthMath(newRate, newNights);
  const delta = next.net - current.net;
  const read = document.getElementById("slider-read");
  const deltaEl = document.getElementById("delta");
  if (!read || !deltaEl) return;
  read.textContent = scenarioRead(pct, newRate, newNights);
  deltaEl.textContent = deltaSentence(delta);
  deltaEl.classList.toggle("up", delta >= 0);
  deltaEl.classList.toggle("down", delta < 0);
}

app.addEventListener("click", (e) => {
  const setBtn = e.target.closest("[data-set]");
  if (setBtn) {
    readNumbers();
    const key = setBtn.dataset.set;
    let value = setBtn.dataset.value;
    if (key === "bedrooms") value = Number(value);
    if (key === "selfClean") value = value === "yes";
    state[key] = value;
    render();
    return;
  }
  if (e.target.id === "example") {
    state.city = "mid";
    state.property = "entire";
    state.bedrooms = 2;
    state.rate = "119";
    state.nights = "20";
    state.before = 1.5;
    state.during = 0.5;
    state.after = 2;
    state.selfClean = true;
    state.cleanHours = 3;
    state.cleanCost = 75;
    state.otherCost = 25;
    state.priceDelta = 0;
    state.error = "";
    state.step = 1;
    render();
  }
  if (e.target.id === "back") {
    readNumbers();
    state.error = "";
    state.step = Math.max(1, state.step - 1);
    render();
  }
  if (e.target.id === "restart") {
    state.step = 1;
    state.rate = "";
    state.nights = "";
    state.error = "";
    render();
  }
});

app.addEventListener("submit", (e) => {
  if (e.target.id !== "form") return;
  e.preventDefault();
  readNumbers();
  const problem = validate(state.step);
  if (problem) {
    state.error = problem;
    render();
    return;
  }
  state.error = "";
  state.step += 1;
  render();
});

render();
