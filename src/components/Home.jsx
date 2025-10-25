import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';
import { auth, db } from '../firebase';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const colors = {
  teal: '#21808D',
  cream: '#FCFCF9',
  charcoal: '#1F2121',
  white: '#FFFFFF',
  orange: '#F59E0B',
  blue: '#2563EB',
  green: '#10B981',
};

function formatDate(date) {
  try {
    return new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const LoadingSkeleton = ({ height = 120 }) => (
  <div style={{
    height,
    background: '#eee',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    animation: 'pulse 1.5s ease-in-out infinite'
  }} />
);

const Badge = ({ children, color = colors.teal }) => (
  <span style={{
    background: `${color}1A`,
    color,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    border: `1px solid ${color}33`
  }}>{children}</span>
);

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Projects
  const [projects, setProjects] = useState([]);

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  // UI
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [toast, setToast] = useState('');

  const [newProject, setNewProject] = useState({ name: '', description: '', members: '' });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) navigate('/');
    });
    return unsubAuth;
  }, [navigate]);

  // Listen to Projects where owner==user.email OR members array-contains user.email
  useEffect(() => {
    if (!user) return;
    setError('');
    const ownerQ = query(collection(db, 'projects'), where('ownerEmail', '==', user.email || '')); 
    const memberQ = query(collection(db, 'projects'), where('members', 'array-contains', user.email || ''));

    const seen = new Map();
    const mergeAndSet = () => setProjects(Array.from(seen.values()));

    const unsub1 = onSnapshot(ownerQ, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') seen.delete(ch.doc.id);
        else seen.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
      });
      mergeAndSet();
    }, (e) => setError(e.message));

    const unsub2 = onSnapshot(memberQ, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') seen.delete(ch.doc.id);
        else seen.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
      });
      mergeAndSet();
    }, (e) => setError(e.message));

    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Listen to tasks assigned to user across projects
  useEffect(() => {
    if (!user) return;
    const qTasks = query(
      collection(db, 'tasks'),
      where('assignee', '==', user.email || ''),
      orderBy('dueDate', 'asc')
    );
    const unsub = onSnapshot(qTasks, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(data);
    }, (e) => setError(e.message));
    return unsub;
  }, [user]);

  const toDoCount = useMemo(() => tasks.filter(t => (t.status || '').toLowerCase() === 'to do').length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter(t => (t.status || '').toLowerCase() === 'in progress').length, [tasks]);
  const completedToday = useMemo(() => {
    const today = new Date();
    return tasks.filter(t => t.completedAt && isSameDay(new Date(t.completedAt.seconds ? t.completedAt.seconds * 1000 : t.completedAt), today)).length;
  }, [tasks]);

  const weekMessageCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return tasks.filter(t => t.completedAt && new Date(t.completedAt.seconds ? t.completedAt.seconds * 1000 : t.completedAt) >= start).length;
  }, [tasks]);

  // Project progress map by projectId
  const projectProgress = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const pid = t.projectId || 'unknown';
      if (!map[pid]) map[pid] = { total: 0, done: 0 };
      map[pid].total += 1;
      if ((t.status || '').toLowerCase() === 'done') map[pid].done += 1;
    }
    return map;
  }, [tasks]);

  // My Tasks tab filtering
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + 7);

    let list = [...tasks];
    if (activeTab === 'today') {
      list = list.filter(t => t.dueDate && isSameDay(new Date(t.dueDate.seconds ? t.dueDate.seconds * 1000 : t.dueDate), startOfToday));
    } else if (activeTab === 'week') {
      list = list.filter(t => t.dueDate) // due within next 7 days
                 .filter(t => {
                   const d = new Date(t.dueDate.seconds ? t.dueDate.seconds * 1000 : t.dueDate);
                   return d >= startOfToday && d < endOfWeek;
                 });
    } else if (activeTab === 'overdue') {
      list = list.filter(t => t.dueDate && new Date(t.dueDate.seconds ? t.dueDate.seconds * 1000 : t.dueDate) < startOfToday && (t.status || '').toLowerCase() !== 'done');
    }

    // sort by due date
    list.sort((a, b) => {
      const ad = a.dueDate ? (a.dueDate.seconds ? a.dueDate.seconds * 1000 : a.dueDate) : Infinity;
      const bd = b.dueDate ? (b.dueDate.seconds ? b.dueDate.seconds * 1000 : b.dueDate) : Infinity;
      return ad - bd;
    });

    return list.slice(0, 10);
  }, [tasks, activeTab]);

  // Weekly chart data (last 7 days)
  const chartData = useMemo(() => {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = new Array(7).fill(0);
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 6); // include today

    tasks.forEach(t => {
      if (t.completedAt) {
        const d = new Date(t.completedAt.seconds ? t.completedAt.seconds * 1000 : t.completedAt);
        if (d >= start) {
          counts[d.getDay()] += 1;
        }
      }
    });

    const labels = Array.from({ length: 7 }, (_, i) => days[(start.getDay() + i) % 7]);
    const rotatedCounts = Array.from({ length: 7 }, (_, i) => counts[(start.getDay() + i) % 7]);

    return {
      labels,
      datasets: [
        {
          label: 'Tasks Completed',
          data: rotatedCounts,
          backgroundColor: colors.teal,
          borderRadius: 6,
        },
      ],
    };
  }, [tasks]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Your Weekly Progress' },
      tooltip: { enabled: true },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  const markTaskComplete = async (task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { status: 'done', completedAt: serverTimestamp() });
      setToast('Task marked as complete');
      setTimeout(() => setToast(''), 1500);
    } catch (e) {
      setError(e.message);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const members = newProject.members
        .split(',')
        .map(m => m.trim())
        .filter(Boolean);
      await addDoc(collection(db, 'projects'), {
        name: newProject.name,
        description: newProject.description,
        ownerEmail: user.email,
        ownerName: user.displayName || user.email,
        members,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowProjectModal(false);
      setNewProject({ name: '', description: '', members: '' });
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <LoadingSkeleton height={48} />
        <div style={{ height: 16 }} />
        <LoadingSkeleton height={180} />
      </div>
    );
  }

  if (!user) return null;

  // Derived helper for project progress
  const getProjectProgress = (projectId) => {
    const p = projectProgress[projectId] || { total: 0, done: 0 };
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    return { ...p, pct };
  };

  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: 24, background: colors.cream, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginBottom: 20
      }}>
        <div>
          <h2 style={{ margin: 0, color: colors.charcoal }}>Welcome back, {user.displayName || user.email}</h2>
          <div style={{ color: '#6B7280' }}>{todayStr}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setShowProjectModal(true)}>Create New Project</button>
          <button className="btn" style={{ background: '#1a6b7a' }} onClick={() => navigate('/tasks')}>Add Task</button>
          <button className="btn" style={{ background: '#1a6b7a' }} onClick={() => navigate('/profile')}>Invite Member</button>
        </div>
      </div>

      {/* Section 2: Task Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div className="card" style={{ borderRadius: 12, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F59E0B22', color: colors.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📝</div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Tasks To Do</div>
            <div style={{ fontSize: 24, color: colors.charcoal }}>{toDoCount}</div>
          </div>
        </div>
        <div className="card" style={{ borderRadius: 12, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#2563EB22', color: colors.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>In Progress</div>
            <div style={{ fontSize: 24, color: colors.charcoal }}>{inProgressCount}</div>
          </div>
        </div>
        <div className="card" style={{ borderRadius: 12, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#10B98122', color: colors.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✔️</div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Completed Today</div>
            <div style={{ fontSize: 24, color: colors.charcoal }}>{completedToday}</div>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 24, color: '#6B7280' }}>You've completed {weekMessageCount} tasks this week! Keep going 🚀</div>

      {/* Section 1: Projects Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 24
      }}>
        {projects.map((p) => {
          const prog = getProjectProgress(p.id);
          return (
            <div key={p.id} className="card" style={{ border: '1px solid #eee', borderRadius: 12, transition: 'box-shadow .2s, transform .2s', cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}`)} onMouseEnter={(e)=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={(e)=>{e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: colors.charcoal }}>{p.name}</h3>
                <Badge>{(p.members?.length || 0) + 1} members</Badge>
              </div>
              <div style={{ color: '#6B7280', marginTop: 6 }}>{p.description}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>Owner: {p.ownerName || p.ownerEmail}</div>
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999 }}>
                  <div style={{ width: `${prog.pct}%`, height: '100%', background: colors.teal, borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>{prog.done}/{prog.total} tasks · {prog.pct}% complete</div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>Last updated: {p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleString() : (p.updatedAt ? formatDate(p.updatedAt) : '—')}</div>
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={(e)=>{ e.stopPropagation(); navigate(`/project/${p.id}`); }}>Open Project</button>
              </div>
            </div>
          );
        })}
        {/* Create new card */}
        <div className="card" style={{ border: '2px dashed #E5E7EB', borderRadius: 12, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setShowProjectModal(true)}>
          <div style={{ color: colors.teal, fontWeight: 600 }}>+ Create New Project</div>
        </div>
      </div>

      {/* Section 3 + 4: Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: 16
      }}>
        {/* My Tasks List */}
        <div className="card" style={{ borderRadius: 12, border: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, borderBottom: '1px solid #F3F4F6', paddingBottom: 8 }}>
            {[
              { key: 'all', label: 'All Tasks' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'overdue', label: 'Overdue' },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                background: activeTab === t.key ? colors.teal : 'transparent',
                color: activeTab === t.key ? 'white' : colors.charcoal,
                border: `1px solid ${activeTab === t.key ? colors.teal : '#E5E7EB'}`,
                padding: '6px 10px', borderRadius: 999, cursor: 'pointer'
              }}>{t.label}</button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn" style={{ background: '#1a6b7a' }} onClick={() => navigate('/tasks')}>View All</button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div style={{ color: '#6B7280' }}>No pending tasks - You're all caught up! 🎉</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredTasks.map(task => {
                const due = task.dueDate ? new Date(task.dueDate.seconds ? task.dueDate.seconds * 1000 : task.dueDate) : null;
                const today = new Date();
                let dueColor = colors.green;
                if (due) {
                  const isToday = isSameDay(due, today);
                  const overdue = due < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  if (overdue) dueColor = '#EF4444';
                  else if (isToday) dueColor = '#F59E0B';
                }
                const priority = (task.priority || 'low').toLowerCase();
                const priorityColor = priority === 'high' ? '#EF4444' : priority === 'medium' ? '#F59E0B' : '#10B981';
                return (
                  <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <input type="checkbox" checked={(task.status || '').toLowerCase() === 'done'} onChange={() => markTaskComplete(task)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: priorityColor, display: 'inline-block' }} />
                        <strong>{task.title}</strong>
                        {task.projectName && <Badge>{task.projectName}</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                        Due: {due ? due.toLocaleDateString() : '—'}
                        <span style={{ marginLeft: 8, color: dueColor }}>●</span>
                      </div>
                    </div>
                    <button title="Quick edit" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✏️</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Productivity Graph */}
        <div className="card" style={{ borderRadius: 12, border: '1px solid #eee' }}>
          {chartData.datasets[0].data.every(v => v === 0) ? (
            <div style={{ color: '#6B7280' }}>No activity in the last 7 days yet.</div>
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showProjectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>Create New Project</h3>
            {error && <div style={{ color: '#b00020', background: '#ffe8e8', padding: 8, borderRadius: 6 }}>{error}</div>}
            <form onSubmit={createProject}>
              <label>Name</label>
              <input value={newProject.name} onChange={(e)=>setNewProject(p=>({...p, name: e.target.value}))} required style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E5E7EB', margin: '6px 0 12px' }} />
              <label>Description</label>
              <textarea value={newProject.description} onChange={(e)=>setNewProject(p=>({...p, description: e.target.value}))} rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E5E7EB', margin: '6px 0 12px' }} />
              <label>Members (comma separated emails)</label>
              <input value={newProject.members} onChange={(e)=>setNewProject(p=>({...p, members: e.target.value}))} placeholder="alice@acme.com, bob@acme.com" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E5E7EB', margin: '6px 0 12px' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" style={{ background: '#6B7280' }} onClick={()=>setShowProjectModal(false)}>Cancel</button>
                <button type="submit" className="btn">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: colors.teal, color: 'white', padding: '10px 16px', borderRadius: 8 }}>{toast}</div>
      )}

      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 1024px) {
          .projects-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .projects-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Home;
