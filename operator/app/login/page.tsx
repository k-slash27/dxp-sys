'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(username, password);
      if (ok) {
        router.push('/dashboard');
      } else {
        setError('ユーザー名またはパスワードが正しくありません');
      }
    } catch {
      setError('ログイン中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#333', letterSpacing: '-0.4px' }}>DXP Operator</h1>
          <p style={{ fontSize: '13px', color: '#71717a', marginTop: '6px' }}>ドローン撮影画像アップロード・管理システム</p>
        </div>
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '400', color: '#52525b', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ログイン</h2>
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="username" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3f3f46', marginBottom: '5px' }}>ユーザー名</label>
              <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="form-input" required disabled={loading} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3f3f46', marginBottom: '5px' }}>パスワード</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="form-input" required disabled={loading} />
            </div>
            {error && (
              <div role="alert" style={{ marginBottom: '14px', padding: '9px 12px', backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '7px', fontSize: '13px', color: '#991b1b', fontWeight: '500', display: 'flex', gap: '7px' }}>
                <span>⚠</span><span>{error}</span>
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', fontSize: '14px', padding: '11px 16px' }}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
