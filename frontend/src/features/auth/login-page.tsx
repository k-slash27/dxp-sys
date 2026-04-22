import React, { useState } from 'react';
import styles from '@/styles/login.module.css';
import PasswordReset from './password-reset';

interface LoginPageProps {
    onLogin: (userInfo: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPasswordReset, setShowPasswordReset] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        localStorage.removeItem('dxp_user');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                const userInfo = await res.json();
                localStorage.setItem('dxp_user', JSON.stringify(userInfo));
                onLogin(userInfo);
            } else {
                const data = await res.json();
                setError(data.error || 'ログインに失敗しました');
            }
        } catch (err) {
            setError('ネットワークエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginContainer}>
            <div className={styles.loginCard} style={{ position: 'relative' }}>
                <h2 className={styles.loginTitle}>
                    LOG IN
                </h2>

                <div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            ユーザー名
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={styles.input}
                            placeholder="メールアドレスを入力"
                            autoComplete="username"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            パスワード
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            placeholder="パスワードを入力"
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        className={styles.loginButton}
                        disabled={loading}
                    >
                        {loading ? 'ログイン中...' : 'ログイン'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button
                            type="button"
                            onClick={() => setShowPasswordReset(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#c5cad3',
                                fontSize: '14px',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            パスワードを忘れた方はこちら
                        </button>
                    </div>
                </div>

                {showPasswordReset && (
                    <PasswordReset
                        onClose={() => setShowPasswordReset(false)}
                        onSuccess={() => {
                            alert('パスワードリセットメールを送信しました');
                            setShowPasswordReset(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default LoginPage;
