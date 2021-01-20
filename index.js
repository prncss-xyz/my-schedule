const Lifx = require("node-lifx-lan");
const SunCalc = require("suncalc");

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;

const user = {
  sleepDuration: 7 * hour,
  eatingPeriod: 6.75 * hour,
  latitude: 45.508889,
  longitude: -73.561667,
};

const eveningColor = {
  hue: 0,
  saturation: 0,
  brightness: 0.8,
  kelvin: 2500
};

const pranayamaParams = {
  upColor: {
    hue: 0.5,
    saturation: 1,
    brightness: 0.1
  },
  downColor: {
    hue: 0.5,
    saturation: 1,
    brightness: 0.01
  },
  afterColor: {
    hue: 0,
    saturation: 1,
    brightness: 0.01
  },
  cycle: {
    in: 3,
    full: 4,
    out: 5,
    empty: 2
  },
  a0: minute / 10,
  aN: minute / 3.8,
  rMax: 1.08,
  duration: 14 * minute,
  pre: 1 * minute,
};

const sunRiseParams = {
  kelvin: 6000,
  redPart: 0.3,
  duration: 20 * minute,
  anticipation: 1 * hour,
};

function calcWakeTime(sunrise) {
  const midnight = new Date (sunrise);
  midnight.setHours(0);
  midnight.setMinutes(0);
  midnight.setSeconds(0);
  midnight.setMilliseconds(0);
  return Math.min(
    sunrise -sunRiseParams.anticipation,
    +midnight +6*hour
  );
}

const day0 = new Date();
const times0 = SunCalc.getTimes(day0, user.latitude, user.longitude);
const sleepTime = calcWakeTime(times0.sunrise) +24*hour -user.sleepDuration;

const day1 = new Date();
const times1 = SunCalc.getTimes(day1, user.latitude, user.longitude);
const wakeTime = calcWakeTime(times1.sunrise);

// `duration` must be an integer between 0 and 65535
const chunk = 65535;
const kelvin0 = 2500;

const color = (kelvin, redPart, t) => ({
  hue: 0,
  saturation: Math.max(0, (redPart - t) / redPart),
  brightness: t,
  kelvin: Math.round(
    kelvin0 + Math.max(0, (t - redPart) / (1 - redPart)) * (kelvin - kelvin0)
  )
});

async function sunRise({ kelvin, redPart, duration }) {
  const n = Math.floor(duration / chunk);
  const r = duration % chunk;
  Lifx.turnOnBroadcast({ color: color(kelvin, redPart, 0) });
  for (let i = 0; i < n; i++) {
    Lifx.setColorBroadcast({
      color: color(kelvin, redPart, (i * chunk) / duration),
      chunk
    });
    await delay(chunk);
  }
  Lifx.setColorBroadcast({ color: color(kelvin, redPart, 1), duration: r });
  await delay(r);
}

function calcPranayamaIntervals({ a0, aN, rMax, duration }) {
  let r = aN / a0;
  let n = 1;
  while (r > rMax) {
    ++n;
    r = (aN / a0) ** (1 / n);
  }
  const nTot = Math.round((duration - (a0 - r * aN) / (1 - r)) / aN) + n;
  intervals = Array(nTot);
  for (let i = 0; i < nTot; ++i) {
    intervals[i] = Math.min(a0 * r ** i, aN);
  }
  return intervals;
}

async function pranayama(
  { a0, aN, rMax, duration, upColor, downColor, afterColor, cycle, pre },
  dev
) {
  console.log("Test");
  if (!dev) {
    console.log("Device expected.");
    return;
  }
  const { level } = await dev.deviceGetPower();
  if (!level) {
    console.log("Light out. Pranayama canceled.");
    return;
  }
  console.log("Pranayama starting.");

  const total = cycle.in + cycle.full + cycle.out + cycle.empty;
  const pranayamaIntervals = calcPranayamaIntervals({ a0, aN, rMax, duration });
  await Lifx.turnOnBroadcast({ color: downColor });
  if (pre) await delay(pre);
  for (const period of pranayamaIntervals) {
    Lifx.setColorBroadcast({
      color: upColor,
      duration: Math.round((period * cycle.in) / total)
    });
    await delay(Math.round((period * (cycle.in + cycle.full)) / total));
    Lifx.setColorBroadcast({
      color: downColor,
      duration: Math.round((period * cycle.out) / total)
    });
    await delay(Math.round((period * (cycle.out + cycle.empty)) / total));
  }
  await Lifx.turnOffBroadcast({});
  await delay(3000);
  await Lifx.setColorBroadcast({ color: afterColor });
}

const now = new Date();
const setTime = (cb, time) => time >= now && setTimeout(cb, time - now);
const setTimeOrRun = (cb, time) =>
  time >= now ? setTimeout(cb, time - now) : cb;

async function detect() {
  let list = [];
  while (list.length === 0) {
    list = await Lifx.discover();
    if (list.length === 0) {
      console.log("No lights detected; retrying...");
    }
  }
  console.log("Lights detected.");
  return list;
}

function printEvents(events) {
  const max = events.reduce((max, [label]) => Math.max(max, label.length), 0);
  events.sort(([, a], [, b]) => a - b);
  for ([label, time] of events) {
    while (label.length < max) label += " ";
    label += " : ";
    let timeString = new Date(time).toLocaleTimeString();
    if (timeString.length < 11) timeString = " " + timeString;
    console.log(label + timeString);
  }
}

let dev;

const a = 2 * hour;
const b = (Math.sqrt(a * (4 * user.eatingPeriod - 3 * a)) - a) / 2;
calcPranayamaIntervals(pranayamaParams);
printEvents([
  ["Shower", sleepTime - 2 * hour],
  ["Pranayama", sleepTime - pranayamaParams.duration],
  ["Sleep", sleepTime],
  ["Wake", wakeTime],
  ["Meal 0", wakeTime + hour],
  ["Meal 1", wakeTime + hour + a],
  ["Meal 2", wakeTime + hour + a + b],
  ["Meal 3", wakeTime + hour + user.eatingPeriod],
  ["Sunset", times0.sunset],
  ["Sunrise", times1.sunrise],
  ["Solar noon", times1.solarNoon],
  ["Golden hour", times1.goldenHour]
]);
(async () => {
  [dev] = await detect();
  setTimeOrRun(
    () => Lifx.setColorBroadcast({ color: eveningColor }),
    sleepTime - 2 * hour
  );
  setTime(
    () => pranayama(pranayamaParams, dev),
    sleepTime - pranayamaParams.duration
  );
  setTime(() => sunRise(sunRiseParams), wakeTime - sunRiseParams.duration);
})();
