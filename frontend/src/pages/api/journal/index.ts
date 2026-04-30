import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { workspace, from_date, to_date } = req.query;
    if (!workspace) return res.status(400).json({ error: 'workspace is required' });

    const params = new URLSearchParams({ workspace: String(workspace) });
    if (from_date) params.set('from_date', String(from_date));
    if (to_date)   params.set('to_date',   String(to_date));

    try {
      const r = await fetch(`${API_URL}/journal?${params}`, { cache: 'no-store' });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }

  } else if (req.method === 'POST') {
    try {
      const r = await fetch(`${API_URL}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
