export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel environment variables.' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  if (!payload || !payload.contents) {
    return res.status(400).json({ error: 'Missing contents in request body.' });
  }

  // Active models (including recommended 3.5 series)
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ];

  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        return res.status(200).json(data);
      }
      lastErr = data;
    } catch (err) {
      lastErr = { message: err.message };
    }
  }

  return res.status(500).json({
    error: 'Google API generation failed.',
    details: lastErr,
  });
}