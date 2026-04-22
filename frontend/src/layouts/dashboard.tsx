import React, { ReactNode, useState } from 'react';
import styles from '@/styles/dashboard.module.css';
import SettingsMenu from '@/components/settings-menu';
import AreaSelector from '@/components/area-selector';
import { Printer } from 'lucide-react';
import PrintScreenshotModal from '@/components/print-screenshot-modal';

interface DashboardProps {
    username: string;
    userInfo?: any;
    onLogout: () => void;
    children: ReactNode;
    selectedArea?: string;
    onAreaChange?: (area: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    username,
    userInfo,
    onLogout,
    children,
    selectedArea = '',
    onAreaChange
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    
    // ユーザー情報の取得（localStorage ベースの flat 形式）
    const userRole = userInfo?.role || 'viewer';
    const userWorkspaces = userInfo?.workspaces || '';
    const primaryArea = userInfo?.primaryArea || '';
    const userEmail = userInfo?.username || username;
    
    
    // ワークスペース名の日本語マッピング
    const workspaceNames: { [key: string]: string } = {
        'minobu': '身延町',
        'minami_alpus': '南アルプス市', 
        'kofu': '甲府市',
        'demo': 'デモ',
        'national': '全エリア',
        '*': '全エリア'
    };
    
    // ユーザー属性名の日本語マッピング
    const roleNames: { [key: string]: string } = {
        'viewer': '利用者',
        'editor': 'エリア担当者',
        'admin': '管理者'
    };
    
    return (
        <div className={styles.dashboardContainer}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logoGroup}>
                    <span className={styles.appTitle}>
                        <img src="/dxp-logo.svg" alt='DXP' />
                    </span>
                </div>
                <div className={styles.userControls}>                    
                    {/* Admin用エリア選択 */}
                    {userInfo?.permissions?.includes('frontend:admin') && onAreaChange && (
                        <div>
                            <AreaSelector
                                selectedArea={selectedArea}
                                onAreaChange={onAreaChange}
                                workspaceNames={workspaceNames}
                            />
                        </div>
                    )}
                    
                    <div 
                        className={styles.userBadge}
                        style={{ position: 'relative', marginLeft: '20px' }}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        <div className={styles.onlineIndicator}></div>
                        <div>
                            <span>{userEmail}</span>
                        </div>
                        
                        {/* ホバー時の詳細情報ツールチップ */}
                        {showTooltip && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    marginTop: '8px',
                                    padding: '12px',
                                    backgroundColor: '#1f2937',
                                    color: 'white',
                                    borderRadius: '6px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    zIndex: 1000,
                                    minWidth: '200px',
                                    fontSize: '13px',
                                    lineHeight: '1.4'
                                }}
                            >
                                <div style={{ marginBottom: '6px' }}>
                                    <strong>ユーザー情報</strong>
                                </div>
                                <div style={{ marginBottom: '4px' }}>
                                    メール: {userEmail}
                                </div>
                                <div style={{ marginBottom: '4px' }}>
                                    ユーザー属性: {roleNames[userRole] || userRole}
                                </div>
                                {primaryArea && (
                                    <div>
                                        エリア: {workspaceNames[primaryArea] || primaryArea}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 印刷ボタン（設定メニューの左） */}
                    <button
                        style={{
                            padding: '0.3rem 0.5rem',
                            borderRadius: '0.375rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => setShowPrintModal(true)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#4c535f';
                            e.currentTarget.style.color = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#fff';
                        }}
                        title="画面を印刷"
                    >
                        <Printer size={18} />
                    </button>

                    {/* 設定メニュー（ログアウトボタンのすぐ左） */}
                    <div>
                        <SettingsMenu userInfo={userInfo} />
                    </div>
                    
                    <button
                        onClick={onLogout}
                        className={styles.logoutButton}
                    >
                        ログアウト
                    </button>
                </div>
            </header>
            {/* Main Content */}
            <div className={`${styles.mainContent} mainContent`}>
                {children}
            </div>

            {/* 印刷モーダル */}
            {showPrintModal && (
                <PrintScreenshotModal onClose={() => setShowPrintModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;