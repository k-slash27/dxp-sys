import { useState, useEffect, useCallback } from "react";
import LoginPage from "@/features/auth/login-page";
import Dashboard from "@/layouts/dashboard";
import MinobuAreaMap from "@/features/areamap/minobu/";
import MinamiAlpusAreaMap from "@/features/areamap/minami-alpus/";
import KofuAreaMap from "@/features/areamap/kofu/";
import DemoAreaMap from "@/features/areamap/demo";
import JournalPanel from "@/features/journal/journal-panel";

export default function Page() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedArea, setSelectedArea] = useState<string>('demo');

    // 生産者日誌パネル
    const [showJournal, setShowJournal] = useState(false);
    const [journalEntries, setJournalEntries] = useState<any[]>([]);
    const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

    // 日誌を閉じたときにマーカーをクリア
    const handleJournalClose = useCallback(() => {
        setShowJournal(false);
        setPickingLocation(false);
        setJournalEntries([]);
    }, []);

    // 地図クリックで位置取得するモード
    const [pickingLocation, setPickingLocation] = useState(false);
    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('dxp_user');
            if (stored) {
                const user = JSON.parse(stored);
                setUserInfo(user);
                setLoggedIn(true);
                if (user.primaryArea) setSelectedArea(user.primaryArea);
            }
        } catch {
            localStorage.removeItem('dxp_user');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleLogin = (user: any) => {
        setUserInfo(user);
        setLoggedIn(true);
        if (user.primaryArea) setSelectedArea(user.primaryArea);
    };

    const handleLogout = () => {
        localStorage.removeItem('dxp_user');
        setUserInfo(null);
        setLoggedIn(false);
    };

    // 地図クリックで座標を受け取る
    const handleLocationPick = useCallback((lat: number, lng: number) => {
        setPickedLocation({ lat, lng });
        setPickingLocation(false);
    }, []);

    // 座標消費（メモ化して JournalForm の useEffect 依存を安定化）
    const handleLocationConsumed = useCallback(() => setPickedLocation(null), []);

    // マーカークリック → 日誌パネルを開いて詳細ビューを表示
    const handleJournalMarkerClick = useCallback((entryId: string) => {
        setShowJournal(true);
        setSelectedJournalId(entryId);
    }, []);

    const areaMapProps = {
        userInfo,
        pickingLocation,
        onLocationPick: handleLocationPick,
        journalEntries: showJournal ? journalEntries : [],
        onJournalMarkerClick: handleJournalMarkerClick,
    };

    const getAreaComponent = () => {
        switch (selectedArea) {
            case 'minobu':      return <MinobuAreaMap {...areaMapProps} />;
            case 'minami_alpus': return <MinamiAlpusAreaMap {...areaMapProps} />;
            case 'kofu':        return <KofuAreaMap {...areaMapProps} />;
            case 'demo':        return <DemoAreaMap {...areaMapProps} />;
            default:            return <DemoAreaMap {...areaMapProps} />;
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>;
    }

    return (
        <div>
            {loggedIn ? (
                <Dashboard
                    username={userInfo?.username || 'ユーザー'}
                    userInfo={userInfo}
                    onLogout={handleLogout}
                    selectedArea={selectedArea}
                    onAreaChange={setSelectedArea}
                    onJournalOpen={() => setShowJournal(true)}
                >
                    {getAreaComponent()}

                    {showJournal && (
                        <JournalPanel
                            workspace={selectedArea}
                            userInfo={userInfo}
                            onClose={handleJournalClose}
                            onEntriesChange={setJournalEntries}
                            pickingLocation={pickingLocation}
                            onRequestLocationPick={() => setPickingLocation(true)}
                            onCancelLocationPick={() => setPickingLocation(false)}
                            pickedLocation={pickedLocation}
                            onLocationConsumed={handleLocationConsumed}
                            selectedEntryId={selectedJournalId}
                            onSelectedEntryConsumed={() => setSelectedJournalId(null)}
                        />
                    )}
                </Dashboard>
            ) : (
                <LoginPage onLogin={handleLogin} />
            )}
        </div>
    );
}
