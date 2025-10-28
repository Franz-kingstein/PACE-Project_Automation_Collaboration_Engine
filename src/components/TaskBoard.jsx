import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { collection, addDoc, onSnapshot, updateDoc, doc, query, where, serverTimestamp, Timestamp, deleteField, increment, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

function normalizeStatus(s) {
  if (!s) return '';
  const t = String(s).toLowerCase();
  if (t.includes('in progress') || t.replace(/\s+/g, '') === 'inprogress') return 'in progress';
  if (t.includes('to do') || t.replace(/\s+/g, '') === 'todo') return 'to do';
  if (t.includes('done') || t.includes('complete')) return 'done';
  return t;
}

const TaskCard = ({ task, onUpdateStatus }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    high: 'red',
    medium: 'orange',
    low: 'green'
  };

  const handleCheckboxChange = async (e) => {
    // Prevent drag listeners from hijacking the click/change
    try { e.stopPropagation(); } catch {}
    // If checked, always mark as Done (move card to Done column)
    if (e?.target?.checked) {
      await onUpdateStatus(task.id, 'done');
    } else {
      // If unchecked, revert to the previous status when available, else fall back to 'to do'
      const fallback = normalizeStatus(task.prevStatus) || 'to do';
      await onUpdateStatus(task.id, fallback);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`dnd-card${isDragging ? ' dragging' : ''}`}
      style={{
        ...style,
        backgroundColor: 'white',
        padding: '10px',
        margin: '10px 0',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderLeft: `5px solid ${priorityColors[task.priority]}`,
        cursor: 'grab'
      }}
      {...attributes}
      {...listeners}
    >
      <h4>{task.title}</h4>
      <p>Assignee: {task.assigneeName || task.assigneeEmail || task.assignee || 'Unassigned'}</p>
      <p>Priority: <span style={{ color: priorityColors[task.priority] }}>{task.priority}</span></p>
      <p>Due: {task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000).toLocaleDateString() : (task.dueDate || '')}</p>
      <div style={{ margin: '8px 0' }}>
        <label style={{ fontSize: 12, marginRight: 8 }}>Status:</label>
        <select
          value={normalizeStatus(task.status)}
          onChange={(e) => onUpdateStatus(task.id, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="to do">To Do</option>
          <option value="in progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <label
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={normalizeStatus(task.status) === 'done'}
          onChange={handleCheckboxChange}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
        Completed
      </label>
    </div>
  );
};

const Column = ({ id, title, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`kanban-column${isOver ? ' is-over' : ''}`}
      style={{ flex: 1, backgroundColor: 'white', padding: '10px', borderRadius: '10px', minHeight: '400px' }}
    >
      <h3 style={{ textAlign: 'center', textTransform: 'capitalize' }}>{title}</h3>
      {children}
    </div>
  );
};

const TaskBoard = ({ projectId }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    assignee: '',
    priority: 'low',
    dueDate: '',
    status: 'to do'
  });
  const [members, setMembers] = useState([]); // { uid, email, displayName, photoURL }
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [projectMeta, setProjectMeta] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 } // require slight movement to start drag so clicks work
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const colRef = collection(db, 'tasks');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const tasksData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => !projectId || t.projectId === projectId);
      setTasks(tasksData);
    });
    return unsubscribe;
  }, [projectId]);

  // Load project members and their user profiles when in a project
  useEffect(() => {
    if (!projectId) return;
    const projRef = doc(db, 'projects', projectId);
    const unsub = onDocSnapshot(projRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setProjectMeta({ name: data.name });
  const rawEmails = [data.ownerEmail, ...(data.members || [])].filter(Boolean);
  const emails = Array.from(new Set(rawEmails.map(e => String(e).toLowerCase())));
  // Try to fetch user docs by email (limit 10 for 'in' queries)
  let list = emails.map(e => ({ email: e, displayName: e }));
      try {
        if (emails.length && emails.length <= 10) {
          const usersCol = collection(db, 'users');
          const qUsers = query(usersCol, where('email', 'in', emails));
          const unsubUsers = onSnapshot(qUsers, (qs) => {
            const enriched = qs.docs.map(d => ({ uid: d.id, ...(d.data() || {}) }));
            // Merge with emails to ensure all appear
    const map = new Map(enriched.map(u => [String(u.email).toLowerCase(), u]));
    const final = emails.map(e => map.get(e) || { email: e, displayName: e });
            setMembers(final);
          });
          return () => unsubUsers();
        } else {
          setMembers(list);
        }
      } catch {
        setMembers(list);
      }
    });
    return unsub;
  }, [projectId]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    const assignee = selectedAssignee;
    if (newTask.title && assignee && newTask.dueDate) {
      // convert dueDate to Timestamp
      const due = Timestamp.fromDate(new Date(newTask.dueDate));
      const payload = {
        title: newTask.title,
        priority: newTask.priority,
        status: normalizeStatus(newTask.status) || 'to do',
        dueDate: due,
        assigneeId: assignee.uid || null,
        assigneeEmail: assignee.email || null,
        assigneeName: assignee.displayName || assignee.email || null,
        createdAt: serverTimestamp(),
        ...(projectId ? { projectId, projectName: projectMeta?.name || '' } : {})
      };
      await addDoc(collection(db, 'tasks'), payload);
      // Update project counters for immediate Home progress
      if (projectId) {
        try {
          await updateDoc(doc(db, 'projects', projectId), {
            taskTotal: increment(1),
            updatedAt: serverTimestamp(),
          });
        } catch {}
      }
      setNewTask({ title: '', assignee: '', priority: 'low', dueDate: '', status: 'to do' });
      setSelectedAssignee(null);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    // When dropping over a task card, use its containerId (column id). Otherwise use the droppable id directly.
    const containerId = over?.data?.current?.sortable?.containerId;
    const targetId = containerId || (typeof over.id === 'string' ? over.id : '');
    const normalized = normalizeStatus(targetId);
    const allowed = ['to do', 'in progress', 'done'];
    if (!allowed.includes(normalized)) return; // ignore accidental drops not over a column
    await updateStatus(taskId, normalized);
  };

  const updateStatus = async (taskId, status) => {
    const normalized = normalizeStatus(status);
    const allowed = ['to do', 'in progress', 'done'];
    if (!allowed.includes(normalized)) return; // safety guard
    const payload = { status: normalized };
    const clientTimestamp = new Date();
    // Determine previous status from current tasks state for reversible transitions
    const prev = tasks.find((t) => t.id === taskId);
    const prevStatus = normalizeStatus(prev?.status);
    if (normalized === 'done') {
      payload.completedAt = serverTimestamp();
      payload.completedAtClient = clientTimestamp;
      if (prevStatus && prevStatus !== 'done') {
        payload.prevStatus = prevStatus; // remember where it came from (to do / in progress)
      }
    } else {
      payload.completedAt = deleteField();
      payload.completedAtClient = deleteField();
      payload.prevStatus = deleteField();
    }
    // Optimistic update: move in UI immediately
    const optimistic = {
      ...payload,
      completedAt: normalized === 'done' ? { seconds: Math.floor(clientTimestamp.getTime() / 1000) } : null,
    };
    setTasks(prevList => prevList.map(t => (t.id === taskId ? { ...t, ...optimistic } : t)));
    // Write to Firestore
    try {
      await updateDoc(doc(db, 'tasks', taskId), payload);
    } catch (err) {
      // Revert on failure
      setTasks(prevList => prevList.map(t => (t.id === taskId ? { ...t, status: prevStatus } : t)));
      return;
    }
    // If part of a project, adjust counters when moving into or out of 'done'
    if (projectId) {
      try {
        const projectRef = doc(db, 'projects', projectId);
        const wasDone = prev && normalizeStatus(prev.status) === 'done';
        if (!wasDone && normalized === 'done') {
          await updateDoc(projectRef, { taskDone: increment(1), updatedAt: serverTimestamp() });
        } else if (wasDone && normalized !== 'done') {
          await updateDoc(projectRef, { taskDone: increment(-1), updatedAt: serverTimestamp() });
        }
      } catch {}
    }
  // Local state already updated optimistically above
  };

  const columns = {
    'to do': tasks.filter(task => normalizeStatus(task.status) === 'to do'),
    'in progress': tasks.filter(task => normalizeStatus(task.status) === 'in progress'),
    'done': tasks.filter(task => normalizeStatus(task.status) === 'done')
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#FCFCF9', minHeight: '100vh' }}>
      <h1>Task Board</h1>

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} style={{ marginBottom: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '10px' }}>
        <input
          type="text"
          placeholder="Task Title"
          value={newTask.title}
          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          required
          style={{ margin: '5px', padding: '10px', width: '200px' }}
        />
        {projectId ? (
          <select
            value={selectedAssignee?.email || ''}
            onChange={(e) => {
              const m = members.find(u => u.email === e.target.value);
              setSelectedAssignee(m || null);
            }}
            required
            style={{ margin: '5px', padding: '10px', width: '220px' }}
          >
            <option value="">Assign to…</option>
            {members.map((m, i) => (
              <option key={`${m.email || 'unknown'}-${m.uid || i}`} value={m.email}>
                {m.displayName || m.email}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="email"
            placeholder="Assignee Email"
            value={newTask.assignee}
            onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
            required
            style={{ margin: '5px', padding: '10px', width: '220px' }}
          />
        )}
        <select
          value={newTask.priority}
          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
          style={{ margin: '5px', padding: '10px' }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          value={newTask.dueDate}
          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
          required
          style={{ margin: '5px', padding: '10px' }}
        />
        <button type="submit" style={{ margin: '5px', padding: '10px', backgroundColor: '#21808D', color: 'white', border: 'none', borderRadius: '5px' }}>Add Task</button>
      </form>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="kanban-board" style={{ display: 'flex', gap: '20px', justifyContent: 'space-around' }}>
          {Object.entries(columns).map(([status, columnTasks]) => (
            <Column key={status} id={status} title={status}>
              <SortableContext id={status} items={columnTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                {columnTasks.map(task => (
                  <TaskCard key={`${task.id}-${normalizeStatus(task.status)}`} task={task} onUpdateStatus={updateStatus} />
                ))}
              </SortableContext>
            </Column>
          ))}
        </div>
      </DndContext>
    </div>
  );
};

export default TaskBoard;
