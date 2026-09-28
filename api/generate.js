module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.' });
  }

  const payload = req.body;
  if (!payload || !payload.contents) {
    return res.status(400).json({ error: 'Missing payload contents.' });
  }

  // Active verified models on Google AI Studio
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
  let errorLog = [];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        return res.status(200).json(data);
      } else {
        errorLog.push({ model, status: response.status, details: data });
      }
    } catch (err) {
      errorLog.push({ model, networkError: err.message });
    }
  }

  // Send back full detail of why Google rejected it
  return res.status(500).json({
    error: 'AI Generation Failed',
    reasons: errorLog
  });
};