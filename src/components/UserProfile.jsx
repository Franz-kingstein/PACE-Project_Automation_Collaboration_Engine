import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserProfile = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div style={{ padding: 24 }}>
      <h2>Profile</h2>
      <img src={user.photoURL || '/default-avatar.png'} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%' }} />
      <div><strong>Name:</strong> {user.displayName || '—'}</div>
      <div><strong>Email:</strong> {user.email}</div>
    </div>
  );
};

export default UserProfile;
