
/**
 * 指定したプロパティでグループ化・ソート
 * 
 * @param {Object} data - 元データ
 * @param groupBy - グループ化したいプロパティ名
 * @param sortBy - ソートキーとなるプロパティ名
 * @param sortOrder - ソート順（'asc' または 'desc'）
 * @returns {Object} - グループ化されたデータ
 */
export const groupedDataProcessor = (data: any[], groupBy: string, sortBy: string, sortOrder: string) => {
    const groupedData = data.reduce((prev, curr) => {

        const key = groupBy.split('.').reduce((acc, idx) => acc?.[idx], curr);
        if (!prev[key]) {
            prev[key] = [curr];
        } else {
            const newValue = [...prev[key], curr];
            const sortByVal = sortBy.split('.').reduce((acc, idx) => acc?.[idx], curr);
            const arr = newValue.sort((a, b) => {
                if (sortOrder === 'asc') {
                    return a[sortByVal] < b[sortByVal] ? -1 : 1;
                } else {
                    return a[sortByVal] < b[sortByVal] ? 1 : -1;
                }
            });
            prev[key] = arr;
        }
        return prev;
    }, {});

    return groupedData;
}

/**
 * グループ化されたデータから指定されたプロパティの平均値を計算
 * 
 * @param {Object} groupedData - グループ化済データ
 * @param {string} propertyPath - 平均値を計算するプロパティのパス (例: 'properties.temp')
 * @param {string} [targetPropertyName] - 結果に設定するプロパティ名（nullの場合はプロパティパスの最後の部分となる）
 * @returns {Array} - 平均値が計算された新しいオブジェクトの配列
 */
export const calculateGroupAverages = (groupedData: any, propertyPath: string, targetPropertyName?: string | null) => {
    const pathParts = propertyPath.split('.');
    const resultPropertyName = targetPropertyName || pathParts[pathParts.length - 1];

    return Object.entries(groupedData).map(([groupName, records]: any) => {
        const values = records.map(record => {
            return pathParts.reduce((obj, part) => obj && obj[part], record);
        });

        const sum = values.reduce((prev, curr) => prev + (curr || 0), 0);
        const avg = sum / values.length;

        const result = { ...records[0] };

        let target = result;
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part];
        }

        target[resultPropertyName] = avg;

        return result;
    });
}

// 飽和水蒸気圧を計算する関数 (hPa)
function saturationVaporPressure(T: number): number {
    return 6.1078 * Math.pow(10, (7.5 * T) / (T + 237.3));
}

// 飽和水蒸気密度を計算する関数 (g/m³)
export const saturationVaporDensity = (T: number) =>  {
    const es = saturationVaporPressure(T);
    return 217 * es / (T + 273.15);
}

export const calculateDewPoint = (T: number, RH: number): number => {
    // 飽和水蒸気圧を計算
    const es = saturationVaporPressure(T);
    // 現在の水蒸気圧を計算
    const e = (RH / 100) * es;
    // 露点温度を計算
    return (237.3 * Math.log(e / 6.1078)) / (7.5 - Math.log(e / 6.1078));
}

export const calculateWBGT = (T: number, RH: number) => {
    // WBGTの計算式
    const Tn = T * 0.725 + RH * 0.0368 + T * RH * 0.00364 - 3.246;

    let status = '';
    let style = {};
    if (Tn >= 25 && Tn < 28) {
        status = '警戒';
        style = { backgroundColor: '#ede911', color: '#fff'}; // オレンジ色
    } else if (Tn >= 28 && Tn < 31) {
        status = '厳重警戒';
        style = { backgroundColor: '#ff9800', color: '#fff'}; // オレンジ色
    } else if (Tn >= 31) {
        status = '危険';
        style = { backgroundColor: '#f44336', color: '#fff'}; // 赤色
    } else {
        status = '注意';
        style = { backgroundColor: '#fff' }; // 白
    }

    return { wbgt: Tn, status, style };
}