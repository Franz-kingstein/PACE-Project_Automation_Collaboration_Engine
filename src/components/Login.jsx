import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
  const cred = await signInWithEmailAndPassword(auth, email, password);
      // Upsert minimal user doc on login
      const u = cred.user;
      await setDoc(doc(db, 'users', u.uid), {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || displayName || '',
        photoURL: u.photoURL || '',
        provider: 'password',
        lastLoginAt: serverTimestamp()
      }, { merge: true });
  navigate('/home');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: displayName || cred.user.displayName || '',
        photoURL: cred.user.photoURL || '',
        provider: 'password',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      }, { merge: true });
  navigate('/home');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    try {
  const cred = await signInWithPopup(auth, googleProvider);
      const u = cred.user;
      await setDoc(doc(db, 'users', u.uid), {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || '',
        photoURL: u.photoURL || '',
        provider: 'google',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      }, { merge: true });
  navigate('/home');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Enter your email to reset password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo('Password reset email sent.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#FCFCF9',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1100px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
      }}>
        {/* Left: Video / Visual */}
        <div style={{ position: 'relative', background: '#5E2BFF' }}>
          <video
            src={'/Login_animation.mp4'}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35))'
          }} />
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            color: 'white'
          }}>
            <h2 style={{ margin: 0 }}>Start Your Journey With Us</h2>
            <p style={{ marginTop: 8, opacity: 0.9 }}>Keep Your Team in Sync.</p>
          </div>
        </div>

  {/* Right: Login / Sign Up Form */}
        <div style={{ padding: '40px 48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <img
                src="/logo.png"
                alt="PACE logo"
                style={{ width: 256, height: 128, borderRadius: '12px', objectFit: 'contain' }}
              />
              <h2 style={{ margin: '12px 0 4px', color: '#1F2121' }}>{isSignUp ? 'Create your account' : 'Login to Your Account'}</h2>
            </div>

            {error && (
              <div className="card" style={{ background: '#ffe8e8', color: '#b00020' }}>{error}</div>
            )}
            {info && (
              <div className="card" style={{ background: '#e7f6ef', color: '#0f5132' }}>{info}</div>
            )}

            <form onSubmit={isSignUp ? handleEmailSignUp : handleEmailLogin}>
              {isSignUp && (
                <>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Full name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid #E5E7EB',
                      marginBottom: 14
                    }}
                  />
                </>
              )}
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  marginBottom: 14
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Password</label>
                {!isSignUp && (
                  <button type="button" onClick={handleForgotPassword} style={{
                    background: 'none', border: 'none', color: '#21808D', cursor: 'pointer', fontSize: 12
                  }}>Forgot Password?</button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  marginBottom: 16
                }}
              />

              <button type="submit" className="btn" style={{ width: '100%' }}>
                {isSignUp ? 'Create Account' : 'Login'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Or {isSignUp ? 'continue with' : 'Login With'}</span>
              <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            </div>

            <button onClick={handleGoogleSignIn} className="btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span role="img" aria-label="google" style={{ fontSize: 28, lineHeight: 1 }}>🇬</span>
              Sign in with Google
            </button>

            <p style={{ marginTop: 16, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
              {isSignUp ? (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => setIsSignUp(false)} style={{ background: 'none', border: 'none', color: '#21808D', cursor: 'pointer' }}>Sign In</button>
                </>
              ) : (
                <>Don’t have an account?{' '}
                  <button type="button" onClick={() => setIsSignUp(true)} style={{ background: 'none', border: 'none', color: '#21808D', cursor: 'pointer' }}>Sign Up</button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Responsive: stack on small screens */}
      <style>{`
        @media (max-width: 900px) {
          .login-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
