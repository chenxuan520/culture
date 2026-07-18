"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const JS_FILES = [
  "assets/js/01-world-data.js",
  "assets/js/02-simulation.js",
  "assets/js/03-interface-tutorial.js",
  "assets/js/04-rendering.js",
  "assets/js/05-bootstrap.js",
  "assets/js/06-enhancements.js",
  "assets/js/07-map-interactions.js",
];

function makeElement(id = "") {
  return {
    id,
    textContent: "",
    innerHTML: "",
    value: "1",
    checked: false,
    dataset: {},
    style: {},
    children: [],
    firstElementChild: null,
    classList: {
      classes: new Set(),
      add(...items) {
        items.forEach((item) => this.classes.add(item));
      },
      remove(...items) {
        items.forEach((item) => this.classes.delete(item));
      },
      toggle(item, force) {
        const shouldAdd = force === undefined ? !this.classes.has(item) : !!force;
        if (shouldAdd) this.classes.add(item);
        else this.classes.delete(item);
      },
      contains(item) {
        return this.classes.has(item);
      },
    },
    addEventListener() {},
    dispatchEvent() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
    },
    focus() {},
    remove() {},
    closest() {
      return null;
    },
  };
}

function makeCanvasContext() {
  const gradient = { addColorStop() {} };
  return {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillText() {},
    strokeText() {},
    createLinearGradient() {
      return gradient;
    },
    createRadialGradient() {
      return gradient;
    },
    measureText() {
      return { width: 0 };
    },
    setLineDash() {},
    drawImage() {},
    rect() {},
    clip() {},
  };
}

function createHarness() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const ids = new Map();
  for (const match of html.matchAll(/id="([^"]+)"/g)) ids.set(match[1], makeElement(match[1]));

  const ctx2d = makeCanvasContext();
  const canvasElement = (id) => ({
    ...makeElement(id),
    getContext() {
      return ctx2d;
    },
    setPointerCapture() {},
    hasPointerCapture() {
      return false;
    },
    releasePointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 };
    },
  });
  ids.set("game", canvasElement("game"));
  ids.set("mini", canvasElement("mini"));

  const timeoutQueue = [];
  const document = {
    getElementById(id) {
      if (!ids.has(id)) ids.set(id, makeElement(id));
      return ids.get(id);
    },
    querySelector() {
      return makeElement();
    },
    querySelectorAll(selector) {
      if (selector === "[data-difficulty]") {
        return ["easy", "medium", "hard"].map((difficulty) => {
          const element = makeElement();
          element.dataset = { difficulty };
          return element;
        });
      }
      return [];
    },
    addEventListener() {},
    createElement() {
      return makeElement();
    },
  };
  const window = {
    addEventListener() {},
    AudioContext: null,
    webkitAudioContext: null,
    __STARFIRE_DEBUG__: {},
  };
  const context = {
    console,
    Math,
    Date,
    Set,
    Map,
    WeakMap,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    JSON,
    Error,
    performance: { now: () => 0 },
    setTimeout(fn) {
      timeoutQueue.push(fn);
      return timeoutQueue.length;
    },
    clearTimeout() {},
    setInterval() {
      return 0;
    },
    clearInterval() {},
    requestAnimationFrame() {},
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    document,
    window,
    globalThis: null,
    Event: function Event(type) {
      this.type = type;
    },
  };
  context.globalThis = context;
  window.window = window;
  window.document = document;
  window.globalThis = context;

  vm.createContext(context);
  for (const file of JS_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  while (timeoutQueue.length) timeoutQueue.shift()();

  return { context, ids, html };
}

function runInGame(context, source) {
  return vm.runInContext(source, context);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("all DOM ids referenced by $() exist", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const missing = [];
  for (const file of JS_FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const match of source.matchAll(/\$\('([^']+)'\)/g)) {
      if (!ids.has(match[1])) missing.push(`${file}: #${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("HTML loads scripts in dependency order and all assets exist", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, JS_FILES);
  const refs = [
    ...scripts,
    ...[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]),
  ];
  assert.deepEqual(
    refs.filter((ref) => !fs.existsSync(path.join(ROOT, ref))),
    [],
  );
});

test("data definitions reference existing resources, techs, and products", () => {
  const { context } = createHarness();
  const errors = runInGame(
    context,
    `(() => {
      const knownResources = new Set(RESOURCE_KEYS);
      const knownTech = new Set(TECHS.map((tech) => tech.id));
      const knownProducts = new Set([...Object.keys(UNIT_DEFS), ...Object.keys(BUILDING_DEFS)]);
      const errors = [];
      for (const tech of TECHS) for (const pre of tech.pre) if (!knownTech.has(pre)) errors.push('missing tech pre ' + tech.id + ' -> ' + pre);
      for (const [id, def] of Object.entries(UNIT_DEFS)) if (def.tech && !knownTech.has(def.tech)) errors.push('unit bad tech ' + id);
      for (const [id, def] of Object.entries(BUILDING_DEFS)) if (def.tech && !knownTech.has(def.tech)) errors.push('building bad tech ' + id);
      for (const id of PRODUCT_IDS) if (!knownProducts.has(id)) errors.push('bad product ' + id);
      for (const [group, defs] of [['unit', UNIT_DEFS], ['building', BUILDING_DEFS], ['improvement', IMPROVEMENTS], ['resource', RESOURCE_DEFS]]) {
        for (const [id, def] of Object.entries(defs)) {
          for (const bag of ['cost', 'yield']) {
            for (const key of Object.keys(def[bag] || {})) if (!knownResources.has(key)) errors.push(group + ' ' + id + ' bad ' + bag + ' ' + key);
          }
        }
      }
      return errors;
    })()`,
  );
  assert.deepEqual(plain(errors), []);
});

test("research pacing is not instant-unlock fast", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const cheapest = Math.min(...TECHS.map((tech) => tech.cost));
      const secondCheapest = TECHS.map((tech) => tech.cost).sort((a, b) => a - b)[1];
      const fastest = Math.min(...TECHS.map((tech) => tech.time));
      return {
        startingScience: state.resources.science,
        cheapest,
        secondCheapest,
        fastest,
        canStartOne: state.resources.science >= cheapest,
        cannotBuyTwo: state.resources.science < cheapest + secondCheapest,
      };
    })()`,
  );
  assert.equal(result.canStartOne, true);
  assert.equal(result.cannotBuyTwo, true);
  assert.ok(result.fastest >= 8);
});

test("starting production stockpile requires early development choices", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const city = state.cities.find((item) => item.team === 'player' && item.capital);
      const before = { ...state.resources };
      const attempted = PRODUCT_IDS.slice(0, 10);
      for (const id of attempted) queueProduct(city, id);
      return {
        starting: before,
        attemptedCount: attempted.length,
        queued: city.queue.map((item) => item.id),
        queueLength: city.queue.length,
        productionAfter: state.resources.production,
        goldAfter: state.resources.gold,
      };
    })()`,
  );
  assert.deepEqual(plain(result.starting), {
    food: 92,
    production: 72,
    science: 42,
    gold: 118,
    energy: 32,
  });
  assert.ok(result.queueLength < result.attemptedCount);
  assert.ok(result.queueLength <= 3);
  assert.ok(result.productionAfter < 20);
  assert.ok(result.goldAfter < result.starting.gold);
});

test("enhanced worker initialization keeps player workers usable", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const initial = state.units.find((unit) => unit.team === 'player' && unit.type === 'worker');
      const made = createUnit('worker', 'player', 3, 8, { aiWorker: false });
      const enemy = createUnit('enemyWorker', 'enemy', 10, 10);
      return {
        initialCharges: initial.charges,
        initialAI: initial.aiWorker,
        madeCharges: made.charges,
        madeAI: made.aiWorker,
        enemyCharges: enemy.charges,
        enemyAI: enemy.aiWorker
      };
    })()`,
  );
  assert.deepEqual(plain(result), {
    initialCharges: 5,
    initialAI: false,
    madeCharges: 5,
    madeAI: false,
    enemyCharges: 5,
    enemyAI: true,
  });
});

test("worker build flow is blocked before tech and works after tech", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const worker = state.units.find((unit) => unit.team === 'player' && unit.type === 'worker');
      const blockedBeforeTech = [...tiles.values()]
        .filter((tile) => !tile.improvement && !cityAt(tile.q, tile.r))
        .some((tile) => !canImproveTile(tile).ok && /需要科技|工人无法|暂无/.test(canImproveTile(tile).reason));
      state.completed.add('agriculture');
      state.completed.add('mining');
      state.completed.add('combustion');
      state.completed.add('electricity');
      const buildTile = [...tiles.values()].find((tile) => canImproveTile(tile).ok && findPath(worker, { q: worker.q, r: worker.r }, tile).length);
      const assigned = assignWorkerBuild(worker, buildTile, true);
      const panel = renderTileSelection(buildTile);
      return {
        blockedBeforeTech,
        assigned,
        workerCharges: worker.charges,
        workerHasJob: !!worker.work,
        jobQ: worker.work && worker.work.q,
        jobR: worker.work && worker.work.r,
        busyPanelBlocked: panel.includes('data-blocked="已经有工人在处理这个地块"'),
        busyPanelStillGreen: panel.includes('action good full" data-action="dispatch-worker"'),
      };
    })()`,
  );
  assert.equal(result.blockedBeforeTech, true);
  assert.equal(result.assigned, true);
  assert.equal(result.workerCharges, 5);
  assert.equal(result.workerHasJob, true);
  assert.equal(typeof result.jobQ, "number");
  assert.equal(typeof result.jobR, "number");
  assert.equal(result.busyPanelBlocked, true);
  assert.equal(result.busyPanelStillGreen, false);
});

test("manual combat commands target enemy improvements and movement clears hold", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const soldier = state.units.find((unit) => unit.team === 'player' && unit.def.combat);
      const targetTile = [...tiles.values()].find((tile) => !tile.improvement && isLand(tile) && !cityAt(tile.q, tile.r));
      targetTile.improvement = { type: 'mine', team: 'enemy', hp: 100, maxHp: 100 };
      setLockedTarget(soldier, { kind: 'improvement', obj: targetTile.improvement, tile: targetTile, q: targetTile.q, r: targetTile.r, team: 'enemy' }, true);
      const targetKind = resolveTarget(soldier.target)?.kind;
      soldier.holdPosition = true;
      setUnitRoute(soldier, soldier.q, soldier.r, true);
      return { targetKind, holdPosition: soldier.holdPosition };
    })()`,
  );
  assert.deepEqual(plain(result), { targetKind: "improvement", holdPosition: false });
});

test("settings/help panels and intro difficulty text are wired", () => {
  const { context, ids } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      renderPanels();
      return {
        introDifficulty: $('introDifficultyDesc').textContent,
        difficultyHint: $('difficultyHint').textContent,
        skirmishHint: $('skirmishHint').textContent,
        mapMode: $('mapModeSelect').value,
        playerFaction: $('playerFactionSelect').value,
        playerSide: $('playerSideSelect').value,
        leftAI: $('leftAISlots').value,
        rightAI: $('rightAISlots').value,
        workerDefaultAI: $('workerDefaultAI').value,
        settlerAutoFound: $('settlerAutoFound').value,
        settingsFn: typeof window.toggleSettingsPanel,
        helpFn: typeof window.toggleHelpPanel,
      };
    })()`,
  );
  assert.match(result.introDifficulty, /中等/);
  assert.match(result.difficultyHint, /中等/);
  assert.match(result.skirmishHint, /默认地图 · 星火联盟 · 左侧开局 · 1v1/);
  assert.equal(result.mapMode, "default");
  assert.equal(result.playerFaction, "spark");
  assert.equal(result.playerSide, "left");
  assert.equal(result.leftAI, "0");
  assert.equal(result.rightAI, "1");
  assert.equal(result.workerDefaultAI, "off");
  assert.equal(result.settlerAutoFound, "off");
  assert.equal(result.settingsFn, "function");
  assert.equal(result.helpFn, "function");
  assert.equal(ids.get("gameSettings").id, "gameSettings");
});

test("worker default AI is a runtime setting, not an intro skirmish option", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const settings = html.slice(html.indexOf('id="settingsLayer"'), html.indexOf('id="helpLayer"'));
  const intro = html.slice(html.indexOf('id="intro"'), html.indexOf('id="tutorial"'));
  assert.equal(settings.includes('id="workerDefaultAI"'), true);
  assert.equal(settings.includes('id="settlerAutoFound"'), true);
  assert.equal(intro.includes('id="workerDefaultAI"'), false);
  assert.equal(intro.includes('id="settlerAutoFound"'), false);
});

test("map mode can switch between default and reproducible random layouts", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const def = freshState(false, 'medium', 'default', 0, 1);
      const defaultLarge = freshState(false, 'medium', 'default', 2, 3);
      const randomA = createMapConfig('random', 123456, 6);
      const randomB = createMapConfig('random', 123456, 6);
      const randomState = freshState(false, 'medium', 'random', 0, 1);
      return {
        defaultMode: def.mapMode,
        defaultSize: def.mapSize,
        largeDefaultSize: defaultLarge.mapSize,
        largeDefaultAreaRatio: defaultLarge.mapSize.width * defaultLarge.mapSize.height / (def.mapSize.width * def.mapSize.height),
        randomConfigStable: JSON.stringify(randomA) === JSON.stringify(randomB),
        randomLargeSizeInRange: randomA.width >= 31 && randomA.width <= 40 && randomA.height >= 23 && randomA.height <= 29,
        randomSizeInRange: randomState.mapSize.width >= 18 && randomState.mapSize.width <= 23 && randomState.mapSize.height >= 13 && randomState.mapSize.height <= 17,
        randomMode: randomState.mapMode,
        randomTileCount: tiles.size,
        noWaterResources: [...tiles.values()].every((tile) => tile.terrain !== 'water' || !tile.resource),
      };
    })()`,
  );
  assert.equal(result.defaultMode, "default");
  assert.deepEqual(plain(result.defaultSize), { width: 20, height: 15 });
  assert.ok(result.largeDefaultSize.width >= 34);
  assert.ok(result.largeDefaultSize.height >= 25);
  assert.ok(result.largeDefaultAreaRatio >= 2.8);
  assert.equal(result.randomConfigStable, true);
  assert.equal(result.randomLargeSizeInRange, true);
  assert.equal(result.randomSizeInRange, true);
  assert.equal(result.randomMode, "random");
  assert.equal(result.randomTileCount, result.randomSizeInRange ? result.randomTileCount : 0);
  assert.equal(result.noWaterResources, true);
});

test("skirmish setup supports up to 3v3 with valid spawn tiles", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const s = freshState(false, 'medium', 'default', 2, 3);
      state = s;
      const playerCities = s.cities.filter((city) => city.team === 'player');
      const enemyCities = s.cities.filter((city) => city.team === 'enemy');
      const allOnLand = [...s.cities, ...s.units].every((obj) => isLand(tileAt(obj.q, obj.r)));
      const playerWorkers = s.units.filter((unit) => unit.team === 'player' && unit.type === 'worker');
      const allyWorkers = playerWorkers.filter((unit) => unit.allyAI);
      return {
        leftAI: s.leftAI,
        rightAI: s.rightAI,
        playerCities: playerCities.length,
        enemyCities: enemyCities.length,
        allOnLand,
        playerWorkers: playerWorkers.length,
        allyWorkers: allyWorkers.length,
        enemyUnits: s.units.filter((unit) => unit.team === 'enemy').length,
        area: s.mapSize.width * s.mapSize.height,
      };
    })()`,
  );
  assert.equal(result.leftAI, 2);
  assert.equal(result.rightAI, 3);
  assert.equal(result.playerCities, 3);
  assert.equal(result.enemyCities, 3);
  assert.equal(result.allOnLand, true);
  assert.equal(result.playerWorkers, 3);
  assert.equal(result.allyWorkers, 2);
  assert.ok(result.enemyUnits >= 9);
  assert.ok(result.area >= 840);
});

test("player faction selection changes player colors and units", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const rightStart = freshState(false, 'medium', 'default', 2, 3, 'right', 'ash');
      state = rightStart;
      const playerCapital = rightStart.cities.find((city) => city.team === 'player' && city.capital);
      const enemyCapital = rightStart.cities.find((city) => city.team === 'enemy' && city.capital);
      const allyFactions = rightStart.cities.filter((city) => city.allyAI).map((city) => city.faction);
      const enemyFactions = rightStart.cities.filter((city) => city.team === 'enemy').map((city) => city.faction);
      const enemyUnitTypes = rightStart.units.filter((unit) => unit.team === 'enemy').map((unit) => unit.type);
      const availableEnemyTypes = window.__STARFIRE_DEBUG__.enemyCombatTypes();
      const mainUnits = rightStart.units.filter((unit) => unit.team === 'player' && !unit.allyAI).map((unit) => unit.type);
      const allyUnits = rightStart.units.filter((unit) => unit.team === 'player' && unit.allyAI).map((unit) => unit.type);
      const factionColors = window.__STARFIRE_DEBUG__.factions();
      const city = rightStart.cities.find((item) => item.team === 'player' && item.capital);
      const before = rightStart.units.length;
      completeProduct(city, { id: 'raider' });
      const produced = rightStart.units.slice(before).find((unit) => unit.type === 'raider');
      const colorKeys = ['blue', 'green', 'yellow', 'red', 'black', 'purple'];
      const rgb = (hex) => {
        const raw = hex.replace('#', '');
        return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
      };
      const colorDistance = (a, b) => {
        const x = rgb(factionColors[a].stroke), y = rgb(factionColors[b].stroke);
        return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      };
      return {
        playerSide: rightStart.playerSide,
        statePlayerFaction: rightStart.playerFaction,
        playerMapSide: rightStart.playerMapSide,
        enemyMapSide: rightStart.enemyMapSide,
        playerRightOfEnemy: playerCapital.q > enemyCapital.q,
        playerCapitalName: playerCapital.name,
        enemyCapitalName: enemyCapital.name,
        playerFaction: playerCapital.faction,
        allyFactions,
        enemyFactions,
        enemyUnitTypes,
        availableEnemyTypes,
        mainUnits,
        allyUnits,
        roster: PRODUCT_IDS.slice(0, 8),
        distinctStrokes: new Set(colorKeys.map((key) => factionColors[key].stroke)).size,
        closePairs: colorKeys.filter((key) => key !== 'black').flatMap((a, i, list) => list.slice(i + 1).map((b) => [a, b, colorDistance(a, b)])).filter((item) => item[2] < 90),
        blackUsesDarkDisplay: factionColors.black.stroke === '#0f172a' && factionColors.black.health === '#111827' && factionColors.black.mini === '#020617' && factionColors.black.unitMini === '#111827',
        allColorsExist: colorKeys.every((key) => !!factionColors[key]),
        producedFaction: produced && produced.faction,
        producedType: produced && produced.type,
      };
    })()`,
  );
  assert.equal(result.playerSide, "right");
  assert.equal(result.statePlayerFaction, "ash");
  assert.equal(result.playerFaction, "red");
  assert.equal(result.playerMapSide, "enemy");
  assert.equal(result.enemyMapSide, "player");
  assert.equal(result.playerRightOfEnemy, true);
  assert.equal(result.playerCapitalName, "灰烬要塞");
  assert.equal(result.enemyCapitalName, "曙光城");
  assert.deepEqual(plain(result.allyFactions), ["black", "purple"]);
  assert.deepEqual(plain(result.enemyFactions), ["blue", "green", "yellow"]);
  assert.equal(plain(result.enemyUnitTypes).every((id) => ["archer", "scout", "warrior"].includes(id)), true);
  assert.equal(plain(result.enemyUnitTypes).some((id) => ["raider", "enemyArcher", "enemyBuggy", "enemySiege", "enemyDrone", "enemyTitan"].includes(id)), false);
  assert.equal(plain(result.availableEnemyTypes).some((id) => ["raider", "enemyArcher", "enemyBuggy", "enemySiege", "enemyDrone", "enemyTitan"].includes(id)), false);
  assert.deepEqual(plain(result.mainUnits.sort()), ["enemyArcher", "enemyWorker", "raider"].sort());
  assert.deepEqual(plain(result.allyUnits.sort()), ["enemyArcher", "enemyArcher", "enemyWorker", "enemyWorker"].sort());
  assert.deepEqual(plain(result.roster), ["enemyWorker", "enemySettler", "raider", "enemyArcher", "enemyBuggy", "enemySiege", "enemyDrone", "enemyTitan"]);
  assert.equal(result.distinctStrokes, 6);
  assert.deepEqual(plain(result.closePairs), []);
  assert.equal(result.blackUsesDarkDisplay, true);
  assert.equal(result.allColorsExist, true);
  assert.equal(result.producedFaction, "red");
  assert.equal(result.producedType, "raider");
});

test("ash combat roster is not using weak enemy-only tuning", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const spark = ['scout', 'warrior', 'archer', 'knight', 'tank', 'prism', 'kirov', 'quantumWalker'];
      const ash = ['raider', 'enemyArcher', 'enemyBuggy', 'enemySiege', 'enemyDrone', 'enemyTitan'];
      const costSum = (def) => Object.values(def.cost || {}).reduce((sum, value) => sum + value, 0);
      const score = (id) => {
        const def = UNIT_DEFS[id];
        const dps = (def.attack || 0) / (def.interval || 1);
        const rangeMul = 1 + Math.max(0, (def.range || 1) - 1) * 0.18;
        const armorMul = 1 + (def.armor || 0) * 0.08;
        const moveMul = 1 + Math.max(0, (def.move || 1) - 1) * 0.12;
        const power = (def.hp || 1) * dps * rangeMul * armorMul * moveMul;
        return {
          id,
          power,
          perCost: power / Math.max(1, costSum(def)),
          perProdSecond: power / Math.max(1, costSum(def) * def.time),
        };
      };
      const average = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
      const sparkRows = spark.map(score);
      const ashRows = ash.map(score);
      const openingCombat = (faction) => freshState(true, 'medium', 'default', 0, 1, 'left', faction).units
        .filter((unit) => unit.team === 'player' && unit.def.combat)
        .map((unit) => score(unit.type));
      const sparkOpening = openingCombat('spark');
      const ashOpening = openingCombat('ash');
      return {
        avgCostRatio: average(ashRows, 'perCost') / average(sparkRows, 'perCost'),
        avgProdRatio: average(ashRows, 'perProdSecond') / average(sparkRows, 'perProdSecond'),
        openingPowerRatio: ashOpening.reduce((sum, row) => sum + row.power, 0) / sparkOpening.reduce((sum, row) => sum + row.power, 0),
        ashWorkerHp: UNIT_DEFS.enemyWorker.hp,
        sparkWorkerHp: UNIT_DEFS.worker.hp,
        ashSettlerTime: UNIT_DEFS.enemySettler.time,
        sparkSettlerTime: UNIT_DEFS.settler.time,
      };
    })()`,
  );
  assert.ok(result.avgCostRatio > 0.7, `ash cost efficiency ratio ${result.avgCostRatio}`);
  assert.ok(result.avgProdRatio > 0.65, `ash production efficiency ratio ${result.avgProdRatio}`);
  assert.ok(result.openingPowerRatio > 0.85, `ash opening power ratio ${result.openingPowerRatio}`);
  assert.equal(result.ashWorkerHp, result.sparkWorkerHp);
  assert.equal(result.ashSettlerTime, result.sparkSettlerTime);
});

test("ash player makes enemy AI produce spark units and support", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const ashIds = ['enemyWorker', 'enemySettler', 'raider', 'enemyArcher', 'enemyBuggy', 'enemySiege', 'enemyDrone', 'enemyTitan', 'ashGranary', 'warLab', 'warFoundry', 'bastion', 'warCore'];
      const sparkIds = ['worker', 'settler', 'scout', 'warrior', 'archer', 'knight', 'tank', 'prism', 'kirov', 'quantumWalker', 'granary', 'forge', 'academy', 'shieldDome', 'quantumRelay'];

      const supportState = freshState(true, 'medium', 'default', 0, 2, 'left', 'ash');
      state = supportState;
      Object.assign(state.enemyAI.resources, { food: 999, production: 999, science: 999, gold: 999, energy: 999 });
      state.enemyAI.thinkTimer = 0;
      state.enemyAI.waveTimer = 99;
      window.__STARFIRE_DEBUG__.updateEnemyStrategicAI(1);
      const supportQueue = state.cities.filter((city) => city.team === 'enemy').flatMap((city) => city.queue.map((item) => item.id));

      const combatState = freshState(true, 'medium', 'default', 0, 2, 'left', 'ash');
      state = combatState;
      Object.assign(state.enemyAI.resources, { food: 999, production: 999, science: 999, gold: 999, energy: 999 });
      TECHS.forEach((tech) => state.enemyAI.completed.add(tech.id));
      let improvements = 0;
      for (const tile of tiles.values()) {
        if (improvements >= 8) break;
        if (!isLand(tile) || cityAt(tile.q, tile.r)) continue;
        tile.improvement = { type: 'farm', team: 'enemy', owner: 'enemy', hp: 10, maxHp: 10, faction: 'blue' };
        improvements++;
      }
      for (const city of state.cities.filter((item) => item.team === 'enemy')) {
        city.buildings = ['granary', 'forge', 'academy', 'shieldDome', 'quantumRelay'];
      }
      state.enemyAI.thinkTimer = 0;
      state.enemyAI.waveTimer = 99;
      window.__STARFIRE_DEBUG__.updateEnemyStrategicAI(1);
      const combatQueue = state.cities.filter((city) => city.team === 'enemy').flatMap((city) => city.queue.map((item) => item.id));
      const before = state.units.length;
      const city = state.cities.find((item) => item.team === 'enemy' && item.queue.length);
      if (city) {
        city.queue[0].progress = city.queue[0].time;
        updateCities(0.1);
      }
      const produced = state.units.slice(before).filter((unit) => unit.team === 'enemy').map((unit) => ({
        type: unit.type,
        name: unit.name,
        faction: unit.faction,
      }));

      return {
        supportQueue,
        supportHasAsh: supportQueue.some((id) => ashIds.includes(id)),
        combatQueue,
        combatHasAsh: combatQueue.some((id) => ashIds.includes(id)),
        combatAllSpark: combatQueue.every((id) => sparkIds.includes(id)),
        produced,
        producedHasAsh: produced.some((unit) => ashIds.includes(unit.type) || unit.name.includes('灰烬')),
      };
    })()`,
  );
  assert.deepEqual(plain(result.supportQueue), ["worker", "worker"]);
  assert.equal(result.supportHasAsh, false);
  assert.ok(result.combatQueue.length > 0);
  assert.equal(result.combatHasAsh, false);
  assert.equal(result.combatAllSpark, true);
  assert.equal(result.producedHasAsh, false);
  assert.equal(plain(result.produced).every((unit) => ["blue", "green", "yellow"].includes(unit.faction)), true);
});

test("ally AI uses independent economy instead of player resources", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const s = freshState(false, 'medium', 'default', 2, 3);
      state = s;
      const playerBefore = {...state.resources};
      const allyBefore = {...state.allyAI.resources};
      const allyCity = state.cities.find((city) => city.allyAI);
      const queued = window.__STARFIRE_DEBUG__.allyQueueProduct(allyCity, 'warrior');
      const playerAfterQueue = {...state.resources};
      const allyAfterQueue = {...state.allyAI.resources};
      const beforeUnits = state.units.length;
      completeProduct(allyCity, { id: 'warrior' });
      const madeAlly = state.units.slice(beforeUnits).find((unit) => unit.type === 'warrior');
      const allyWorker = state.units.find((unit) => unit.allyAI && unit.type === 'worker');
      state.completed.add('agriculture');
      state.completed.add('mining');
      const tile = [...tiles.values()].find((item) => canImproveTile(item).ok && findPath(allyWorker, { q: allyWorker.q, r: allyWorker.r }, item).length);
      assignWorkerBuild(allyWorker, tile, false);
      const work = allyWorker.work;
      tile.improvement = { type: work.type, team: 'player', owner: 'ally', hp: IMPROVEMENTS[work.type].hp, maxHp: IMPROVEMENTS[work.type].hp };
      const playerYield = calculateYield();
      const allyYield = window.__STARFIRE_DEBUG__.calculateAllyYield();
      const allyPanel = renderCitySelection(allyCity);
      return {
        queued,
        playerUnchanged: JSON.stringify(playerBefore) === JSON.stringify(playerAfterQueue),
        allySpentProduction: allyAfterQueue.production < allyBefore.production,
        madeUnitIsAlly: !!madeAlly && madeAlly.allyAI === true,
        allyFacilityFriendly: tile.improvement.team === 'player',
        allyPanelHasNoManualProducts: !allyPanel.includes('data-product='),
        playerYieldFromAllyFacility: Object.values(tileYield(tile)).every((value) => value === 0),
        allyYieldHasFacility: Object.values(allyYield).some((value) => value > 0),
        playerYieldIgnoresAllyCity: playerYield.production < allyYield.production + 20,
      };
    })()`,
  );
  assert.equal(result.queued, true);
  assert.equal(result.playerUnchanged, true);
  assert.equal(result.allySpentProduction, true);
  assert.equal(result.madeUnitIsAlly, true);
  assert.equal(result.allyFacilityFriendly, true);
  assert.equal(result.allyPanelHasNoManualProducts, true);
  assert.equal(result.playerYieldFromAllyFacility, true);
  assert.equal(result.allyYieldHasFacility, true);
  assert.equal(result.playerYieldIgnoresAllyCity, true);
});

test("enemy garrison over cap launches an attack instead of camping base", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const s = freshState(true, 'medium', 'default', 0, 1);
      state = s;
      const city = state.cities.find((item) => item.team === 'enemy' && item.capital);
      for (let i = 0; i < 10; i++) state.units.push(createUnit('raider', 'enemy', city.q, city.r, { aiOrder: 'garrison' }));
      state.enemyAI.waveTimer = 99;
      window.__STARFIRE_DEBUG__.updateEnemyStrategicAI(1);
      return {
        attacking: state.units.filter((unit) => unit.team === 'enemy' && unit.aiOrder === 'attack').length,
        wave: state.enemyAI.waveNumber,
      };
    })()`,
  );
  assert.ok(result.attacking > 0);
  assert.ok(result.wave > 0);
});

test("new worker default AI setting affects produced workers", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      state.completed.add('agriculture');
      state.completed.add('mining');
      window.__STARFIRE_DEBUG__.setWorkerDefaultAI(true, false);
      const city = state.cities.find((item) => item.team === 'player' && item.capital);
      const before = state.units.length;
      completeProduct(city, { id: 'worker' });
      const worker = state.units.slice(before).find((unit) => unit.type === 'worker');
      window.__STARFIRE_DEBUG__.setWorkerDefaultAI(false, false);
      const beforeManual = state.units.length;
      completeProduct(city, { id: 'worker' });
      const manualWorker = state.units.slice(beforeManual).find((unit) => unit.type === 'worker');
      return {
        autoAI: worker.aiWorker,
        autoHasCharges: worker.charges,
        manualAI: manualWorker.aiWorker,
        manualHasCharges: manualWorker.charges,
      };
    })()`,
  );
  assert.deepEqual(plain(result), {
    autoAI: true,
    autoHasCharges: 5,
    manualAI: false,
    manualHasCharges: 5,
  });
});

test("city rally point sends produced combat units to the target tile", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const city = state.cities.find((item) => item.team === 'player' && item.capital);
      const target = [...tiles.values()].find((tile) => isLand(tile) && !cityAt(tile.q, tile.r) && hexDistance(city, tile) >= 3);
      city.rallyPoint = { q: target.q, r: target.r };
      const cityPanel = renderCitySelection(city);
      const before = state.units.length;
      completeProduct(city, { id: 'warrior' });
      const warrior = state.units.slice(before).find((unit) => unit.type === 'warrior');
      const end = warrior.route[warrior.route.length - 1];
      const workerBefore = state.units.length;
      completeProduct(city, { id: 'worker' });
      const worker = state.units.slice(workerBefore).find((unit) => unit.type === 'worker');
      return {
        combatHasRoute: warrior.route.length > 0,
        routeEndsAtRally: !!end && end.q === target.q && end.r === target.r,
        workerRouteLength: worker.route.length,
        panelShowsRally: cityPanel.includes('清除集结点') && cityPanel.includes('战斗单位完成后前往'),
      };
    })()`,
  );
  assert.equal(result.combatHasRoute, true);
  assert.equal(result.routeEndsAtRally, true);
  assert.equal(result.workerRouteLength, 0);
  assert.equal(result.panelShowsRally, true);
});

test("city production speed scales with production output and consumes production stockpile", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const city = state.cities.find((item) => item.team === 'player' && item.capital);
      state.resources.production = 100;
      city.queue.push({ qid: 'slow', id: 'warrior', progress: 0, time: productDef('warrior').time, cost: {} });
      const baseProd = cityYield(city).production;
      updateCities(1);
      const progressWithoutForge = city.queue[0].progress;
      const stockAfter = state.resources.production;
      city.queue = [{ qid: 'fast', id: 'warrior', progress: 0, time: productDef('warrior').time, cost: {} }];
      city.buildings.push('forge');
      state.resources.production = 100;
      updateCities(1);
      const progressWithForge = city.queue[0]?.progress ?? productDef('warrior').time;
      return { baseProd, progressWithoutForge, progressWithForge, stockAfter };
    })()`,
  );
  assert.ok(result.baseProd > 0);
  assert.ok(result.progressWithoutForge > 1);
  assert.ok(result.progressWithForge > result.progressWithoutForge);
  assert.ok(result.stockAfter < 100);
});

test("production hotkeys do not replace product icons", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const city = state.cities.find((item) => item.team === 'player' && item.capital);
      const html = renderCitySelection(city);
      return {
        workerIconKept: html.includes('<div class="pIcon">👷</div>'),
        hotkeyShown: html.includes('[1] 工人'),
      };
    })()`,
  );
  assert.equal(result.workerIconKept, true);
  assert.equal(result.hotkeyShown, true);
});

test("settler auto-found setting creates a city after route arrival", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      state.completed.add('engineering');
      const city = state.cities.find((item) => item.team === 'player' && item.capital);
      const settler = createUnit('settler', 'player', city.q, city.r);
      state.units.push(settler);
      const target = [...tiles.values()].find((tile) => isLand(tile) && !cityAt(tile.q, tile.r) && hexDistance(city, tile) >= 4 && findPath(settler, { q: settler.q, r: settler.r }, tile).length);
      window.__STARFIRE_DEBUG__.setSettlerAutoFound(true, false);
      setUnitRoute(settler, target.q, target.r, true);
      let guard = 0;
      while (state.units.some((unit) => unit.id === settler.id) && settler.route.length && guard++ < 200) updateMovement(settler, 1);
      const created = state.cities.find((item) => item.team === 'player' && item.q === target.q && item.r === target.r);
      window.__STARFIRE_DEBUG__.setSettlerAutoFound(false, false);
      return { cityCreated: !!created, settlerRemoved: !state.units.some((unit) => unit.id === settler.id) };
    })()`,
  );
  assert.deepEqual(plain(result), { cityCreated: true, settlerRemoved: true });
});

test("map generation does not create undevelopable water resources", () => {
  const { context } = createHarness();
  const ok = runInGame(context, `[...tiles.values()].every((tile) => tile.terrain !== 'water' || !tile.resource)`);
  assert.equal(ok, true);
});

test("tile pulse contribution displays actual yield, not pulse duration", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      state.completed.add('agriculture');
      state.completed.add('mining');
      const tile = [...tiles.values()].find((item) => canImproveTile(item).ok);
      const type = canImproveTile(tile).type;
      tile.improvement = { type, team: 'player', owner: 'player', hp: IMPROVEMENTS[type].hp, maxHp: IMPROVEMENTS[type].hp };
      const html = renderTileSelection(tile);
      return { hasDurationText: html.includes('1.0 模拟秒'), hasYield: html.includes(yieldText(tileYield(tile))) };
    })()`,
  );
  assert.equal(result.hasDurationText, false);
  assert.equal(result.hasYield, true);
});

test("unbuilt resource tiles show potential yield instead of all zeroes", () => {
  const { context } = createHarness();
  const result = runInGame(
    context,
    `(() => {
      const tile = [...tiles.values()].find((item) => item.resource && !item.improvement);
      const html = renderTileSelection(tile);
      const resourceYield = RESOURCE_DEFS[tile.resource].yield;
      return {
        showsPotentialTitle: html.includes('潜在每脉冲产出'),
        showsPotentialText: html.includes(yieldText(resourceYield)),
        hasNonZeroPotential: Object.entries(resourceYield).some(([key, value]) => value > 0 && html.includes(RESOURCE_META[key].name + ' <b>+' + value + '</b>')),
      };
    })()`,
  );
  assert.equal(result.showsPotentialTitle, true);
  assert.equal(result.showsPotentialText, true);
  assert.equal(result.hasNonZeroPotential, true);
});

test("visible docs do not contain removed terminology", () => {
  const files = ["index.html", "assets/js/03-interface-tutorial.js", "assets/js/06-enhancements.js"];
  const text = files.map((file) => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  assert.equal(/超载|试听|左上角/.test(text), false);
  assert.equal(/红黑紫阵营|蓝绿黄阵营/.test(text), false);
});

test("RTS control docs mention box select and production hotkeys", () => {
  const files = ["index.html", "assets/js/03-interface-tutorial.js", "assets/js/06-enhancements.js"];
  const text = files.map((file) => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  assert.match(text, /框选/);
  assert.match(text, /右键拖动地图|右键拖图|拖动地图/);
  assert.equal(/鼠标边缘|地图边缘|靠边滚屏|靠近边缘|自动滚动视野|自动平移视野/.test(text), false);
  assert.match(text, /1-9\s*\/\s*0|1-9\/0/);
  assert.match(text, /打开上次生产基地/);
  assert.match(text, /<span(?: class="key")?>H<\/span><b?>?|<span class="key">H<\/span> 打开上次生产基地/);
  assert.equal(/<span(?: class="key")?>G<\/span>(?:<b>)?打开上次生产基地|<span class="key">G<\/span> 打开上次生产基地/.test(text), false);
});

test("production base hotkey uses H instead of G", () => {
  const source = fs.readFileSync(path.join(ROOT, "assets/js/05-bootstrap.js"), "utf8");
  assert.match(source, /k==='h'\|\|k==='H'/);
  assert.equal(/k==='g'\|\|k==='G'/.test(source), false);
});

test("mouse command docs and handlers use left-click commands and right-click deselect", () => {
  const docs = ["index.html", "assets/js/03-interface-tutorial.js", "assets/js/06-enhancements.js"]
    .map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"))
    .join("\n");
  const bootstrap = fs.readFileSync(path.join(ROOT, "assets/js/05-bootstrap.js"), "utf8");
  assert.match(docs, /左键.*移动\/攻击|左键.*规划路线/);
  assert.match(docs, /右键.*取消/);
  assert.equal(/右键(?:敌人|此设施|目标|要塞|移动|锁敌|规划|攻击)|右键地图(?:让|规划|下达|移动|锁敌)/.test(docs), false);
  assert.match(bootstrap, /canvas\.addEventListener\('click'[\s\S]*issueCommandAt\(x,y\)/);
  assert.match(bootstrap, /canvas\.addEventListener\('contextmenu'[\s\S]*state\.selection=null[\s\S]*renderPanels\(\)/);
  assert.equal(/contextmenu[\s\S]{0,180}issueCommandAt/.test(bootstrap), false);
});

test("WASD camera movement has no A command conflict", () => {
  const bootstrap = fs.readFileSync(path.join(ROOT, "assets/js/05-bootstrap.js"), "utf8");
  const enhancements = fs.readFileSync(path.join(ROOT, "assets/js/06-enhancements.js"), "utf8");
  const text = [bootstrap, enhancements, fs.readFileSync(path.join(ROOT, "assets/js/03-interface-tutorial.js"), "utf8"), fs.readFileSync(path.join(ROOT, "index.html"), "utf8")].join("\n");
  assert.equal(/pendingACommand|轻点 A|按 A 会|对鼠标指向执行移动\/攻击/.test(text), false);
  assert.match(bootstrap, /MOVE_KEYS=new Set\(\['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'\]\)/);
  assert.match(bootstrap, /state\.keys\.add\(code\)/);
  assert.match(bootstrap, /state\.keys\.delete\(e\.code\)/);
  assert.match(enhancements, /state\.keys\.has\('KeyA'\)\)dx--/);
  assert.equal(/const edge=28|screen\.w-edge|screen\.h-edge/.test(bootstrap + enhancements), false);
});

test("updateCamera consumes keyboard movement codes", () => {
  const { context } = createHarness();
  const moved = runInGame(
    context,
    `(() => {
      const before = {...state.camera};
      state.keys.clear();
      state.keys.add('KeyD');
      updateCamera(0.2);
      const after = {...state.camera};
      state.keys.clear();
      return Math.hypot(after.x - before.x, after.y - before.y);
    })()`,
  );
  assert.ok(moved > 1);
});

test("right mouse drag pans map when no unit selection exists", () => {
  const source = fs.readFileSync(path.join(ROOT, "assets/js/07-map-interactions.js"), "utf8");
  assert.match(source, /function hasUnitSelection\(\)/);
  assert.match(source, /const rightDrag=e\.button===2&&!hasUnitSelection\(\)/);
  assert.match(source, /dragState\.mode=rightDrag\?'pan':'box'/);
  assert.match(source, /state\.camera\.x=dragState\.startCamX-dx\/state\.camera\.zoom/);
  assert.match(source, /state\.rightPanSuppressUntil=performance\.now\(\)\+250/);
});

test("Escape key is wired to pause outside tutorials", () => {
  const source = fs.readFileSync(path.join(ROOT, "assets/js/05-bootstrap.js"), "utf8");
  assert.match(source, /if\(k==='Escape'\).*togglePause\(\)/s);
});
