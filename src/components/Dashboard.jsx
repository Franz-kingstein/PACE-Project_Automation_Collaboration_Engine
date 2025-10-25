import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { auth } from '../firebase';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    completed: 0,
    inProgress: 0,
    bugsReported: 0
  });
  const navigate = useNavigate();
  const db = getFirestore();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/');
      }
    });

    // Real-time listeners for tasks and bugs
    const tasksRef = collection(db, 'tasks');
    const bugsRef = collection(db, 'bugs');

    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const tasks = snapshot.docs.map(doc => doc.data());
      const totalTasks = tasks.length;
      const completed = tasks.filter(task => task.status === 'completed').length;
      const inProgress = tasks.filter(task => task.status === 'in progress').length;
      setMetrics(prev => ({ ...prev, totalTasks, completed, inProgress }));
    });

    const unsubscribeBugs = onSnapshot(bugsRef, (snapshot) => {
      setMetrics(prev => ({ ...prev, bugsReported: snapshot.size }));
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTasks();
      unsubscribeBugs();
    };
  }, [navigate, db]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#FCFCF9', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#21808D',
        color: 'white',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>PACE</h1>
        </div>
        <nav style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link to="/tasks" style={{ color: 'white', textDecoration: 'none' }}>Tasks</Link>
          <Link to="/bugs" style={{ color: 'white', textDecoration: 'none' }}>Bugs</Link>
          <Link to="/chat" style={{ color: 'white', textDecoration: 'none' }}>Chat</Link>
          <Link to="/tools" style={{ color: 'white', textDecoration: 'none' }}>Tools</Link>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={user.photoURL || '/default-avatar.png'} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          <span>{user.displayName || 'User'}</span>
          <button onClick={handleLogout} style={{
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid white',
            padding: '5px 10px',
            cursor: 'pointer'
          }}>Logout</button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div style={{
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center',
          borderTop: '5px solid #21808D'
        }}>
          <h3>Total Tasks</h3>
          <p style={{ fontSize: '24px', color: '#21808D' }}>{metrics.totalTasks}</p>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center',
          borderTop: '5px solid #21808D'
        }}>
          <h3>Completed</h3>
          <p style={{ fontSize: '24px', color: '#21808D' }}>{metrics.completed}</p>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center',
          borderTop: '5px solid #21808D'
        }}>
          <h3>In Progress</h3>
          <p style={{ fontSize: '24px', color: '#21808D' }}>{metrics.inProgress}</p>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center',
          borderTop: '5px solid #21808D'
        }}>
          <h3>Bugs Reported</h3>
          <p style={{ fontSize: '24px', color: '#21808D' }}>{metrics.bugsReported}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;