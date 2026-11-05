// Builds /<slug>/index.html character sheet pages into the site repo.
// Usage: node build.js /path/to/site-repo
const fs = require('fs');
const path = require('path');
const SPELLS = require('./spells.js');
const CHARS = require('./chars.js');
const OUT = process.argv[2];
const ACCENT_DARK = {"#b0458a": "#e48cc4", "#c4622d": "#ec8d5e", "#b8432f": "#f07b66", "#3d5ba8": "#8ea8ec", "#4f7a3a": "#93c577", "#2b7a8c": "#63c0d4", "#7a4aa8": "#bb92e6"};
if (!OUT) throw new Error('usage: node build.js <site repo dir>');

const PROF = 3;
const AB = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const AB_USE = {
  str: 'Lifting, pushing, climbing, jumping, hitting hard with non-finesse weapons.',
  dex: 'Agility, balance, reflexes, sneaking, aiming bows. Your armor and initiative use it.',
  con: 'Toughness and stamina. Adds to your Hit Points and helps you keep concentrating on spells.',
  int: 'Memory, reasoning and book learning.',
  wis: 'Awareness, intuition and willpower. Noticing things.',
  cha: 'Force of personality: persuading, lying, performing, intimidating.',
};
const SKILLS = {
  Acrobatics: ['dex', 'Keeping your balance, tumbling, wriggling free, landing on your feet.'],
  'Animal Handling': ['wis', 'Calming or controlling an animal, or guessing what it wants.'],
  Arcana: ['int', 'Knowing about magic, spells, magic items and magical creatures.'],
  Athletics: ['str', 'Climbing, swimming, jumping, shoving, grappling.'],
  Deception: ['cha', 'Lying convincingly, bluffing, disguising your intentions.'],
  History: ['int', 'Remembering past events, kingdoms, wars and legends.'],
  Insight: ['wis', 'Telling if someone is lying or what they really feel.'],
  Intimidation: ['cha', 'Scaring or pressuring someone into doing what you want.'],
  Investigation: ['int', 'Searching for clues, working out how something works, spotting traps by reasoning.'],
  Medicine: ['wis', 'Stabilizing a dying friend (DC 10, no kit needed), or working out what made someone sick or killed them.'],
  Nature: ['int', 'Knowing about plants, animals, terrain and weather.'],
  Perception: ['wis', 'Spotting, hearing or noticing things. The most-rolled skill in the game.'],
  Performance: ['cha', 'Music, dance, acting, storytelling for a crowd.'],
  Persuasion: ['cha', 'Convincing someone politely and honestly.'],
  Religion: ['int', 'Knowing about gods, rites, holy symbols and the undead.'],
  'Sleight of Hand': ['dex', 'Pickpocketing, palming an object, quick hand tricks.'],
  Stealth: ['dex', 'Sneaking and hiding.'],
  Survival: ['wis', 'Tracking, hunting, finding your way, predicting weather.'],
};
const FORMS = {
  'Cat': { size: 'Tiny', ac: 12, speed: '40 ft, climb 40 ft', atk: 'Scratch: d20 + 4 to hit, 1 Slashing', notes: 'Perception +3, Stealth +4, Darkvision 60 ft. Jumps using Dexterity.' },
  'Spider': { size: 'Tiny', ac: 12, speed: '20 ft, climb 20 ft (walls and ceilings, no check needed)', atk: 'Bite: d20 + 4 to hit, 1 Piercing + 1d4 Poison', notes: 'Stealth +4, Darkvision 30 ft. Walks on webs freely.' },
  'Wolf': { size: 'Medium', ac: 12, speed: '40 ft', atk: 'Bite: d20 + 4 to hit, 1d6 + 2 Piercing. If the target is Medium or smaller, it is knocked Prone (no save)', notes: 'Pack Tactics: advantage on attacks if a friend is next to the target. Perception +5, Stealth +4, Darkvision 60 ft.' },
  'Black Bear': { size: 'Medium', ac: 11, speed: '30 ft, climb 30 ft, swim 30 ft', atk: 'Two Rend attacks per Attack action: each d20 + 4 to hit, 1d6 + 2 Slashing', notes: 'Perception +5, Darkvision 60 ft.' },
  'Warhorse': { size: 'Large', ac: 11, speed: '60 ft', atk: 'Hooves: d20 + 6 to hit, 2d4 + 4 Bludgeoning. If you moved 20+ feet straight at a Large-or-smaller target first: +2d4 more and it falls Prone', notes: 'A creature can ride you.' },
  'Crocodile': { size: 'Large', ac: 12, speed: '20 ft, swim 30 ft', atk: 'Bite: d20 + 4 to hit, 1d8 + 2 Piercing. A Medium-or-smaller target is Grappled (escape DC 12) and Restrained while grappled', notes: 'Holds its breath for 1 hour.' },
  'Reef Shark': { size: 'Medium', ac: 12, speed: '5 ft, swim 30 ft (breathes only underwater)', atk: 'Bite: d20 + 4 to hit, 2d4 + 2 Piercing', notes: 'Pack Tactics. Blindsight 30 ft.' },
  'Giant Venomous Snake': { size: 'Medium', ac: 14, speed: '40 ft, swim 40 ft', atk: 'Bite: d20 + 6 to hit, reach 10 ft, 1d4 + 4 Piercing + 1d8 Poison', notes: 'Blindsight 10 ft.' },
};

const mod = (s) => Math.floor((s - 10) / 2);
const sg = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LVL = ['Cantrip', '1st level', '2nd level', '3rd level'];

function fill(t, v) { return t.replace(/\{(\w+)\}/g, (_, k) => v[k] !== undefined ? v[k] : `{${k}}`); }

function boxes(slug, key, count, cls) {
  let h = '';
  for (let i = 0; i < count; i++) h += `<label class="box${cls ? ' ' + cls : ''}"><input type="checkbox" data-k="${slug}:${key}:${i}" aria-label="${key} ${i + 1}"><span></span></label>`;
  return h;
}

function spellCard(name, c, tag, override, fullSrc, free) {
  const s = SPELLS[name];
  if (!s) throw new Error('missing spell ' + name);
  const m = mod(c.abilities[c.castAbility]);
  const dc = (override && override.dc) || 8 + PROF + m;
  const atk = (override && override.atk) || PROF + m;
  const v = { dc, atk: atk, mod: m, mageArmor: c.mageArmor };
  const flags = [s.conc ? '<span class="pill conc">Concentration</span>' : '', s.ritual ? '<span class="pill rit">Ritual</span>' : '', tag ? `<span class="pill src">${esc(tag)}</span>` : ''].join('');
  const ritualOnly = override && override.ritualOnly;
  const cast = s.lvl > 0 && !ritualOnly ? `<button type="button" class="cast" data-level="${s.lvl}"${free ? ` data-free="${free.key}"` : ''}${free && free.freeOnly ? ' data-freeonly="1"' : ''}>Cast</button>` : '';
  const freeRow = free ? `<div class="freerow"><span class="fl">Free casts${free.freeOnly ? '' : ' (used first)'}</span><span class="boxes">${boxes(c.slug, free.key, free.count, 'sm')}</span></div>` : '';
  return `<div class="spell">
<div class="shead"><div class="sh"><span class="sname">${esc(name)}</span><span class="smeta">${s.time.split(',')[0]} · ${esc(s.range.split(',')[0])}</span>${flags}</div>${cast}</div>
${freeRow}<p class="castmsg" role="status" aria-live="polite"></p>
<details><summary><span class="sh"><span class="more">What it does</span></span></summary>
<div class="sbody">${fullSrc ? `<p class="from"><b>Where it comes from:</b> ${esc(fullSrc)}</p>` : ''}
<dl class="facts"><div><dt>Casting time</dt><dd>${esc(s.time)}</dd></div><div><dt>Range</dt><dd>${esc(s.range)}</dd></div><div><dt>Lasts</dt><dd>${esc(s.dur)}${s.conc ? ' (concentration)' : ''}</dd></div></dl>
<p>${fill(s.what, v)}</p>
<p class="roll"><b>What to roll:</b> ${fill(s.roll, v)}</p>
${s.up ? `<p class="muted"><b>With a higher slot:</b> ${s.up}</p>` : ''}
</div></details></div>`;
}

function tracker(key, label, count, slug, note) {
  let boxes = '';
  for (let i = 0; i < count; i++) boxes += `<label class="box"><input type="checkbox" data-k="${slug}:${key}:${i}"><span></span></label>`;
  return `<div class="trk"><span class="tl">${esc(label)}${note ? ` <span class="muted">${note}</span>` : ''}</span><span class="boxes">${boxes}</span></div>`;
}

function page(c) {
  const m = {}; for (const k in c.abilities) m[k] = mod(c.abilities[k]);
  const cm = m[c.castAbility];
  const dc = 8 + PROF + cm, satk = PROF + cm;
  const skillRows = Object.keys(SKILLS).map((sk) => {
    const [ab, use] = SKILLS[sk];
    const lv = c.skills[sk] || 0;
    let b = m[ab] + PROF * lv;
    const chips = [];
    if (lv === 2) chips.push('Expert'); else if (lv === 1) chips.push('Trained');
    if (c.magician && (sk === 'Arcana' || sk === 'Nature')) { b += m.wis; chips.push('+ Wisdom (Magician)'); }
    return `<tr class="${lv ? 'prof' : ''}"><td><b>${sk}</b> <span class="muted">(${AB[ab].slice(0, 3)})</span>${chips.map((x) => ` <span class="chip">${x}</span>`).join('')}<div class="use">${use}</div></td><td class="num">${sg(b)}</td></tr>`;
  }).join('');
  const percep = 10 + m.wis + PROF * (c.skills.Perception || 0);
  const abilRows = Object.keys(AB).map((k) => {
    const sv = m[k] + (c.saves.includes(k) ? PROF : 0);
    return `<tr><td><b>${AB[k]}</b><div class="use">${AB_USE[k]}</div></td><td class="num">${c.abilities[k]}</td><td class="num">${sg(m[k])}</td><td class="num ${c.saves.includes(k) ? 'hi' : ''}">${sg(sv)}${c.saves.includes(k) ? '<span class="dot" title="proficient">●</span>' : ''}</td></tr>`;
  }).join('');
  const isCaster = (c.prepared && c.prepared.length) || Object.keys(c.always || {}).length;
  const hasSlots = c.slots && c.slots.length;
  const freeBy = {}; (c.free || []).forEach((f) => { if (f.spell) freeBy[f.spell] = f; });
  const freeT = (c.free || []).filter((f) => !f.spell).map((f) => tracker(f.key, f.label, f.count, c.slug)).join('');
  const featT = c.features.filter((f) => f.track).map((f) => tracker(f.track.key, f.track.label, f.track.count, c.slug)).join('');
  const hd = tracker('hd', `Hit Dice (d${c.hitDie})`, 5, c.slug, 'spend on a Short Rest');
  const short = (t) => t.split(/[:(]/)[0].trim();
  const cantrips = (c.cantrips || []).map((n) => { const src = (c.cantripSrc || {})[n]; return spellCard(n, c, src && short(src), null, src); }).join('');
  const extra = Object.entries(c.always || {}).map(([n, v]) => ({ n, o: typeof v === 'string' ? { src: v } : v }));
  const byLvl = [1, 2, 3].map((l) => {
    const nSlots = c.slots[l - 1] || 0;
    const ex = extra.filter((e) => SPELLS[e.n].lvl === l);
    const list = c.prepared.filter((n) => SPELLS[n].lvl === l);
    if (!nSlots && !ex.length && !list.length) return '';
    const cards = list.map((n) => spellCard(n, c, null, null, null, freeBy[n])).join('') + ex.map((e) => spellCard(e.n, c, short(e.o.src), e.o, e.o.src, freeBy[e.n])).join('');
    return `<div class="lvlgrp" data-level="${l}"><div class="lvlhead"><h3 class="lvl">${LVL[l]} spells</h3>${nSlots ? `<div class="slotbox"><span class="fl">${nSlots} slots</span><span class="boxes">${boxes(c.slug, 'slot' + l, nSlots)}</span></div>` : ''}</div>${cards}</div>`;
  }).join('');
  const forms = (c.forms || []).map((f) => { const b = FORMS[f]; return `<div class="form"><h4>${f} <span class="muted">${b.size}</span></h4><p><b>AC</b> ${b.ac} · <b>Speed</b> ${b.speed}</p><p>${b.atk}</p><p class="muted">${b.notes}</p></div>`; }).join('');
  const feats = c.features.map((f) => `<details class="feat"><summary><span class="sh"><span class="sname">${esc(f.name)}</span><span class="pill type">${esc(f.type)}</span></span></summary><div class="sbody"><p class="muted small">${esc(f.src)}${f.uses ? ' · ' + esc(f.uses) : ''}</p>${f.text}</div></details>`).join('');
  const atkRows = c.attacks.map((a) => {
    const add = a[1] === '—';
    const hit = a[1] === 'Save' ? '<div class="kv"><span class="k">Target rolls</span><span class="v">a save</span></div>' : add ? '' : `<div class="kv"><span class="k">To hit</span><span class="v">d20 ${a[1].replace('+', '+ ')}</span></div>`;
    return `<li class="atk${add ? ' add' : ''}"><h3 class="aname">${esc(a[0])}</h3><div class="kvs">${hit}<div class="kv"><span class="k">${add ? 'Adds' : a[1] === 'Save' ? 'Effect' : 'Damage'}</span><span class="v">${esc(a[2])}</span></div>${add ? '' : `<div class="kv"><span class="k">Range</span><span class="v r">${esc(a[3])}</span></div>`}</div>${a[4] ? `<p class="use">${esc(a[4])}</p>` : ''}</li>`;
  }).join('');
  const who = Object.entries(c.who || {}).map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('') || '<p class="muted">Nothing written yet.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.svg">
<title>${esc(c.name)} · Character Sheet</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..800,50&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
:root { --bg:#eef0f4; --panel:#fff; --fg:#1d2230; --muted:#5a6275; --line:#d4d9e3; --accent:${c.accent}; --soft:#e3e7ef; --conc:#8a5a00; --down:#b3261e; --good:#2e7d4a; --display:"Fraunces",Georgia,serif; --body:"Atkinson Hyperlegible",system-ui,sans-serif; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#161a26; --panel:#1f2434; --fg:#e9ebf2; --muted:#a2a9bb; --line:#343b4f; --down:#ff8a7a; --good:#7cc98f; --soft:#262b3c; --accent:${ACCENT_DARK[c.accent]}; --conc:#f0b44a; color-scheme: dark; } }
:root[data-theme="dark"] { --bg:#161a26; --panel:#1f2434; --fg:#e9ebf2; --muted:#a2a9bb; --line:#343b4f; --down:#ff8a7a; --good:#7cc98f; --soft:#262b3c; --accent:${ACCENT_DARK[c.accent]}; --conc:#f0b44a; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font-family:var(--body); font-size:16px; line-height:1.5; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 80px; }
body::before { content:""; position:fixed; inset:0 0 auto; height: env(safe-area-inset-top, 0px); z-index:10; background: var(--bg); }
a:focus-visible, summary:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
.wrap { max-width: 820px; margin: 0 auto; }
h1,h2,h3 { font-family:var(--display); margin:0; text-wrap:balance; }
h1 { font-size: clamp(2.2rem, 8vw, 3.2rem); line-height:1.05; }
h2 { font-size: 1.5rem; margin-bottom: 4px; }
h4 { margin: 0; font-size: 1rem; }
p { margin: 0 0 8px; } p:last-child { margin-bottom: 0; }
ul { margin: 4px 0 8px; padding-left: 20px; } li { margin-bottom: 6px; }
.muted { color: var(--muted); } .small { font-size: .85rem; }
header { padding: 32px 0 12px; border-bottom: 4px solid var(--accent); margin-bottom: 8px; }
.eyebrow { font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:700; }
.line { font-weight: 700; color: var(--accent); margin-top: 4px; }
nav { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); display:flex; gap:6px; overflow-x:auto; padding: 10px 0; border-bottom: 1px solid var(--line); }
nav a { flex:none; font-size:.85rem; font-weight:700; color:var(--fg); text-decoration:none; padding:6px 12px; border-radius:999px; border:1px solid var(--line); background:var(--panel); }
section { margin-top: 32px; scroll-margin-top: 64px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; margin-top:10px; }
.stats { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin-top: 14px; }
@media (min-width: 640px) { .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.stat { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:10px 12px; min-width:0; }
.stat .k { font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:700; }
.stat .v { font-family:var(--display); font-size:1.8rem; font-weight:700; line-height:1.1; color: var(--accent); font-variant-numeric: tabular-nums; }
.stat .n { font-size:.8rem; color:var(--muted); line-height:1.3; }
table { width:100%; border-collapse: collapse; font-size: .95rem; }
th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align: top; }
th { font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
td.num { font-variant-numeric: tabular-nums; font-weight:700; white-space:nowrap; font-size:1.05rem; }
td.hi { color: var(--accent); }
.dot { font-size:.6rem; margin-left:4px; vertical-align: 2px; }
tr.prof td:first-child b { color: var(--accent); }
.use { font-size:.83rem; color:var(--muted); line-height:1.35; margin-top:2px; }
.scroll { overflow-x:auto; }
dl.turn { margin: 10px 0 0; display:grid; gap: 14px; }
.turn .tr { display:grid; gap: 2px; }
.turn dt { font-weight:700; color: var(--accent); }
.turn dd { margin:0; }
@media (min-width: 640px) { .turn .tr { grid-template-columns: 13rem 1fr; gap: 16px; } }
.atks { list-style:none; margin: 10px 0 0; padding:0; display:grid; gap:8px; }
.atk { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px 14px; display:grid; gap:8px; min-width:0; margin:0; }
.atk.add { background: var(--soft); border-style: dashed; }
.aname { font-family: var(--body); font-size: 1.02rem; margin:0; }
.kvs { display:flex; flex-wrap:wrap; gap: 6px 22px; }
.kv { display:grid; min-width:0; }
.kv .k { font-size:.7rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:700; }
.kv .v { font-weight:700; font-size:1.05rem; font-variant-numeric: tabular-nums; }
.kv .v.r { font-weight:400; font-size:.95rem; }
.atk .use { margin:0; }
.chip { display:inline-block; font-size:.68rem; font-weight:700; padding:1px 7px; border-radius:999px; background: var(--soft); color: var(--fg); vertical-align: 1px; }
th.numh { text-align:right; } td.num { text-align:right; }
.from { font-size:.85rem; color: var(--muted); }
.lvlgrp { margin-top: 18px; display:grid; gap: 8px; }
.lvlhead { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap: 8px 16px; padding: 10px 0 6px; border-bottom: 2px solid var(--accent); }
h3.lvl { font-family: var(--display); font-size: 1.25rem; margin:0; }
.slotbox { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
.fl { font-size:.75rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:700; }
.spell { background:var(--panel); border:1px solid var(--line); border-radius:12px; min-width:0; }
.spell > details { background: transparent; border:0; border-top: 1px solid var(--line); border-radius: 0 0 12px 12px; margin:0; }
.spell > details > summary { padding: 8px 14px; }
.more { font-size:.88rem; font-weight:700; color: var(--muted); }
.shead { display:grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items:center; padding: 12px 14px; }
.freerow { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding: 0 14px 10px; }
.box.sm span { width:24px; height:24px; border-radius:6px; }
button.cast { font: inherit; font-weight:700; font-size:.95rem; padding: 8px 16px; border-radius: 10px; border: 0; background: var(--accent); color: var(--bg); cursor:pointer; min-height: 40px; }
button.cast:active { transform: translateY(1px); }
.castmsg { margin:0; padding: 0 14px; font-size:.88rem; font-weight:700; color: var(--accent); }
.castmsg:empty { display:none; }
.castmsg:not(:empty) { padding-bottom: 10px; }
@media (prefers-reduced-motion: reduce) { button.cast:active { transform:none; } }
header > p, section > p, .callout p { max-width: 68ch; }
details { background:var(--panel); border:1px solid var(--line); border-radius:12px; margin-top:8px; }
summary { cursor:pointer; padding:12px 14px; display:grid; grid-template-columns: minmax(0, 1fr) auto; align-items:start; gap:10px; list-style:none; }
summary::-webkit-details-marker { display:none; }
summary .sh, .shead .sh { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; min-width:0; }
summary::after { content:"+"; font-weight:700; color:var(--muted); font-size:1.2rem; line-height:1.2; }
details[open] summary::after { content:"−"; }
.sname { font-weight:700; font-size:1.02rem; }
.smeta { font-size:.82rem; color:var(--muted); }
.sbody { padding: 0 14px 14px; border-top: 1px solid var(--line); padding-top: 12px; }
.facts { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:6px 14px; margin:0 0 10px; font-size:.88rem; }
.facts dt { font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:700; } .facts dd { margin:0; }
.roll { background: var(--soft); padding: 8px 12px; border-radius: 8px; }
.roll b { color: var(--accent); }
.pill { display:inline-block; font-size:.7rem; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.pill.conc { color: var(--conc); border-color: var(--conc); } .pill.rit { color: var(--accent); border-color: var(--accent); }
.pill.type { color: var(--accent); border-color: var(--accent); }
h4.lvl { margin-top: 18px; font-family: var(--display); font-size: 1.15rem; }
.callout { background: var(--soft); border-radius: 12px; padding: 12px 14px; margin-top: 10px; }
.forms { display:grid; grid-template-columns: repeat(auto-fit, minmax(230px,1fr)); gap:8px; margin-top:8px; }
.form { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px; font-size:.92rem; }
.form h4 { font-family: var(--display); font-size: 1.1rem; margin-bottom: 4px; }
.trk { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line); flex-wrap: wrap; }
.trk:last-child { border-bottom: 0; }
.boxes { display:flex; gap:6px; flex-wrap: wrap; }
.box input { position:absolute; opacity:0; width:1px; height:1px; }
.box span { display:block; width:30px; height:30px; border:2px solid var(--accent); border-radius:8px; cursor:pointer; }
.box input:checked + span { background: var(--accent); }
.box input:focus-visible + span { outline: 3px solid var(--fg); outline-offset: 2px; }
button.reset { font: inherit; font-weight:700; padding:10px 14px; border-radius:10px; border:1px solid var(--accent); background:var(--panel); color:var(--fg); cursor:pointer; margin-top:10px; }
.hpcard { display:grid; gap:10px; }
.hpnow { display:flex; align-items:baseline; gap: 8px 14px; flex-wrap: wrap; }
.hpbig { font-family: var(--display); font-size: 3rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--accent); }
.hpmax { font-size: 1.4rem; color: var(--muted); }
.hptemp { font-weight:700; padding: 2px 10px; border-radius: 999px; background: var(--soft); }
.hpbar { height: 10px; border-radius: 999px; background: var(--soft); overflow: hidden; }
.hpbar span { display:block; height:100%; width:100%; background: var(--accent); border-radius: 999px; transition: width .25s; }
.hpstate { margin:0; font-weight:700; }
.hpstate:empty { display:none; }
.hpstate.down { color: var(--down); }
.hpctl { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; align-items:end; }
.hpctl .fl { grid-column: 1 / -1; }
.hpctl input { grid-column: 1 / -1; font: inherit; font-size:1.5rem; font-weight:700; padding:8px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color: var(--fg); min-width:0; }
@media (min-width: 640px) { .hpctl { grid-template-columns: 8rem repeat(4, auto); justify-content: start; } .hpctl .fl { grid-column: 1 / -1; } .hpctl input { grid-column: auto; } }
.hpbtn { font: inherit; font-weight:700; padding: 10px 14px; border-radius:10px; min-height: 44px; cursor:pointer; border: 1px solid var(--line); background: var(--panel); color: var(--fg); }
.hpbtn.dmg { background: var(--down); border-color: var(--down); color: var(--bg); }
.hpbtn.heal { background: var(--good); border-color: var(--good); color: var(--bg); }
.hpbtn:disabled { opacity: .45; cursor: default; }
@media (prefers-reduced-motion: reduce) { .hpbar span { transition: none; } }
footer { margin-top: 40px; color: var(--muted); font-size: .85rem; }
@media print { nav, button.reset { display:none; } details { break-inside: avoid; } details:not([open]) .sbody { display:block; } body { background:#fff; } }
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="eyebrow">Character sheet · Level 5${c.pronouns ? ' · ' + esc(c.pronouns) : ''}</p>
  <h1>${esc(c.name)}</h1>
  <p class="line">${esc(c.line)}</p>
  <div class="stats">
    <div class="stat"><div class="k">Armor Class</div><div class="v">${c.ac}</div><div class="n">${esc(c.acNote)}</div></div>
    <div class="stat"><div class="k">Hit Points</div><div class="v">${c.hp}</div><div class="n">Maximum. Hit Dice: 5 × d${c.hitDie}</div></div>
    <div class="stat"><div class="k">Speed</div><div class="v">${c.speed} ft</div><div class="n">${esc(c.size)}${c.darkvision ? ` · Darkvision ${c.darkvision} ft` : ''}</div></div>
    <div class="stat"><div class="k">Initiative</div><div class="v">${sg(c.init)}</div><div class="n">${esc(c.initNote)}</div></div>
    <div class="stat"><div class="k">Proficiency</div><div class="v">+3</div><div class="n">Added to things you're trained in</div></div>
    <div class="stat"><div class="k">Passive Perception</div><div class="v">${percep}</div><div class="n">What you notice without rolling</div></div>
    ${c.tiles ? c.tiles.map((t) => `<div class="stat"><div class="k">${esc(t[0])}</div><div class="v">${esc(t[1])}</div><div class="n">${esc(t[2])}</div></div>`).join('') : `<div class="stat"><div class="k">Spell Save DC</div><div class="v">${dc}</div><div class="n">What enemies roll against</div></div>
    <div class="stat"><div class="k">Spell Attack</div><div class="v">${sg(satk)}</div><div class="n">Add to d20 for spell attacks</div></div>`}
  </div>
</header>
<nav aria-label="Jump to"><a href="#hp">Hit Points</a><a href="#track">Tracker</a><a href="#attacks">Attacks</a>${isCaster ? '<a href="#spells">Spells</a>' : ''}<a href="#features">Abilities</a>${c.forms ? '<a href="#forms">Animal forms</a>' : ''}<a href="#scores">Scores &amp; skills</a><a href="#gear">Gear</a><a href="#you">Who you are</a><a href="#rules">Rules help</a></nav>

<section id="hp">
  <h2>Hit Points</h2>
  <div class="card hpcard">
    <div class="hpnow"><span class="hpbig"><span id="hpcur">${c.hp}</span><span class="hpmax"> / ${c.hp}</span></span><span class="hptemp" id="hptemp" hidden>+<span id="hptempn">0</span> temporary</span></div>
    <div class="hpbar" aria-hidden="true"><span id="hpfill"></span></div>
    <p class="hpstate" id="hpstate" role="status" aria-live="polite"></p>
    <div class="hpctl">
      <label for="hpamt" class="fl">Amount</label>
      <input id="hpamt" type="number" inputmode="numeric" min="0" placeholder="0">
      <button type="button" class="hpbtn dmg" data-act="dmg">Damage</button>
      <button type="button" class="hpbtn heal" data-act="heal">Heal</button>
      <button type="button" class="hpbtn tmp" data-act="tmp">Temp HP</button>
      <button type="button" class="hpbtn undo" id="hpundo" disabled>Undo</button>
    </div>
    <p class="muted small">Type a number, then tap a button. Damage comes off temporary HP first. Healing can't go above ${c.hp}. Temporary HP doesn't add up: you keep whichever is higher.</p>
  </div>
</section>

<section id="how">
  <div class="callout">
    <p><b>How to read this page.</b> When the DM asks you to roll, it's almost always a <b>d20</b> (the 20-sided die) plus a number from this page. "d20 + 7" means roll the d20 and add 7. Tell the DM the total. Damage is written like <b>2d10 + 4</b>: roll two 10-sided dice, add them up, then add 4. Tap any spell or ability below to open the full explanation. There's a <a href="#rules">rules help</a> section at the bottom.</p>
  </div>
</section>


<section id="track">
  <h2>Tracker</h2>
  <p class="muted">Tap a box when you use something. Spell slots are in the Spells section. Boxes stay ticked on this phone until you reset them. When you finish a <b>Long Rest</b> (a full night's sleep), tap the button to clear everything.</p>
  <div class="card">
    ${freeT}${featT}${hd}
    ${tracker('ds', 'Death saves: successes', 3, c.slug)}${tracker('df', 'Death saves: failures', 3, c.slug)}
    <button class="reset" type="button" id="reset">Long Rest: reset everything</button>
  </div>
</section>

<section id="attacks">
  <h2>Attacks</h2>
  <p class="muted">"To hit" means roll a d20 and add that number. The DM tells you if it beats the target's Armor Class. If it hits, roll the damage. <b>Rolled a natural 20</b> (the die shows 20)? That's a <b>critical hit</b>: roll all the damage dice twice and add the bonus once.</p>
  <ul class="atks">${atkRows}</ul>
</section>

${isCaster ? `<section id="spells">
  <h2>Spells</h2>
  <div class="callout">
    ${c.spellNote ? `<p>${c.spellNote}</p>` : `<p><b>How your magic works.</b> <b>Cantrips</b> are free: cast them as often as you like. Every other spell uses up a <b>spell slot</b> of its level or higher. You have <b>${c.slots.map((n, i) => `${n} ${LVL[i + 1]}`).join(', ')}</b> slots, and you get them all back after a Long Rest. Casting a spell with a higher slot than needed usually makes it stronger.</p>
    <p><b>Spell attack:</b> d20 ${sg(satk).replace('+', '+ ')}. <b>Spell save DC:</b> ${dc}. When a spell says "save", the <i>target</i> rolls and needs ${dc} or more to resist.</p>`}
    <p><span class="pill conc">Concentration</span> You can only keep <b>one</b> concentration spell going at a time. Starting a second one ends the first. If you take damage, roll a <b>Constitution save</b> (d20 ${sg(m.con + (c.saves.includes('con') ? PROF : 0)).replace('+', '+ ')}) and get 10 or half the damage, whichever is higher, or the spell ends.</p>
    ${hasSlots ? `<p><b>Bonus Action spell rule:</b> if you cast a spell using a slot on your turn, you can't cast a second spell with a slot that same turn. A cantrip is fine.</p>` : ''}
  </div>
  <p class="muted">Tap <b>Cast</b> to tick off ${hasSlots ? 'a slot' : 'a free cast'}. Tap a ticked box to undo it.</p>
  ${cantrips ? `<div class="lvlgrp"><div class="lvlhead"><h3 class="lvl">Cantrips</h3><span class="fl">Free, no slots</span></div>${cantrips}</div>` : ''}
  ${byLvl}
</section>` : ''}

<section id="features">
  <h2>Abilities and traits</h2>
  <p class="muted">Everything your class, species and background give you. Tap to read what it does.</p>
  ${feats}
</section>

${c.forms ? `<section id="forms">
  <h2>Your animal forms (Wild Shape)</h2>
  <p class="muted">These are the 6 animals you know. When you Wild Shape, your HP stays the same and you get 5 Temporary HP. Use the animal's AC, speed and attacks below. Numbers are from the official 2024 stat blocks.</p>
  <div class="forms">${forms}</div>
</section>` : ''}

<section id="scores">
  <h2>Ability scores and saving throws</h2>
  <p class="muted">The <b>modifier</b> is what you add to rolls. A <b>saving throw</b> is a roll to resist something bad, like dodging a fireball (Dexterity) or shrugging off poison (Constitution). The DM will say which. Roll d20 + the save number. ● means you're trained in that save.</p>
  <div class="card scroll"><table><thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead><tbody>${abilRows}</tbody></table>
  <p class="muted small" style="margin-top:8px">How these were built: ${esc(c.build)}</p></div>
  <h2 style="margin-top:24px">Skills</h2>
  <p class="muted">When the DM says "make a Perception check", roll d20 + the number here. Skills marked Trained or Expert get your proficiency bonus.</p>
  <div class="card scroll"><table><thead><tr><th>Skill</th><th class="numh">Roll</th></tr></thead><tbody>${skillRows}</tbody></table></div>
</section>

<section id="gear">
  <h2>Gear</h2>
  <div class="card"><ul>${c.equipment.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
  <p><b>Tools you can use:</b> ${esc(c.tools.join(', '))}. Add your proficiency (+3) to checks with them.</p>
  <p><b>Languages:</b> ${esc(c.languages.join(', '))}.</p></div>
</section>

<section id="you">
  <h2>Who you are</h2>
  <div class="card">${who}</div>
</section>

<section id="rules">
  <h2>Rules help</h2>
  <details><summary><span class="sname">Rolling: checks, saves, attacks</span></summary><div class="sbody">
    <p>Almost everything is a <b>d20 roll + a number</b>, trying to reach a target the DM knows:</p>
    <ul><li><b>Ability check</b> (a skill): d20 + the skill number. Target is a DC (Difficulty Class): 10 easy, 15 medium, 20 hard.</li>
    <li><b>Saving throw</b>: d20 + the save number, to resist something.</li>
    <li><b>Attack roll</b>: d20 + to-hit number, against the target's Armor Class.</li></ul>
    <p><b>Advantage:</b> roll two d20s and use the <b>higher</b>. <b>Disadvantage:</b> roll two and use the <b>lower</b>. If you have both, they cancel out: roll one.</p>
    <p><b>Natural 20</b> on an attack always hits and is a critical hit. <b>Natural 1</b> on an attack always misses.</p>
  </div></details>
  <details><summary><span class="sname">Your turn: what you can do</span></summary><div class="sbody">
    <p>On your turn: <b>move</b> (up to your speed, and you can split it up before and after your action), take <b>one Action</b>, and take a <b>Bonus Action</b> only if a spell or feature says it uses one. Talking a little is free.</p>
    <p><b>Actions anyone can take:</b></p>
    <ul><li><b>Attack</b>: swing or shoot a weapon.</li><li><b>Magic</b>: cast a spell or use a magic feature.</li><li><b>Dash</b>: move your speed again.</li><li><b>Disengage</b>: move away without enemies getting free hits.</li><li><b>Dodge</b>: attacks against you have disadvantage until your next turn, and you have advantage on Dexterity saves.</li><li><b>Help</b>: give a friend advantage on their next check or attack.</li><li><b>Hide</b>: Dexterity (Stealth) check to become hidden.</li><li><b>Search</b> / <b>Study</b>: look for something (Wisdom) or figure something out (Intelligence).</li><li><b>Influence</b>: persuade, deceive or intimidate someone.</li><li><b>Ready</b>: pick a trigger ("when the door opens, I cast Fire Bolt") and react when it happens.</li><li><b>Utilize</b>: use an object (drink a potion, pull a lever, use a Healer's Kit).</li></ul>
    <p><b>Reaction</b> (one per round, even on others' turns): spells like Shield, or an <b>Opportunity Attack</b>, which means one free melee attack when an enemy next to you moves away.</p>
  </div></details>
  <details><summary><span class="sname">Hit Points, dropping to 0, and death saves</span></summary><div class="sbody">
    <p>Damage lowers your HP. <b>Temporary HP</b> absorbs damage first and doesn't stack. At <b>0 HP</b> you fall unconscious.</p>
    <p>At the start of each of your turns at 0 HP, roll a <b>death saving throw</b>: a plain d20, nothing added. <b>10 or higher</b> = a success, <b>9 or lower</b> = a failure. <b>3 successes</b>: you're stable. <b>3 failures</b>: you die. A <b>natural 20</b>: you wake up with 1 HP. A <b>natural 1</b>: two failures. Taking damage while at 0 = one failure (a critical hit = two).</p>
    <p><b>Any healing at all wakes you up.</b> A friend can also stabilize you with a DC 10 Wisdom (Medicine) check.</p>
  </div></details>
  <details><summary><span class="sname">Resting</span></summary><div class="sbody">
    <p><b>Short Rest</b> (1 hour of downtime): spend Hit Dice to heal. Roll a d${c.hitDie}, add your Constitution modifier (${sg(m.con)}), and heal that much, as many times as you have Hit Dice left. Some features come back too (it says so on each one).</p>
    <p><b>Long Rest</b> (8 hours, a night's sleep): get back <b>all</b> your HP, all spent Hit Dice, all spell slots and all once-per-day features. Only one Long Rest per day.</p>
  </div></details>
  <details><summary><span class="sname">Conditions (what they mean)</span></summary><div class="sbody">
    <ul><li><b>Blinded:</b> you can't see; your attacks have disadvantage, attacks against you have advantage.</li>
    <li><b>Charmed:</b> you can't attack the charmer, and it has advantage when it talks to you.</li>
    <li><b>Frightened:</b> disadvantage on checks and attacks while you can see the source; you can't move closer to it.</li>
    <li><b>Grappled:</b> speed 0; you can try to escape with an Athletics or Acrobatics check as your action.</li>
    <li><b>Incapacitated:</b> you can't take actions, bonus actions or reactions; concentration breaks.</li>
    <li><b>Invisible:</b> attacks against you have disadvantage, yours have advantage.</li>
    <li><b>Paralyzed:</b> Incapacitated, can't move or speak; hits from within 5 feet are critical hits.</li>
    <li><b>Poisoned:</b> disadvantage on attack rolls and ability checks.</li>
    <li><b>Prone:</b> lying down. Standing up costs half your speed. Your attacks have disadvantage; melee attacks against you have advantage, ranged ones disadvantage.</li>
    <li><b>Restrained:</b> speed 0; your attacks and Dexterity saves have disadvantage; attacks against you have advantage.</li>
    <li><b>Unconscious:</b> Incapacitated, Prone, drop what you're holding; hits from within 5 feet are critical hits.</li></ul>
  </div></details>
  <details><summary><span class="sname">Cover, range, light</span></summary><div class="sbody">
    <p><b>Half cover</b> (behind a low wall or another creature): +2 AC and Dex saves. <b>Three-quarters cover</b> (arrow slit, thick tree): +5. <b>Total cover</b>: can't be targeted.</p>
    <p>Ranged attacks at <b>long range</b> (the second number, like 80/320) have disadvantage. So do ranged attacks while an enemy is right next to you.</p>
    <p><b>Dim light</b>: disadvantage on Perception checks that rely on sight. <b>Darkness</b>: effectively blind, unless you have Darkvision, which treats darkness as dim light.</p>
  </div></details>
</section>

<footer>Built for the Lantern Fair. No rolling here: grab your real dice. Questions? Ask your DM.</footer>
</div>
<script>
(function(){
  function get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function set(k,v){ try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k,v); } catch(e){} }
  var boxes = document.querySelectorAll('input[type=checkbox][data-k]');
  boxes.forEach(function(b){ b.checked = get(b.dataset.k) === '1'; b.addEventListener('change', function(){ set(b.dataset.k, b.checked ? '1' : null); }); });
  var nums = document.querySelectorAll('input[type=number][data-k]');
  nums.forEach(function(n){ var v = get(n.dataset.k); if (v !== null) n.value = v; n.addEventListener('input', function(){ set(n.dataset.k, n.value); }); });
  var slug = ${JSON.stringify(c.slug)};
  var ORD = ['', '1st', '2nd', '3rd'];
  function take(key){
    var list = document.querySelectorAll('input[data-k^="' + slug + ':' + key + ':"]');
    for (var i = 0; i < list.length; i++) if (!list[i].checked) { list[i].checked = true; set(list[i].dataset.k, '1'); return true; }
    return false;
  }
  document.querySelectorAll('button.cast').forEach(function(btn){
    btn.addEventListener('click', function(){
      var card = btn.closest('.spell'), msg = card.querySelector('.castmsg');
      var lvl = +btn.dataset.level, text = '';
      if (btn.dataset.free && take(btn.dataset.free)) text = 'Used a free cast.';
      else if (btn.dataset.freeonly) text = 'No free casts left for this one.';
      else {
        var used = 0;
        for (var L = lvl; L <= 3 && !used; L++) if (take('slot' + L)) used = L;
        if (!used) text = 'No ' + ORD[lvl] + '-level or higher slots left.';
        else if (used === lvl) text = 'Used a ' + ORD[used] + '-level slot.';
        else text = 'No ' + ORD[lvl] + '-level slots left, so this used a ' + ORD[used] + '-level slot.';
      }
      msg.textContent = text;
      clearTimeout(msg._t); msg._t = setTimeout(function(){ msg.textContent = ''; }, 5000);
    });
  });
  var MAX = ${c.hp}, hpK = slug + ':hp', tK = slug + ':thp';
  function num(v, d){ var n = parseInt(v, 10); return isNaN(n) ? d : n; }
  var hp = Math.max(0, Math.min(MAX, num(get(hpK), MAX))), thp = Math.max(0, num(get(tK), 0)), last = null;
  var stEl = document.getElementById('hpstate');
  function drawHP(note){
    document.getElementById('hpcur').textContent = hp;
    document.getElementById('hptempn').textContent = thp;
    document.getElementById('hptemp').hidden = thp <= 0;
    document.getElementById('hpfill').style.width = (hp / MAX * 100) + '%';
    var down = hp === 0;
    stEl.className = 'hpstate' + (down ? ' down' : '');
    stEl.textContent = down ? 'You are at 0 HP and unconscious. At the start of each of your turns, roll a death save (see the Tracker). Any healing wakes you up.' : (note || '');
    document.getElementById('hpundo').disabled = !last;
    set(hpK, String(hp)); set(tK, String(thp));
  }
  function clearDeathSaves(){ document.querySelectorAll('input[data-k^="' + slug + ':ds:"], input[data-k^="' + slug + ':df:"]').forEach(function(b){ b.checked = false; set(b.dataset.k, null); }); }
  document.querySelectorAll('.hpbtn[data-act]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var inp = document.getElementById('hpamt'), amt = num(inp.value, 0);
      if (amt <= 0) { stEl.className = 'hpstate'; stEl.textContent = 'Type a number first.'; inp.focus(); return; }
      last = { hp: hp, thp: thp }; var note;
      if (btn.dataset.act === 'dmg') {
        var fromT = Math.min(thp, amt); thp -= fromT; hp = Math.max(0, hp - (amt - fromT));
        note = 'Took ' + amt + ' damage' + (fromT ? ' (' + fromT + ' from temporary HP)' : '') + '.';
      } else if (btn.dataset.act === 'heal') {
        var was = hp; hp = Math.min(MAX, hp + amt); if (was === 0 && hp > 0) clearDeathSaves();
        note = 'Healed ' + (hp - was) + '.' + (hp === MAX ? ' You are at full HP.' : '');
      } else {
        var old = thp; thp = Math.max(thp, amt);
        note = thp === old ? 'You already have ' + old + ' temporary HP, which is more, so you keep that.' : 'You now have ' + thp + ' temporary HP.';
      }
      inp.value = ''; drawHP(note);
    });
  });
  document.getElementById('hpundo').addEventListener('click', function(){ if (!last) return; hp = last.hp; thp = last.thp; last = null; drawHP('Undid the last change.'); });
  drawHP('');
  document.getElementById('reset').addEventListener('click', function(){
    if (!confirm('Finished a Long Rest? This clears every box and sets HP back to full.')) return;
    boxes.forEach(function(b){ b.checked = false; set(b.dataset.k, null); });
    nums.forEach(function(n){ n.value = n.defaultValue; set(n.dataset.k, null); });
    hp = MAX; thp = 0; last = null; drawHP('Long Rest: back to full HP.');
  });
})();
</script>
</body>
</html>
`;
}

for (const c of CHARS) {
  const dir = path.join(OUT, c.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(c));
  console.log('wrote', c.slug);
}
