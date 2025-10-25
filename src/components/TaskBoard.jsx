import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { collection, addDoc, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const TaskCard = ({ task, onUpdate }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    high: 'red',
    medium: 'orange',
    low: 'green'
  };

  const handleCheckboxChange = async () => {
    const newStatus = task.status === 'done' ? 'to do' : 'done';
    await updateDoc(doc(db, 'tasks', task.id), { status: newStatus });
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: 'white',
        padding: '10px',
        margin: '10px 0',
        borderRadius: '5px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderLeft: `5px solid ${priorityColors[task.priority]}`,
        cursor: 'grab'
      }}
      {...attributes}
      {...listeners}
    >
      <h4>{task.title}</h4>
      <p>Assignee: {task.assignee}</p>
      <p>Priority: <span style={{ color: priorityColors[task.priority] }}>{task.priority}</span></p>
      <p>Due: {task.dueDate}</p>
      <label>
        <input type="checkbox" checked={task.status === 'done'} onChange={handleCheckboxChange} />
        Completed
      </label>
    </div>
  );
};

const TaskBoard = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    assignee: '',
    priority: 'low',
    dueDate: '',
    status: 'to do'
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(tasksData);
    });
    return unsubscribe;
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (newTask.title && newTask.assignee && newTask.dueDate) {
      await addDoc(collection(db, 'tasks'), newTask);
      setNewTask({ title: '', assignee: '', priority: 'low', dueDate: '', status: 'to do' });
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id; // Assuming column ids are 'to-do', 'in-progress', 'done'

    await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
  };

  const columns = {
    'to do': tasks.filter(task => task.status === 'to do'),
    'in progress': tasks.filter(task => task.status === 'in progress'),
    'done': tasks.filter(task => task.status === 'done')
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
        <input
          type="text"
          placeholder="Assignee"
          value={newTask.assignee}
          onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
          required
          style={{ margin: '5px', padding: '10px', width: '200px' }}
        />
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
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'space-around' }}>
          {Object.entries(columns).map(([status, columnTasks]) => (
            <div key={status} style={{ flex: 1, backgroundColor: 'white', padding: '10px', borderRadius: '10px', minHeight: '400px' }}>
              <h3 style={{ textAlign: 'center', textTransform: 'capitalize' }}>{status}</h3>
              <SortableContext items={columnTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                {columnTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </SortableContext>
            </div>
          ))}
        </div>
      </DndContext>
    </div>
  );
};

export default TaskBoard;
