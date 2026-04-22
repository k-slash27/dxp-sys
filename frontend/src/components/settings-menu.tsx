import React, { useState } from 'react';
import { Settings, UserPlus, Lock, Users, HardDrive } from 'lucide-react';
import UserRegistration from '@/features/auth/user-registration';
import PasswordChange from '@/features/auth/password-change';
import UserManagement from '@/features/auth/user-area-management';
import CacheManagementModal from '@/features/cache/cache-management-modal';

interface SettingsMenuProps {
    userInfo: any;
}

export default function SettingsMenu({ userInfo }: SettingsMenuProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [showUserRegistration, setShowUserRegistration] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [showUserManagement, setShowUserManagement] = useState(false);
    const [showCacheManagement, setShowCacheManagement] = useState(false);

    const can = (permission: string): boolean =>
        (userInfo?.permissions ?? []).includes(permission);

    const styles = {
        container: {
            position: 'relative' as const,
            display: 'inline-block'
        },
        button: {
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
        },
        buttonHover: {
            backgroundColor: '#4c535f',
            color: '#d1d5db'
        },
        menu: {
            position: 'absolute' as const,
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '200px',
            overflow: 'hidden',
            backdropFilter: 'blur(4px)',
        },
        menuItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            textAlign: 'left' as const,
            cursor: 'pointer',
            fontSize: '14px',
            color: '#374151',
            transition: 'background-color 0.2s ease'
        },
        menuItemHover: {
            backgroundColor: '#f3f4f6'
        },
        separator: {
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '4px 0'
        },
        overlay: {
            position: 'fixed' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
        }
    };

    const handleMenuItemClick = (action: 'userRegistration' | 'passwordChange' | 'userManagement' | 'cacheManagement') => {
        setShowMenu(false);
        if (action === 'userRegistration') setShowUserRegistration(true);
        else if (action === 'passwordChange') setShowPasswordChange(true);
        else if (action === 'userManagement') setShowUserManagement(true);
        else if (action === 'cacheManagement') setShowCacheManagement(true);
    };

    return (
        <>
            <div style={styles.container}>
                <button
                    style={styles.button}
                    onClick={() => setShowMenu(!showMenu)}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.buttonHover)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.button)}
                    title="設定"
                >
                    <Settings size={18} />
                </button>

                {showMenu && (
                    <>
                        <div style={styles.overlay} onClick={() => setShowMenu(false)} />
                        <div style={styles.menu}>

                            {/* ユーザー管理（admin/editor のみ） */}
                            {can('frontend:manage_area') && (
                                <>
                                    <button
                                        style={styles.menuItem}
                                        onClick={() => handleMenuItemClick('userManagement')}
                                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...styles.menuItem, ...styles.menuItemHover })}
                                        onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.menuItem)}
                                    >
                                        <Users size={16} />
                                        ユーザー管理
                                    </button>
                                    <div style={styles.separator} />
                                </>
                            )}

                            {/* 新規ユーザー登録（admin/editor のみ） */}
                            {can('frontend:manage_area') && (
                                <>
                                    <button
                                        style={styles.menuItem}
                                        onClick={() => handleMenuItemClick('userRegistration')}
                                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...styles.menuItem, ...styles.menuItemHover })}
                                        onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.menuItem)}
                                    >
                                        <UserPlus size={16} />
                                        新規ユーザー登録
                                    </button>
                                    <div style={styles.separator} />
                                </>
                            )}

                            {/* パスワード変更（全ユーザー） */}
                            <button
                                style={styles.menuItem}
                                onClick={() => handleMenuItemClick('passwordChange')}
                                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...styles.menuItem, ...styles.menuItemHover })}
                                onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.menuItem)}
                            >
                                <Lock size={16} />
                                パスワード変更
                            </button>

                            <div style={styles.separator} />

                            {/* キャッシュ管理（全ユーザー） */}
                            <button
                                style={styles.menuItem}
                                onClick={() => handleMenuItemClick('cacheManagement')}
                                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...styles.menuItem, ...styles.menuItemHover })}
                                onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.menuItem)}
                            >
                                <HardDrive size={16} />
                                キャッシュ管理
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ユーザー登録モーダル */}
            {showUserRegistration && (
                <UserRegistration
                    userInfo={userInfo}
                    onClose={() => setShowUserRegistration(false)}
                    onSuccess={() => alert('ユーザーが正常に作成されました')}
                />
            )}

            {/* パスワード変更モーダル */}
            {showPasswordChange && (
                <PasswordChange
                    onClose={() => setShowPasswordChange(false)}
                    onSuccess={() => alert('パスワードが正常に変更されました')}
                />
            )}

            {/* ユーザー管理モーダル */}
            {showUserManagement && (
                <UserManagement
                    userInfo={userInfo}
                    onClose={() => setShowUserManagement(false)}
                    onSuccess={() => alert('ユーザー情報が正常に変更されました')}
                />
            )}

            {/* キャッシュ管理モーダル */}
            {showCacheManagement && (
                <CacheManagementModal
                    onClose={() => setShowCacheManagement(false)}
                    onSuccess={() => console.log('Cache management operation completed')}
                />
            )}
        </>
    );
}
