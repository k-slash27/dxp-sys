import styles from "@/features/areamap/_shared-styles";

// サイドバーの LayerToggle コンポーネント
const LayerToggle = ({ label, isActive, disabled, onChange }: {
    label: String;
    isActive: Boolean;
    disabled?: Boolean;
    onChange: any;
}) => {
    return (
        <div style={styles.layerToggle} onClick={ !disabled ? onChange : () => {return;} }>
            <span style={styles.toggleLabel}>{label}</span>
            <div style={{ ...styles.toggleSwitch, ...(isActive ? styles.toggleSwitchActive : {}), ...(disabled ? styles.toggleSwitchDisabled : {}) }}>
                <div style={{ ...styles.toggleHandle, ...(isActive ? styles.toggleHandleActive : {}) }} />
            </div>
        </div>
    );
};

export default LayerToggle;