// Builds the outline map for "Wo liegt das?" from Natural Earth (public
// domain, via world-atlas) into public/maps/world.json. One map for every
// category, the category only picks the region it opens on. Germany uses the
// finest data so it stays sharp when zoomed in, Europe medium, the rest coarse.
// Run with: node scripts/build-maps.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { feature } from 'topojson-client';

const load = (res) => {
  const topo = JSON.parse(readFileSync(new URL(`../node_modules/world-atlas/countries-${res}.json`, import.meta.url)));
  return feature(topo, topo.objects.countries).features.filter((f) => f.geometry);
};

// Rounds coordinates (3 digits ~100 m, 2 digits ~1 km).
const rounder = (digits) => {
  const f = 10 ** digits;
  const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f] : c.map(round));
  return round;
};
const strip = (f, digits) => ({ type: 'Feature', properties: {}, geometry: { type: f.geometry.type, coordinates: rounder(digits)(f.geometry.coordinates) } });

function bboxOf(f) {
  let [minX, minY, maxX, maxY] = [180, 90, -180, -90];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    } else c.forEach(walk);
  };
  walk(f.geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

// Europe in medium detail (it gets zoomed in), the rest of the world coarse,
// Germany fine.
const inEurope = (f) => {
  const [w, s, e, n] = bboxOf(f);
  return e > -25 && w < 45 && n > 34 && s < 71.5;
};
const skip = (f) => f.properties.name === 'Antarctica' || f.properties.name === 'Germany';
const europe = load('50m').filter((f) => !skip(f) && inEurope(f));
const europeNames = new Set(europe.map((f) => f.properties.name));
const rest = load('110m').filter((f) => !skip(f) && !europeNames.has(f.properties.name) && !inEurope(f));
const germany = load('10m').find((f) => f.properties.name === 'Germany');
const features = [...europe.map((f) => strip(f, 2)), ...rest.map((f) => strip(f, 2)), strip(germany, 3)];

mkdirSync(new URL('../public/maps/', import.meta.url), { recursive: true });
const json = JSON.stringify({ features });
writeFileSync(new URL('../public/maps/world.json', import.meta.url), json);
console.log(`world: ${features.length} shapes, ${(json.length / 1024).toFixed(0)} KB`);
