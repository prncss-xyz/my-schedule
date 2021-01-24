const Lifx = require("node-lifx-lan");
const SunCalc = require("suncalc");

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;

const user = {
  sleepDuration: 7 * hour,
  latitude: 45.5544645,
  longitude: -73.5494181
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
  a0: 6 * second,
  aN: 15.7 * second,
  n: 12,
  duration: 14 * minute,
  pre: minute
};

const sunRiseParams = {
  kelvin: 6000,
  redPart: 0.3,
  duration: 20 * minute,
  anticipation: 1 * hour,
};

const day = new Date();
const times0 = SunCalc.getTimes(day, user.latitude, user.longitude);
day.setDate(day.getDate() + 1);
const times1 = SunCalc.getTimes(day, user.latitude, user.longitude);
day.setHours(0);
day.setMinutes(0);
day.setSeconds(0);
day.setMilliseconds(0);

const wakeTime = Math.min(
  times1.sunrise - sunRiseParams.anticipation,
  +day + 6 * hour
);
const sleepTime = wakeTime - user.sleepDuration;

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
  console.log("Sunrise starting.");
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

function calcPranayamaIntervals({ a0, aN, n, duration }) {
  const r = (aN / a0) ** (1 / n);
  const nTot = Math.round((duration - (a0 - r * aN) / (1 - r)) / aN) + n;
  intervals = Array(nTot);
  for (let i = 0; i < nTot; ++i) {
    intervals[i] = Math.min(a0 * r ** i, aN);
  }
  return intervals;
}

async function pranayama(
  { a0, aN, n, duration, upColor, downColor, afterColor, cycle, pre },
  dev
) {
  // console.log(dev);
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
  const pranayamaIntervals = calcPranayamaIntervals({ a0, aN, n, duration });
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

const eatingPeriod = 6.75 * hour;
const a = 2 * hour;
const b = (Math.sqrt(a * (4 * eatingPeriod - 3 * a)) - a) / 2;

printEvents([
  ["Shower", sleepTime - 2 * hour],
  ["Pranayama", sleepTime - pranayamaParams.duration],
  ["Sleep", sleepTime],
  ["Wake", wakeTime],
  ["Meal 0", wakeTime + hour],
  ["Meal 1", wakeTime + hour + a],
  ["Meal 2", wakeTime + hour + a + b],
  ["Meal 3", wakeTime + hour + eatingPeriod],
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
  // await pranayama(pranayamaParams, dev);
})();
