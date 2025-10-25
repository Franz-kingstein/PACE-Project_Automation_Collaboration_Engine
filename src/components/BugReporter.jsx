import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';

const BugReporter = () => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'low',
    screenshot: null
  });
  const [bugs, setBugs] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bugs'), (snapshot) => {
      const bugsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBugs(bugsData);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) return;

    setUploading(true);
    let screenshotUrl = '';
    if (form.screenshot) {
      const storageRef = ref(storage, `screenshots/${Date.now()}_${form.screenshot.name}`);
      await uploadBytes(storageRef, form.screenshot);
      screenshotUrl = await getDownloadURL(storageRef);
    }

    const bugData = {
      title: form.title,
      description: form.description,
      severity: form.severity,
      screenshotUrl,
      status: 'Open',
      browserInfo: navigator.userAgent,
      timestamp: new Date(),
      userEmail: auth.currentUser?.email || 'Anonymous'
    };

    await addDoc(collection(db, 'bugs'), bugData);
    setForm({ title: '', description: '', severity: 'low', screenshot: null });
    setUploading(false);
  };

  const statusColors = {
    Open: 'red',
    'In Progress': 'orange',
    Resolved: 'green'
  };

  const filteredBugs = filterSeverity === 'all' ? bugs : bugs.filter(bug => bug.severity === filterSeverity);

  return (
    <div style={{ padding: '20px', backgroundColor: '#FCFCF9', minHeight: '100vh' }}>
      <h1>Bug Reporter</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Bug Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%' }}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', height: '100px' }}
        />
        <select
          value={form.severity}
          onChange={(e) => setForm({ ...form, severity: e.target.value })}
          style={{ display: 'block', margin: '10px 0', padding: '10px' }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setForm({ ...form, screenshot: e.target.files[0] })}
          style={{ display: 'block', margin: '10px 0' }}
        />
        <button type="submit" disabled={uploading} style={{
          padding: '10px 20px',
          backgroundColor: '#21808D',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: uploading ? 'not-allowed' : 'pointer'
        }}>
          {uploading ? 'Submitting...' : 'Report Bug'}
        </button>
      </form>

      {/* Filter */}
      <div style={{ marginBottom: '20px' }}>
        <label>Filter by Severity: </label>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
          <option value="all">All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Bugs List */}
      <div>
        {filteredBugs.map(bug => (
          <div key={bug.id} style={{
            backgroundColor: 'white',
            padding: '15px',
            margin: '10px 0',
            borderRadius: '10px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3>{bug.title}</h3>
            <p>{bug.description}</p>
            <p>Severity: {bug.severity}</p>
            <p>Status: <span style={{
              backgroundColor: statusColors[bug.status],
              color: 'white',
              padding: '2px 8px',
              borderRadius: '5px'
            }}>{bug.status}</span></p>
            <p>Reported by: {bug.userEmail}</p>
            <p>Timestamp: {bug.timestamp?.toDate().toLocaleString()}</p>
            {bug.screenshotUrl && <img src={bug.screenshotUrl} alt="Screenshot" style={{ maxWidth: '200px' }} />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BugReporter;
