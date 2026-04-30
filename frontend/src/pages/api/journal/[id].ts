import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id is required' });

  const url = `${API_URL}/journal/${id}`;

  try {
    if (req.method === 'GET') {
      const r = await fetch(url, { cache: 'no-store' });
      const data = await r.json();
      res.status(r.status).json(data);

    } else if (req.method === 'PUT') {
      const r = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      res.status(r.status).json(data);

    } else if (req.method === 'DELETE') {
      const r = await fetch(url, { method: 'DELETE' });
      const data = await r.json();
      res.status(r.status).json(data);

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
