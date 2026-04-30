import React, { useState } from 'react';
import {
  MODAL_OVERLAY, MODAL_CONTAINER, MODAL_HEADER, MODAL_TITLE, MODAL_CLOSE_BUTTON,
  MODAL_FORM, FORM_GROUP, FORM_LABEL, FORM_INPUT, FORM_HELP_TEXT, FORM_ERROR,
  BUTTON_GROUP, BUTTON_BASE, BUTTON_CANCEL, BUTTON_SUBMIT, BUTTON_DISABLED,
} from '@/styles/modal-form-constants';
import { useButtonHoverState } from '@/hooks/useButtonHoverState';

interface PasswordResetProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function PasswordReset({ onClose, onSuccess }: PasswordResetProps) {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const cancelHover = useButtonHoverState('#f3f4f6', '#e5e7eb', isLoading);
    const submitHover = useButtonHoverState('#3b82f6', '#2563eb', isLoading);

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

    const successBox: React.CSSProperties = {
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '8px',
        padding: '16px',
        color: '#166534',
        fontSize: '14px',
        lineHeight: 1.6,
        marginBottom: '16px',
    };

    return (
        <div style={MODAL_OVERLAY}>
            <div style={{ ...MODAL_CONTAINER, maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                <div style={MODAL_HEADER}>
                    <h3 style={MODAL_TITLE}>パスワードリセット</h3>
                    <button style={MODAL_CLOSE_BUTTON} onClick={onClose}>×</button>
                </div>

                {sent ? (
                    <>
                        <div style={successBox}>
                            パスワードリセットメールを送信しました。<br />
                            メール内のリンクをクリックしてパスワードをリセットしてください。
                        </div>
                        <div style={BUTTON_GROUP}>
                            <button style={{ ...BUTTON_BASE, ...BUTTON_SUBMIT }} onClick={onSuccess}>
                                閉じる
                            </button>
                        </div>
                    </>
                ) : (
                    <form style={MODAL_FORM} onSubmit={handleSubmit}>
                        <div style={FORM_GROUP}>
                            <label style={FORM_LABEL}>メールアドレス *</label>
                            <input
                                type="email"
                                style={FORM_INPUT}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="メールアドレスを入力"
                                required
                            />
                            <div style={FORM_HELP_TEXT}>
                                ログインに使用しているメールアドレスを入力してください。パスワードリセットリンクが送信されます。
                            </div>
                        </div>

                        {error && <div style={FORM_ERROR}>{error}</div>}

                        <div style={BUTTON_GROUP}>
                            <button
                                type="button"
                                style={{ ...BUTTON_BASE, ...BUTTON_CANCEL }}
                                onClick={onClose}
                                {...cancelHover}
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                style={{ ...BUTTON_BASE, ...BUTTON_SUBMIT, ...(isLoading ? BUTTON_DISABLED : {}) }}
                                disabled={isLoading}
                                {...submitHover}
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
