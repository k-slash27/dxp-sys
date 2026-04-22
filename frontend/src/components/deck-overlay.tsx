import React, { useEffect } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useControl } from "react-map-gl/maplibre";

export default function DeckOverlay(props) {
    // overlayの作成時に固定のプロパティを設定
    const overlay = useControl(
        () => new MapboxOverlay({
            interleaved: false,
            ...props
        })
    );
    
    // マウント時とpropsの変更時に確実にプロパティを更新
    useEffect(() => {
        // プロパティの更新をrequestAnimationFrameでラップして
        // レンダリングとの同期を確保
        const handler = window.requestAnimationFrame(() => {
            if (overlay) {
                // 必要なプロパティのみ更新してパフォーマンスを向上
                overlay.setProps(props);
            }
        });
        
        // クリーンアップ
        return () => {
            window.cancelAnimationFrame(handler);
        };
    }, [overlay, props]);
    
    return null;
}