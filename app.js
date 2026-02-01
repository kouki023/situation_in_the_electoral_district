/**
 * 選挙区情勢マップ - メインアプリケーション
 */

// ======================================
// 都道府県名マッピング
// ======================================
const PREFECTURE_NAMES = {
    1: '北海道', 2: '青森', 3: '岩手', 4: '宮城', 5: '秋田',
    6: '山形', 7: '福島', 8: '茨城', 9: '栃木', 10: '群馬',
    11: '埼玉', 12: '千葉', 13: '東京', 14: '神奈川', 15: '新潟',
    16: '富山', 17: '石川', 18: '福井', 19: '山梨', 20: '長野',
    21: '岐阜', 22: '静岡', 23: '愛知', 24: '三重', 25: '滋賀',
    26: '京都', 27: '大阪', 28: '兵庫', 29: '奈良', 30: '和歌山',
    31: '鳥取', 32: '島根', 33: '岡山', 34: '広島', 35: '山口',
    36: '徳島', 37: '香川', 38: '愛媛', 39: '高知', 40: '福岡',
    41: '佐賀', 42: '長崎', 43: '熊本', 44: '大分', 45: '宮崎',
    46: '鹿児島', 47: '沖縄'
};

// ======================================
// 情勢の色設定
// ======================================
const OUTLOOK_COLORS = {
    5: '#2563eb',     // 安定 - 青
    4: '#60a5fa',     // 優勢 - 水色
    3: '#9333ea',   // 接戦 - 紫
    2: '#f472b6',     // 劣勢 - ピンク
    1: '#dc2626'      // 厳しい - 赤
};

const OUTLOOK_LABELS = {
    5: '安定',
    4: '優勢',
    3: '接戦',
    2: '劣勢',
    1: '厳しい'
};

// ======================================
// 候補者データ（JSONから読み込み）
// ======================================
let CANDIDATES_DATA = {};

// ======================================
// グローバル変数
// ======================================
let map;
let geojsonLayer;
let districtBounds = {};      // 選挙区ごとの境界
let prefectureBounds = {};    // 県ごとの境界
let currentPrefecture = null; // 現在ズーム中の県
let selectedLayer = null;     // 現在選択中の選挙区レイヤー

// 日本の中心座標とズームレベル
const JAPAN_CENTER = [37.0, 138.5];
const JAPAN_ZOOM = 7;

// 日本の表示範囲（南西端と北東端）- 他の国が見えないよう厳しく制限
const JAPAN_BOUNDS = [
    [24.0, 119.5],  // 南西端
    [46.0, 150.5]   // 北東端
];

// ======================================
// 初期化
// ======================================
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadElectionData();
    initSelectors();
    setupEventListeners();
});

/**
 * マップを初期化
 */
function initMap() {
    map = L.map('map', {
        center: JAPAN_CENTER,
        zoom: JAPAN_ZOOM,
        minZoom: 7,
        maxZoom: 14,
        zoomControl: true,
        maxBounds: JAPAN_BOUNDS,
        maxBoundsViscosity: 1.0  // 境界を超えてドラッグできないようにする
    });

    // ダークテーマのタイルレイヤー
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // ズームコントロールを右下に移動
    map.zoomControl.setPosition('bottomright');
}

/**
 * 選挙データを読み込む
 * グローバル変数ELECTION_DATA（election_data.jsで定義）を使用
 * 候補者データはcandidates.jsonから読み込む
 */
async function loadElectionData() {
    try {
        // 候補者データをJSONから読み込む
        const candidatesResponse = await fetch('candidates.json');
        if (!candidatesResponse.ok) {
            throw new Error('candidates.json の読み込みに失敗しました');
        }
        CANDIDATES_DATA = await candidatesResponse.json();

        // ELECTION_DATAはelection_data.jsで定義されたグローバル変数
        if (typeof ELECTION_DATA === 'undefined') {
            throw new Error('ELECTION_DATA が定義されていません。election_data.js を読み込んでください。');
        }

        // 県ごと、選挙区ごとの境界を計算
        calculateBounds(ELECTION_DATA);

        // GeoJSONレイヤーを追加
        addGeoJSONLayer(ELECTION_DATA);

        // 日本以外を隠すマスクレイヤーを追加
        //addMaskLayer(ELECTION_DATA);
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
    }
}


/**
 * 県・選挙区ごとの境界を計算
 */
function calculateBounds(geojsonData) {
    const prefectureFeatures = {};
    const districtFeatures = {};

    geojsonData.features.forEach(feature => {
        const ken = feature.properties.ken;
        const kucode = feature.properties.kucode;

        // 県ごとに分類
        if (!prefectureFeatures[ken]) {
            prefectureFeatures[ken] = [];
        }
        prefectureFeatures[ken].push(feature);

        // 選挙区ごとに分類
        if (!districtFeatures[kucode]) {
            districtFeatures[kucode] = [];
        }
        districtFeatures[kucode].push(feature);
    });

    // 県ごとの境界を計算
    Object.keys(prefectureFeatures).forEach(ken => {
        const bounds = L.latLngBounds();
        prefectureFeatures[ken].forEach(feature => {
            const layer = L.geoJSON(feature);
            bounds.extend(layer.getBounds());
        });
        prefectureBounds[ken] = bounds;
    });

    // 選挙区ごとの境界を計算
    Object.keys(districtFeatures).forEach(kucode => {
        const bounds = L.latLngBounds();
        districtFeatures[kucode].forEach(feature => {
            const layer = L.geoJSON(feature);
            bounds.extend(layer.getBounds());
        });
        districtBounds[kucode] = bounds;
    });
}

/**
 * GeoJSONレイヤーを追加
 */
function addGeoJSONLayer(geojsonData) {
    geojsonLayer = L.geoJSON(geojsonData, {
        style: getFeatureStyle,
        onEachFeature: onEachFeature
    }).addTo(map);
}

/**
 * 各フィーチャーのスタイルを取得
 */
function getFeatureStyle(feature) {
    const kucode = String(feature.properties.kucode);
    const candidateData = CANDIDATES_DATA[kucode];
    const outlook = candidateData ? candidateData.outlook : 'competitive';
    const color = OUTLOOK_COLORS[outlook] || OUTLOOK_COLORS.competitive;

    return {
        fillColor: color,
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.6
    };
}

/**
 * 各フィーチャーにイベントを設定
 */
function onEachFeature(feature, layer) {
    const ken = feature.properties.ken;
    const ku = feature.properties.ku;
    const kucode = feature.properties.kucode;
    const prefName = PREFECTURE_NAMES[ken] || `県${ken}`;
    const districtName = getDistrictName(ken, ku, kucode);

    // ツールチップ
    layer.bindTooltip(districtName, {
        className: 'district-tooltip',
        direction: 'top',
        offset: [0, -10]
    });

    // イベントリスナー
    layer.on({
        mouseover: handleMouseOver,
        mouseout: handleMouseOut,
        click: (e) => handleDistrictClick(e, feature)
    });
}

/**
 * 選挙区名を取得
 */
function getDistrictName(ken, ku, kucode) {
    const candidateData = CANDIDATES_DATA[String(kucode)];
    if (candidateData) {
        return candidateData.name;
    }
    const prefName = PREFECTURE_NAMES[ken] || `県${ken}`;
    return `${prefName}${ku}区`;
}

/**
 * マウスオーバー時のハイライト
 */
function handleMouseOver(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 2,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85
    });
    layer.bringToFront();
}

/**
 * マウスアウト時のスタイルリセット
 */
function handleMouseOut(e) {
    const layer = e.target;

    // 選択中のレイヤーはリセットしない
    if (layer === selectedLayer) {
        return;
    }

    geojsonLayer.resetStyle(layer);
}

/**
 * 選挙区クリック時の処理
 */
function handleDistrictClick(e, feature) {
    L.DomEvent.stopPropagation(e);

    const ken = feature.properties.ken;
    const ku = feature.properties.ku;
    const kucode = feature.properties.kucode;

    // 県にズーム（まだズームしていない場合）
    if (currentPrefecture !== ken) {
        zoomToPrefecture(ken);
    }

    // 以前に選択されていたレイヤーがあればスタイルをリセット
    if (selectedLayer && selectedLayer !== feature) {
        geojsonLayer.resetStyle(selectedLayer);
    }

    // 新しく選択されたレイヤーをハイライト
    const layer = e.target;
    // resetStyleで選択解除されてしまうのを防ぐため、selectedLayer更新前にスタイル適用
    // ここではマウスオーバーと同じかそれ以上に強調する
    layer.setStyle({
        weight: 3,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85
    });

    selectedLayer = layer;
    layer.bringToFront();

    // サイドバーに候補者情報を表示
    showDistrictInfo(ken, ku, kucode);
}

/**
 * 県にズーム
 */
function zoomToPrefecture(ken) {
    const bounds = prefectureBounds[ken];
    if (bounds) {
        map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 10
        });
        currentPrefecture = ken;
    }
}

/**
 * 日本全体にズームアウト
 */
function resetView() {
    map.setView(JAPAN_CENTER, JAPAN_ZOOM);
    currentPrefecture = null;

    // 選択状態を解除
    if (selectedLayer) {
        geojsonLayer.resetStyle(selectedLayer);
        selectedLayer = null;
    }

    closeSidebar();

    // ドロップダウンをリセット
    document.getElementById('prefecture-select').value = '';
    const districtSelect = document.getElementById('district-select');
    districtSelect.innerHTML = '<option value="">選挙区を選択</option>';
    districtSelect.toggleAttribute('disabled', true);
}

/**
 * 選挙区情報をサイドバーに表示
 */
function showDistrictInfo(ken, ku, kucode) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const districtNameEl = document.getElementById('district-name');
    const outlookBadge = document.getElementById('district-outlook');
    const candidatesList = document.getElementById('candidates-list');

    const districtName = getDistrictName(ken, ku, kucode);
    const candidateData = CANDIDATES_DATA[String(kucode)];

    // 選挙区名を表示
    districtNameEl.textContent = districtName;

    // 情勢バッジを更新
    const outlook = candidateData ? candidateData.outlook : 'competitive';
    outlookBadge.textContent = OUTLOOK_LABELS[outlook];
    outlookBadge.className = `outlook-badge ${outlook}`;

    // 候補者リストを生成
    if (candidateData && candidateData.candidates) {
        candidatesList.innerHTML = candidateData.candidates.map(candidate => `
            <div class="candidate-card">
                <div class="candidate-name">${candidate.name}</div>
                <div class="candidate-info">
                    <span class="candidate-tag party">${candidate.party}</span>
                    <span class="candidate-tag status-${candidate.status === '現職' ? 'incumbent' : 'new'}">${candidate.status}</span>
                </div>
            </div>
        `).join('');
    } else {
        candidatesList.innerHTML = `
            <div class="candidate-card">
                <div class="candidate-name" style="color: var(--text-secondary);">候補者情報がありません</div>
            </div>
        `;
    }

    // サイドバーを開く
    sidebar.classList.add('open');
    overlay.classList.add('visible');
}

/**
 * サイドバーを閉じる
 */
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');

    // ハイライトを解除
    if (selectedLayer) {
        geojsonLayer.resetStyle(selectedLayer);
        selectedLayer = null;
    }
}

/**
 * タッチデバイスかどうかを判定
 */
function isTouchDevice() {
    return ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0);
}

/**
 * ドロップダウンの初期化
 */
function initSelectors() {
    const prefSelect = document.getElementById('prefecture-select');
    const districtSelect = document.getElementById('district-select');

    // 都道府県プルダウンの生成
    Object.entries(PREFECTURE_NAMES).forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        prefSelect.appendChild(option);
    });

    // 都道府県変更時のイベント
    prefSelect.addEventListener('change', (e) => {
        const kenCode = e.target.value;
        if (!kenCode) {
            resetView();
            return;
        }

        // 県にズーム
        zoomToPrefecture(kenCode);

        // 選挙区プルダウンの更新
        updateDistrictSelect(kenCode);
    });

    // 選挙区変更時のイベント
    districtSelect.addEventListener('change', (e) => {
        const kucode = e.target.value;
        if (!kucode) return;

        // 選挙区を選択（クリックと同じ処理）
        selectDistrictByCode(kucode);
    });
}

/**
 * 選挙区プルダウンの更新
 */
function updateDistrictSelect(kenCode) {
    const districtSelect = document.getElementById('district-select');
    districtSelect.innerHTML = '<option value="">選挙区を選択</option>';
    districtSelect.removeAttribute('disabled');

    // この県の選挙区コードを取得してソート
    // CANDIDATES_DATAからこの県の選挙区を探す
    // ※ CANDIDATES_DATAのキーはkucode。kucodeの上2桁が県コード（例外ありそうだが、election_data.jsの実装依存）
    // election_data.jsの構造上、districtBoundsのキーを使うのが確実

    const districts = [];
    Object.keys(districtBounds).forEach(kucode => {
        // kucodeから県コードを判定するより、districtBoundsの構造を使ったほうがいいが、
        // ここではELECTION_DATAやCANDIDATES_DATAを活用する
        // 簡易的に GeoJSONのプロパティから逆引きするマップを作っておくのが本当は早いが、
        // ここでは全探索でフィルタリングする（件数少ないのでOK）

        // districtBoundsに対応するfeatureを取得したいが、
        // 単純にkucodeが一致するものとしてCANDIDATES_DATAを参照
        const data = CANDIDATES_DATA[kucode];
        // データがない場合や県が一致しない場合はスキップ
        // kucodeから県コードを抽出するロジックが必要そうだが、
        // GeoJSON読み込み時に prefectureFeatures[ken] を作っているのでそれを使う

        // prefectureFeaturesはローカル変数だったので、districtFeatures等もグローバルにするか、
        // 毎回検索するか。
        // ここではCANDIDATES_DATAを見て判断する
        if (data) {
            // CANDIDATES_DATAには ken プロパティがないかもしれない。
            // 既存コードを見ると feature.properties.ken を使っている。
            // kucode と feature の対応が必要。
        }
    });

    // 代替案: election_data.js の features を走査して、該当する県の選挙区を集める
    const districtMap = new Map();
    ELECTION_DATA.features.forEach(feature => {
        if (String(feature.properties.ken) === String(kenCode)) {
            const kucode = feature.properties.kucode;
            const ku = feature.properties.ku;
            const name = getDistrictName(feature.properties.ken, ku, kucode);

            if (!districtMap.has(kucode)) {
                districtMap.set(kucode, {
                    code: kucode,
                    name: name,
                    ku: parseInt(ku)
                });
            }
        }
    });

    // ソート（区番号順）
    const sortedDistricts = Array.from(districtMap.values()).sort((a, b) => a.ku - b.ku);

    sortedDistricts.forEach(district => {
        const option = document.createElement('option');
        option.value = district.code;
        option.textContent = district.name;
        districtSelect.appendChild(option);
    });
}

/**
 * コード指定で選挙区を選択
 */
function selectDistrictByCode(kucode) {
    // districtBounds[kucode]を使ってズームもできるが、
    // ここではクリックイベントをシミュレート、または同等の処理を行う

    // 該当するレイヤーを探す
    let targetLayer = null;
    let targetFeature = null;

    geojsonLayer.eachLayer(layer => {
        if (layer.feature.properties.kucode === kucode) {
            targetLayer = layer;
            targetFeature = layer.feature;
        }
    });

    if (targetLayer && targetFeature) {
        // 新しく選択されたレイヤーをハイライト
        if (selectedLayer && selectedLayer !== targetLayer) {
            geojsonLayer.resetStyle(selectedLayer);
        }

        selectedLayer = targetLayer;

        targetLayer.setStyle({
            weight: 3,
            opacity: 1,
            color: '#ffffff',
            fillOpacity: 0.85
        });
        targetLayer.bringToFront();

        // ズーム（必要であれば。県ズーム済みなら不要かもしれないが念のため）
        // ただし選挙区単体へのズームはしすぎになることが多いので、
        // 県ズーム状態を維持するか、少し寄るか。
        // ここでは県ズームはプルダウン変更時に行われているので、
        // 特に追加ズームはしない（ユーザー体験的にそのほうがいい場合も）
        // しかし、選挙区が画面外にある場合は移動が必要。
        map.fitBounds(targetLayer.getBounds(), {
            padding: [50, 50],
            maxZoom: 12
        });

        // サイドバー表示
        const props = targetFeature.properties;
        showDistrictInfo(props.ken, props.ku, props.kucode);
    }
}

/**
 * スマホサイズかどうかを判定
 */
function isMobileSize() {
    return window.innerWidth <= 480;
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
    // リセットボタン
    document.getElementById('reset-btn').addEventListener('click', resetView);

    // サイドバー閉じるボタン
    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);

    // オーバーレイクリックでサイドバーを閉じる
    document.getElementById('overlay').addEventListener('click', closeSidebar);

    // Escキーでサイドバーを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
        }
    });

    // スマホ向け機能
    setupMobileFeatures();
}

/**
 * スマホ向け機能を設定
 */
function setupMobileFeatures() {
    // 凡例の折りたたみ機能（スマホのみ）
    const legend = document.getElementById('legend');
    const legendTitle = legend.querySelector('h4');

    legendTitle.addEventListener('click', () => {
        if (isMobileSize()) {
            legend.classList.toggle('collapsed');
        }
    });

    // 初期状態で凡例を折りたたむ（スマホの場合）
    if (isMobileSize()) {
        legend.classList.add('collapsed');
    }

    // サイドバーのスワイプ操作
    setupSidebarSwipe();

    // 画面サイズ変更時の対応
    window.addEventListener('resize', handleResize);
}

/**
 * サイドバーのスワイプ操作を設定
 */
function setupSidebarSwipe() {
    const sidebar = document.getElementById('sidebar');
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    sidebar.addEventListener('touchstart', (e) => {
        // サイドバー上部のドラッグハンドル領域でのみスワイプ有効
        if (e.target === sidebar || e.touches[0].clientY < sidebar.getBoundingClientRect().top + 50) {
            startY = e.touches[0].clientY;
            isDragging = true;
        }
    }, { passive: true });

    sidebar.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;

        // 下方向へのスワイプのみ許可（スマホ縦画面時）
        if (deltaY > 0 && isMobileSize() && window.innerHeight > window.innerWidth) {
            sidebar.style.transform = `translateY(${deltaY}px)`;
        }
    }, { passive: true });

    sidebar.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        const deltaY = currentY - startY;

        // 100px以上スワイプしたら閉じる
        if (deltaY > 100 && isMobileSize()) {
            closeSidebar();
        }

        // スタイルをリセット
        sidebar.style.transform = '';
    }, { passive: true });
}

/**
 * 画面サイズ変更時の処理
 */
function handleResize() {
    const legend = document.getElementById('legend');

    // スマホサイズになったら凡例を折りたたむ
    if (isMobileSize() && !legend.classList.contains('collapsed')) {
        legend.classList.add('collapsed');
    }

    // スマホサイズでなくなったら展開
    if (!isMobileSize() && legend.classList.contains('collapsed')) {
        legend.classList.remove('collapsed');
    }
}
