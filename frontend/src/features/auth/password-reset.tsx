import React, { useState } from 'react';

interface PasswordResetProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function PasswordReset({ onClose, onSuccess }: PasswordResetProps) {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!email) {
            setError('メールアドレスを入力してください');
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'パスワードリセットに失敗しました');
            }

            setSent(true);
        } catch (err: any) {
            setError(err.message || 'パスワードリセットの開始に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const styles = {
        overlay: {
            position: 'fixed' as const,
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)',
        },
        modal: {
            backgroundColor: 'white', borderRadius: '8px', padding: '24px',
            width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' as const
        },
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '20px', paddingBottom: '12px', color: '#333',
        },
        title: { margin: 0, fontSize: '18px', fontWeight: '600' as const },
        closeButton: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' },
        form: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
        formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
        label: { fontSize: '14px', fontWeight: '500' as const, color: '#374151' },
        input: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' },
        error: { color: '#ef4444', fontSize: '14px', marginTop: '4px' },
        helpText: { fontSize: '12px', color: '#6b7280', lineHeight: '1.6' as const, marginTop: '2px' },
        buttonGroup: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' },
        button: {
            padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '14px',
            fontWeight: '500' as const, cursor: 'pointer', minWidth: '120px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: '6px'
        },
        cancelButton: { backgroundColor: '#f3f4f6', color: '#374151' },
        submitButton: { backgroundColor: '#3b82f6', color: 'white' },
        successBox: {
            backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px',
            padding: '16px', color: '#166534', fontSize: '14px', lineHeight: '1.6' as const,
            marginBottom: '16px'
        },
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>パスワード変更</h3>
                    <button style={styles.closeButton} onClick={onClose}>×</button>
                </div>

                {sent ? (
                    <>
                        <div style={styles.successBox}>
                            パスワードリセットメールを送信しました。<br />
                            メール内のリンクをクリックしてパスワードをリセットしてください。
                        </div>
                        <div style={styles.buttonGroup}>
                            <button style={{ ...styles.button, ...styles.submitButton }} onClick={onSuccess}>
                                閉じる
                            </button>
                        </div>
                    </>
                ) : (
                    <form style={styles.form} onSubmit={handleSubmit}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>メールアドレス *</label>
                            <input
                                type="email"
                                style={styles.input}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="メールアドレスを入力"
                                required
                            />
                            <div style={styles.helpText}>
                                ログインに使用しているメールアドレスを入力してください。パスワードリセットリンクが送信されます。
                            </div>
                        </div>

                        {error && <div style={styles.error}>{error}</div>}

                        <div style={styles.buttonGroup}>
                            <button
                                type="button"
                                style={{ ...styles.button, ...styles.cancelButton }}
                                onClick={onClose}
                                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                style={{
                                    ...styles.button, ...styles.submitButton,
                                    ...(isLoading ? { backgroundColor: '#9ca3af', cursor: 'not-allowed' } : {})
                                }}
                                disabled={isLoading}
                                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                            >
                                {isLoading ? '送信中...' : 'リセットメール送信'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
