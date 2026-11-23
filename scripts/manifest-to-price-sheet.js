#!/usr/bin/env node
// FlipFloor Lite: turn a lot manifest CSV into a price sheet.
//
// Usage:
//   node manifest-to-price-sheet.js --manifest data/manifest.csv [--config config.yaml] [--out data/price-sheet.csv]
//   Options without --config: --list 0.5 --floor 0.4 --hard 0.3 --round 0.5
//
// Input: any CSV with a header row. Column names are mapped through config.yaml -> manifest_columns
// (defaults match a standard B-Stock export: Item #, Item Description, Qty, Unit Retail, Brand, UPC).
// Rows with the same item number are merged (qty summed).
//
// Output columns:
//   item_no, description, brand, qty, unit_retail, ext_retail, list_price, offer_floor, hard_floor, tier, upc
//   list_price  = unit_retail x pricing.list_pct_of_retail, rounded to pricing.rounding
//   offer_floor = unit_retail x pricing.offer_floor_pct, rounded up to the cent
//   hard_floor  = unit_retail x pricing.hard_floor_pct, rounded up to the cent
//   tier        = A/B/C/D by unit retail (pricing.tier_a/b/c_min_retail)
//
// No dependencies. Node 16+.

'use strict';

const DEFAULTS = {
  manifest_columns: { item_no: 'Item #', description: 'Item Description', qty: 'Qty', unit_retail: 'Unit Retail', brand: 'Brand', upc: 'UPC' },
  pricing: {
    list_pct_of_retail: 0.5, offer_floor_pct: 0.4, hard_floor_pct: 0.3, rounding: 0.5,
    tier_a_min_retail: 90, tier_b_min_retail: 40, tier_c_min_retail: 20,
  },
};

// --- CSV -------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) || s === '' ? '"' + s.replace(/"/g, '""') + '"' : '"' + s + '"';
}

// --- tiny YAML subset (two levels of "key: value", comments, inline lists ignored) -------------
function parseSimpleYaml(text) {
  const out = {};
  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#\s+.*$/, '').replace(/^\s*#.*$/, '');
    if (!line.trim()) continue;
    const indent = line.match(/^ */)[0].length;
    const m = line.trim().match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, valRaw] = m;
    const val = valRaw.trim().replace(/^["']|["']$/g, '');
    if (indent === 0) {
      if (val === '') { section = key; out[key] = out[key] || {}; } else { section = null; out[key] = val; }
    } else if (indent === 2 && section) {
      out[section][key] = val;
    }
  }
  return out;
}

// --- core ------------------------------------------------------------------
function num(v) {
  const n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}
const roundTo = (x, step) => (step > 0 ? Math.round(x / step) * step : x);
const ceilCent = x => Math.ceil(Math.round(x * 10000) / 100) / 100;
const money = x => (Number.isFinite(x) ? x.toFixed(2) : '');

function tierFor(retail, p) {
  if (retail >= p.tier_a_min_retail) return 'A';
  if (retail >= p.tier_b_min_retail) return 'B';
  if (retail >= p.tier_c_min_retail) return 'C';
  return 'D';
}

function resolveConfig(yamlObj, overrides) {
  const cols = Object.assign({}, DEFAULTS.manifest_columns, (yamlObj && yamlObj.manifest_columns) || {});
  const p = Object.assign({}, DEFAULTS.pricing);
  const yp = (yamlObj && yamlObj.pricing) || {};
  for (const k of Object.keys(p)) if (yp[k] !== undefined && !Number.isNaN(num(yp[k]))) p[k] = num(yp[k]);
  Object.assign(p, overrides || {});
  return { cols, p };
}

function buildPriceSheet(manifestText, cfg) {
  const { cols, p } = cfg;
  const rows = parseCsv(manifestText);
  if (rows.length < 2) throw new Error('Manifest has no data rows.');
  const header = rows[0].map(h => h.trim());
  const idx = {};
  for (const [field, name] of Object.entries(cols)) {
    idx[field] = header.findIndex(h => h.toLowerCase() === String(name).toLowerCase());
  }
  for (const req of ['description', 'qty', 'unit_retail']) {
    if (idx[req] < 0) throw new Error(`Column "${cols[req]}" (${req}) not found. Header: ${header.join(' | ')}. Fix manifest_columns in config.yaml.`);
  }
  const get = (r, f) => (idx[f] >= 0 ? String(r[idx[f]] == null ? '' : r[idx[f]]).trim() : '');

  const byItem = new Map();
  const warnings = [];
  rows.slice(1).forEach((r, i) => {
    const retail = num(get(r, 'unit_retail'));
    const qty = num(get(r, 'qty'));
    const desc = get(r, 'description');
    if (!desc && !Number.isFinite(retail)) return;
    if (!Number.isFinite(retail)) { warnings.push(`row ${i + 2}: no unit retail for "${desc}"`); return; }
    const key = get(r, 'item_no') || desc;
    const cur = byItem.get(key);
    const q = Number.isFinite(qty) ? qty : 1;
    if (cur) { cur.qty += q; if (cur.unit_retail !== retail) warnings.push(`item ${key}: different unit retail on merged rows (${cur.unit_retail} vs ${retail}); kept the first`); }
    else byItem.set(key, { item_no: get(r, 'item_no'), description: desc, brand: get(r, 'brand'), qty: q, unit_retail: retail, upc: get(r, 'upc').replace(/[,\s]+$/g, '') });
  });

  const items = [...byItem.values()].sort((a, b) => b.unit_retail * b.qty - a.unit_retail * a.qty);
  const out = items.map(it => ({
    item_no: it.item_no, description: it.description, brand: it.brand, qty: it.qty,
    unit_retail: money(it.unit_retail), ext_retail: money(it.unit_retail * it.qty),
    list_price: money(roundTo(it.unit_retail * p.list_pct_of_retail, p.rounding)),
    offer_floor: money(ceilCent(it.unit_retail * p.offer_floor_pct)),
    hard_floor: money(ceilCent(it.unit_retail * p.hard_floor_pct)),
    tier: tierFor(it.unit_retail, p), upc: it.upc,
  }));
  const fields = ['item_no', 'description', 'brand', 'qty', 'unit_retail', 'ext_retail', 'list_price', 'offer_floor', 'hard_floor', 'tier', 'upc'];
  const csv = [fields.map(csvCell).join(','), ...out.map(o => fields.map(f => csvCell(o[f])).join(','))].join('\n') + '\n';
  const summary = {
    skus: out.length,
    units: items.reduce((s, x) => s + x.qty, 0),
    retail_total: money(items.reduce((s, x) => s + x.qty * x.unit_retail, 0)),
    list_total: money(out.reduce((s, x) => s + x.qty * Number(x.list_price), 0)),
    tiers: out.reduce((t, x) => ((t[x.tier] = (t[x.tier] || 0) + x.qty), t), {}),
  };
  return { csv, rows: out, summary, warnings };
}

// --- CLI -------------------------------------------------------------------
function main(argv) {
  const fs = require('fs');
  const path = require('path');
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; args[k] = v; }
  }
  if (!args.manifest || args.help) {
    console.error('Usage: node manifest-to-price-sheet.js --manifest <file.csv> [--config config.yaml] [--out price-sheet.csv] [--list 0.5 --floor 0.4 --hard 0.3 --round 0.5]');
    process.exit(args.help ? 0 : 1);
  }
  const yamlObj = args.config ? parseSimpleYaml(fs.readFileSync(args.config, 'utf8')) : {};
  const ov = {};
  if (args.list) ov.list_pct_of_retail = num(args.list);
  if (args.floor) ov.offer_floor_pct = num(args.floor);
  if (args.hard) ov.hard_floor_pct = num(args.hard);
  if (args.round) ov.rounding = num(args.round);
  const res = buildPriceSheet(fs.readFileSync(args.manifest, 'utf8'), resolveConfig(yamlObj, ov));
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, res.csv);
    console.error(`Wrote ${args.out}`);
  } else process.stdout.write(res.csv);
  console.error(`SKUs ${res.summary.skus}, units ${res.summary.units}, retail $${res.summary.retail_total}, at list $${res.summary.list_total}, units by tier ${JSON.stringify(res.summary.tiers)}`);
  res.warnings.forEach(w => console.error('warning: ' + w));
}

if (typeof module !== 'undefined') module.exports = { parseCsv, parseSimpleYaml, resolveConfig, buildPriceSheet };
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) main(process.argv.slice(2));
