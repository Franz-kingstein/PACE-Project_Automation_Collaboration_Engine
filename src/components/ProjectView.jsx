import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import TaskBoard from './TaskBoard';
import Chat from './Chat';
import BugReporter from './BugReporter';

const Tab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 14px',
      borderRadius: 999,
      border: `1px solid ${active ? '#21808D' : '#E5E7EB'}`,
      background: active ? '#21808D' : 'transparent',
      color: active ? 'white' : '#1F2121',
      cursor: 'pointer'
    }}
  >
    {children}
  </button>
);

const ProjectView = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'projects', projectId), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [projectId]);

  if (!project) return <div style={{ padding: 24 }}>Loading project...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{project.name}</h2>
        <span style={{ color: '#6B7280' }}>Project ID: {project.id}</span>
      </div>
      <p style={{ marginTop: 0, color: '#6B7280' }}>{project.description}</p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 20px' }}>
        <Tab active={tab==='overview'} onClick={() => setTab('overview')}>Overview</Tab>
        <Tab active={tab==='tasks'} onClick={() => setTab('tasks')}>Tasks</Tab>
        <Tab active={tab==='chat'} onClick={() => setTab('chat')}>Chat</Tab>
        <Tab active={tab==='bugs'} onClick={() => setTab('bugs')}>Bugs</Tab>
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ border: '1px solid #eee', borderRadius: 12 }}>
            <h3>Members</h3>
            <ul>
              <li>{project.ownerName || project.ownerEmail} (Owner)</li>
              {(project.members || []).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ border: '1px solid #eee', borderRadius: 12 }}>
            <h3>Quick Links</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tab active={false} onClick={() => setTab('tasks')}>Open Tasks</Tab>
              <Tab active={false} onClick={() => setTab('chat')}>Open Chat</Tab>
              <Tab active={false} onClick={() => setTab('bugs')}>Report Bug</Tab>
            </div>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          <TaskBoard projectId={project.id} />
        </div>
      )}

      {tab === 'chat' && (
        <div>
          <Chat projectId={project.id} />
        </div>
      )}

      {tab === 'bugs' && (
        <div>
          <BugReporter projectId={project.id} />
        </div>
      )}
    </div>
  );
};

export default ProjectView;
