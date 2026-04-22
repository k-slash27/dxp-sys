import { useState, useEffect } from "react";
import LoginPage from "@/features/auth/login-page";
import Dashboard from "@/layouts/dashboard";
import MinobuAreaMap from "@/features/areamap/minobu/";
import MinamiAlpusAreaMap from "@/features/areamap/minami-alpus/";
import KofuAreaMap from "@/features/areamap/kofu/";
import DemoAreaMap from "@/features/areamap/demo";

export default function Page() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedArea, setSelectedArea] = useState<string>('demo');

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

    const getAreaComponent = () => {
        switch (selectedArea) {
            case 'minobu': return <MinobuAreaMap userInfo={userInfo} />;
            case 'minami_alpus': return <MinamiAlpusAreaMap userInfo={userInfo} />;
            case 'kofu': return <KofuAreaMap userInfo={userInfo} />;
            case 'demo': return <DemoAreaMap userInfo={userInfo} />;
            default: return <DemoAreaMap userInfo={userInfo} />;
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>;
    }

    return (
        <div>
            {loggedIn ? (
                <Dashboard username={userInfo?.username || 'ユーザー'} userInfo={userInfo} onLogout={handleLogout} selectedArea={selectedArea} onAreaChange={setSelectedArea}>
                    {getAreaComponent()}
                </Dashboard>
            ) : (
                <LoginPage onLogin={handleLogin} />
            )}
        </div>
    );
}
