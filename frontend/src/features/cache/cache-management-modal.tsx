import React, { useState, useEffect } from 'react';
import { cacheManager } from '@/utils/_cache-manager';
import { X, Trash2, RotateCcw, AlertCircle, CheckCircle, HardDrive } from 'lucide-react';

interface CacheStats {
    total: number;
    ortho: number;
    expired: number;
    storageUsed: number;
}

interface CacheManagementModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function CacheManagementModal({ onClose, onSuccess }: CacheManagementModalProps) {
    const [stats, setStats] = useState<CacheStats>({ total: 0, ortho: 0, expired: 0, storageUsed: 0 });
    const [isClearing, setIsClearing] = useState(false);
    const [lastCleared, setLastCleared] = useState<Date | null>(null);

    const updateStats = () => {
        const newStats = cacheManager.getCacheStats();
        setStats(newStats);
    };

    useEffect(() => {
        updateStats();
        const interval = setInterval(updateStats, 10000); // 10秒間隔
        return () => clearInterval(interval);
    }, []);

    const handleClearExpired = async () => {
        setIsClearing(true);
        try {
            const clearedCount = await cacheManager.clearExpiredOrthoCache();
            setLastCleared(new Date());
            updateStats();
            onSuccess?.();
            alert(`期限切れキャッシュを${clearedCount}件クリアしました`);
        } catch (error) {
            console.error('キャッシュクリアエラー:', error);
            alert('キャッシュクリアに失敗しました');
        } finally {
            setIsClearing(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('すべての農地オルソキャッシュを削除しますか？\n次回表示時に再ダウンロードが必要になります。')) {
            return;
        }

        setIsClearing(true);
        try {
            const clearedCount = await cacheManager.clearAllOrthoCache();
            setLastCleared(new Date());
            updateStats();
            onSuccess?.();
            alert(`農地オルソキャッシュを${clearedCount}件すべてクリアしました`);
        } catch (error) {
            console.error('全キャッシュクリアエラー:', error);
            alert('キャッシュクリアに失敗しました');
        } finally {
            setIsClearing(false);
        }
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const overlayStyle = {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
    };

    const modalStyle = {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '500px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        position: 'relative' as const
    };

    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        color: '#333'
    };

    const titleStyle = {
        fontSize: '18px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '10px 0'
    };

    const closeButtonStyle = {
        padding: '6px',
        borderRadius: '6px',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#6b7280',
        transition: 'all 0.2s ease'
    };

    const statsContainerStyle = {
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '20px'
    };

    const statRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        fontSize: '14px'
    };

    const statLabelStyle = {
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const statValueStyle = {
        fontWeight: 'bold',
    };

    const expiredValueStyle = {
        ...statValueStyle,
        color: stats.expired > 0 ? '#dc2626' : '#059669'
    };

    const buttonContainerStyle = {
        display: 'flex',
        gap: '12px',
        marginBottom: '16px'
    };

    const buttonStyle = {
        flex: 1,
        padding: '12px 16px',
        borderRadius: '6px',
        border: 'none',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const expiredButtonStyle = {
        ...buttonStyle,
        backgroundColor: stats.expired > 0 ? '#dc2626' : '#e5e7eb',
        color: stats.expired > 0 ? 'white' : '#9ca3af',
        cursor: isClearing || stats.expired === 0 ? 'not-allowed' : 'pointer',
        opacity: isClearing || stats.expired === 0 ? 0.6 : 1
    };

    const allButtonStyle = {
        ...buttonStyle,
        backgroundColor: stats.ortho > 0 ? '#ea580c' : '#e5e7eb',
        color: stats.ortho > 0 ? 'white' : '#9ca3af',
        cursor: isClearing || stats.ortho === 0 ? 'not-allowed' : 'pointer',
        opacity: isClearing || stats.ortho === 0 ? 0.6 : 1
    };

    const lastClearedStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        fontSize: '13px',
        color: '#059669',
        backgroundColor: '#f0fdf4',
        padding: '8px 12px',
        borderRadius: '6px',
        marginBottom: '16px'
    };

    const noteStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: '#6b7280',
        backgroundColor: '#f3f4f6',
        padding: '12px',
        borderRadius: '6px',
        textAlign: 'center' as const
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={titleStyle}>
                        <HardDrive size={20} />
                        キャッシュ管理
                    </h2>
                    <button
                        style={closeButtonStyle}
                        onClick={onClose}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={statsContainerStyle}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                        キャッシュ統計情報
                    </h3>
                    
                    <div style={statRowStyle}>
                        <span style={statLabelStyle}>総キャッシュ数</span>
                        <span style={statValueStyle}>{stats.total}件</span>
                    </div>
                    
                    <div style={statRowStyle}>
                        <span style={statLabelStyle}>農地オルソ</span>
                        <span style={statValueStyle}>{stats.ortho}件</span>
                    </div>
                    
                    <div style={statRowStyle}>
                        <span style={statLabelStyle}>期限切れ</span>
                        <span style={expiredValueStyle}>{stats.expired}件</span>
                    </div>
                    
                    <div style={statRowStyle}>
                        <span style={statLabelStyle}>使用容量</span>
                        <span style={statValueStyle}>{formatBytes(stats.storageUsed)}</span>
                    </div>
                </div>

                {lastCleared && (
                    <div style={lastClearedStyle}>
                        <CheckCircle size={16} />
                        最終クリア: {lastCleared.toLocaleString()}
                    </div>
                )}

                <div style={buttonContainerStyle}>
                    <button
                        onClick={handleClearExpired}
                        disabled={isClearing || stats.expired === 0}
                        style={expiredButtonStyle}
                        onMouseEnter={(e) => {
                            if (stats.expired > 0 && !isClearing) {
                                e.currentTarget.style.backgroundColor = '#b91c1c';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (stats.expired > 0 && !isClearing) {
                                e.currentTarget.style.backgroundColor = '#dc2626';
                            }
                        }}
                    >
                        {isClearing ? (
                            <RotateCcw size={16} className="animate-spin" />
                        ) : (
                            <Trash2 size={16} />
                        )}
                        {isClearing ? '処理中...' : `期限切れクリア (${stats.expired}件)`}
                    </button>

                    <button
                        onClick={handleClearAll}
                        disabled={isClearing || stats.ortho === 0}
                        style={allButtonStyle}
                        onMouseEnter={(e) => {
                            if (stats.ortho > 0 && !isClearing) {
                                e.currentTarget.style.backgroundColor = '#c2410c';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (stats.ortho > 0 && !isClearing) {
                                e.currentTarget.style.backgroundColor = '#ea580c';
                            }
                        }}
                    >
                        {isClearing ? (
                            <RotateCcw size={16} className="animate-spin" />
                        ) : (
                            <Trash2 size={16} />
                        )}
                        {isClearing ? '処理中...' : `全オルソクリア (${stats.ortho}件)`}
                    </button>
                </div>

                <div style={noteStyle}>
                    <AlertCircle size={16} />
                    24時間経過後に自動クリア実行されます
                </div>
            </div>
        </div>
    );
}