import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  arrayUnion,
  serverTimestamp,
  deleteField,
  getCountFromServer,
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

// ============ Helper to calculate counts from tasks array ============
function calculateTaskCounts(tasksArray) {
  let toDoCount = 0;
  let inProgressCount = 0;
  let completedTodayCount = 0;
  const today = new Date();

  const toDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const n = new Date(val);
    return isNaN(n.getTime()) ? null : n;
  };

  tasksArray.forEach((t) => {
    const status = normalizeStatus(t?.status);
    const completed = status === 'done';

    // Only count pending "to do" and "in progress" tasks
    if (!completed) {
      if (status === 'to do') toDoCount++;
      else if (status === 'in progress') inProgressCount++;
    }

    // Completed today (only if status is 'done' AND has completedAt timestamp)
    if (completed && t.completedAt) {
      const completedDate = toDate(t.completedAt);
      if (completedDate && isSameDay(completedDate, today)) completedTodayCount++;
    }
  });

  // Minimal logging for debugging
  console.log('[calculateTaskCounts] counts ->', { toDoCount, inProgressCount, completedTodayCount, total: tasksArray.length });
  return { toDoCount, inProgressCount, completedTodayCount };
}

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

// Normalize various timestamp shapes (Firestore Timestamp, {seconds}, ISO/string)
function parseTimestamp(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeStatus(s) {
  if (!s) return '';
  const t = String(s).toLowerCase().trim();
  
  // Check for "in progress" variations
  if (t.includes('in progress') || t.includes('inprogress') || t === 'in progress') {
    return 'in progress';
  }
  
  // Check for "to do" variations
  if (t.includes('to do') || t.includes('todo') || t === 'to do') {
    return 'to do';
  }
  
  // Check for "done" variations
  if (t.includes('done') || t.includes('complete')) {
    return 'done';
  }
  
  return t;
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

// Standardized completion logic - ONLY based on status field
const isTaskCompleted = (t) => normalizeStatus(t?.status) === 'done';

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Projects
  const [projects, setProjects] = useState([]);

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  // Default to showing only pending tasks
  const [activeTab, setActiveTab] = useState('pending');

  // Server-side counts
  const [toDoCount, setToDoCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  // UI
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [toast, setToast] = useState('');

  const [newProject, setNewProject] = useState({ name: '', description: '', members: '' });
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [personalNote, setPersonalNote] = useState('');

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
    // load personal note
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setPersonalNote(snap.data().personalNote || '');
      }
    });
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

  return () => { unsub1(); unsub2(); unsubUser && unsubUser(); };
  }, [user]);

  // Backfill project task counts (taskTotal/taskDone) so progress shows immediately on Home
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    // For any project missing counts, compute using Firestore aggregation counts
    const tasksCol = collection(db, 'tasks');
    projects.forEach(async (p) => {
      if (typeof p.taskTotal === 'number' && typeof p.taskDone === 'number') {
        console.log(`[Home] Project "${p.name}" already has counts:`, p.taskTotal, 'total,', p.taskDone, 'done');
        return;
      }
      try {
        console.log(`[Home] Backfilling counts for project "${p.name}" (${p.id})...`);
        const baseQ = query(tasksCol, where('projectId', '==', p.id));
        const totalSnap = await getCountFromServer(baseQ);
        
        // Count completed tasks: ONLY those with status='done'
        const allTasksSnap = await getDocs(baseQ);
        let doneCount = 0;
        let taskDetails = [];
        allTasksSnap.forEach(doc => {
          const t = doc.data();
          const completed = normalizeStatus(t.status) === 'done';
          taskDetails.push({ title: t.title, status: t.status, completed });
          if (completed) doneCount++;
        });
        
        console.log(`[Home] Project "${p.name}" backfill results:`, totalSnap.data().count, 'total,', doneCount, 'done');
        console.table(taskDetails);
        
        await updateDoc(doc(db, 'projects', p.id), {
          taskTotal: totalSnap.data().count || 0,
          taskDone: doneCount,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error(`[Home] Backfill error for project "${p.name}":`, err);
      }
    });
  }, [projects]);

  // Backfill: ensure tasks with status done have completedAt set
  useEffect(() => {
    const toBackfill = tasks.filter(t => normalizeStatus(t.status) === 'done' && !t.completedAt);
    if (!toBackfill.length) return;
    // limit write burst to avoid excessive updates
    toBackfill.slice(0, 20).forEach(async (t) => {
      try {
        await updateDoc(doc(db, 'tasks', t.id), { completedAt: serverTimestamp() });
      } catch (e) {
        // ignore backfill errors silently to avoid user disruption
      }
    });
  }, [tasks]);

  // Listen to tasks assigned to user across projects (supports assigneeId, assigneeEmail, and legacy assignee)
  useEffect(() => {
    if (!user) return;
    console.log('[Home] Setting up task listeners for user:', { uid: user.uid, email: user.email });
    const tasksCol = collection(db, 'tasks');
    // Remove orderBy to avoid index requirement; sort client-side instead
    const qById = query(tasksCol, where('assigneeId', '==', user.uid || ''));
    const qByEmail = query(tasksCol, where('assigneeEmail', '==', user.email || ''));
    const qLegacy = query(tasksCol, where('assignee', '==', user.email || ''));
    const seen = new Map();
    let loadCount = 0;
    const mergeAndSet = () => {
      const sorted = Array.from(seen.values()).sort((a, b) => {
        const ad = a.dueDate ? (a.dueDate.seconds ? a.dueDate.seconds * 1000 : a.dueDate) : Infinity;
        const bd = b.dueDate ? (b.dueDate.seconds ? b.dueDate.seconds * 1000 : b.dueDate) : Infinity;
        return ad - bd;
      });
      console.log('[Home] Tasks merged:', sorted.length, 'Unique task IDs:', seen.size);
      console.log('[Home] ALL TASK STATUSES FROM DB:', sorted.map(t => ({ title: t.title, rawStatus: t.status, normalized: normalizeStatus(t.status), completed: isTaskCompleted(t) })));
      sorted.forEach(t => {
        console.log('[Home] Task:', t.title, '| Status:', t.status, '| Completed:', isTaskCompleted(t), '| AssigneeId:', t.assigneeId, '| AssigneeEmail:', t.assigneeEmail, '| Project:', t.projectId);
      });
      setTasks(sorted);
    };
    const unsub1 = onSnapshot(qById, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') seen.delete(ch.doc.id);
        else seen.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
      });
      mergeAndSet();
      loadCount++;
      if (loadCount >= 3) setTasksLoaded(true);
    }, (e) => { setError(e.message); setTasksLoaded(true); });
    const unsub2 = onSnapshot(qByEmail, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') seen.delete(ch.doc.id);
        else seen.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
      });
      mergeAndSet();
      loadCount++;
      if (loadCount >= 3) setTasksLoaded(true);
    }, (e) => { setError(e.message); setTasksLoaded(true); });
    const unsub3 = onSnapshot(qLegacy, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') seen.delete(ch.doc.id);
        else seen.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
      });
      mergeAndSet();
      loadCount++;
      if (loadCount >= 3) setTasksLoaded(true);
    }, (e) => { setError(e.message); setTasksLoaded(true); });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  // Update server-side counts when tasks change
  useEffect(() => {
    if (tasks.length === 0) {
      setToDoCount(0);
      setInProgressCount(0);
      setCompletedToday(0);
      return;
    }
    
    const counts = calculateTaskCounts(tasks);
    setToDoCount(counts.toDoCount);
    setInProgressCount(counts.inProgressCount);
    setCompletedToday(counts.completedTodayCount);
  }, [tasks]);

  const hasPending = useMemo(() => tasks.some(t => !isTaskCompleted(t)), [tasks]);
  
  const weekMessageCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
  return tasks.filter(t => t.completedAt && parseTimestamp(t.completedAt) >= start).length;
  }, [tasks]);

  // Project progress map by projectId
  const projectProgress = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const pid = t.projectId || 'unknown';
      if (!map[pid]) map[pid] = { total: 0, done: 0 };
      map[pid].total += 1;
      if (isTaskCompleted(t)) map[pid].done += 1;
    }
    return map;
  }, [tasks]);

  // My Tasks tab filtering - show only pending by default; if none pending, show completed as fallback
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + 7);

  // Helper shorthands
  const isPending = (t) => !isTaskCompleted(t);
  const isDone = (t) => isTaskCompleted(t);

    let list = [...tasks];
    console.log('[Home] Filtering tasks. Active tab:', activeTab, 'Total tasks:', list.length);
    
    if (activeTab === 'pending') {
      const pending = list.filter(isPending);
      console.log('[Home] Pending tasks:', pending.length);
      list = pending.length ? pending : list.filter(isDone); // fallback to completed when no pending
    } else if (activeTab === 'today') {
      list = list.filter(t => t.dueDate && isSameDay(parseTimestamp(t.dueDate), startOfToday) && isPending(t));
    } else if (activeTab === 'week') {
      list = list.filter(t => t.dueDate) // due within next 7 days
                 .filter(t => {
                   const d = parseTimestamp(t.dueDate);
                   return d && d >= startOfToday && d < endOfWeek;
                 })
                 .filter(isPending);
    } else if (activeTab === 'inprogress') {
      list = list.filter(t => normalizeStatus(t.status) === 'in progress' && isPending(t));
    } else if (activeTab === 'overdue') {
      list = list.filter(t => t.dueDate && parseTimestamp(t.dueDate) < startOfToday && isPending(t));
    } else {
      // Unknown tab -> default to pending
      const pending = list.filter(isPending);
      list = pending.length ? pending : list.filter(isDone);
    }

    // sort by due date
    list.sort((a, b) => {
      const ad = parseTimestamp(a.dueDate) ? parseTimestamp(a.dueDate).getTime() : Infinity;
      const bd = parseTimestamp(b.dueDate) ? parseTimestamp(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });

    console.log('[Home] Filtered tasks for display:', list.length);
    // Show all tasks, not just 10 (removed slice limit for better visibility)
    return list;
  }, [tasks, activeTab]);

  // Weekly chart data (last 7 days)
  const chartData = useMemo(() => {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = new Array(7).fill(0);
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 6); // include today

    tasks.forEach(t => {
      // Only count tasks that are actually completed (status = 'done') AND have completedAt
      if (normalizeStatus(t.status) === 'done' && t.completedAt) {
        const d = parseTimestamp(t.completedAt);
        if (d && d >= start) counts[d.getDay()] += 1;
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

  const handleJoinProject = async (e) => {
    e.preventDefault();
    setError('');
    if (!joinCode) return setError('Enter project ID or invitation link.');
    try {
      let projId = joinCode.trim();
      const maybeUrl = (() => {
        try { return new URL(projId); } catch { return null; }
      })();
      if (maybeUrl) {
        const parts = maybeUrl.pathname.split('/').filter(Boolean);
        projId = parts[parts.length - 1];
      }

      const projRef = doc(db, 'projects', projId);
      const snap = await getDoc(projRef);
      if (!snap.exists()) return setError('Project not found. Check the ID or link.');

      await updateDoc(projRef, {
        members: arrayUnion(user.email),
        updatedAt: serverTimestamp()
      });
      setShowJoinModal(false);
      setJoinCode('');
      setToast('Joined project successfully');
      setTimeout(() => setToast(''), 2000);
    } catch (e) {
      setError(e.message);
    }
  };

  const savePersonalNote = async (value) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { personalNote: value }, { merge: true });
      setToast('Note saved');
      setTimeout(() => setToast(''), 1200);
    } catch (e) {
      setError(e.message);
    }
  };

  const markTaskComplete = async (task) => {
    try {
      const isDone = normalizeStatus(task.status) === 'done';
      const payload = isDone
        ? { status: 'to do', completedAt: deleteField() }
        : { status: 'done', completedAt: serverTimestamp() };
      await updateDoc(doc(db, 'tasks', task.id), payload);
      setToast(isDone ? 'Task set to To Do' : 'Task marked as complete');
      setTimeout(() => setToast(''), 1500);
      // Counts will automatically update when tasks listener fires
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
  const getProjectProgress = (project) => {
    // Prefer counts stored on the project doc (taskTotal/taskDone) for instant display
    const totalFromProject = typeof project.taskTotal === 'number' ? project.taskTotal : undefined;
    const doneFromProject = typeof project.taskDone === 'number' ? project.taskDone : undefined;
    const fallback = projectProgress[project.id] || { total: 0, done: 0 };
    const total = totalFromProject ?? fallback.total;
    const done = doneFromProject ?? fallback.done;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
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
          <button className="btn" style={{ background: '#21808D' }} onClick={() => setShowJoinModal(true)}>Join Project</button>
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
          const prog = getProjectProgress(p);
          return (
            <div key={p.id} className="card" style={{ border: '1px solid #eee', borderRadius: 12, transition: 'box-shadow .2s, transform .2s', cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}`)} onMouseEnter={(e)=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={(e)=>{e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: colors.charcoal }}>{p.name}</h3>
                <Badge>{(p.members?.length || 0) + 1} members</Badge>
              </div>
              <div style={{ color: '#6B7280', marginTop: 6 }}>{p.description}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>Owner: {p.ownerName || p.ownerEmail}</div>
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${prog.pct}%`, height: '100%', background: colors.teal, borderRadius: 999, transition: 'width .3s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                  {prog.total === 0 && (typeof p.taskTotal !== 'number') ? 'Calculating…' : `${prog.done}/${prog.total} tasks · ${prog.pct}% complete`}
                </div>
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
      <div className="dashboard-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1fr',
        gap: 16
      }}>
        {/* My Tasks List */}
        <div className="card" style={{ borderRadius: 12, border: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, borderBottom: '1px solid #F3F4F6', paddingBottom: 8, alignItems: 'center' }}>
            {[
              { key: 'pending', label: 'Pending' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'inprogress', label: 'In Progress' },
              { key: 'overdue', label: 'Overdue' },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                background: activeTab === t.key ? colors.teal : 'transparent',
                color: activeTab === t.key ? 'white' : colors.charcoal,
                border: `1px solid ${activeTab === t.key ? colors.teal : '#E5E7EB'}`,
                padding: '6px 10px', borderRadius: 999, cursor: 'pointer'
              }}>{t.label}</button>
            ))}
            <div style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>
              ({filteredTasks.length} of {tasks.length} tasks)
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn" style={{ background: '#1a6b7a' }} onClick={() => navigate('/tasks')}>View All</button>
            </div>
          </div>

          {!tasksLoaded ? (
            <div style={{ color: '#6B7280' }}>Loading tasks…</div>
          ) : activeTab === 'pending' && !hasPending && tasks.length > 0 ? (
            <div style={{ color: '#6B7280' }}>All tasks are completed 🎉</div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ color: '#6B7280' }}>No pending tasks - You're all caught up! 🎉</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredTasks.map(task => {
                const due = task.dueDate ? parseTimestamp(task.dueDate) : null;
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
                    <input 
                      type="checkbox" 
                      checked={normalizeStatus(task.status) === 'done'} 
                      onChange={() => markTaskComplete(task)} 
                    />
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
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Weekly Activity</h3>
          {chartData.datasets[0].data.every(v => v === 0) ? (
            <div style={{ color: '#6B7280', textAlign: 'center', padding: 20 }}>No activity in the last 7 days yet.</div>
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>

        {/* Personal Notes */}
        <div className="card personal-notes-section" style={{ borderRadius: 12, border: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Personal Notes</h3>
            <button 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: 12 }} 
              onClick={() => savePersonalNote(personalNote)}
            >
              Save
            </button>
          </div>
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="Jot down quick thoughts, reminders, or notes..."
            rows={12}
            style={{ 
              width: '100%', 
              padding: 12, 
              borderRadius: 8, 
              border: '1px solid #E5E7EB',
              fontSize: 14,
              lineHeight: 1.4,
              resize: 'vertical',
              minHeight: '200px'
            }}
          />
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
            💡 Notes are saved automatically when you click Save
          </div>
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

      {/* Join Project Modal */}
      {showJoinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>Join Project</h3>
            {error && <div style={{ color: '#b00020', background: '#ffe8e8', padding: 8, borderRadius: 6 }}>{error}</div>}
            <form onSubmit={handleJoinProject}>
              <label>Project ID or Invitation Link</label>
              <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E5E7EB', margin: '6px 0 12px' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" style={{ background: '#6B7280' }} onClick={()=>setShowJoinModal(false)}>Cancel</button>
                <button type="submit" className="btn">Join</button>
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
        @media (max-width: 1200px) {
          .dashboard-main-grid { 
            grid-template-columns: 1fr 1fr !important; 
          }
          .dashboard-main-grid .personal-notes-section {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 768px) {
          .dashboard-main-grid { 
            grid-template-columns: 1fr !important; 
          }
        }
      `}</style>
    </div>
  );
};

export default Home;