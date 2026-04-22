const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        height: '100%',
        width: '100%',
        position: 'relative',
        color: '#333840'
    },
    sidebar: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '320px',
        height: 'calc(100% - 30px)',
        margin: '10px',
        backgroundColor: '#ffffff',
        boxShadow: '4px 0 8px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        transition: 'transform 0.3s ease',
        overflow: 'hidden',
        borderRadius: '8px',
    },
    sidebarHidden: {
        transform: 'translateX(-346px)'
    },
    sidebarHeader: {
        backgroundColor: '#333840',
        color: 'white',
        padding: '16px'
    },
    sidebarTitle: {
        fontSize: '16px',
        letterSpacing: '0.5px',
        fontWeight: 600,
        margin: 0
    },
    sidebarSubtitle: {
        fontSize: '12px',
        color: '#cbd5e0',
        marginTop: '4px'
    },
    sidebarContent: {
        flex: 1,
        overflowY: 'auto'
    },
    layerSection: {
        padding: '16px',
        paddingBottom: '24px', // Extra padding at bottom for better scrolling experience
    },
    sectionTitle: {
        fontSize: '14px',
        fontWeight: 700,
        marginBottom: '12px',
        color: '#4c535f'
    },
    layerToggle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px',
        marginBottom: '8px',
        backgroundColor: '#f7fafc',
        borderRadius: '6px',
        cursor: 'pointer'
    },
    toggleLabel: {
        fontSize: '14px',
        fontWeight: 500,
        color: '#4c535f'
    },
    toggleSwitch: {
        position: 'relative',
        width: '40px',
        height: '24px',
        backgroundColor: '#cbd5e0',
        borderRadius: '12px',
        transition: 'background-color 0.2s'
    },
    toggleSwitchActive: {
        backgroundColor: '#3182ce'
    },
    toggleSwitchDisabled: {
        backgroundColor: '#eee',
        cursor: 'initial'
    },
    toggleHandle: {
        position: 'absolute',
        left: '4px',
        top: '4px',
        width: '16px',
        height: '16px',
        backgroundColor: 'white',
        borderRadius: '50%',
        transition: 'transform 0.2s'
    },
    toggleHandleActive: {
        transform: 'translateX(16px)'
    },
    sensorDetails: {
        // flex: 1,
        // overflow: 'auto',
        width: '350px',
        position: 'absolute',
        borderRadius: '8px',
        top: '10px',
        right: '10px',
        height: 'calc(100vh - 100px)',
        zIndex: 999,
        backgroundColor: 'white',
        boxShadow: '4px 0 8px rgba(0, 0, 0, 0.15)',
        overflow: 'scroll'
    },
    detailsEmpty: {
        padding: '8px',
        fontSize: '12px',
        color: '#aaa',
    },
    detailsContent: {
        padding: '16px 0'
    },
    detailsHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    detailsTitle: {
        fontSize: '15px',
        fontWeight: 700,
        margin: 0
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        borderRadius: '50%',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    infoCard: {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '16px',
        marginBottom: '16px'
    },
    infoGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        fontSize: '14px'
    },
    infoLabel: {
        fontWeight: 500
    },
    infoValue: {
        textAlign: 'right',
        fontSize: '13px'
    },
    smallText: {
        fontSize: '12px'
    },
    historyTitle: {
        fontSize: '14px',
        fontWeight: 700,
        marginBottom: '8px'
    },
    historyList: {
        maxHeight: '400px',
        overflowY: 'auto'
    },
    historyItem: {
        marginBottom: '8px',
        padding: '12px',
        fontSize: '12px',
        borderRadius: '6px',
        backgroundColor: '#f1f5f9'
    },
    currentHistoryItem: {
        backgroundColor: '#ebf5ff'
    },
    toggleButton: {
        position: 'absolute',
        top: '10px',
        left: '15px',
        zIndex: 20,
        backgroundColor: 'white',
        padding: '8px',
        borderRadius: '50%',
        boxShadow: '0 3px 6px rgba(0, 0, 0, 0.2)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    toggleButtonClose: {
        left: 'calc(320px + 25px)',
    },
    mapContainer: {
        flex: 1
    },
    map: {
        height: '100%',
        width: '100%'
    },
    tooltip: {
        position: 'absolute',
        zIndex: 999,
        pointerEvents: 'auto',
        backgroundColor: 'white',
        padding: '8px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    },
    tooltipClose: {
        position: 'absolute',
        top: '5px',
        right: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold'
    },
    button: { 
        padding: '8px 10px',
        color: '#666',
        backgroundColor: '#ccc',
        borderRadius: '8px 8px 0 0',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonSelected: {
        backgroundColor: 'white',
        boxShadow: '1px -4px 4px rgba(0, 0, 0, 0.1)',
        color: '#333'
    },
    loading: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '18px',
        fontWeight: '500',
        color: '#4b5563',
        backgroundColor: 'white',
        padding: '20px 30px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
    }
};

export default styles;