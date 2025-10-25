import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const ProjectView = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'projects', projectId), (snap) => {
      setProject({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [projectId]);

  if (!project) return <div style={{ padding: 24 }}>Loading project...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>{project.name}</h2>
      <p>{project.description}</p>
    </div>
  );
};

export default ProjectView;
