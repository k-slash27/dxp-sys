import type { NextApiRequest, NextApiResponse } from 'next';

const GEOSERVER_URL = process.env.GEOSERVER_URL || 'http://geoserver:8080/geoserver';
const GEOSERVER_USER = process.env.GEOSERVER_USER || 'admin';
const GEOSERVER_PASSWORD = process.env.GEOSERVER_PASSWORD || 'geoserver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { workspace, store } = req.query;
  if (
    !workspace || !store ||
    typeof workspace !== 'string' || typeof store !== 'string'
  ) {
    return res.status(400).json({ error: 'workspace and store parameters are required' });
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASSWORD}`).toString('base64')}`;
    const r = await fetch(
      `${GEOSERVER_URL}/rest/workspaces/${workspace}/coveragestores/${store}/coverages/${store}.json`,
      { headers: { Authorization: authHeader, Accept: 'application/json' } }
    );
    if (!r.ok) {
      return res.status(r.status).json({ error: `GeoServer error: ${r.status}` });
    }
    const data = await r.json();
    const bbox = data?.coverage?.latLonBoundingBox;
    if (!bbox) {
      return res.status(404).json({ error: 'latLonBoundingBox not found in coverage response' });
    }
    // Return { minx, maxx, miny, maxy } — already in WGS84 (EPSG:4326)
    res.status(200).json({
      minx: bbox.minx,
      maxx: bbox.maxx,
      miny: bbox.miny,
      maxy: bbox.maxy,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
