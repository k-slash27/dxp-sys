import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { workspace, from_date, to_date } = req.query;
  if (!workspace) return res.status(400).json({ error: 'workspace is required' });

  const params = new URLSearchParams({ workspace: String(workspace) });
  if (from_date) params.set('from_date', String(from_date));
  if (to_date)   params.set('to_date',   String(to_date));

  try {
    const r = await fetch(`${API_URL}/journal/export/csv?${params}`, { cache: 'no-store' });
    if (!r.ok) return res.status(r.status).json({ error: 'CSV export failed' });

    const csv = await r.arrayBuffer();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8-sig');
    res.setHeader('Content-Disposition', `attachment; filename=journal_${workspace}.csv`);
    res.status(200).send(Buffer.from(csv));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
