// server.js
const express = require('express');
const cors = require('cors');
const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5175;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const QWEN_API_KEY = process.env.QWEN_API_KEY || process.env.REACT_APP_QWEN_API_KEY;
const ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

if (!QWEN_API_KEY) {
  console.warn('⚠️  Missing QWEN_API_KEY. Set it in .env');
}

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/chat', async (req, res) => {
  try {
    const userPrompt =
      req.body?.prompt ||
      req.body?.text ||
      req.body?.message ||
      req.body?.input?.prompt;

    if (!userPrompt) {
      return res.status(400).json({
        error: 'Missing prompt',
        hint: 'Send JSON { "prompt": "..." }',
        received: req.body,
      });
    }

    if (!QWEN_API_KEY) {
      return res.status(500).json({ error: 'Server missing QWEN_API_KEY' });
    }

    const body = {
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content:
            req.body.system ||
            'You are a helpful AI assistant for project management in the PACE app.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    };

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Upstream Qwen error:', data);
      return res
        .status(response.status)
        .json({ error: data.error || data.message || 'Qwen API failed' });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      data?.output?.text ||
      'No response received';

    res.json({ text: answer });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PACE proxy running on http://localhost:${PORT}`);
});
