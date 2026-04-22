'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface BasemapOption {
    id: string;
    name: string;
    thumbnail: string;
}

const basemapSwitcherStyles: Record<string, React.CSSProperties> = {
    // Absolute positioned container for bottom-right placement
    container: {
        position: 'absolute',
        top: '20px',
        right: '60px',
        zIndex: 1000,
    },
    // compact switcher
    compactSwitcher: {
        position: 'relative',
        display: 'inline-block',
    },
    compactButton: {
        padding: '0',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
        width: '64px',
        height: '64px',
    },
    compactButtonHover: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        transform: 'translateY(-1px)',
    },
    compactThumbnail: {
        width: '64px',
        height: '64px',
        borderRadius: '8px',
        objectFit: 'cover' as const,
    },
    compactLabel: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        fontSize: '11px',
        fontWeight: '600',
        padding: '4px 6px',
        textAlign: 'center' as const,
        backgroundColor: 'rgba(60, 64, 67, 0.8)',
        color: 'white',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
    },
    // Dropdown menu styles - positioned above the icon
    dropdown: {
        position: 'absolute',
        top: '0px', // Position above the icon (64px height + 8px gap)
        right: '80px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '10px',
        minWidth: '400px', // Increased width for horizontal layout
        zIndex: 1000,
        display: 'none',
    },
    dropdownOpen: {
        display: 'block',
    },
    dropdownGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr', // Horizontal layout with 4 columns
        gap: '8px',
    },
    dropdownOption: {
        padding: '0',
        border: '2px solid transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
    },
    dropdownOptionSelected: {
        border: '2px solid #1976d2',
    },
    dropdownOptionHover: {
        border: '2px solid #e0e0e0',
    },
    dropdownThumbnailWrapper: {
        width: '100%',
        height: '60px', // Slightly smaller for horizontal layout
        borderRadius: '4px 4px 0 0',
        overflow: 'hidden',
    },
    dropdownThumbnail: {
        width: '100%',
        height: '60px', // Slightly smaller for horizontal layout
        objectFit: 'cover' as const,
    },
    dropdownLabel: {
        fontSize: '12px',
        fontWeight: '500',
        padding: '4px 8px',
        textAlign: 'center' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        color: '#3c4043',
    },
    dropdownLabelSelected: {
        backgroundColor: '#1976d2',
        color: 'white',
    },
    // Close button styles
    closeButton: {
        position: 'absolute',
        top: '0',
        left: '-30px',
        width: '24px',
        height: '24px',
        border: 'none',
        borderRadius: '50%',
        backgroundColor: '#f5f5f5',
        color: '#666',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        transition: 'all 0.2s ease',
    },
    closeButtonHover: {
        backgroundColor: '#e0e0e0',
        color: '#333',
    },
};

interface BasemapSwitcherProps {
    toggleBaseMap: (baseMapName: string, visible: boolean | null) => void;
}

const BasemapSwitcher: React.FC<BasemapSwitcherProps> = ({ toggleBaseMap }) => {
    const [selectedBasemap, setSelectedBasemap] = useState('standard');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [hoveredOption, setHoveredOption] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isCloseButtonHovered, setIsCloseButtonHovered] = useState(false);

    const basemapOptions: BasemapOption[] = [
        {
            id: 'standard',
            name: 'OSM標準',
            thumbnail: '/basemaps/standard.png',
        },
        {
            id: 'baseOrtho',
            name: '航空写真',
            thumbnail: '/basemaps/satellite.png',
        },
        {
            id: 'baseGsi',
            name: '国土地理院',
            thumbnail: '/basemaps/gsi.png',
        },
        {
            id: 'baseWaterLevel',
            name: '水路マップ',
            thumbnail: '/basemaps/waterOrtho.png',
        },
    ];

    const selectedOption = basemapOptions.find(option => option.id === selectedBasemap) || basemapOptions[0];

    const handleBasemapSelect = (basemapId: string) => {
        setSelectedBasemap(basemapId);
        // Removed setIsDropdownOpen(false) to keep popup open after selection

        // すべてのベースマップを無効にする
        toggleBaseMap('baseOrtho', false);
        toggleBaseMap('baseGsi', false);
        toggleBaseMap('baseWaterLevel', false);

        // standardの場合は何も有効にしない
        if (basemapId === 'standard') return;

        // 選択されたベースマップを有効にする
        toggleBaseMap(basemapId, true);
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const closeDropdown = () => {
        setIsDropdownOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('[data-basemap-switcher]')) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [isDropdownOpen]);

    return (
        <div style={basemapSwitcherStyles.container}>
            <div style={basemapSwitcherStyles.compactSwitcher} data-basemap-switcher>
                <button
                    onClick={toggleDropdown}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{
                        ...basemapSwitcherStyles.compactButton,
                        ...(isHovered ? basemapSwitcherStyles.compactButtonHover : {})
                    }}
                    title={selectedOption.name}
                    type="button"
                    aria-expanded={isDropdownOpen}
                    aria-label="ベースマップを選択"
                >
                    <Image
                        style={basemapSwitcherStyles.compactThumbnail}
                        src={selectedOption.thumbnail}
                        alt={`${selectedOption.name}のプレビュー`}
                        width={64}
                        height={64}
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A0XqN7s2vV6jc7Nr1eo3OzKKBEgQNsN"
                    />
                    <div style={basemapSwitcherStyles.compactLabel}>
                        マップ
                    </div>
                </button>

                {/* Dropdown Menu */}
                <div
                    style={{
                        ...basemapSwitcherStyles.dropdown,
                        ...(isDropdownOpen ? basemapSwitcherStyles.dropdownOpen : {})
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={closeDropdown}
                        onMouseEnter={() => setIsCloseButtonHovered(true)}
                        onMouseLeave={() => setIsCloseButtonHovered(false)}
                        style={{
                            ...basemapSwitcherStyles.closeButton,
                            ...(isCloseButtonHovered ? basemapSwitcherStyles.closeButtonHover : {})
                        }}
                        title="閉じる"
                        type="button"
                        aria-label="ポップアップを閉じる"
                    >
                        ×
                    </button>

                    <div style={basemapSwitcherStyles.dropdownGrid}>
                        {basemapOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleBasemapSelect(option.id)}
                                onMouseEnter={() => setHoveredOption(option.id)}
                                onMouseLeave={() => setHoveredOption(null)}
                                style={{
                                    ...basemapSwitcherStyles.dropdownOption,
                                    ...(selectedBasemap === option.id ? basemapSwitcherStyles.dropdownOptionSelected : {}),
                                    ...(hoveredOption === option.id && selectedBasemap !== option.id ? basemapSwitcherStyles.dropdownOptionHover : {})
                                }}
                                title={option.name}
                                type="button"
                                aria-pressed={selectedBasemap === option.id}
                                aria-label={`${option.name}を選択`}
                            >
                                <div style={basemapSwitcherStyles.dropdownThumbnailWrapper}>
                                    <Image
                                        style={basemapSwitcherStyles.dropdownThumbnail}
                                        src={option.thumbnail}
                                        alt={`${option.name}のプレビュー`}
                                        width={80}
                                        height={40}
                                        placeholder="blur"
                                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A0XqN7s2vV6jc7Nr1eo3OzKKBEgQNsN"
                                    />
                                </div>
                                <div
                                    style={{
                                        ...basemapSwitcherStyles.dropdownLabel,
                                        ...(selectedBasemap === option.id ? basemapSwitcherStyles.dropdownLabelSelected : {})
                                    }}
                                >
                                    {option.name}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BasemapSwitcher;