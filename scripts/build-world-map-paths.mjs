/**
 * Precomputes world map SVG path strings for TacticalWorldMap (Genesis 3.0 LCP).
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json" with { type: "json" };

const WIDTH = 960;
const HEIGHT = 480;

const land = feature(
  countries110m,
  countries110m.objects.countries,
);
const projection = geoMercator().fitSize([WIDTH, HEIGHT], land);
const pathGen = geoPath(projection);
const paths = land.features.map((f) => pathGen(f) ?? "").filter(Boolean);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "geo");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "world-map-paths.json"),
  JSON.stringify({
    width: WIDTH,
    height: HEIGHT,
    paths,
    projection: {
      translate: projection.translate(),
      scale: projection.scale(),
      center: projection.center(),
    },
  }),
);

console.log(`[build-world-map-paths] wrote ${paths.length} paths`);
