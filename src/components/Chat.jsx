import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

const Chat = ({ projectId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const base = collection(db, 'messages');
    const q = projectId
      ? query(base, where('projectId', '==', projectId), orderBy('timestamp', 'asc'))
      : query(base, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(messagesData);
      scrollToBottom();
    });
    return unsubscribe;
  }, [projectId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, 'messages'), {
      text: newMessage,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      userPhotoURL: user.photoURL || '/default-avatar.png',
      timestamp: new Date(),
      ...(projectId ? { projectId } : {})
    });
    setNewMessage('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#FCFCF9'
    }}>
      {/* Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        backgroundColor: 'white',
        margin: '10px',
        borderRadius: '10px'
      }}>
        {messages.map(message => (
          <div key={message.id} style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <img
              src={message.userPhotoURL || '/default-avatar.png'}
              alt="Avatar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                marginRight: '10px'
              }}
            />
            <div>
              <strong>{message.userName}</strong>
              <p style={{ margin: '5px 0' }}>{message.text}</p>
              <small style={{ color: '#666' }}>
                {message.timestamp?.toDate().toLocaleString()}
              </small>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} style={{
        display: 'flex',
        padding: '10px',
        backgroundColor: 'white',
        margin: '10px',
        borderRadius: '10px'
      }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            marginRight: '10px'
          }}
        />
        <button type="submit" style={{
          padding: '10px 20px',
          backgroundColor: '#21808D',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
