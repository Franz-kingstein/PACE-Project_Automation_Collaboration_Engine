# PACE Quick Start Guide for Developers

**Last Updated:** October 28, 2025

---

## 🚀 Get Running in 5 Minutes

### 1. Clone & Install (2 min)
```bash
git clone https://github.com/Franz-kingstein/PACE-Project_Automation_-_Collaboration_Engine.git
cd pace-app
npm install
```

### 2. Setup Firebase (2 min)
Create `.env` file in project root:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 3. Start Dev Server (1 min)
```bash
npm start
```

App opens at `http://localhost:3000` ✅

---

## 📁 File Structure Quick Reference

```
src/components/
├── Home.jsx ⭐ (Main dashboard - 850 lines)
│   ├── calculateTaskCounts() - Dashboard metrics
│   ├── parseTimestamp() - Unified timestamp parser
│   ├── normalizeStatus() - Status standardizer
│   ├── 6 useEffect hooks (Auth, Projects, Tasks, Counts, etc)
│   └── Complete JSX UI rendering
│
├── Tasks.jsx - Task creation/edit
├── TaskBoard.jsx - Project task board
├── Project.jsx - Project details
└── ... other components

src/
├── firebase.js - Firebase initialization
├── App.js - Root component
├── index.js - Entry point
└── App.css - Global styles
```

---

## 🔑 Key Code Locations

### Dashboard Counts Logic
**File:** `src/components/Home.jsx`  
**Lines:** 35-66  
**Function:** `calculateTaskCounts(tasksArray)`

```javascript
// Shows: To Do, In Progress, Completed Today
const counts = calculateTaskCounts(tasks);
```

### Real-Time Task Listener
**File:** `src/components/Home.jsx`  
**Lines:** 240-320  
**Pattern:** Three onSnapshot queries + deduplication

```javascript
// Automatically updates when Firestore changes
const unsub1 = onSnapshot(qById, (snap) => { ... });
```

### Task Filtering
**File:** `src/components/Home.jsx`  
**Lines:** 370-410  
**Tabs:** Pending, Today, Week, In Progress, Overdue

```javascript
// Filter by activeTab state
if (activeTab === 'today') { ... }
```

### Chart Data Generation
**File:** `src/components/Home.jsx`  
**Lines:** 430-460  
**Function:** `chartData` useMemo

```javascript
// Weekly completed tasks bar chart
tasks.forEach(t => {
  if (normalizeStatus(t.status) === 'done' && t.completedAt) {
    counts[d.getDay()] += 1;
  }
});
```

---

## 🎯 Common Tasks

### Add a New Dashboard Metric

**Step 1:** Create state variable
```javascript
const [newMetric, setNewMetric] = useState(0);
```

**Step 2:** Add calculation in `calculateTaskCounts()`
```javascript
function calculateTaskCounts(tasksArray) {
  let newMetric = 0;
  tasksArray.forEach((t) => {
    if (/* your condition */) newMetric++;
  });
  return { toDoCount, inProgressCount, completedTodayCount, newMetric };
}
```

**Step 3:** Update the effect that calls it
```javascript
useEffect(() => {
  const counts = calculateTaskCounts(tasks);
  // ... existing updates ...
  setNewMetric(counts.newMetric); // ADD THIS
}, [tasks]);
```

**Step 4:** Render the metric card
```javascript
<div className="card" style={{ /* card styles */ }}>
  <div>New Metric</div>
  <div style={{ fontSize: 24 }}>{newMetric}</div>
</div>
```

### Create a New Task Tab Filter

**File:** `src/components/Home.jsx`

**Step 1:** Add button in filter tabs
```javascript
{ key: 'myfilter', label: 'My Filter' },
```

**Step 2:** Add filter logic in `filteredTasks` useMemo
```javascript
} else if (activeTab === 'myfilter') {
  list = list.filter(t => {
    // Your filter condition
    return true; // Include this task
  });
}
```

**Step 3:** Verify it works
- Click the tab
- Check console: `[Home] Filtered tasks for display: X`

### Update Task in Firestore

**File:** `src/components/Home.jsx` (Around line 700)

```javascript
const updateTaskStatus = async (taskId, newStatus) => {
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    setToast('Task updated');
  } catch (e) {
    setError(e.message);
  }
};
```

---

## 🐛 Debugging Tips

### Check Task Data Flow
1. Open DevTools Console
2. Look for logs:
   - `[Home] Tasks merged:` - How many tasks loaded
   - `[Home] ALL TASK STATUSES FROM DB:` - Task status mapping
   - `[calculateTaskCounts] counts ->` - Dashboard metrics

### Verify Counts Are Correct
```javascript
// In DevTools Console
db.collection('tasks')
  .where('assigneeId', '==', auth.currentUser.uid)
  .get()
  .then(snap => {
    console.log('Total tasks:', snap.size);
    const done = snap.docs.filter(d => d.data().status === 'done').length;
    console.log('Done tasks:', done);
  });
```

### Test Timestamp Parsing
```javascript
// In DevTools Console
parseTimestamp(new Date());
parseTimestamp({seconds: 1700000000});
parseTimestamp('2025-10-28');
```

### Test Status Normalization
```javascript
// In DevTools Console
normalizeStatus('TO DO');      // 'to do'
normalizeStatus('inprogress'); // 'in progress'
normalizeStatus('DONE');       // 'done'
```

---

## 📊 Data Model Reference

### Task Fields
```javascript
{
  id: 'task_123',
  title: 'Fix login bug',
  description: 'Users cannot reset password',
  status: 'in progress',        // "to do", "in progress", "done"
  priority: 'high',             // "low", "medium", "high"
  dueDate: Timestamp,           // Firestore Timestamp
  projectId: 'proj_456',
  assigneeId: 'user_789',       // Firebase Auth UID
  assigneeEmail: 'user@ex.com',
  completedAt: Timestamp,       // When marked done
  projectName: 'Backend',       // For display
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### Project Fields
```javascript
{
  id: 'proj_123',
  name: 'Website Redesign',
  description: 'Modernize the landing page',
  ownerEmail: 'owner@example.com',
  ownerName: 'John Doe',
  members: ['dev@ex.com', 'designer@ex.com'],
  taskTotal: 15,                // Total tasks in project
  taskDone: 8,                  // Completed tasks
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## 🔗 Firebase Queries Used

### Query 1: Tasks by Assignee ID (Preferred)
```javascript
const q = query(
  collection(db, 'tasks'),
  where('assigneeId', '==', user.uid)
);
```
**Why:** Most reliable, uses Firebase Auth UID

### Query 2: Tasks by Assignee Email (Alternative)
```javascript
const q = query(
  collection(db, 'tasks'),
  where('assigneeEmail', '==', user.email)
);
```
**Why:** Fallback if assigneeId not set

### Query 3: Tasks by Legacy Assignee (Backward Compat)
```javascript
const q = query(
  collection(db, 'tasks'),
  where('assignee', '==', user.email)
);
```
**Why:** Supports old data migrations

### Query 4: Projects by Owner
```javascript
const q = query(
  collection(db, 'projects'),
  where('ownerEmail', '==', user.email)
);
```

### Query 5: Projects by Member
```javascript
const q = query(
  collection(db, 'projects'),
  where('members', 'array-contains', user.email)
);
```

---

## 🎨 Styling

### Color Palette
```javascript
const colors = {
  teal: '#21808D',      // Primary (buttons, accents)
  cream: '#FCFCF9',     // Background
  charcoal: '#1F2121',  // Text
  white: '#FFFFFF',
  orange: '#F59E0B',    // To Do indicator
  blue: '#2563EB',      // In Progress indicator
  green: '#10B981',     // Done indicator
};
```

### Card Component
```javascript
className="card" style={{
  borderRadius: 12,
  border: '1px solid #eee',
  padding: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}}
```

### Button Component
```javascript
className="btn" style={{
  background: colors.teal,
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: 6,
  cursor: 'pointer',
}}
```

---

## 🧪 Testing Workflow

### Test 1: Dashboard Counts
```bash
# Steps:
1. Create 3 tasks (statuses: "to do", "in progress", "done")
2. Open DevTools Console
3. Look for: [calculateTaskCounts] counts ->
4. Verify: toDoCount=1, inProgressCount=1, completedTodayCount=1
5. Mark one as complete
6. Verify counts update instantly
```

### Test 2: Real-Time Sync
```bash
# Steps:
1. Open app in 2 browser windows (same account)
2. In Window 1: Mark task complete
3. In Window 2: Watch for update (should be instant)
4. Check Network tab: Should see Firestore sync
```

### Test 3: Task Filtering
```bash
# Steps:
1. Create tasks with different due dates
2. Switch between tabs (Today, Week, Pending, etc)
3. Check Console: [Home] Filtered tasks for display
4. Verify correct tasks appear for each filter
```

### Test 4: Project Progress
```bash
# Steps:
1. Create project with 5 tasks
2. Mark 2 as complete
3. Verify progress bar shows 40%
4. Create another task
5. Verify progress recalculates (2/6 = 33%)
```

---

## 📝 Code Conventions

### Naming
```javascript
// ✅ Good
const toDoCount = 5;
const isTaskCompleted = (t) => { ... };
const handleJoinProject = async () => { ... };

// ❌ Avoid
const todo_count = 5;
const checkIfTaskDone = (t) => { ... };
const joinProject = async () => { ... }; // Ambiguous
```

### Functions
```javascript
// ✅ Arrow functions for callbacks
const handleClick = () => { ... };

// ✅ Regular functions for helpers
function calculateTaskCounts(tasks) { ... }

// ✅ Async for Firebase operations
const updateTask = async (id, data) => { ... };
```

### Comments
```javascript
// ✅ Explain WHY, not WHAT
// Only count pending tasks to exclude already-completed ones
if (!completed) toDoCount++;

// ❌ Obvious
// Increment to do count
toDoCount++;
```

### Error Handling
```javascript
// ✅ User-friendly messages
catch (e) {
  setError('Failed to update task. Please try again.');
  console.error('[updateTask] Error:', e);
}

// ❌ Technical jargon
catch (e) {
  setError(e.message); // Users don't understand "PERMISSION_DENIED"
}
```

---

## 🚀 Performance Tips

### Use useMemo for Expensive Operations
```javascript
// ✅ Good - only recalculates when tasks change
const filteredTasks = useMemo(() => {
  return tasks.filter(t => /* complex filter */);
}, [tasks]);

// ❌ Bad - recalculates on every render
const filteredTasks = tasks.filter(t => /* complex filter */);
```

### Batch Firestore Updates
```javascript
// ✅ Good - updates multiple docs efficiently
const batch = writeBatch(db);
tasks.forEach(t => {
  if (/* condition */) {
    batch.update(doc(db, 'tasks', t.id), { status: 'done' });
  }
});
await batch.commit();

// ❌ Avoid - separate update for each task (slow)
tasks.forEach(async (t) => {
  await updateDoc(doc(db, 'tasks', t.id), { status: 'done' });
});
```

### Limit Real-Time Listeners
```javascript
// ✅ Good - specific query
const q = query(
  collection(db, 'tasks'),
  where('assigneeId', '==', user.uid)
);

// ❌ Bad - listens to ALL tasks
const q = collection(db, 'tasks');
```

---

## 🆘 Common Errors & Fixes

### "Cannot read property 'toDate' of undefined"
**Cause:** Firestore Timestamp not parsed correctly
**Fix:**
```javascript
// Use parseTimestamp()
const date = parseTimestamp(t.completedAt);
// Not:
const date = t.completedAt.toDate(); // Might fail
```

### "Tasks not updating in real-time"
**Cause:** Listeners not set up correctly
**Fix:**
1. Check console for `[Home] Tasks merged:`
2. Verify onSnapshot is subscribed
3. Check Firestore Security Rules

### "Dashboard counts always show 0"
**Cause:** Status not normalized or tasks not loaded
**Fix:**
1. Check console: `[calculateTaskCounts] counts ->`
2. Verify: `[Home] ALL TASK STATUSES FROM DB:`
3. Check `normalizeStatus()` logic

---

## 📚 Resources

- **Firebase Docs:** https://firebase.google.com/docs
- **React Docs:** https://react.dev
- **Firestore Guide:** https://firebase.google.com/docs/firestore
- **Chart.js:** https://www.chartjs.org

---

## 💡 Pro Tips

1. **Always cleanup listeners:**
   ```javascript
   return () => { unsub1(); unsub2(); unsub3(); };
   ```

2. **Use server timestamps:**
   ```javascript
   createdAt: serverTimestamp(), // NOT new Date()
   ```

3. **Batch related updates:**
   ```javascript
   status: 'done',
   completedAt: serverTimestamp(),
   updatedAt: serverTimestamp(), // All in one update
   ```

4. **Log strategically:**
   ```javascript
   console.log('[functionName] key_info:', value);
   // Makes debugging grep-able
   ```

5. **Test with real data:**
   ```javascript
   // Don't just test happy path - try edge cases
   // Empty arrays, missing fields, null values, etc.
   ```

---

## 🎓 Learning Path

1. **Week 1:** Understand React Hooks (useState, useEffect, useMemo)
2. **Week 2:** Learn Firestore (collections, documents, queries)
3. **Week 3:** Study real-time listeners (onSnapshot)
4. **Week 4:** Explore Home.jsx implementation
5. **Week 5:** Contribute features or fixes

---

**Questions?** Check the comprehensive README or GitHub Issues!

Happy coding! 🚀
