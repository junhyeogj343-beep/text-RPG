const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc, collection } = require('firebase/firestore');
const { getAuth, signInAnonymously, signInWithCustomToken } = require('firebase/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// --- Firebase 설정 및 초기화 (Rule 3 준수) ---
const firebaseConfig = JSON.parse(__firebase_config);
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'goblin-mine-rpg';

const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
};
initAuth();

// --- 게임 상수 ---
const TORCH_DURATION = 60000; 
const REVIVE_TIME = 3000; 
const PORTAL_CAST_TIME = 3000; 
const MAX_BLEED_GAUGE = 100; 
const IDENTIFY_COST = 100;
const MAP_SIZE = 3000; 

// 마을 NPC 정의
const VILLAGE_NPCS = [
    { id: 'blacksmith', name: '대장장이 고든', x: -200, y: -200, role: '강화' },
    { id: 'merchant', name: '상인 잭', x: 200, y: -200, role: '상점/감별' },
    { id: 'vault', name: '금고지기 밥', x: -200, y: 200, role: '창고' },
    { id: 'tavern', name: '주점 주인', x: 200, y: 200, role: '팀매칭' }
];

// 던전 정보
const DUNGEON_LIST = [
    { id: 'goblin_mine', name: '고블린 광산 (Goblin Mine)', level: 1, difficulty: 'Easy', desc: '고블린들이 점령한 무작위 구조의 광산입니다.' }
];

// --- 아이템 데이터베이스 (30종 완벽 유지) ---
const ITEM_DATABASE = {
    weapons: [
        { name: "무뎌진 곡괭이", job: "Guardian", tier: "Common", type: "weapon", stats: { atk: 5, stagger: 0.05 } },
        { name: "광산용 대형 해머", job: "Guardian", tier: "Magic", type: "weapon", stats: { atk: 12, knockback: 1.8 } },
        { name: "철제 가시 방패", job: "Guardian", tier: "Rare", type: "weapon", stats: { def: 10, reflect: 0.15 } },
        { name: "강화된 채굴용 드릴", job: "Guardian", tier: "Epic", type: "weapon", stats: { atk: 25, vsElite: 1.6 } },
        { name: "녹슨 단검 쌍", job: "Vigilante", tier: "Common", type: "weapon", stats: { atk: 4, speed: 1.2 } },
        { name: "암살자의 작업용 정", job: "Vigilante", tier: "Magic", type: "weapon", stats: { critChance: 0.15, critDmg: 0.4 } },
        { name: "연사 크로스보우", job: "Vigilante", tier: "Rare", type: "weapon", stats: { atk: 15, doubleShot: true } },
        { name: "감독관의 그림자 채찍", job: "Vigilante", tier: "Legendary", type: "weapon", stats: { atk: 45, pull: true } },
        { name: "금이 간 수정 구슬", job: "Arcanist", tier: "Common", type: "weapon", stats: { magAtk: 10 } },
        { name: "광부의 다이너마이트", job: "Arcanist", tier: "Magic", type: "weapon", stats: { magAtk: 18, aoe: 150, burn: 5 } },
        { name: "황금 광석 지팡이", job: "Arcanist", tier: "Rare", type: "weapon", stats: { magAtk: 30, sight: 1.4, intScale: 0.7 } },
        { name: "마인 브레이커의 심장", job: "Arcanist", tier: "Legendary", type: "weapon", stats: { magAtk: 65, rockFall: 0.2 } }
    ],
    armor: [
        { name: "누더기 광산복", part: "Body", tier: "Common", type: "armor", stats: { def: 2 } },
        { name: "강화 가죽 조끼", part: "Body", tier: "Magic", type: "armor", stats: { hp: 80 } },
        { name: "광산 안전모", part: "Head", tier: "Rare", type: "armor", stats: { def: 8, blastResist: 0.5 } },
        { name: "철광석 흉갑", part: "Body", tier: "Rare", type: "armor", stats: { def: 30, speed: -0.1 } },
        { name: "그림자 망토", part: "Back", tier: "Epic", type: "armor", stats: { aggroReduce: 0.5 } },
        { name: "고대 광부의 작업복", part: "Body", tier: "Legendary", type: "armor", stats: { def: 25, bleedResist: 0.6 } }, 
        { name: "용암 방열복", part: "Body", tier: "Epic", type: "armor", stats: { fireImmune: true } },
        { name: "견고한 무릎 보호대", part: "Legs", tier: "Magic", type: "armor", stats: { dashCD: -1.0 } },
        { name: "광부의 두꺼운 장갑", part: "Hands", tier: "Magic", type: "armor", stats: { interactSpeed: 1.4 } },
        { name: "정신 집중의 서클릿", part: "Head", tier: "Rare", type: "armor", stats: { mpRegen: 5 } }
    ],
    accessories: [
        { name: "구리 반지", tier: "Common", type: "acc", stats: { atk: 3 } },
        { name: "올빼미의 눈 목걸이", tier: "Magic", type: "acc", stats: { sight: 1.5 } },
        { name: "카나리아의 펜던트", tier: "Rare", type: "acc", stats: { showTraps: true } },
        { name: "어둠 속의 횃불 반지", tier: "Rare", type: "acc", stats: { light: 3, darkImmune: true } },
        { name: "행운의 광석 조각", tier: "Epic", type: "acc", stats: { luck: 25 } },
        { name: "바람의 발걸음 장화", tier: "Epic", type: "acc", stats: { travelSpeed: 1.4 } },
        { name: "미다스의 곡괭이 펜던트", tier: "Legendary", type: "acc", stats: { oreDrop: true } },
        { name: "차원 이동자의 나침반", tier: "Legendary", type: "acc", stats: { portalGuide: true } }
    ],
    consumables: [
        { name: "체력 포션", type: "consumable", stats: { healHp: 50 }, price: 200 },
        { name: "마나 포션", type: "consumable", stats: { healMp: 30 }, price: 200 },
        { name: "횃불", type: "consumable", stats: { vision: true }, price: 150 }
    ]
};

const JOB_BASE = {
    Guardian: { sta: 15, str: 12, int: 5, def: 10, dex: 5 },
    Vigilante: { sta: 8, str: 8, int: 5, def: 5, dex: 15 },
    Arcanist: { sta: 6, str: 4, int: 15, def: 4, dex: 8 }
};

const MONSTER_TEMPLATES = {
    Goblin_Slave: { type: 'common', name: "고블린 노예", hp: 80, atk: 5, speed: 2.5, range: 45, aggro: 300, color: '#bef264', size: 35 },
    Goblin_Warrior: { type: 'common', name: "고블린 전사", hp: 180, atk: 12, speed: 3.2, range: 55, aggro: 350, color: '#65a30d', size: 45 },
    Goblin_Archer: { type: 'common', name: "고블린 궁수", hp: 120, atk: 8, speed: 2.8, range: 400, aggro: 450, color: '#facc15', size: 40, isRanged: true },
    Goblin_Miner: { type: 'common', name: "고블린 채굴꾼", hp: 150, atk: 10, speed: 4.2, range: 50, aggro: 300, color: '#ca8a04', size: 42 },
    Goblin_Overseer: { type: 'elite', name: "고블린 감독관", hp: 2000, atk: 45, speed: 2.3, range: 80, aggro: 500, color: '#dc2626', size: 85, patternCD: 4000 },
    Mine_Breaker: { type: 'boss', name: "마인 브레이커", hp: 15000, atk: 80, speed: 1.8, range: 180, aggro: 1000, color: '#7f1d1d', size: 180, slamCD: 6000, rockCD: 12000 }
};

// --- 게임 상태 관리 ---
const players = {};
const projectiles = [];
const monsters = {};
const groundItems = [];
const worldObjects = []; 
const worldPortals = []; 
const rooms = {}; 
const activeTrades = {};

// --- 스탯 계산 시스템 ---
function calculateDerivedStats(p) {
    const now = Date.now();
    const base = JOB_BASE[p.job];
    const s = {
        sta: base.sta + (p.addedStats?.sta || 0),
        str: base.str + (p.addedStats?.str || 0),
        int: base.int + (p.addedStats?.int || 0),
        def: base.def + (p.addedStats?.def || 0),
        dex: base.dex + (p.addedStats?.dex || 0)
    };
    let bonusHp = 0, bonusDef = 0, bonusAtk = 0, bonusSpd = 0, bonusCrit = 0, bonusCritDmg = 0;
    let sightMult = 1.0;
    let bleedReduction = 1.0;
    
    [p.equippedWeapon, p.equippedArmor, p.equippedAcc].forEach(item => {
        if (item && item.isIdentified && item.stats) {
            if (item.stats.hp) bonusHp += item.stats.hp;
            if (item.stats.def) bonusDef += item.stats.def;
            if (item.stats.atk) bonusAtk += item.stats.atk;
            if (item.stats.speed) bonusSpd += item.stats.speed;
            if (item.stats.critChance) bonusCrit += item.stats.critChance;
            if (item.stats.critDmg) bonusCritDmg += item.stats.critDmg;
            if (item.stats.sight) sightMult *= item.stats.sight;
            if (item.stats.bleedResist) bleedReduction *= (1 - item.stats.bleedResist);
        }
    });

    if (p.torchUntil && now < p.torchUntil) sightMult *= 1.5;

    return {
        maxHp: 100 + (s.sta * 20) + bonusHp,
        hpRegen: 0.5 + (s.sta * 0.1),
        physAtk: 10 + (s.str * 2) + bonusAtk,
        magAtk: 10 + (s.int * 3) + (p.equippedWeapon?.stats?.magAtk || 0),
        maxMp: 50 + (s.int * 10),
        mpRegen: 1 + (s.int * 0.2),
        damageReduc: (s.def * 0.5) + bonusDef,
        moveSpeed: (6 + (s.dex * 0.1)) * (1 + bonusSpd),
        critChance: bonusCrit,
        critDmg: 1.5 + bonusCritDmg,
        knockbackMult: p.equippedWeapon?.stats?.knockback || 1.0,
        reflect: p.equippedWeapon?.stats?.reflect || 0,
        sightRange: 350 * sightMult,
        bleedRate: 0.5 * bleedReduction
    };
}

// --- 데이터 영속성 (Firestore) ---
const getPlayerDoc = (nick) => doc(db, 'artifacts', appId, 'public', 'data', 'players', nick);

async function savePlayerData(nick, p) {
    if (!auth.currentUser) return;
    try {
        const d = {
            nickname: p.nickname, job: p.job, level: p.level, gold: p.gold,
            addedStats: p.addedStats, statPoints: p.statPoints,
            inventory: p.inventory, storage: p.storage,
            equippedWeapon: p.equippedWeapon, equippedArmor: p.equippedArmor, equippedAcc: p.equippedAcc,
            lastUpdated: Date.now()
        };
        await setDoc(getPlayerDoc(nick), d);
    } catch (e) { console.error("DB 저장 실패:", e); }
}

async function loadPlayerData(nick) {
    if (!auth.currentUser) return null;
    try {
        const s = await getDoc(getPlayerDoc(nick));
        return s.exists() ? s.data() : null;
    } catch (e) { return null; }
}

// --- 절차적 던전 생성 로직 ---
function generateDungeonContent() {
    Object.keys(monsters).forEach(key => delete monsters[key]);
    worldObjects.length = 0;
    worldPortals.length = 0;
    groundItems.length = 0;

    const startX = 500, startY = 500;

    // 1. 장애물 배치
    for(let i=0; i<30; i++) {
        let rx, ry;
        do { rx = Math.random() * MAP_SIZE; ry = Math.random() * MAP_SIZE; } 
        while (Math.hypot(rx - startX, ry - startY) < 400);
        worldObjects.push({ x: rx, y: ry, type: 'rock', size: 60 + Math.random()*40 });
    }

    // 2. 탈출 포탈 배치 (2개)
    for(let i=0; i<2; i++) {
        let px, py;
        do { px = 500 + Math.random() * (MAP_SIZE - 1000); py = 500 + Math.random() * (MAP_SIZE - 1000); }
        while (Math.hypot(px - startX, py - startY) < 1800);
        worldPortals.push({ id: `portal_${i}`, x: px, y: py });
    }

    // 3. 몬스터 배치 (일반 40, 엘리트 2, 보스 1)
    for (let i = 0; i < 40; i++) {
        const types = Object.keys(MONSTER_TEMPLATES).filter(k => MONSTER_TEMPLATES[k].type === 'common');
        const key = types[Math.floor(Math.random() * types.length)];
        let mx, my;
        do { mx = Math.random() * MAP_SIZE; my = Math.random() * MAP_SIZE; }
        while (Math.hypot(mx - startX, my - startY) < 500);
        createMonster(key, `c_${i}`, mx, my);
    }
    for (let i = 0; i < 2; i++) {
        let ex, ey;
        do { ex = Math.random() * MAP_SIZE; ey = Math.random() * MAP_SIZE; }
        while (Math.hypot(ex - startX, ey - startY) < 1000);
        createMonster('Goblin_Overseer', `elite_${i}`, ex, ey);
    }
    let bx, by;
    do { bx = 500 + Math.random() * (MAP_SIZE - 1000); by = 500 + Math.random() * (MAP_SIZE - 1000); }
    while (Math.hypot(bx - startX, by - startY) < 1500);
    createMonster('Mine_Breaker', 'boss_1', bx, by);
}

function createMonster(key, id, fx, fy) {
    const t = MONSTER_TEMPLATES[key];
    monsters[id] = { id, key, ...t, maxHp: t.hp, x: fx, y: fy, lastAtk: 0, lastPattern: 0 };
}

// --- 서버 메인 루프 (데미지 즉각 적용) ---
setInterval(() => {
    const now = Date.now();
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pj = projectiles[i];
        pj.x += pj.vx; pj.y += pj.vy; pj.life -= 16;
        if (pj.fromPlayer) {
            Object.values(monsters).forEach(m => {
                if (m.hp <= 0) return;
                if (Math.sqrt((pj.x-m.x)**2 + (pj.y-m.y)**2) < m.size/2 + 20) {
                    let dmg = pj.damage;
                    if (Math.random() < pj.critChance) dmg *= pj.critDmg;
                    if (m.type !== 'common') dmg *= (pj.vsElite || 1.0);
                    m.hp -= dmg; // 즉시 데미지 반영
                    const ang = Math.atan2(m.y-pj.y, m.x-pj.x);
                    m.x += Math.cos(ang) * (25 * pj.kbMult); m.y += Math.sin(ang) * (25 * pj.kbMult);
                    pj.life = 0;
                    if (m.hp <= 0) handleMonsterDeath(m, pj.owner);
                }
            });
        } else {
            Object.values(players).forEach(p => {
                if (!p.inDungeon || p.hp <= 0 || p.downed || p.isDead) return;
                if (Math.sqrt((pj.x-p.x)**2 + (pj.y-p.y)**2) < 35) {
                    p.hp -= Math.max(1, pj.damage - calculateDerivedStats(p).damageReduc);
                    pj.life = 0;
                }
            });
        }
        if (pj.life <= 0) projectiles.splice(i, 1);
    }

    Object.values(monsters).forEach(m => {
        if (m.hp <= 0) return;
        let target = null; let minDist = m.aggro;
        Object.values(players).forEach(p => {
            if (!p.inDungeon || p.isDead || p.downed) return;
            const d = Math.sqrt((p.x-m.x)**2 + (p.y-m.y)**2);
            if (d < minDist) { minDist = d; target = p; }
        });
        if (target) {
            const stats = calculateDerivedStats(target);
            if (m.key === 'Goblin_Overseer' && now - m.lastPattern > m.patternCD) {
                const ang = Math.atan2(target.y-m.y, target.x-m.x);
                target.x += Math.cos(ang)*200; target.y += Math.sin(ang)*200;
                target.hp -= m.atk * 1.5; m.lastPattern = now; return;
            }
            if (m.key === 'Mine_Breaker' && now - m.lastPattern > m.slamCD) {
                io.emit('bossAction', { type: 'slam', x: m.x, y: m.y });
                Object.values(players).forEach(p => {
                    if (p.inDungeon && Math.sqrt((p.x-m.x)**2 + (p.y-m.y)**2) < 300) {
                        p.hp -= m.atk * 1.3; const a = Math.atan2(p.y-m.y, p.x-m.x);
                        p.x += Math.cos(a)*150; p.y += Math.sin(a)*150;
                    }
                });
                m.lastPattern = now; return;
            }
            if (minDist < m.range) {
                if (now - m.lastAtk > 1500) {
                    target.hp -= Math.max(1, m.atk - stats.damageReduc);
                    if (stats.reflect > 0) m.hp -= m.atk * stats.reflect;
                    m.lastAtk = now;
                }
            } else {
                const a = Math.atan2(target.y-m.y, target.x-m.x);
                m.x += Math.cos(a)*m.speed; m.y += Math.sin(a)*m.speed;
            }
        }
    });

    Object.values(players).forEach(p => {
        const d = calculateDerivedStats(p);
        p.sightRange = d.sightRange;
        if (p.inDungeon && !p.isDead) {
            if (p.hp <= 0 && !p.downed) triggerDowned(p);
            if (p.downed) {
                p.bleedGauge -= d.bleedRate;
                if (p.bleedGauge <= 0) handleFinalDeath(p);
            } else {
                if (p.hp < d.maxHp) p.hp = Math.min(d.maxHp, p.hp + d.hpRegen * 0.1);
            }
        }
        if (p.reviveEndTime && now >= p.reviveEndTime) completeRevive(p);
        if (p.portalEndTime && now >= p.portalEndTime) handleTeamEscape(p);
        if (p.isDead && p.inDungeon && p.roomPwd) {
            const survivors = rooms[p.roomPwd]?.members.filter(id => players[id] && !players[id].isDead && players[id].inDungeon);
            if (!survivors || survivors.length === 0) returnToVillage(p);
            else if (!p.spectateTargetId || !players[p.spectateTargetId] || players[p.spectateTargetId].isDead) p.spectateTargetId = survivors[0];
        }
    });

    io.emit('stateUpdate', { players, projectiles, monsters: Object.values(monsters).filter(m => m.hp > 0), groundItems, worldPortals, worldObjects, npcs: VILLAGE_NPCS });
}, 16);

// --- 핵심 핸들러 ---
function triggerDowned(p) { p.downed = true; p.hp = 0; p.bleedGauge = MAX_BLEED_GAUGE; io.to(p.id).emit('sysMsg', "기절했습니다! 팀원을 기다리세요."); }
function handleFinalDeath(p) {
    const drops = p.inventory.filter(i => i.type !== "consumable");
    drops.forEach(item => groundItems.push({ id: Math.random().toString(36).substr(2,9), x: p.x + Math.random()*40-20, y: p.y + Math.random()*40-20, data: { ...item } }));
    p.inventory = p.inventory.filter(i => i.type === "consumable");
    p.hp = 0; p.downed = false; p.isDead = true; io.to(p.id).emit('sysMsg', "최종 사망하여 관전 모드에 진입합니다.");
}

function handleMonsterDeath(m, killerId) {
    const killer = players[killerId]; if (!killer) return;
    killer.gold += (m.type === 'boss' ? 1000 : (m.type === 'elite' ? 200 : Math.floor(Math.random()*10)+1));
    let chance = m.type === 'boss' ? 1.0 : (m.type === 'elite' ? 0.6 : 0.15);
    if (Math.random() < chance) {
        const cat = ['weapons', 'armor', 'accessories'][Math.floor(Math.random()*3)];
        let tier = 'Common'; const tr = Math.random();
        if (m.type === 'boss') tier = tr < 0.1 ? 'Legendary' : 'Epic';
        else if (m.type === 'elite') tier = tr < 0.05 ? 'Epic' : (tr < 0.4 ? 'Rare' : 'Magic');
        else tier = tr < 0.01 ? 'Rare' : (tr < 0.1 ? 'Magic' : 'Common');
        const itemTemplate = ITEM_DATABASE[cat].find(i => i.tier === tier);
        if (itemTemplate) groundItems.push({ id: Math.random().toString(36).substr(2,9), x: m.x, y: m.y, data: { ...itemTemplate, id: Math.random().toString(36).substr(2,5), isIdentified: false } });
    }
    if (m.type === 'boss') {
        io.to(killer.roomPwd).emit('sysMsg', "★보스 클리어! 10초 뒤 귀환합니다★");
        setTimeout(() => { rooms[killer.roomPwd]?.members.forEach(id => { if (players[id]) returnToVillage(players[id]); }); }, 10000);
    }
}

function handleTeamEscape(leader) { rooms[leader.roomPwd]?.members.forEach(id => { if (players[id]) returnToVillage(players[id]); }); }
function returnToVillage(p) { p.isDead = false; p.downed = false; p.inDungeon = false; p.hp = 1; p.x = 0; p.y = 0; const socket = io.sockets.sockets.get(p.id); if (socket) socket.emit('mapChange', { map: 'village' }); }
function completeRevive(p) { const target = players[p.reviveTargetId]; if (target?.downed) { target.downed = false; target.hp = calculateDerivedStats(target).maxHp * 0.3; } p.reviveEndTime = null; p.reviveTargetId = null; }

// --- 소켓 이벤트 핸들러 (아이템 선점 로직 포함) ---
io.on('connection', (socket) => {
    socket.on('checkNickname', async (nick) => { const d = await loadPlayerData(nick); socket.emit('nicknameStatus', d ? { exists: true, job: d.job, level: d.level } : { exists: false }); });
    socket.on('join', async (data) => {
        let pData = await loadPlayerData(data.nickname) || { nickname: data.nickname, job: data.job, level: 1, gold: 5000, statPoints: 0, addedStats: { sta: 0, str: 0, int: 0, def: 0, dex: 0 }, inventory: [], storage: [], equippedWeapon: null, equippedArmor: null, equippedAcc: null };
        const d = calculateDerivedStats(pData);
        players[socket.id] = { ...pData, id: socket.id, x: 0, y: 0, hp: d.maxHp, inDungeon: false, torchUntil: 0, roomPwd: null };
        socket.emit('joined', players[socket.id]);
    });
    socket.on('move', (data) => { const p = players[socket.id]; if (p && !p.downed && !p.isDead) { p.x = data.x; p.y = data.y; p.dir = data.dir; p.reviveEndTime = null; p.portalEndTime = null; } });
    socket.on('action', (data) => {
        const p = players[socket.id]; if (!p || p.downed || p.isDead) return;
        if (data.type === 'attack') {
            const d = calculateDerivedStats(p);
            projectiles.push({ fromPlayer: true, owner: p.id, x: p.x, y: p.y, vx: Math.cos(data.angle)*15, vy: Math.sin(data.angle)*15, life: 1000, damage: d.physAtk, critChance: d.critChance, critDmg: d.critDmg, kbMult: d.knockbackMult, aoe: p.equippedWeapon?.stats?.aoe || 0, vsElite: p.equippedWeapon?.stats?.vsElite || 1.0 });
        } else if (data.type === 'skill') handleSkill(socket, p, data.skillIdx, data.angle);
    });
    socket.on('joinRoom', (pwd) => { if (!rooms[pwd]) rooms[pwd] = { leader: socket.id, members: [] }; rooms[pwd].members.push(socket.id); players[socket.id].roomPwd = pwd; socket.join(pwd); });
    socket.on('selectDungeon', (did) => {
        const r = rooms[players[socket.id]?.roomPwd];
        if (r?.leader === socket.id) {
            generateDungeonContent();
            r.members.forEach(id => { if (players[id]) { players[id].inDungeon = true; players[id].x = 500; players[id].y = 500; io.to(id).emit('mapChange', { map: 'dungeon' }); } });
        }
    });

    // --- 아이템 획득 로직 (먼저 먹는 사람이 임자) ---
    socket.on('pickupItem', (id) => {
        const p = players[socket.id];
        if (!p || p.isDead || p.downed) return;
        const idx = groundItems.findIndex(i => i.id === id);
        // 서버에서 이미 삭제되었는지(다른 사람이 먹었는지) 먼저 확인
        if (idx !== -1) {
            const item = groundItems[idx];
            if (Math.hypot(p.x - item.x, p.y - item.y) < 120) {
                // 인벤토리에 추가하고 바닥 데이터에서 즉시 제거
                p.inventory.push(item.data);
                groundItems.splice(idx, 1); 
                socket.emit('sysMsg', `${item.data.name}을(를) 획득했습니다!`);
                // 전체 클라이언트에 동기화하여 화면에서 즉시 사라지게 함 (stateUpdate로 자동 처리됨)
            }
        }
    });

    socket.on('disconnect', async () => {
        const p = players[socket.id];
        if (p) {
            if (p.inDungeon) { p.inventory = p.inventory.filter(i => i.type === "consumable"); p.inDungeon = false; if (p.roomPwd) io.to(p.roomPwd).emit('sysMsg', `${p.nickname}님이 전장 이탈로 장비를 잃었습니다.`); }
            if (p.roomPwd && rooms[p.roomPwd]) {
                rooms[p.roomPwd].members = rooms[p.roomPwd].members.filter(id => id !== socket.id);
                if (rooms[p.roomPwd].members.length === 0) delete rooms[p.roomPwd];
                else if (rooms[p.roomPwd].leader === socket.id) rooms[p.roomPwd].leader = rooms[p.roomPwd].members[0];
            }
            await savePlayerData(p.nickname, p); delete players[socket.id];
        }
    });
});

function handleSkill(socket, p, idx, angle) {
    const d = calculateDerivedStats(p);
    const skills = {
        Guardian: [
            { cost: 15, logic: () => { p.x += Math.cos(angle)*200; p.y += Math.sin(angle)*200; } },
            { cost: 30, logic: () => { p.hp = Math.min(d.maxHp, p.hp + 50); } },
            { cost: 10, logic: () => { io.to(p.roomPwd).emit('skillEffect', { type: 'shout', x: p.x, y: p.y }); } }
        ],
        Vigilante: [
            { cost: 10, logic: () => { p.x += Math.cos(angle)*250; p.y += Math.sin(angle)*250; } },
            { cost: 20, logic: () => { for(let i=0; i<8; i++) projectiles.push({ fromPlayer: true, owner: p.id, x: p.x, y: p.y, vx: Math.cos(angle-0.5+i*0.125)*15, vy: Math.sin(angle-0.5+i*0.125)*15, life: 500, damage: 20 }); } },
            { cost: 15, logic: () => {} }
        ],
        Arcanist: [
            { cost: 25, logic: () => { for(let i=0; i<5; i++) projectiles.push({ fromPlayer: true, owner: p.id, x: p.x, y: p.y, vx: Math.cos(angle+(i-2)*0.2)*12, vy: Math.sin(angle+(i-2)*0.2)*12, life: 1000, damage: 25 }); } },
            { cost: 40, logic: () => { worldObjects.push({ x: p.x+Math.cos(angle)*100, y: p.y+Math.sin(angle)*100, type: 'ice_wall', expiresAt: Date.now()+6000 }); } },
            { cost: 50, logic: () => { io.to(p.roomPwd).emit('skillEffect', { type: 'explode', x: p.x, y: p.y }); } }
        ]
    };
    const s = skills[p.job][idx];
    if (p.mp >= s.cost) { p.mp -= s.cost; s.logic(); }
}

server.listen(3000, () => console.log("Real-time Action RPG Server Online"));