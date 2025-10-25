import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyCHEEIw_T8n2G4gOS0Zc3tqPQpdTAuv5FQ';
const genAI = new GoogleGenerativeAI(API_KEY);

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `You are a helpful AI assistant for project management in the PACE app. Answer questions about project management, suggest task assignments, and provide advice on productivity. User message: ${input}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const botMessage = { role: 'bot', text: response.text() };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = { role: 'bot', text: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
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
              onKeyPress={handleKeyPress}
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
