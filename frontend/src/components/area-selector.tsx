import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { AVAILABLE_AREAS } from '../constants/areas';

interface AreaSelectorProps {
    selectedArea: string;
    onAreaChange: (area: string) => void;
    workspaceNames: { [key: string]: string };
}

const AreaSelector: React.FC<AreaSelectorProps> = ({
    selectedArea,
    onAreaChange,
    workspaceNames
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    
    // 初期値設定（未選択の場合は最初のエリアを選択）
    useEffect(() => {
        if (!selectedArea || selectedArea === 'national') {
            onAreaChange(AVAILABLE_AREAS[0]);
        }
    }, [selectedArea, onAreaChange]);
    
    const handleAreaSelect = (area: string) => {
        onAreaChange(area);
        setIsOpen(false);
    };
    
    const currentAreaName = workspaceNames[selectedArea] || workspaceNames[AVAILABLE_AREAS[0]];
    
    const styles = {
        container: {
            position: 'relative' as const,
            display: 'inline-block',
        },
        selector: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px 4px 12px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer',
            minWidth: '130px',
            transition: 'all 0.2s ease',
        },
        selectorHover: {
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
        },
        label: {
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
        },
        areaName: {
            fontWeight: '500',
        },
        chevron: {
            marginLeft: 'auto',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        },
        dropdown: {
            position: 'absolute' as const,
            top: '100%',
            left: '0',
            right: '0',
            marginTop: '4px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 3000,
            overflow: 'hidden',
        },
        dropdownItem: {
            padding: '12px 16px',
            fontSize: '14px',
            color: '#374151',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            borderBottom: '1px solid #f3f4f6',
        },
        dropdownItemHover: {
            backgroundColor: '#f9fafb',
        },
        dropdownItemSelected: {
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            fontWeight: '500',
        },
        dropdownItemLast: {
            borderBottom: 'none',
        }
    };
    
    return (
        <div style={styles.container}>
            <div
                style={styles.selector}
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, styles.selectorHover);
                }}
                onMouseLeave={(e) => {
                    Object.assign(e.currentTarget.style, {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                    });
                }}
            >
                <span style={styles.label}>エリア:</span>
                <span style={styles.areaName}>{currentAreaName}</span>
                <ChevronDown size={16} style={styles.chevron} />
            </div>
            
            {isOpen && (
                <div style={styles.dropdown}>
                    {AVAILABLE_AREAS.map((area, index) => (
                        <div
                            key={area}
                            style={{
                                ...styles.dropdownItem,
                                ...(selectedArea === area ? styles.dropdownItemSelected : {}),
                                ...(index === AVAILABLE_AREAS.length - 1 ? styles.dropdownItemLast : {})
                            }}
                            onClick={() => handleAreaSelect(area)}
                            onMouseEnter={(e) => {
                                if (selectedArea !== area) {
                                    Object.assign(e.currentTarget.style, styles.dropdownItemHover);
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedArea !== area) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                        >
                            {workspaceNames[area] || area}
                        </div>
                    ))}
                </div>
            )}
            
            {/* 外側クリックでドロップダウンを閉じる */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 2999,
                    }}
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default AreaSelector;