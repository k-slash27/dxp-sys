import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.REGISTER_SERVICE_URL || 'http://localhost:8000';

// multipart をそのままバックエンドへストリーム転送するため bodyParser を無効化
export const config = { api: { bodyParser: false } };

/** req ストリームを Buffer に読み込む（for-await より安定） */
function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id is required' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const contentType = req.headers['content-type'] || '';

    const r = await fetch(`${API_URL}/journal/${id}/photos`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
