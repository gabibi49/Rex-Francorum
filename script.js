// --- MOTEUR AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
}
function playClick() { playSound(800, 'sine', 0.1); }
function playWar() { playSound(150, 'sawtooth', 0.4); }
function playVictory() { playSound(600, 'sine', 0.2); setTimeout(()=>playSound(800, 'sine', 0.3), 200); }

// --- DONNÉES DU JEU ---
let gameId = 1;
let date = { year: 1066, month: 0 };
let gameSpeed = 0;
let playerCharId = 1;
let selectedProvinceId = null;
let gameLoopId = null;

const provincesData = [
    { id: 1, name: "Île-de-France", baseIncome: 10, baseTroops: 200 },
    { id: 2, name: "Normandie", baseIncome: 8, baseTroops: 250 },
    { id: 3, name: "Bretagne", baseIncome: 6, baseTroops: 150 },
    { id: 4, name: "Champagne", baseIncome: 7, baseTroops: 180 },
    { id: 5, name: "Flandre", baseIncome: 9, baseTroops: 300 },
    { id: 6, name: "Aquitaine", baseIncome: 8, baseTroops: 220 },
    { id: 7, name: "Bourgogne", baseIncome: 7, baseTroops: 180 },
    { id: 8, name: "Toulouse", baseIncome: 6, baseTroops: 150 },
    { id: 9, name: "Orléanais", baseIncome: 7, baseTroops: 160 },
    { id: 10, name: "Anjou", baseIncome: 6, baseTroops: 140 },
    { id: 11, name: "Poitou", baseIncome: 6, baseTroops: 140 },
    { id: 12, name: "Dauphiné", baseIncome: 5, baseTroops: 120 }
];

let characters = [];
let provinces = [];

// --- INITIALISATION ---
function init() {
    provincesData.forEach(p => { provinces.push({ ...p, owner: null, troops: p.baseTroops }); });

    createCharacter("Philippe", "Capet", 14, 1, true); 
    createCharacter("Guillaume", "Normandie", 38, 2, true); 
    createCharacter("Conan", "Bretagne", 41, 3, true); 
    createCharacter("Hugues", "Bourgogne", 51, 7, true);
    createCharacter("Aimeri", "Poitou", 45, 11, true);
    createCharacter("Foulques", "Anjou", 37, 10, true);
    assignVassal(7, 1); assignVassal(11, 1); assignVassal(10, 1);

    createCharacter("Adèle", "Champagne", 20, 4, false);
    createCharacter("Mathilde", "Flandre", 15, 5, false);
    createCharacter("Berthe", "Hollande", 16, null, false, true);
    for(let i=0; i<3; i++) createCharacter(generateName(false), "Courtisan", Math.floor(Math.random()*15)+16, null, false, true);

    renderMap(); updateUI(); selectCharacter(playerCharId);
    addLog("1066. Le Roi Philippe règne. Unifiez la France !"); setSpeed(1);
}

function createCharacter(name, dynasty, age, ownedProvinceId, isMale, isCourtier = false) {
    const stats = { martial: Math.floor(Math.random()*10)+3, diplomacy: Math.floor(Math.random()*10)+3, stewardship: Math.floor(Math.random()*10)+3 };
    const char = { id: gameId++, name, dynasty, age: age || 18, isMale, stats, traits: [], gold: isCourtier ? 0 : 100, prestige: isCourtier ? 0 : 50, spouse: null, alive: true, isCourtier, primaryTitle: null, liege: null };
    if(ownedProvinceId) { char.primaryTitle = `Héritier(e) de ${provinces[ownedProvinceId-1].name}`; provinces[ownedProvinceId-1].owner = char.id; }
    characters.push(char); return char;
}
function assignVassal(vassalId, liegeId) { let vassal = characters.find(c => c.id === vassalId); if(vassal) vassal.liege = liegeId; }

// --- CALCULS TRANSPARENTS ---
function getArmySize(char) { if(char.isCourtier) return 0; return provinces.filter(p => p.owner === char.id).reduce((sum, p) => sum + p.troops, 0); }
function getIncomeBreakdown(char) {
    if(char.isCourtier) return { total: 0 };
    const domain = provinces.filter(p => p.owner === char.id).reduce((sum, p) => sum + p.baseIncome, 0);
    const stewardship = char.stats.stewardship;
    const vassalTax = characters.filter(c => c.liege === char.id && c.alive && !c.isCourtier).reduce((sum, v) => sum + Math.floor((provinces.filter(p=>p.owner===v.id).reduce((s,p)=>s+p.baseIncome,0) + v.stats.stewardship) * 0.1), 0);
    return { domain, stewardship, vassalTax, total: domain + stewardship + vassalTax };
}
function getHeir(char) {
    const dynastyMembers = characters.filter(c => c.alive && c.dynasty === char.dynasty && c.id !== char.id);
    const males = dynastyMembers.filter(c => c.isMale).sort((a,b) => b.age - a.age);
    const females = dynastyMembers.filter(c => !c.isMale).sort((a,b) => b.age - a.age);
    return males[0] || females[0] || null;
}

// --- RENDU & UI ---
function renderMap() {
    provinces.forEach(p => {
        const path = document.getElementById(`prov-${p.id}`); if(!path) return;
        let color = "#aaa"; const owner = characters.find(c => c.id === p.owner);
        if(p.owner === playerCharId) color = "#ffd700";
        else if(owner && owner.liege === playerCharId) color = "#cd5c5c";
        else if(owner) color = "#5555ff";
        path.setAttribute("fill", color); path.onclick = () => { playClick(); selectProvince(p.id); };
    });
}

function updateUI() {
    document.getElementById('date').textContent = `${getMonthName(date.month)} ${date.year}`;
    const player = characters.find(c => c.id === playerCharId);
    if(player) { document.getElementById('gold').textContent = Math.floor(player.gold); document.getElementById('troops').textContent = getArmySize(player); document.getElementById('prestige').textContent = player.prestige; }
    const pct = Math.round((provinces.filter(p => p.owner === playerCharId).length / provinces.length) * 100);
    document.getElementById('unification-bar').value = pct; document.getElementById('unification-pct').textContent = `${pct}%`;
    if(pct >= 75 && !window.gameWon) { window.gameWon = true; setSpeed(0); playVictory(); addLog("🏆 VICTOIRE !"); setTimeout(() => alert("VICTOIRE !"), 500); }
}

function selectCharacter(id) {
    const char = characters.find(c => c.id === id); if(!char || !char.alive) return;
    const infoDiv = document.getElementById('char-info'); const income = getIncomeBreakdown(char); const army = getArmySize(char); const heir = getHeir(char);
    let html = `<h3>${char.name} ${char.dynasty} ${char.id === playerCharId ? '(VOUS)' : ''}</h3>`;
    html += `<p>Âge: ${char.age} | ${char.isMale ? '♂' : '♀'} | ${char.primaryTitle || 'Courtisan'}</p>`;
    html += `<p>⚔️${char.stats.martial} 🗣️${char.stats.diplomacy} 💰${char.stats.stewardship}</p>`;
    html += `<p><strong>Armée: ${army}</strong></p>`;
    html += `<p><strong>Or: ${Math.floor(char.gold)}</strong> <span class="detail-line">(Revenus: +${income.total}/mois)</span></p>`;
    const spouse = char.spouse ? characters.find(c => c.id === char.spouse) : null;
    html += `<p>Époux/se: ${spouse ? `${spouse.name} ${spouse.dynasty}` : 'Célibataire'}</p>`;
    if(heir) html += `<p>Héritier: ${heir.name} (Âge: ${heir.age})</p>`;
    else if(char.id === playerCharId) html += `<p style="color:red;">Héritier: AUCUN</p>`;
    infoDiv.innerHTML = html;
}

function selectProvince(id) {
    selectedProvinceId = id;
    const prov = provinces[id-1]; const owner = characters.find(c => c.id === prov.owner); const player = characters.find(c => c.id === playerCharId);
    const actionsDiv = document.getElementById('actions');
    const btnMarry = document.getElementById('btn-marry');
    const btnWar = document.getElementById('btn-war');
    const btnRecruit = document.getElementById('btn-recruit');

    document.getElementById('panel-title').innerText = `Province: ${prov.name} (Troupes: ${prov.troops})`;

    if(owner) {
        selectCharacter(owner.id);
        if(owner.id === playerCharId) {
            // MA PROVINCE
            actionsDiv.style.display = 'block';
            btnMarry.style.display = player.spouse ? 'none' : 'block';
            btnWar.style.display = 'none';
            btnRecruit.style.display = 'block';
            btnRecruit.innerText = `🛡️ Renforcer Troupes (+100⚔️, -50💰)`;
            btnRecruit.disabled = player.gold < 50;
            btnRecruit.onclick = () => recruitTroops(id);
        } else if(owner.liege === playerCharId) {
            // VASSAL
            actionsDiv.style.display = 'block'; btnMarry.style.display = 'none'; btnRecruit.style.display = 'none';
            btnWar.style.display = 'block'; btnWar.innerText = `🛡️ Revendiquer (Vassal) [-50🛡️]`; btnWar.disabled = player.prestige < 50; btnWar.onclick = () => claimProvince(id, 'vassal');
        } else {
            // ENNEMI
            actionsDiv.style.display = 'block'; btnMarry.style.display = 'none'; btnRecruit.style.display = 'none';
            btnWar.style.display = 'block'; btnWar.innerText = `⚔️ Conquérir (Ennemi) [-80🛡️]`; btnWar.disabled = player.prestige < 80; btnWar.onclick = () => claimProvince(id, 'enemy');
        }
    } else {
        // NEUTRE
        document.getElementById('char-info').innerHTML = `<h3>${prov.name}</h3><p>Territoire neutre (${prov.troops} troupes locales).</p>`;
        actionsDiv.style.display = 'block'; btnMarry.style.display = 'none'; btnRecruit.style.display = 'none';
        btnWar.style.display = 'block'; btnWar.innerText = `🏕️ Coloniser (Neutre) [-30💰]`; btnWar.disabled = player.gold < 30; btnWar.onclick = () => claimProvince(id, 'neutral');
    }
}

// --- MÉCANIQUES : RECRUTEMENT ---
function recruitTroops(provId) {
    const prov = provinces[provId-1]; const player = characters.find(c => c.id === playerCharId);
    if(player.gold >= 50) {
        playClick();
        player.gold -= 50;
        prov.troops += 100; // On ajoute 100 hommes à la province
        addLog(`[Armée] 100 troupes recrutées à ${prov.name}. (-50 Or)`);
        updateUI(); selectProvince(provId);
    }
}

// --- MÉCANIQUES : GUERRE ---
function claimProvince(provId, warType) {
    playWar(); const prov = provinces[provId-1]; const player = characters.find(c => c.id === playerCharId); const owner = characters.find(c => c.id === prov.owner);

    if(warType === 'neutral') {
        player.gold -= 30; addLog(`[Colonisation] ${prov.name} (-30 Or).`);
        if(getArmySize(player) > prov.troops * 0.5) {
            prov.owner = playerCharId; prov.troops -= Math.floor(prov.troops*0.2); playVictory();
            addLog(`[Succès] ${prov.name} colonisé !`);
        } else { addLog(`[Échec] Armée trop faible.`); provinces.filter(p=>p.owner===playerCharId).forEach(p => p.troops = Math.floor(p.troops * 0.7)); }
    } 
    else if(warType === 'vassal') {
        player.prestige -= 50; addLog(`[Guerre] Revendication sur ${prov.name} (-50 Prestige).`);
        const pRoll = getArmySize(player) * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
        const dRoll = getArmySize(owner) * (0.8 + Math.random() * 0.4) + owner.stats.martial * 10;
        if(pRoll > dRoll) {
            playVictory(); prov.owner = playerCharId; owner.liege = null; owner.primaryTitle = "Sans-terre";
            if(!provinces.some(p => p.owner === owner.id)) { owner.alive = false; addLog(`${owner.name} déchu et exilé.`); }
            addLog(`[Victoire] ${prov.name} annexé au domaine royal.`);
        } else { addLog(`[Défaite] ${owner.name} s'émancipe.`); owner.liege = null; provinces.filter(p=>p.owner===playerCharId).forEach(p => p.troops = Math.floor(p.troops * 0.6)); }
    }
    else if(warType === 'enemy') {
        player.prestige -= 80; addLog(`[Guerre] Invasion de ${prov.name} (-80 Prestige).`);
        const pRoll = getArmySize(player) * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
        const dRoll = getArmySize(owner) * (0.8 + Math.random() * 0.4) + owner.stats.martial * 10;
        if(pRoll > dRoll) {
            playVictory(); prov.owner = playerCharId; player.prestige += 50; owner.alive = false;
            if(owner.spouse) { characters.find(c=>c.id===owner.spouse).spouse=null; }
            addLog(`[Victoire] ${prov.name} conquis ! ${owner.name} est mort.`);
        } else { addLog(`[Défaite] Invasion repoussée.`); provinces.filter(p=>p.owner===playerCharId).forEach(p => p.troops = Math.floor(p.troops * 0.5)); player.prestige -= 30; }
    }
    renderMap(); updateUI(); selectProvince(provId);
}

// --- MÉCANIQUES : TEMPS & MARIAGE ---
function nextMonth() {
    date.month++; if(date.month > 11) { date.month = 0; date.year++; }
    characters.forEach(char => {
        if(!char.alive) return;
        if(Math.random() < 0.002 + (char.age > 40 ? (char.age-40)*0.001 : 0)) { killCharacter(char); return; }
        // Revenus silencieux
        if(!char.isCourtier) { char.gold += getIncomeBreakdown(char).total; }
        if(char.spouse && char.isMale) {
            const spouse = characters.find(c => c.id === char.spouse);
            if(spouse && !spouse.pregnant && spouse.age >= 16 && Math.random() < 0.04) { spouse.pregnant = true; addLog(`[Famille] ${spouse.name} est enceinte !`); }
        }
    });
    characters.filter(c => c.pregnant).forEach(spouse => {
        if(Math.random() < 0.2) {
            spouse.pregnant = false; if(Math.random() < 0.1) { addLog("[Tragédie] Mort-né."); }
            else { const child = createCharacter(generateName(Math.random()>0.5), spouse.dynasty, 0, null, Math.random()>0.5, true); addLog(`[Naissance] ${child.name} !`); }
        }
    });
    if(Math.random() < 0.03) triggerRandomEvent();
    updateUI(); renderMap();
}

function killCharacter(char) {
    char.alive = false; addLog(`[Mort] ${char.name} (Âge: ${char.age}).`);
    if(char.spouse) { const ex = characters.find(c => c.id === char.spouse); if(ex) ex.spouse=null; char.spouse=null; }
    if(char.id === playerCharId) handlePlayerSuccession(char); else handleAISuccession(char);
}
function handlePlayerSuccession(deadChar) {
    const heir = getHeir(deadChar);
    if(heir) { playerCharId = heir.id; provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; }); heir.gold += deadChar.gold; heir.prestige += deadChar.prestige; addLog(`[Succession] ${heir.name} devient Roi.`); selectCharacter(playerCharId); }
    else { setSpeed(0); document.getElementById('game-over-screen').style.display = 'flex'; }
}
function handleAISuccession(deadChar) {
    if(deadChar.spouse === playerCharId && provinces.some(p => p.owner === deadChar.id)) { addLog(`[Succession] Terre de ${deadChar.name} au Domaine Royal.`); provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = playerCharId; }); return; }
    const heir = getHeir(deadChar);
    if(heir) { provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; }); addLog(`[Succession] ${heir.name} hérite.`); }
    else { provinces.forEach(p => { if(p.owner === deadChar.id) { p.owner = null; addLog(`${p.name} neutre.`); }}); }
}

function openMarriageModal() {
    playClick(); const modal = document.getElementById('marriage-modal'); const listDiv = document.getElementById('spouse-list'); const player = characters.find(c => c.id === playerCharId);
    if(player.spouse) { addLog("Déjà marié !"); return; }
    const candidates = characters.filter(c => c.alive && !c.spouse && !c.isMale && c.id !== playerCharId && c.age >= 14);
    listDiv.innerHTML = '';
    if(candidates.length === 0) { listDiv.innerHTML = "<p>Aucune femme.</p>"; }
    else {
        candidates.sort((a,b) => (provinces.some(p=>p.owner===b.id)?1:0) - (provinces.some(p=>p.owner===a.id)?1:0));
        candidates.forEach(c => {
            const div = document.createElement('div'); div.className = 'char-card';
            let str = ""; if(provinces.some(p=>p.owner===c.id)) str = `<span style='color:gold;'>🧬 Héritière !</span>`;
            div.innerHTML = `${c.name} (Âge:${c.age}, 💰${c.stats.stewardship}) ${str}`;
            div.onclick = () => marry(playerCharId, c.id); listDiv.appendChild(div);
        });
    }
    modal.style.display = 'block';
}
function autoMarry() { playClick(); const c = characters.filter(c => c.alive && !c.spouse && !c.isMale && c.id !== playerCharId && c.age >= 14); if(c.length>0) marry(playerCharId, c[0].id); }
function marry(id1, id2) {
    const c1 = characters.find(c => c.id === id1); const c2 = characters.find(c => c.id === id2);
    c1.spouse = id2; c2.spouse = id1; c1.prestige += 20;
    if(c2.liege && c2.liege !== playerCharId) { c2.liege = null; addLog(`${c2.name} rejoint votre cour.`); }
    addLog(`[Mariage] ${c1.name} épouse ${c2.name} !`);
    document.getElementById('marriage-modal').style.display = 'none'; updateUI(); selectCharacter(playerCharId);
}
function closeModal() { document.getElementById('marriage-modal').style.display = 'none'; }

// --- ÉVÉNEMENTS ---
function triggerRandomEvent() {
    const events = [
        { title: "Bonne Récolte", desc: "Les greniers sont pleins.", choices: [{ text: "Taxer (+20 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold += 20; addLog("[Événement] +20 Or"); } }] },
        { title: "Famine", desc: "Le grain se fait rare.", choices: [{ text: "Acheter du blé (-30 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold -= 30; addLog("[Événement] -30 Or"); }}] },
        { title: "Mercenaires", desc: "Des soldats cherchent du travail.", choices: [{ text: "Les recruter (-50 Or, +100 Troupes Paris)", effect: () => { characters.find(c=>c.id===playerCharId).gold -= 50; provinces.find(p=>p.id===1).troops += 100; addLog("[Événement] +100 Troupes"); }}] }
    ];
    showEvent(events[Math.floor(Math.random() * events.length)]);
}
function showEvent(event) {
    setSpeed(0); document.getElementById('event-title').textContent = event.title; document.getElementById('event-desc').textContent = event.desc;
    const choicesDiv = document.getElementById('event-choices'); choicesDiv.innerHTML = '';
    event.choices.forEach(choice => {
        const btn = document.createElement('button'); btn.textContent = choice.text;
        btn.onclick = () => { playClick(); choice.effect(); document.getElementById('event-popup').style.display = 'none'; updateUI(); renderMap(); };
        choicesDiv.appendChild(btn);
    });
    document.getElementById('event-popup').style.display = 'block';
}

// --- VITESSE ---
function setSpeed(speed) { gameSpeed = speed; clearInterval(gameLoopId); if(speed > 0) { const ms = [0, 1000, 500, 100][speed]; gameLoopId = setInterval(nextMonth, ms); } }

// --- UTILITAIRES ---
function addLog(msg) { const logContent = document.getElementById('log-content'); const p = document.createElement('p'); p.textContent = `[${date.year} ${getMonthName(date.month).substring(0,3)}] ${msg}`; logContent.prepend(p); if(logContent.children.length > 30) logContent.removeChild(logContent.lastChild); }
function generateName(isMale) { const m = ["Louis", "Charles", "Henri", "Robert", "Hugues", "Philippe", "Raoul", "Guillaume", "Thibaud", "Eudes"]; const f = ["Marie", "Marguerite", "Agnès", "Adèle", "Isabelle", "Jeanne", "Blanche", "Adélaïde", "Mathilde", "Berthe"]; return isMale ? m[Math.floor(Math.random()*m.length)] : f[Math.floor(Math.random()*f.length)]; }
function getMonthName(month) { return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][month]; }
function getCharName(id) { const c = characters.find(c => c.id === id); return c ? `${c.name} ${c.dynasty}` : 'Inconnu'; }

init();
