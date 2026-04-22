import type { NextApiRequest, NextApiResponse } from 'next';

const REGISTER_SERVICE_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { workspace } = req.query;
  if (!workspace || typeof workspace !== 'string') {
    return res.status(400).json({ error: 'workspace parameter is required' });
  }

  try {
    const r = await fetch(`${REGISTER_SERVICE_URL}/webhook/granules/${workspace}`, { cache: 'no-store' });
    if (!r.ok) return res.status(r.status).json({ error: `register-service error: ${r.status}` });
    const data = await r.json();
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
