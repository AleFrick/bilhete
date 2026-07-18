import { z } from 'zod';
import zlib from 'zlib';

const importQuerySchema = z.object({
  city: z.string().trim().min(2).max(120),
  bbox: z.string().trim().optional(),
});

const AMENITY_FOOD_VALUES = new Set([
  'restaurant',
  'bar',
  'pub',
  'cafe',
  'fast_food',
  'biergarten',
  'food_court',
]);

const SHOP_FOOD_VALUES = new Set([
  'supermarket',
  'convenience',
  'bakery',
  'beverages',
  'coffee',
]);

const LEISURE_VALUES = new Set([
  'nightclub',
  'sports_centre',
  'stadium',
]);

const TOURISM_VALUES = new Set([
  'hotel',
  'hostel',
  'guest_house',
  'motel',
  'attraction',
]);

function isVenueLike(tags) {
  if (!tags || typeof tags !== 'object') {
    return false;
  }

  if (tags.amenity) return true;
  if (tags.shop) return true;
  if (tags.leisure) return true;
  if (tags.tourism) return true;

  return false;
}

function inferCategory(tags) {
  const amenity = String(tags.amenity || '').toLowerCase();
  if (amenity === 'restaurant') return 'restaurante';
  if (amenity === 'bar') return 'bar';
  if (amenity === 'pub') return 'pub';
  if (amenity === 'cafe') return 'cafeteria';
  if (amenity === 'fast_food') return 'restaurante';
  if (amenity === 'biergarten') return 'bar';
  if (amenity === 'food_court') return 'restaurante';
  if (amenity === 'nightclub') return 'balada';
  if (amenity === 'cinema') return 'cinema';
  if (amenity === 'theatre') return 'teatro';
  if (amenity === 'arts_centre') return 'teatro';
  if (amenity === 'fuel') return 'restaurante';
  if (amenity === 'pharmacy') return 'farmacia';
  if (amenity === 'bank') return 'servico';
  if (amenity === 'hospital') return 'servico';
  if (amenity === 'school') return 'servico';
  if (amenity === 'university') return 'servico';
  if (amenity === 'library') return 'servico';
  if (amenity === 'parking') return 'servico';
  if (amenity) return 'servico';

  const leisure = String(tags.leisure || '').toLowerCase();
  if (leisure === 'nightclub') return 'balada';
  if (leisure === 'sports_centre') return 'evento';
  if (leisure === 'stadium') return 'show';
  if (leisure === 'park') return 'evento';
  if (leisure === 'cinema') return 'cinema';
  if (leisure) return 'evento';

  const tourism = String(tags.tourism || '').toLowerCase();
  if (tourism) return 'evento';

  const shop = String(tags.shop || '').toLowerCase();
  if (shop === 'supermarket' || shop === 'convenience') return 'restaurante';
  if (shop === 'bakery') return 'cafeteria';
  if (shop === 'coffee') return 'cafeteria';
  if (shop) return 'loja';

  return '';
}

function pointInPolygon(lat, lon, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function normalizeCityName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractCity(tags) {
  const candidates = [
    tags['addr:city'],
    tags['addr:town'],
    tags['addr:village'],
    tags['addr:municipality'],
    tags.city,
    tags.town,
    tags.village,
    tags.municipality,
  ];

  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return '';
}

function extractName(tags) {
  return String(tags.name || tags['name:pt'] || '').trim();
}

function extractAddress(tags) {
  const street = tags['addr:street'] || '';
  const number = tags['addr:housenumber'] || '';
  const parts = [street, number].filter(Boolean);
  return parts.join(' ').trim();
}

class ProtoReader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
    this.length = buf.length;
  }

  readVarint() {
    let result = 0;
    let shift = 0;

    while (this.pos < this.length) {
      const byte = this.buf[this.pos];
      this.pos++;

      result += (byte & 0x7f) * Math.pow(2, shift);

      if ((byte & 0x80) === 0) {
        return result;
      }

      shift += 7;
    }

    return result;
  }

  readSVarint() {
    const v = this.readVarint();
    const half = Math.floor(v / 2);
    return (v & 1) ? -half - 1 : half;
  }

  readBytes() {
    const len = this.readVarint();
    const start = this.pos;
    this.pos += len;
    return this.buf.subarray(start, start + len);
  }

  readString() {
    const bytes = this.readBytes();
    return Buffer.from(bytes).toString('utf8');
  }

  skip(wireType) {
    switch (wireType) {
      case 0:
        this.readVarint();
        break;
      case 1:
        this.pos += 8;
        break;
      case 2:
        this.pos += this.readVarint();
        break;
      case 5:
        this.pos += 4;
        break;
      default:
        break;
    }
  }

  readFields(callback) {
    while (this.pos < this.length) {
      const tag = this.readVarint();
      const fieldNumber = Math.floor(tag / 8);
      const wireType = tag & 0x7;

      if (fieldNumber === 0) break;

      callback(fieldNumber, wireType);
    }
  }

  readPackedVarint() {
    const bytes = this.readBytes();
    const reader = new ProtoReader(bytes);
    const values = [];
    while (reader.pos < reader.length) {
      values.push(reader.readVarint());
    }
    return values;
  }

  readPackedSVarint() {
    const bytes = this.readBytes();
    const reader = new ProtoReader(bytes);
    const values = [];
    while (reader.pos < reader.length) {
      values.push(reader.readSVarint());
    }
    return values;
  }
}

export async function importPbfVenues(req, res) {
  const parsedQuery = importQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Parâmetro "city" é obrigatório.' });
  }

  const rawCity = parsedQuery.data.city;
  const cityFilter = normalizeCityName(rawCity.split(',')[0].trim());

  let bbox = null;
  let cityPolygon = null;
  if (parsedQuery.data.bbox) {
    const parts = parsedQuery.data.bbox.split(',').map(v => parseFloat(v.trim()));
    if (parts.length === 4 && parts.every(v => !isNaN(v))) {
      bbox = { minLat: parts[0], minLon: parts[1], maxLat: parts[2], maxLon: parts[3] };
    }
  }

  let nominatimDebug = 'not attempted';

  if (!bbox) {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(rawCity)}&countrycodes=br&format=json&limit=1&addressdetails=1&polygon_geojson=1`;
      console.log('[import:pbf] Nominatim lookup:', nominatimUrl);
      nominatimDebug = `url: ${nominatimUrl}`;
      const nominatimRes = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'bilhete-import/1.0' },
      });
      nominatimDebug += ` status: ${nominatimRes.status}`;
      if (nominatimRes.ok) {
        const nominatimData = await nominatimRes.json();
        nominatimDebug += ` results: ${nominatimData ? nominatimData.length : 0}`;
        if (nominatimData && nominatimData.length > 0) {
          const result = nominatimData[0];
          if (result.boundingbox) {
            const bb = result.boundingbox;
            bbox = {
              minLat: parseFloat(bb[0]),
              maxLat: parseFloat(bb[1]),
              minLon: parseFloat(bb[2]),
              maxLon: parseFloat(bb[3]),
            };
          }
          if (result.geojson) {
            const geo = result.geojson;
            if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates.length > 0) {
              cityPolygon = geo.coordinates[0];
              nominatimDebug += ` polygon points: ${cityPolygon.length}`;
            } else if (geo.type === 'MultiPolygon' && geo.coordinates && geo.coordinates.length > 0) {
              cityPolygon = geo.coordinates[0][0];
              nominatimDebug += ` polygon points: ${cityPolygon.length}`;
            }
          }
          nominatimDebug += ` bbox: ${bbox ? JSON.stringify(bbox) : 'none'} display: ${result.display_name}`;
          console.log('[import:pbf] Nominatim bbox:', JSON.stringify(bbox), 'polygon:', cityPolygon ? cityPolygon.length + ' points' : 'none', result.display_name);
        } else {
          nominatimDebug += ' no results';
        }
      } else {
        nominatimDebug += ` response not ok`;
      }
    } catch (e) {
      nominatimDebug += ` error: ${e?.message}`;
      console.warn('[import:pbf] Nominatim lookup failed:', e?.message);
    }
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Arquivo .pbf é obrigatório.' });
  }

  const fs = await import('fs');

  try {
    const buffer = fs.readFileSync(req.file.path);
    console.log('[import:pbf] file size:', buffer.length, 'bytes');
    const result = parsePbf(buffer, cityFilter, bbox, cityPolygon);
    const places = result.places;
    console.log('[import:pbf] total places found:', places.length, 'for city:', cityFilter);

    try {
      const debugDir = 'C:\\temp';
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const debugLines = [];
      debugLines.push(`City filter: ${cityFilter}`);
      debugLines.push(`Nominatim: ${nominatimDebug}`);
      debugLines.push(`BBox: ${bbox ? JSON.stringify(bbox) : 'none'}`);
      debugLines.push(`Polygon: ${cityPolygon ? cityPolygon.length + ' points' : 'none'}`);
      debugLines.push(`Total places: ${places.length}`);
      debugLines.push(`Blocks: ${result.debugInfo.blockCount} OSMData: ${result.debugInfo.osmDataCount} Nodes: ${result.debugInfo.totalNodes} VenueLike: ${result.debugInfo.totalVenueLike} WithCity: ${result.debugInfo.totalWithCity} NoCity: ${result.debugInfo.totalNoCity}`);
      debugLines.push(`PrimitiveGroup field counts: ${JSON.stringify(result.debugInfo.groupFieldCounts)}`);
      debugLines.push('');
      if (result.debugInfo.debugLines && result.debugInfo.debugLines.length > 0) {
        debugLines.push('=== DEBUG: First 3 OSMData blocks ===');
        debugLines.push(...result.debugInfo.debugLines);
        debugLines.push('');
      }
      debugLines.push('First 50 places:');
      for (let i = 0; i < Math.min(50, places.length); i++) {
        debugLines.push(JSON.stringify(places[i], null, 2));
      }
      fs.writeFileSync('C:\\temp\\pbf-debug.txt', debugLines.join('\n'), 'utf8');
      console.log('[import:pbf] debug written to C:\\temp\\pbf-debug.txt');
    } catch (e) {
      console.error('[import:pbf] failed to write debug file:', e?.message);
    }

    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    return res.json({
      city: parsedQuery.data.city,
      totalFound: places.length,
      places,
    });
  } catch (error) {
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    console.error('[import:pbf] failed', error?.stack || error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao processar arquivo PBF.' });
  }
}

function parsePbf(buffer, cityFilter, bbox, cityPolygon) {
  const places = [];
  const pendingWays = [];
  let offset = 0;
  let blockCount = 0;
  let osmDataCount = 0;
  let totalNodes = 0;
  let totalVenueLike = 0;
  let totalWithCity = 0;
  let totalNoCity = 0;
  const groupFieldCounts = {};

  let allDebugLines = [];

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) break;

    const blobHeaderLength = buffer.readUInt32BE(offset);
    offset += 4;

    if (offset + blobHeaderLength > buffer.length) break;

    const blobHeaderReader = new ProtoReader(buffer.subarray(offset, offset + blobHeaderLength));
    const blobHeader = readBlobHeader(blobHeaderReader);
    offset += blobHeaderLength;

    const blobLength = blobHeader.datasize;

    if (offset + blobLength > buffer.length) break;

    const blobReader = new ProtoReader(buffer.subarray(offset, offset + blobLength));
    const blobData = readBlob(blobReader);
    offset += blobLength;

    blockCount++;

    if (blobHeader.type !== 'OSMData' || !blobData) {
      continue;
    }

    osmDataCount++;

    const blockReader = new ProtoReader(blobData);
    const stats = { totalNodes: 0, venueLike: 0, withCity: 0, noCity: 0 };
    const debugLines = (osmDataCount <= 3) ? [] : null;
    if (debugLines) {
      debugLines.push(`=== OSMData block ${osmDataCount} ===`);
      debugLines.push(`blobData size: ${blobData.length}`);
      debugLines.push(`hex head: ${Buffer.from(blobData.subarray(0, Math.min(40, blobData.length))).toString('hex')}`);
    }
    const blockPlaces = parsePrimitiveBlock(blockReader, cityFilter, bbox, cityPolygon, stats, debugLines, groupFieldCounts, pendingWays);
    if (debugLines) {
      debugLines.push(`block stats: nodes=${stats.totalNodes} venueLike=${stats.venueLike} withCity=${stats.withCity}`);
      allDebugLines.push(...debugLines);
    }
    totalNodes += stats.totalNodes;
    totalVenueLike += stats.venueLike;
    totalWithCity += stats.withCity;
    totalNoCity += stats.noCity;
    places.push(...blockPlaces);
  }

  console.log('[import:pbf] blocks:', blockCount, 'osmData:', osmDataCount, 'totalNodes:', totalNodes, 'venueLike:', totalVenueLike, 'withCity:', totalWithCity, 'pendingWays:', pendingWays.length);

  if (pendingWays.length > 0) {
    const neededNodeIds = new Set();
    for (const w of pendingWays) {
      for (const ref of w.nodeRefs) {
        neededNodeIds.add(ref);
      }
    }
    console.log('[import:pbf] way node refs to resolve:', neededNodeIds.size);

    const nodeCoords = new Map();
    offset = 0;

    while (offset < buffer.length && nodeCoords.size < neededNodeIds.size) {
      if (offset + 4 > buffer.length) break;

      const blobHeaderLength = buffer.readUInt32BE(offset);
      offset += 4;

      if (offset + blobHeaderLength > buffer.length) break;

      const blobHeaderReader = new ProtoReader(buffer.subarray(offset, offset + blobHeaderLength));
      const blobHeader = readBlobHeader(blobHeaderReader);
      offset += blobHeaderLength;

      const blobLength = blobHeader.datasize;

      if (offset + blobLength > buffer.length) break;

      const blobReader = new ProtoReader(buffer.subarray(offset, offset + blobLength));
      const blobData = readBlob(blobReader);
      offset += blobLength;

      if (blobHeader.type !== 'OSMData' || !blobData) {
        continue;
      }

      const blockReader = new ProtoReader(blobData);
      collectNodeCoords(blockReader, neededNodeIds, nodeCoords);
    }

    console.log('[import:pbf] node coords resolved:', nodeCoords.size);

    for (const w of pendingWays) {
      const coords = [];
      for (const ref of w.nodeRefs) {
        const c = nodeCoords.get(ref);
        if (c) coords.push(c);
      }

      const hasMatchingCity = w.city && cityFilter && normalizeCityName(w.city) === cityFilter;

      if (coords.length === 0) {
        if (hasMatchingCity) {
          places.push(w.place);
        }
        continue;
      }

      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const avgLon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;

      if (!hasMatchingCity) {
        if (cityPolygon) {
          if (!pointInPolygon(avgLat, avgLon, cityPolygon)) {
            continue;
          }
        } else if (bbox) {
          if (avgLat < bbox.minLat || avgLat > bbox.maxLat ||
              avgLon < bbox.minLon || avgLon > bbox.maxLon) {
            continue;
          }
        }
      }

      w.place.lat = Math.round(avgLat * 10000000) / 10000000;
      w.place.lng = Math.round(avgLon * 10000000) / 10000000;
      places.push(w.place);
    }
  }

  return { places, debugInfo: { blockCount, osmDataCount, totalNodes, totalVenueLike, totalWithCity, totalNoCity, groupFieldCounts, debugLines: allDebugLines } };
}

function readBlobHeader(reader) {
  const header = { type: '', datasize: 0 };

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1:
        header.type = reader.readString();
        break;
      case 2:
        reader.readBytes();
        break;
      case 3:
        header.datasize = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  });

  return header;
}

function readBlob(reader) {
  let raw = null;
  let zlibData = null;

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1:
        raw = Buffer.from(reader.readBytes());
        break;
      case 2:
        reader.readVarint();
        break;
      case 3:
        zlibData = Buffer.from(reader.readBytes());
        break;
      default:
        reader.skip(wireType);
        break;
    }
  });

  if (raw) {
    return raw;
  }

  if (zlibData) {
    return zlib.inflateSync(zlibData);
  }

  return null;
}

function parsePrimitiveBlock(reader, cityFilter, bbox, cityPolygon, stats, debugLines, groupFieldCounts, pendingWays) {
  const places = [];

  let stringTable = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;
  let blockLogged = false;
  let blockLogCount = 0;

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1: {
        const stringTableData = reader.readBytes();
        const stReader = new ProtoReader(stringTableData);
        stringTable = readStringTable(stReader);
        if (debugLines) {
          debugLines.push(`PrimitiveBlock field ${field} wt ${wireType}: stringTable length=${stringTable.length}`);
          const nonEmpty = stringTable.filter(s => s.length > 0);
          debugLines.push(`stringTable non-empty (first 30): ${JSON.stringify(nonEmpty.slice(0, 30))}`);
        }
        break;
      }
      case 2: {
        const groupData = reader.readBytes();
        const gReader = new ProtoReader(groupData);
        if (debugLines) {
          debugLines.push(`PrimitiveBlock field ${field} wt ${wireType}: PrimitiveGroup data size=${groupData.length}`);
        }
        const groupPlaces = parsePrimitiveGroup(
          gReader,
          stringTable,
          cityFilter,
          bbox,
          cityPolygon,
          granularity,
          latOffset,
          lonOffset,
          stats,
          debugLines,
          groupFieldCounts,
          pendingWays,
        );
        places.push(...groupPlaces);
        break;
      }
      case 17:
        granularity = reader.readVarint();
        if (debugLines) debugLines.push(`PrimitiveBlock field 17: granularity=${granularity}`);
        break;
      case 18:
        latOffset = reader.readVarint();
        if (debugLines) debugLines.push(`PrimitiveBlock field 18: latOffset=${latOffset}`);
        break;
      case 19:
        lonOffset = reader.readVarint();
        if (debugLines) debugLines.push(`PrimitiveBlock field 19: lonOffset=${lonOffset}`);
        break;
      default:
        reader.skip(wireType);
        break;
    }
  });

  return places;
}

function readStringTable(reader) {
  const strings = [];

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1:
        strings.push(reader.readString());
        break;
      default:
        reader.skip(wireType);
        break;
    }
  });

  return strings;
}

function parsePrimitiveGroup(reader, stringTable, cityFilter, bbox, cityPolygon, granularity, latOffset, lonOffset, stats, debugLines, groupFieldCounts, pendingWays) {
  const places = [];
  let groupLogCount = 0;

  reader.readFields((field, wireType) => {
    if (groupFieldCounts) {
      groupFieldCounts[field] = (groupFieldCounts[field] || 0) + 1;
    }
    switch (field) {
      case 1: {
        const nodeData = reader.readBytes();
        const nReader = new ProtoReader(nodeData);
        if (debugLines) {
          debugLines.push(`  PrimitiveGroup field ${field} wt ${wireType} (Node): data size=${nodeData.length} hex=${Buffer.from(nodeData.subarray(0, Math.min(30, nodeData.length))).toString('hex')}`);
        }
        const nodePlaces = parseNode(
          nReader,
          stringTable,
          cityFilter,
          bbox,
          cityPolygon,
          granularity,
          latOffset,
          lonOffset,
          stats,
        );
        places.push(...nodePlaces);
        break;
      }
      case 2: {
        const nodeData = reader.readBytes();
        const nReader = new ProtoReader(nodeData);
        if (debugLines) {
          debugLines.push(`  PrimitiveGroup field ${field} wt ${wireType} (DenseNodes): data size=${nodeData.length} hex=${Buffer.from(nodeData.subarray(0, Math.min(30, nodeData.length))).toString('hex')}`);
        }
        const nodePlaces = parseDenseNode(
          nReader,
          stringTable,
          cityFilter,
          bbox,
          cityPolygon,
          granularity,
          latOffset,
          lonOffset,
          stats,
          debugLines,
        );
        places.push(...nodePlaces);
        break;
      }
      case 3: {
        const wayData = reader.readBytes();
        const wReader = new ProtoReader(wayData);
        if (debugLines) {
          debugLines.push(`  PrimitiveGroup field ${field} wt ${wireType} (Way): data size=${wayData.length}`);
        }
        const wayPlaces = parseWay(
          wReader,
          stringTable,
          cityFilter,
          bbox,
          cityPolygon,
          granularity,
          latOffset,
          lonOffset,
          stats,
          pendingWays,
        );
        places.push(...wayPlaces);
        break;
      }
      default:
        if (debugLines) {
          debugLines.push(`  PrimitiveGroup UNKNOWN field ${field} wt ${wireType} at pos ${reader.pos}`);
        }
        reader.skip(wireType);
        break;
    }
  });

  return places;
}

function parseDenseNode(reader, stringTable, cityFilter, bbox, cityPolygon, granularity, latOffset, lonOffset, stats, debugLines) {
  const places = [];

  let denseIds = [];
  let denseLat = [];
  let denseLon = [];
  let denseKeysVals = [];

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1:
        denseIds = reader.readPackedSVarint();
        break;
      case 8:
        denseLat = reader.readPackedSVarint();
        break;
      case 9:
        denseLon = reader.readPackedSVarint();
        break;
      case 10:
        denseKeysVals = reader.readPackedVarint();
        break;
      case 5: {
        const skipLen = reader.readVarint();
        reader.pos += skipLen;
        break;
      }
      default:
        reader.skip(wireType);
        break;
    }
  });

  if (!denseIds.length) {
    return places;
  }

  let cumulativeId = 0;
  let cumulativeLat = 0;
  let cumulativeLon = 0;

  let kvIndex = 0;

  for (let i = 0; i < denseIds.length; i++) {
    cumulativeId += denseIds[i];
    cumulativeLat += denseLat[i];
    cumulativeLon += denseLon[i];

    const tags = {};

    while (kvIndex < denseKeysVals.length) {
      const keyIdx = denseKeysVals[kvIndex];

      if (keyIdx === 0) {
        kvIndex++;
        break;
      }

      const valIdx = denseKeysVals[kvIndex + 1];

      if (keyIdx < stringTable.length && valIdx < stringTable.length) {
        tags[stringTable[keyIdx]] = stringTable[valIdx];
      }

      kvIndex += 2;
    }

    if (stats) stats.totalNodes++;

    if (!isVenueLike(tags)) {
      continue;
    }

    if (stats) stats.venueLike++;

    const name = extractName(tags);
    if (!name) {
      continue;
    }

    const city = extractCity(tags);
    const latitude = 0.000000001 * (latOffset + granularity * cumulativeLat);
    const longitude = 0.000000001 * (lonOffset + granularity * cumulativeLon);

    if (city) {
      if (stats) stats.withCity++;
      if (cityFilter && normalizeCityName(city) === cityFilter) {
        // city tag matches filter - include
      } else {
        // city tag does not match - exclude even if inside bbox
        continue;
      }
    } else {
      if (stats) stats.noCity++;
      if (cityPolygon) {
        if (!pointInPolygon(latitude, longitude, cityPolygon)) {
          continue;
        }
      } else if (bbox) {
        if (latitude < bbox.minLat || latitude > bbox.maxLat ||
            longitude < bbox.minLon || longitude > bbox.maxLon) {
          continue;
        }
      } else if (cityFilter) {
        continue;
      }
    }

    places.push({
      osmId: cumulativeId,
      name,
      city,
      address: extractAddress(tags),
      lat: Math.round(latitude * 10000000) / 10000000,
      lng: Math.round(longitude * 10000000) / 10000000,
      category: inferCategory(tags),
      tags: {
        amenity: tags.amenity || null,
        shop: tags.shop || null,
        leisure: tags.leisure || null,
        tourism: tags.tourism || null,
      },
    });
  }

  return places;
}

function parseNode(reader, stringTable, cityFilter, bbox, cityPolygon, granularity, latOffset, lonOffset, stats) {
  const places = [];

  let nodeId = 0;
  let lat = 0;
  let lon = 0;
  const keys = [];
  const vals = [];

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1:
        nodeId = reader.readSVarint();
        break;
      case 2:
        keys.push(...reader.readPackedVarint());
        break;
      case 3:
        vals.push(...reader.readPackedVarint());
        break;
      case 8:
        lat = reader.readSVarint();
        break;
      case 9:
        lon = reader.readSVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  });

  const tags = {};
  for (let i = 0; i < keys.length && i < vals.length; i++) {
    if (keys[i] < stringTable.length && vals[i] < stringTable.length) {
      tags[stringTable[keys[i]]] = stringTable[vals[i]];
    }
  }

  if (stats) stats.totalNodes++;

  if (!isVenueLike(tags)) {
    return places;
  }

  if (stats) stats.venueLike++;

  const name = extractName(tags);
  if (!name) {
    return places;
  }

  const city = extractCity(tags);
  const latitude = 0.000000001 * (latOffset + granularity * lat);
  const longitude = 0.000000001 * (lonOffset + granularity * lon);

  if (city) {
    if (stats) stats.withCity++;
    if (cityFilter && normalizeCityName(city) === cityFilter) {
      // city tag matches filter - include
    } else {
      // city tag does not match - exclude even if inside bbox
      return places;
    }
  } else {
    if (stats) stats.noCity++;
    if (cityPolygon) {
      if (!pointInPolygon(latitude, longitude, cityPolygon)) {
        return places;
      }
    } else if (bbox) {
      if (latitude < bbox.minLat || latitude > bbox.maxLat ||
          longitude < bbox.minLon || longitude > bbox.maxLon) {
        return places;
      }
    } else if (cityFilter) {
      return places;
    }
  }

  places.push({
    osmId: nodeId,
    name,
    city,
    address: extractAddress(tags),
    lat: Math.round(latitude * 10000000) / 10000000,
    lng: Math.round(longitude * 10000000) / 10000000,
    category: inferCategory(tags),
    tags: {
      amenity: tags.amenity || null,
      shop: tags.shop || null,
      leisure: tags.leisure || null,
      tourism: tags.tourism || null,
    },
  });

  return places;
}

function parseWay(reader, stringTable, cityFilter, bbox, cityPolygon, granularity, latOffset, lonOffset, stats, pendingWays) {
  const places = [];

  let wayId = 0;
  const keys = [];
  const vals = [];
  let nodeRefs = [];

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1:
        wayId = reader.readVarint();
        break;
      case 2:
        keys.push(...reader.readPackedVarint());
        break;
      case 3:
        vals.push(...reader.readPackedVarint());
        break;
      case 4: {
        const refDeltas = reader.readPackedSVarint();
        let cumulative = 0;
        nodeRefs = refDeltas.map(d => { cumulative += d; return cumulative; });
        break;
      }
      default:
        reader.skip(wireType);
        break;
    }
  });

  const tags = {};
  for (let i = 0; i < keys.length && i < vals.length; i++) {
    if (keys[i] < stringTable.length && vals[i] < stringTable.length) {
      tags[stringTable[keys[i]]] = stringTable[vals[i]];
    }
  }

  if (stats) stats.totalNodes++;

  if (!isVenueLike(tags)) {
    return places;
  }

  if (stats) stats.venueLike++;

  const name = extractName(tags);
  if (!name) {
    return places;
  }

  const city = extractCity(tags);

  if (city) {
    if (stats) stats.withCity++;
    if (cityFilter && normalizeCityName(city) === cityFilter) {
      // city tag matches - include, coords will be resolved later
    } else {
      // city tag does not match - exclude
      return places;
    }
  } else {
    if (stats) stats.noCity++;
    if (bbox) {
      // no city tag, need coords to check bbox - defer to second pass
    } else if (cityFilter) {
      return places;
    }
  }

  const place = {
    osmId: wayId,
    name,
    city,
    address: extractAddress(tags),
    lat: null,
    lng: null,
    category: inferCategory(tags),
    tags: {
      amenity: tags.amenity || null,
      shop: tags.shop || null,
      leisure: tags.leisure || null,
      tourism: tags.tourism || null,
    },
  };

  if (pendingWays) {
    pendingWays.push({ place, nodeRefs, city });
  } else {
    places.push(place);
  }

  return places;
}

function collectNodeCoords(reader, neededNodeIds, nodeCoords) {
  let stringTable = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;

  reader.readFields((field, wireType) => {
    switch (field) {
      case 1: {
        const stringTableData = reader.readBytes();
        const stReader = new ProtoReader(stringTableData);
        stringTable = readStringTable(stReader);
        break;
      }
      case 2: {
        const groupData = reader.readBytes();
        const gReader = new ProtoReader(groupData);
        gReader.readFields((gf, gw) => {
          if (gf === 2) {
            const nodeData = gReader.readBytes();
            const nReader = new ProtoReader(nodeData);
            let denseIds = [];
            let denseLat = [];
            let denseLon = [];
            nReader.readFields((df, dw) => {
              switch (df) {
                case 1: denseIds = nReader.readPackedSVarint(); break;
                case 8: denseLat = nReader.readPackedSVarint(); break;
                case 9: denseLon = nReader.readPackedSVarint(); break;
                case 5: { const skipLen = nReader.readVarint(); nReader.pos += skipLen; break; }
                default: nReader.skip(dw); break;
              }
            });
            let cumId = 0, cumLat = 0, cumLon = 0;
            for (let i = 0; i < denseIds.length; i++) {
              cumId += denseIds[i];
              cumLat += denseLat[i];
              cumLon += denseLon[i];
              if (neededNodeIds.has(cumId)) {
                nodeCoords.set(cumId, {
                  lat: 0.000000001 * (latOffset + granularity * cumLat),
                  lon: 0.000000001 * (lonOffset + granularity * cumLon),
                });
              }
            }
          } else {
            gReader.skip(gw);
          }
        });
        break;
      }
      case 17:
        granularity = reader.readVarint();
        break;
      case 18:
        latOffset = reader.readVarint();
        break;
      case 19:
        lonOffset = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  });
}
