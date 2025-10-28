import React, { useEffect, useState } from 'react';

// Prefer environment configuration; optionally support a simple HTTP proxy if provided
const CHAT_API_URL = process.env.REACT_APP_CHAT_API_URL; // Optional custom backend proxy
let QWEN_API_KEY = process.env.REACT_APP_QWEN_API_KEY;
// Dev-friendly fallback: allow setting a temporary key at runtime
if (!QWEN_API_KEY) {
  try {
    const fromWindow = typeof window !== 'undefined' && (window.PACE_QWEN_API_KEY);
    const fromStorage = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('PACE_QWEN_API_KEY');
    QWEN_API_KEY = fromWindow || fromStorage || QWEN_API_KEY;
  } catch {}
}

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Dev-time diagnostics to confirm env wiring (does not print secrets)
  useEffect(() => {
    /* eslint-disable no-console */
    console.log('PACE Chatbot config:', {
  provider: 'qwen',
  hasQwenKey: Boolean(QWEN_API_KEY),
      hasProxyUrl: Boolean(CHAT_API_URL),
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      let answer = '';

      // Option A: Use custom backend if provided
      if (CHAT_API_URL) {
        try {
          const resp = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: input,
              system: 'You are a helpful AI assistant for project management in the PACE app. Answer with concise, practical guidance.',
            }),
          });
          if (!resp.ok) {
            let body = '';
            try { body = await resp.text(); } catch {}
            throw new Error(`HTTP ${resp.status}${body ? ` - ${body.slice(0,200)}` : ''}`);
          }
          const data = await resp.json();
          answer = data.text || data.answer || '';
        } catch (proxyErr) {
      console.warn('Proxy call failed:', proxyErr);
      // Do not fall back to direct browser call when proxy is configured
      throw proxyErr;
        }
      }

      // Option B: Direct Qwen call (browser). Requires REACT_APP_QWEN_API_KEY.
  if (!answer && QWEN_API_KEY && !CHAT_API_URL) {
        const endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        const models = ['qwen2.5', 'qwen2.5-mini', 'qwen-plus', 'qwen-turbo'];
        const messagesBody = [
          { role: 'system', content: 'You are a helpful AI assistant for project management in the PACE app. Keep replies short and actionable.' },
          { role: 'user', content: input }
        ];
        let lastErr = null;
        for (const model of models) {
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${QWEN_API_KEY}`,
              },
              body: JSON.stringify({ model, messages: messagesBody, temperature: 0.7 })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            answer = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
            if (answer) break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!answer && lastErr) throw lastErr;
      }

      if (!answer) {
        throw new Error('No answer produced. Check API key or backend URL.');
      }

      const botMessage = { role: 'bot', text: answer };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      let hint = '';
      if (!QWEN_API_KEY && !CHAT_API_URL) {
        hint = ' Missing API configuration. Set REACT_APP_QWEN_API_KEY or REACT_APP_CHAT_API_URL.';
      }
      const detail = error?.message ? `\nDetails: ${String(error.message).slice(0, 180)}` : '';
      const errorMessage = { role: 'bot', text: `Sorry, I encountered an error. Please try again.${hint}${detail}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#21808D',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        {isOpen ? '×' : '💬'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '350px',
          height: '500px',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#21808D',
            color: 'white',
            padding: '10px',
            borderRadius: '10px 10px 0 0',
            textAlign: 'center'
          }}>
            PACE AI Assistant
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px'
          }}>
            {messages.map((msg, index) => (
              <div key={index} style={{
                marginBottom: '10px',
                textAlign: msg.role === 'user' ? 'right' : 'left'
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: msg.role === 'user' ? '#21808D' : '#f1f1f1',
                  color: msg.role === 'user' ? 'white' : 'black',
                  maxWidth: '80%'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ textAlign: 'left', marginBottom: '10px' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#f1f1f1',
                  color: 'black'
                }}>
                  Bot is typing...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '10px',
            borderTop: '1px solid #ccc',
            display: 'flex'
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about project management..."
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                marginRight: '10px'
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: '8px 12px',
                backgroundColor: '#21808D',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatbot;
