import React, { useEffect, useState } from 'react';
import { GoogleGenAI } from '@google/genai';

// TEMP: explicit API key for first-time testing. Replace with your key.
// After testing, move this into an env var (e.g., REACT_APP_GOOGLE_API_KEY).
const GOOGLE_API_KEY = 'AIzaSyDMkJsFXYf_2TTgoVPpi5D6y2ForJS1iKs';

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    /* eslint-disable no-console */
    console.log('PACE Chatbot (Google GenAI) config:', {
  hasKey: Boolean(!!GOOGLE_API_KEY),
      model: 'gemini-2.5-flash',
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
  if (!GOOGLE_API_KEY) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Missing API key. Set GOOGLE_API_KEY in AIChatbot.jsx.' }]);
      return;
    }

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Build a simple prompt from short chat history
      const history = [...messages, userMessage];
      const system = 'You are a helpful AI assistant for project management in the PACE app. Keep replies short and actionable.';
      const transcript = history
        .slice(-8) // keep it short
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');

      const contents = `${system}\n\n${transcript}\nAssistant:`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      });

      const answer = response?.text || '';
      if (!answer) throw new Error('Empty response from model');

      setMessages(prev => [...prev, { role: 'bot', text: answer }]);
    } catch (err) {
      console.error('Chatbot error:', err);
      const msg = err?.message ? String(err.message).slice(0, 180) : 'Unknown error';
      setMessages(prev => [...prev, { role: 'bot', text: `Sorry, I encountered an error. Details: ${msg}` }]);
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
          <div style={{
            backgroundColor: '#21808D',
            color: 'white',
            padding: '10px',
            borderRadius: '10px 10px 0 0',
            textAlign: 'center'
          }}>
            PACE AI Assistant
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
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

          <div style={{ padding: '10px', borderTop: '1px solid #ccc', display: 'flex' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about project management..."
              style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '5px', marginRight: '10px' }}
            />
            <button
              onClick={sendMessage}
              style={{ padding: '8px 12px', backgroundColor: '#21808D', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
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