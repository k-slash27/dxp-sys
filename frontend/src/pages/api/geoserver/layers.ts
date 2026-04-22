import { NextApiRequest, NextApiResponse } from 'next';

const GEOSERVER_HOST = process.env.NEXT_PUBLIC_GEOSERVER_HOST || 'http://localhost:8080/geoserver';
const GEOSERVER_USER = process.env.GEOSERVER_USER || 'admin';
const GEOSERVER_PASSWORD = process.env.GEOSERVER_PASSWORD || 'geoserver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { workspace } = req.query;
    if (!workspace || typeof workspace !== 'string') {
        return res.status(400).json({ message: 'workspace parameter is required' });
    }

    try {
        const url = `${GEOSERVER_HOST}/rest/workspaces/${workspace}/layers.json`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASSWORD}`).toString('base64'),
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ message: `GeoServer error: ${response.status}` });
        }

        const data = await response.json();
        const layers: string[] = (data.layers?.layer ?? []).map((l: { name: string }) => l.name);

        res.status(200).json({ layers });
    } catch (error: any) {
        console.error('GeoServer layers fetch error:', error);
        res.status(500).json({ message: error.message });
    }
}
