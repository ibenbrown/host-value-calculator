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

const CITY_LABEL = { major: "Major metro", mid: "Mid-size city", small: "Smaller market" };
const PROPERTY_LABEL = { entire: "Entire home", room: "Private room", unique: "Unique stay" };

const HOUR_PER_STAY = ["msgBefore", "prepCheckin", "guestDuring", "checkoutReset", "cleaning", "reviewFollowup"];
const HOUR_MONTHLY = ["calendarPricing", "maintenanceAdmin"];
const COST_FIELDS = ["cleaningCost", "suppliesCost", "laundryCost", "repairsCost"];

const state = {};

function applyDefaults() {
  Object.assign(state, {
    step: 1,
    editingListing: false,
    city: "mid",
    property: "entire",
    bedrooms: 2,
    rate: 119,
    nights: 20,
    msgBefore: 0.5,
    prepCheckin: 1,
    guestDuring: 0.5,
    checkoutReset: 0.5,
    cleaning: 2.5,
    reviewFollowup: 0.5,
    selfClean: true,
    calendarPricing: 2,
    maintenanceAdmin: 1,
    cleaningCost: 0,
    suppliesCost: 0,
    laundryCost: 0,
    repairsCost: 0,
    priceDelta: 0,
    error: "",
  });
}

applyDefaults();

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

function hourValue(n) {
  const rounded = Math.round(Number(n) * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function choice(name, value, label, current) {
  const pressed = String(current) === String(value) ? "true" : "false";
  return `<button type="button" data-set="${name}" data-value="${value}" aria-pressed="${pressed}">${label}</button>`;
}

function numField(name, label, value, step, min, max) {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${value}" />
    </div>`;
}

function activityRow(id, label, value, step, min, max, unit) {
  const shown = unit === "hr" ? hourValue(value) : String(Math.round(Number(value) || 0));
  return `
    <div class="activity">
      <label for="${id}">${label}</label>
      <div class="stepper">
        <button type="button" data-bump="${id}" data-step="${step}" data-min="${min}" data-max="${max}" data-dir="-1" aria-label="Decrease ${label}">−</button>
        <input id="${id}" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${shown}" />
        <button type="button" data-bump="${id}" data-step="${step}" data-min="${min}" data-max="${max}" data-dir="1" aria-label="Increase ${label}">+</button>
        <span class="unit">${unit}</span>
      </div>
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

function stayHours() {
  return HOUR_PER_STAY.reduce((sum, id) => sum + (Number(state[id]) || 0), 0);
}

function monthlyOverhead() {
  return HOUR_MONTHLY.reduce((sum, id) => sum + (Number(state[id]) || 0), 0);
}

function perStayCosts() {
  return COST_FIELDS.reduce((sum, id) => sum + (Number(state[id]) || 0), 0);
}

function monthMath(nightly, nights) {
  const stayLen = STAY_NIGHTS[state.property];
  const stays = nights / stayLen;
  const payout = nightly * nights * (1 - FEE);
  const costs = stays * perStayCosts();
  const net = payout - costs;
  const perStay = stayHours();
  const hours = stays * perStay;
  const allHours = hours + monthlyOverhead();
  return {
    stayLen,
    stays,
    payout,
    costs,
    net,
    hours,
    perStay,
    allHours,
    hourly: hours > 0 ? net / hours : null,
    allInHourly: allHours > 0 ? net / allHours : null,
  };
}

function readNumbers() {
  ["rate", "nights", ...HOUR_PER_STAY, ...HOUR_MONTHLY, ...COST_FIELDS].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    state[id] = el.value === "" ? "" : Number(el.value);
  });
}

function validate(step) {
  if (step === 1) {
    const rate = Number(state.rate);
    const nights = Number(state.nights);
    if (state.rate === "" || state.nights === "") return "The listing needs a nightly rate and nights booked.";
    if (!Number.isFinite(rate) || rate < 40 || rate > 1500) return "Use a nightly rate between $40 and $1,500.";
    if (!Number.isFinite(nights) || nights < 0 || nights > 30) return "Nights booked should be between 0 and 30.";
  }
  if (step === 2) {
    for (const id of HOUR_PER_STAY) {
      const n = Number(state[id]);
      const max = id === "cleaning" ? 12 : 20;
      if (!Number.isFinite(n) || n < 0 || n > max) return "Hours per stay need to stay in a realistic range.";
    }
    for (const id of HOUR_MONTHLY) {
      const n = Number(state[id]);
      if (!Number.isFinite(n) || n < 0 || n > 40) return "Hours between stays need to be between 0 and 40 a month.";
    }
    for (const id of COST_FIELDS) {
      const n = Number(state[id]);
      if (!Number.isFinite(n) || n < 0 || n > 2000) return "Costs need to be between $0 and $2,000 per stay.";
    }
  }
  return "";
}

function render() {
  renderStepper();
  if (state.step === 1) renderListing();
  else if (state.step === 2) renderWork();
  else renderResults();
}

function errorHtml() {
  return state.error ? `<p class="error" role="alert">${state.error}</p>` : "";
}

function bedroomLabel() {
  return Number(state.bedrooms) >= 4 ? "4+" : String(state.bedrooms);
}

function renderListing() {
  if (!state.editingListing) {
    app.innerHTML = `
      <form class="card" id="form">
        <h2>Your listing</h2>
        <p class="help">Already on your account. This uses a normal recent month, not your best one.</p>
        <dl class="confirm">
          <div><dt>Property</dt><dd>${bedroomLabel()}-bedroom ${PROPERTY_LABEL[state.property].toLowerCase()}</dd></div>
          <div><dt>Market</dt><dd>${CITY_LABEL[state.city]}</dd></div>
          <div><dt>Nightly rate</dt><dd>${money(state.rate)}</dd></div>
          <div><dt>Nights in a normal month</dt><dd>${state.nights}</dd></div>
        </dl>
        ${errorHtml()}
        <div class="row">
          <button class="primary" type="submit">This looks right</button>
        </div>
        <button class="linkish" type="button" id="adjust">Not your listing? Adjust</button>
      </form>`;
    return;
  }

  app.innerHTML = `
    <form class="card" id="form">
      <h2>Adjust your listing</h2>
      <p class="help">In the product these fields are already filled. Change anything that’s off. Use a normal month, not your best month.</p>
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
          ${choice("bedrooms", "1", "1", state.bedrooms)}
          ${choice("bedrooms", "2", "2", state.bedrooms)}
          ${choice("bedrooms", "3", "3", state.bedrooms)}
          ${choice("bedrooms", "4", "4+", state.bedrooms)}
        </div>
      </div>
      ${numField("rate", "Current nightly rate (USD)", state.rate, "1", "40", "1500")}
      ${numField("nights", "Nights booked in a normal month", state.nights, "1", "0", "30")}
      ${errorHtml()}
      <div class="row">
        <button class="primary" type="submit">Continue</button>
      </div>
      <button class="linkish" type="button" id="example">Reset example listing</button>
    </form>`;
}

function renderWork() {
  const cleaningRow = state.selfClean
    ? activityRow("cleaning", "Cleaning, if you do it yourself", state.cleaning, 0.5, 0, 12, "hr")
    : `<div class="activity"><span class="static-label">Cleaning</span><span class="static-value">Someone you hire</span></div>`;

  app.innerHTML = `
    <form class="card" id="form">
      <h2>Your time and costs</h2>
      <p class="help">Hours are per booked stay unless the row says per month. Costs start at zero. Change only what you actually pay.</p>

      <p class="phase">Before the stay</p>
      ${activityRow("msgBefore", "Guest messages and coordination", state.msgBefore, 0.5, 0, 20, "hr")}
      ${activityRow("prepCheckin", "Prep and check-in", state.prepCheckin, 0.5, 0, 20, "hr")}

      <p class="phase">During the stay</p>
      ${activityRow("guestDuring", "Guest questions and issues", state.guestDuring, 0.5, 0, 20, "hr")}

      <p class="phase">After the stay</p>
      <div class="field">
        <span class="group-label">Who cleans?</span>
        <div class="choices">
          ${choice("selfClean", "yes", "I do", state.selfClean ? "yes" : "no")}
          ${choice("selfClean", "no", "I hire someone", state.selfClean ? "yes" : "no")}
        </div>
      </div>
      ${activityRow("checkoutReset", "Checkout, inspection, reset", state.checkoutReset, 0.5, 0, 20, "hr")}
      ${cleaningRow}
      ${activityRow("reviewFollowup", "Review and follow-up", state.reviewFollowup, 0.5, 0, 20, "hr")}

      <p class="phase">Between stays, per month</p>
      ${activityRow("calendarPricing", "Calendar, pricing, listing updates", state.calendarPricing, 0.5, 0, 40, "hr")}
      ${activityRow("maintenanceAdmin", "Photos, restocking, scheduling repairs", state.maintenanceAdmin, 0.5, 0, 40, "hr")}

      <p class="phase">Costs per stay</p>
      <p class="help cost-note">A flat 15% stands in for host fees. It is not a payout statement.</p>
      ${activityRow("cleaningCost", "Cleaning service", state.cleaningCost, 5, 0, 2000, "$")}
      ${activityRow("suppliesCost", "Supplies and restocking", state.suppliesCost, 5, 0, 2000, "$")}
      ${activityRow("laundryCost", "Laundry", state.laundryCost, 5, 0, 2000, "$")}
      ${activityRow("repairsCost", "Small repairs and maintenance", state.repairsCost, 5, 0, 2000, "$")}

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
  const hours = current.perStay;
  const typical = state.selfClean ? BENCH[state.property].self : BENCH[state.property].hire;

  let place = `Your rate of ${money(rate)} sits inside this simulated band.`;
  if (rate < band.low) place = `Your rate of ${money(rate)} is under this simulated band.`;
  if (rate > band.high) place = `Your rate of ${money(rate)} is above this simulated band.`;

  const allInLine = current.hourly !== null && current.allInHourly !== null
    ? `<p class="plain" id="all-in">Including listing management: ${hourlyText(current.allInHourly)} all-in.</p>`
    : "";

  const hourlyBlock = nights <= 0
    ? `<p class="metric">—</p><p class="metric-label">Add nights from a normal month to see an hourly rate.</p>`
    : current.hourly === null
      ? `<p class="metric">—</p><p class="metric-label">Add your hours to see a rate.</p>`
      : `<p class="metric">${hourlyText(current.hourly)}</p>
         <p class="metric-label">Per stay, after the 15% fee and costs</p>
         <p class="plain">About ${money(current.net)} this month, spread across ${current.hours.toFixed(1)} hours of stay work.</p>
         ${allInLine}`;

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
        <p class="plain">You logged ${hours.toFixed(1)} hours per stay, not counting listing management. The benchmark for this listing is ${typical} hours.</p>
        <p class="plain">${effortCopy(hours, typical)}</p>
      </div>

      <div class="block">
        <p class="plain"><strong>In the product, the next step would be a draft of a new rate the host can accept or ignore.</strong> This prototype stops at the math.</p>
      </div>

      <details class="assumptions">
        <summary>How these numbers are calculated</summary>
        <p>Host payout is nightly rate times nights, minus 15%. Stays are nights divided by ${STAY_NIGHTS[state.property]} (the assumed stay length for this property type). Per-stay costs scale with stays. The big hourly rate is payout minus costs, divided by stay hours only. The all-in rate adds hours you spend between stays, which are monthly and do not grow with each booking. The market band starts from a fixed table and rises 12% for each bedroom after the first. Occupancy steps are fixed: +10% price assumes 94% of current nights, +15% assumes 90%, and so on.</p>
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

function setSelfClean(yes) {
  state.selfClean = yes;
  if (yes) {
    state.cleaning = 2.5;
    state.cleaningCost = 0;
  } else {
    state.cleaning = 0;
    state.cleaningCost = 75;
  }
}

app.addEventListener("click", (e) => {
  const bump = e.target.closest("[data-bump]");
  if (bump) {
    readNumbers();
    const id = bump.dataset.bump;
    const step = Number(bump.dataset.step);
    const min = Number(bump.dataset.min);
    const max = Number(bump.dataset.max);
    const dir = Number(bump.dataset.dir);
    let next = (Number(state[id]) || 0) + dir * step;
    next = Math.min(max, Math.max(min, Math.round(next * 100) / 100));
    state[id] = next;
    render();
    return;
  }

  const setBtn = e.target.closest("[data-set]");
  if (setBtn) {
    readNumbers();
    const key = setBtn.dataset.set;
    let value = setBtn.dataset.value;
    if (key === "bedrooms") value = Number(value);
    if (key === "selfClean") {
      setSelfClean(value === "yes");
      render();
      return;
    }
    state[key] = value;
    render();
    return;
  }

  if (e.target.id === "adjust") {
    state.editingListing = true;
    state.error = "";
    render();
    return;
  }

  if (e.target.id === "example") {
    applyDefaults();
    state.editingListing = true;
    render();
    return;
  }

  if (e.target.id === "back") {
    readNumbers();
    state.error = "";
    state.step = Math.max(1, state.step - 1);
    if (state.step === 1) state.editingListing = false;
    render();
  }

  if (e.target.id === "restart") {
    applyDefaults();
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
