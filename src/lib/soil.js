import { cacheGet, cacheSet } from './storage.js';
import { textureClass, TEXTURE_INFO, phAdvice, omAdvice, soilManagement } from '../data/soilGuide.js';

const URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const PROPS = ['clay', 'sand', 'silt', 'phh2o', 'soc'];
const DEPTHS = ['0-5cm', '5-15cm', '15-30cm'];

function buildUrl(lat, lon) {
  let q = URL + '?lon=' + lon + '&lat=' + lat;
  for (let i = 0; i < PROPS.length; i++) q += '&property=' + PROPS[i];
  for (let i = 0; i < DEPTHS.length; i++) q += '&depth=' + DEPTHS[i];
  q += '&value=mean';
  return q;
}

function readLayer(layers, name) {
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].name !== name) continue;
    const layer = layers[i];
    const df = (layer.unit_measure && layer.unit_measure.d_factor) ? layer.unit_measure.d_factor : 1;
    let sum = 0;
    let n = 0;
    const depths = layer.depths || [];
    for (let j = 0; j < depths.length; j++) {
      const v = depths[j].values ? depths[j].values.mean : null;
      if (typeof v === 'number') { sum += v / df; n++; }
    }
    if (!n) return null;
    return sum / n;
  }
  return null;
}

/** ดึงข้อมูลดินตามพิกัดแปลงจาก SoilGrids (ISRIC) */
export async function fetchSoil(lat, lon) {
  const ck = 'soil:' + lat.toFixed(3) + ':' + lon.toFixed(3);
  const cached = cacheGet(ck, 30 * 24 * 60 * 60 * 1000);
  if (cached) return cached;

  const res = await fetch(buildUrl(lat, lon));
  if (!res.ok) throw new Error('SoilGrids ' + res.status);
  const j = await res.json();
  const layers = (j.properties && j.properties.layers) ? j.properties.layers : [];

  const clay = readLayer(layers, 'clay');
  const sand = readLayer(layers, 'sand');
  const silt = readLayer(layers, 'silt');
  const ph = readLayer(layers, 'phh2o');
  const soc = readLayer(layers, 'soc');

  if (clay === null || sand === null || silt === null) throw new Error('ไม่พบข้อมูลดินที่พิกัดนี้');

  const total = clay + sand + silt;
  const c = Math.round((clay / total) * 1000) / 10;
  const s = Math.round((sand / total) * 1000) / 10;
  const si = Math.round((silt / total) * 1000) / 10;
  const tex = textureClass(s, si, c);
  const om = soc === null ? null : Math.round((soc / 10) * 1.724 * 10) / 10;

  const out = {
    lat: lat, lon: lon,
    clay: c, sand: s, silt: si,
    ph: ph === null ? null : Math.round(ph * 10) / 10,
    om: om,
    texture: tex,
    textureName: TEXTURE_INFO[tex].name,
    awc: TEXTURE_INFO[tex].awc,
    drain: TEXTURE_INFO[tex].drain,
    hold: TEXTURE_INFO[tex].hold,
    source: 'SoilGrids 250m (ISRIC) ความลึก 0–30 ซม.',
    fetchedAt: Date.now()
  };
  cacheSet(ck, out);
  return out;
}

export function soilAdvice(soil, crop) {
  if (!soil) return { ph: null, om: null, manage: [] };
  return {
    ph: phAdvice(soil.ph),
    om: omAdvice(soil.om),
    manage: soilManagement(soil.texture, crop)
  };
}