// Increase body parser limit to 10MB so base64 images don't get truncated
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Allow Cross-Origin Requests (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify server-side API key from Vercel environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.' 
    });
  }

  const payload = req.body;
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
  let lastErrorDetails = null;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return res.status(200).json(data);
      } else {
        lastErrorDetails = {
          model,
          status: response.status,
          response: data,
        };
      }
    } catch (err) {
      lastErrorDetails = {
        model,
        error: err.message,
      };
    }
  }

  // Forward the actual error response from Google instead of a blank 500
  return res.status(500).json({
    error: 'Failed to generate content from AI models.',
    details: lastErrorDetails,
  });
}