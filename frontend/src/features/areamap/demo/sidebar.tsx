import LayerToggle from "@/components/layer-toggle";
import styles from "@/features/areamap/_shared-styles";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useState } from 'react';
import React from 'react';

export default function Sidebar(props) {
    const {
        sidebarOpen,
        setSidebarOpen,
        layerVisibility,
        toggleLayer,
        setShowOrthoHistory,
        onLayerOrderChange
    } = props;
    
    // 将来の拡張用にuseAuthは保持
    // const { userRole, getAccessibleWorkspaces, workspacesLoading } = useAuth(userInfo);

    const [sidebarWidth, setSidebarWidth] = useState(320);

    const handleRightEdgeDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidth;
        const onMove = (ev: MouseEvent) => {
            setSidebarWidth(Math.min(600, Math.max(200, startWidth + (ev.clientX - startX))));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const rightResizeHandle = (
        <div
            onMouseDown={handleRightEdgeDrag}
            style={{
                position: 'absolute' as const,
                right: 0,
                top: 0,
                bottom: 0,
                width: '6px',
                cursor: 'ew-resize',
                zIndex: 11,
                background: 'transparent',
            }}
        />
    );

    // レイヤーの初期順序
    const [layerOrder, setLayerOrder] = useState([
        { id: 'grids', label: '区画線', key: 'grids' },
        { id: 'contour', label: '気温分布', key: 'contour' },
        { id: 'sensors', label: '環境センサー情報', key: 'sensors' },
        { id: 'waterLevel', label: '水位センサー情報', key: 'waterLevel' },
        { id: 'nouchiOrtho', label: 'ドローン空撮画像', key: 'nouchiOrtho' },
        { id: 'nouchiVari', label: '植生分布', key: 'nouchiVari' }
    ]);

    // ドラッグ終了時の処理
    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(layerOrder);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        
        setLayerOrder(items);
        
        // 親コンポーネント（DemoAreaMap）にレイヤー順序変更を通知
        if (onLayerOrderChange) {
            onLayerOrderChange(items);
        }
    };

    return (
        <>
            {/* Inject scrollbar CSS */}
            
            {/* サイドバー */}
            <div style={{ ...styles.sidebar, width: sidebarWidth, ...(sidebarOpen ? {} : { transform: `translateX(-${sidebarWidth + 26}px)` }) }}>
                {rightResizeHandle}
                {/* サイドバーヘッダー */}
                <div style={styles.sidebarHeader}>
                    <h2 style={styles.sidebarTitle}>表示設定</h2>
                </div>

                {/* スクロール可能なコンテンツエリア */}
                <div style={styles.sidebarContent}>
                    {/* レイヤーコントロール */}
                    <div style={styles.layerSection}>
                        <h3 style={styles.sectionTitle}>レイヤー設定</h3>
                        
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="layer-list">
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        style={{
                                            backgroundColor: snapshot.isDraggingOver ? '#f9fafb' : 'transparent',
                                            borderRadius: '6px',
                                            padding: snapshot.isDraggingOver ? '8px' : '0',
                                            transition: 'background-color 0.2s ease'
                                        }}
                                    >
                                        {layerOrder.map((layer, index) => (
                                            <Draggable key={layer.id} draggableId={layer.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        style={{
                                                            ...provided.draggableProps.style,
                                                            marginBottom: '4px',
                                                            backgroundColor: snapshot.isDragging ? '#ffffff' : 'transparent',
                                                            borderRadius: '4px',
                                                            boxShadow: snapshot.isDragging ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
                                                            border: snapshot.isDragging ? '1px solid #e5e7eb' : 'none'
                                                        }}
                                                    >
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center',
                                                            padding: snapshot.isDragging ? '4px' : '0'
                                                        }}>
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                style={{
                                                                    cursor: 'grab',
                                                                    padding: '8px 4px',
                                                                    color: '#9ca3af',
                                                                    fontSize: '14px',
                                                                    lineHeight: 1,
                                                                    userSelect: 'none'
                                                                }}
                                                                title="ドラッグして順序を変更"
                                                            >
                                                                ≡
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                {layer.key === 'grids' && (
                                                                    <LayerToggle
                                                                        label={layer.label}
                                                                        isActive={layerVisibility.grids}
                                                                        onChange={() => toggleLayer('grids')}
                                                                    />
                                                                )}
                                                                {layer.key === 'contour' && (
                                                                    <LayerToggle
                                                                        label={layer.label}
                                                                        isActive={layerVisibility.contour}
                                                                        onChange={() => toggleLayer('contour')}
                                                                    />
                                                                )}
                                                                {layer.key === 'sensors' && (
                                                                    <LayerToggle
                                                                        label={layer.label}
                                                                        isActive={layerVisibility.sensors}
                                                                        onChange={() => toggleLayer('sensors')}
                                                                    />
                                                                )}
                                                                {layer.key === 'waterLevel' && (
                                                                    <LayerToggle
                                                                        label={layer.label}
                                                                        isActive={layerVisibility.waterLevel}
                                                                        onChange={() => {
                                                                            toggleLayer('waterLevel');
                                                                            if (!layerVisibility.waterLevel) {
                                                                                toggleLayer('baseWaterLevel', true);
                                                                                toggleLayer('baseOrtho', false);
                                                                                toggleLayer('baseGsi', false);
                                                                            }                            
                                                                        }}
                                                                    />
                                                                )}
                                                                {layer.key === 'nouchiOrtho' && (
                                                                    <LayerToggle
                                                                        label={layer.label}
                                                                        isActive={layerVisibility.nouchiOrtho}
                                                                        onChange={() => {
                                                                            toggleLayer('nouchiOrtho');
                                                                            if (!layerVisibility.nouchiOrtho) {
                                                                                setShowOrthoHistory?.(true);
                                                                            } else {
                                                                                setShowOrthoHistory?.(false);
                                                                            }
                                                                        }}
                                                                    />
                                                                )}
                                                                {layer.key === 'nouchiVari' && (
                                                                    <LayerToggle
                                                                        label={layer.label}
                                                                        isActive={layerVisibility.nouchiVari}
                                                                        onChange={() => toggleLayer('nouchiVari')}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>

                </div>
            </div>

            {/* トグルボタン */}
            <button
                style={{ ...styles.toggleButton, ...(sidebarOpen ? { left: `calc(${sidebarWidth}px + 25px)` } : {}) }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {sidebarOpen ? (
                        <>
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </>
                    ) : (
                        <>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </>
                    )}
                </svg>
            </button>
        </>
    )
}