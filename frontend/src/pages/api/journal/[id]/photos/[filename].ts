import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, filename } = req.query;
  if (!id || !filename) return res.status(400).json({ error: 'id and filename are required' });

  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const r = await fetch(`${API_URL}/journal/${id}/photos/${filename}`, { method: 'DELETE' });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
