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
    provincesData.forEach(p => {
        provinces.push({ ...p, owner: null, troops: p.baseTroops });
    });

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
    addLog("1066. Le Roi Philippe règne. Unifiez la France !");
    setSpeed(1);
}

function createCharacter(name, dynasty, age, ownedProvinceId, isMale, isCourtier = false) {
    const stats = { martial: Math.floor(Math.random()*10)+3, diplomacy: Math.floor(Math.random()*10)+3, stewardship: Math.floor(Math.random()*10)+3 };
    const char = {
        id: gameId++, name, dynasty, age: age || 18, isMale,
        stats, traits: [],
        gold: isCourtier ? 0 : 100, prestige: isCourtier ? 0 : 50,
        spouse: null, alive: true, isCourtier,
        primaryTitle: null, liege: null
    };
    
    if(ownedProvinceId) {
        char.primaryTitle = `Héritier(e) de ${provinces[ownedProvinceId-1].name}`;
        provinces[ownedProvinceId-1].owner = char.id;
    }
    
    characters.push(char);
    return char;
}

function assignVassal(vassalId, liegeId) {
    let vassal = characters.find(c => c.id === vassalId);
    if(vassal) vassal.liege = liegeId;
}

// --- CALCULS TRANSPARENTS ---
function getArmySize(char) {
    if(char.isCourtier) return 0;
    return provinces.filter(p => p.owner === char.id).reduce((sum, p) => sum + p.troops, 0);
}

function getIncomeBreakdown(char) {
    if(char.isCourtier) return { domain: 0, stewardship: 0, vassalTax: 0 };
    const domain = provinces.filter(p => p.owner === char.id).reduce((sum, p) => sum + p.baseIncome, 0);
    const stewardship = char.stats.stewardship;
    const vassalTax = characters.filter(c => c.liege === char.id && c.alive && !c.isCourtier)
                                .reduce((sum, v) => sum + Math.floor((provinces.filter(p=>p.owner===v.id).reduce((s,p)=>s+p.baseIncome,0) + v.stats.stewardship) * 0.1), 0);
    return { domain, stewardship, vassalTax, total: domain + stewardship + vassalTax };
}

function getHeir(char) {
    // Primogéniture : Fils le plus vieux, sinon frère, sinon fille
    const dynastyMembers = characters.filter(c => c.alive && c.dynasty === char.dynasty && c.id !== char.id);
    const males = dynastyMembers.filter(c => c.isMale).sort((a,b) => b.age - a.age);
    const females = dynastyMembers.filter(c => !c.isMale).sort((a,b) => b.age - a.age);
    return males[0] || females[0] || null;
}

// --- RENDU & UI ---
function renderMap() {
    provinces.forEach(p => {
        const path = document.getElementById(`prov-${p.id}`);
        if(!path) return;
        let color = "#aaa";
        const owner = characters.find(c => c.id === p.owner);
        if(p.owner === playerCharId) color = "#ffd700";
        else if(owner && owner.liege === playerCharId) color = "#cd5c5c";
        else if(owner) color = "#5555ff";
        
        path.setAttribute("fill", color);
        path.onclick = () => { playClick(); selectProvince(p.id); };
    });
}

function updateUI() {
    document.getElementById('date').textContent = `${getMonthName(date.month)} ${date.year}`;
    const player = characters.find(c => c.id === playerCharId);
    if(player) {
        document.getElementById('gold').textContent = Math.floor(player.gold);
        document.getElementById('troops').textContent = getArmySize(player);
        document.getElementById('prestige').textContent = player.prestige;
    }
    const royalProvinces = provinces.filter(p => p.owner === playerCharId).length;
    const pct = Math.round((royalProvinces / provinces.length) * 100);
    document.getElementById('unification-bar').value = pct;
    document.getElementById('unification-pct').textContent = `${pct}%`;
    
    if(pct >= 75 && !window.gameWon) {
        window.gameWon = true; setSpeed(0); playVictory();
        addLog("🏆 VICTOIRE ! Le Royaume est unifié !");
        setTimeout(() => alert("VICTOIRE !"), 500);
    }
}

function selectCharacter(id) {
    const char = characters.find(c => c.id === id);
    if(!char || !char.alive) return;

    const infoDiv = document.getElementById('char-info');
    const actionsDiv = document.getElementById('actions');
    
    const income = getIncomeBreakdown(char);
    const army = getArmySize(char);
    const heir = getHeir(char);
    
    let html = `<h3>${char.name} ${char.dynasty} ${char.id === playerCharId ? '(VOUS)' : ''}</h3>`;
    html += `<p>Âge: ${char.age} | ${char.isMale ? '♂' : '♀'} | Titre: ${char.primaryTitle || 'Courtisan'}</p>`;
    html += `<p>⚔️${char.stats.martial} 🗣️${char.stats.diplomacy} 💰${char.stats.stewardship}</p>`;
    
    html += `<p><strong>Armée: ${army}</strong> <span class="detail-line">(Prov: ${provinces.filter(p=>p.owner===char.id).map(p=>p.troops).join('+') || 0})</span></p>`;
    html += `<p><strong>Or: ${Math.floor(char.gold)}</strong> <span class="detail-line">(+${income.total}/mois: ${income.domain}Dom+${income.stewardship}Int+${income.vassalTax}Vass)</span></p>`;
    
    const spouse = char.spouse ? characters.find(c => c.id === char.spouse) : null;
    html += `<p>Époux/se: ${spouse ? `${spouse.name} ${spouse.dynasty}` : 'Célibataire'}</p>`;
    
    if(heir) html += `<p>Héritier: ${heir.name} ${heir.dynasty} (Âge: ${heir.age})</p>`;
    else if(char.id === playerCharId) html += `<p style="color:red;">Héritier: AUCUN (Game Over si mort)</p>`;
    
    if(char.liege) html += `<p>Vassal de: ${getCharName(char.liege)}</p>`;
    
    infoDiv.innerHTML = html;
    
    if(id === playerCharId) {
        actionsDiv.style.display = 'block';
        document.getElementById('btn-marry').style.display = char.spouse ? 'none' : 'block';
        document.getElementById('btn-war').style.display = 'none';
    } else {
        actionsDiv.style.display = 'none';
    }
}

function selectProvince(id) {
    selectedProvinceId = id;
    const prov = provinces[id-1];
    const owner = characters.find(c => c.id === prov.owner);
    const player = characters.find(c => c.id === playerCharId);
    
    const actionsDiv = document.getElementById('actions');
    const btnWar = document.getElementById('btn-war');
    const btnMarry = document.getElementById('btn-marry');
    
    document.getElementById('panel-title').innerText = `Province: ${prov.name} (Troupes: ${prov.troops})`;

    if(owner) {
        selectCharacter(owner.id);
        if(owner.id !== playerCharId) {
            actionsDiv.style.display = 'block';
            btnMarry.style.display = 'none';
            btnWar.style.display = 'block';

            if(owner.liege === playerCharId) {
                btnWar.innerText = `🛡️ Revendiquer (Vassal) [-50🛡️]`;
                btnWar.disabled = player.prestige < 50;
                btnWar.onclick = () => claimProvince(id, 'vassal');
            } else {
                btnWar.innerText = `⚔️ Conquérir (Ennemi) [-80🛡️]`;
                btnWar.disabled = player.prestige < 80;
                btnWar.onclick = () => claimProvince(id, 'enemy');
            }
        } else {
            actionsDiv.style.display = 'block';
            btnMarry.style.display = player.spouse ? 'none' : 'block';
            btnWar.style.display = 'none';
        }
    } else {
        document.getElementById('char-info').innerHTML = `<h3>${prov.name}</h3><p>Territoire neutre.</p>`;
        actionsDiv.style.display = 'block';
        btnMarry.style.display = 'none';
        btnWar.innerText = `🏕️ Coloniser (Neutre) [-30💰]`;
        btnWar.disabled = player.gold < 30;
        btnWar.onclick = () => claimProvince(id, 'neutral');
    }
}

// --- MÉCANIQUES : GUERRE ---
function claimProvince(provId, warType) {
    playWar();
    const prov = provinces[provId-1];
    const player = characters.find(c => c.id === playerCharId);
    const owner = characters.find(c => c.id === prov.owner);

    if(warType === 'neutral') {
        player.gold -= 30;
        addLog(`[Action] Colonisation de ${prov.name} (-30 Or).`);
        if(getArmySize(player) > prov.troops * 0.5) {
            prov.owner = playerCharId;
            addLog(`[Succès] ${prov.name} colonisé ! Pertes: -${Math.floor(prov.troops*0.2)} troupes.`);
            prov.troops = prov.troops - Math.floor(prov.troops*0.2); // La province perd des troupes
            playVictory();
        } else {
            addLog(`[Échec] Trop faible pour ${prov.name}. -30% armée.`);
            // Pas de changement de propriétaire, on réduit juste l'armée globale (approximation)
            provinces.filter(p=>p.owner===playerCharId).forEach(p => p.troops = Math.floor(p.troops * 0.7));
        }
    } 
    else if(warType === 'vassal') {
        player.prestige -= 50;
        addLog(`[Guerre] Revendication sur ${prov.name} contre vassal ${owner.name} (-50 Prestige).`);
        const pRoll = getArmySize(player) * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
        const dRoll = getArmySize(owner) * (0.8 + Math.random() * 0.4) + owner.stats.martial * 10;

        if(pRoll > dRoll) {
            playVictory();
            addLog(`[Victoire] ${prov.name} annexé. ${owner.name} déchu.`);
            prov.owner = playerCharId;
            owner.liege = null; owner.primaryTitle = "Sans-terre";
            if(!provinces.some(p => p.owner === owner.id)) { owner.alive = false; addLog(`${owner.name} est mort.`); }
        } else {
            addLog(`[Défaite] ${owner.name} s'émancipe et garde ${prov.name}. -40% armée royale.`);
            owner.liege = null;
            provinces.filter(p=>p.owner===playerCharId).forEach(p => p.troops = Math.floor(p.troops * 0.6));
        }
    }
    else if(warType === 'enemy') {
        player.prestige -= 80;
        addLog(`[Guerre] Invasion de ${prov.name} contre ${owner.name} (-80 Prestige).`);
        const pRoll = getArmySize(player) * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
        const dRoll = getArmySize(owner) * (0.8 + Math.random() * 0.4) + owner.stats.martial * 10;

        if(pRoll > dRoll) {
            playVictory();
            addLog(`[Victoire] ${prov.name} conquis ! ${owner.name} est mort.`);
            prov.owner = playerCharId;
            player.prestige += 50;
            owner.alive = false;
            if(owner.spouse) { const w = characters.find(c=>c.id===owner.spouse); if(w) w.spouse=null; }
        } else {
            addLog(`[Défaite] Invasion repoussée. -50% armée royale, -30 Prestige.`);
            provinces.filter(p=>p.owner===playerCharId).forEach(p => p.troops = Math.floor(p.troops * 0.5));
            player.prestige -= 30;
        }
    }

    renderMap(); updateUI(); selectProvince(provId);
}

// --- MÉCANIQUES : TEMPS & MARIAGE ---
function nextMonth() {
    date.month++;
    if(date.month > 11) { date.month = 0; date.year++; }

    characters.forEach(char => {
        if(!char.alive) return;
        if(Math.random() < 0.002 + (char.age > 40 ? (char.age-40)*0.001 : 0)) { killCharacter(char); return; }

        // Revenus explicites
        if(!char.isCourtier) {
            const income = getIncomeBreakdown(char);
            char.gold += income.total;
            if(char.id === playerCharId && income.total > 0) {
                addLog(`[Revenus] +${income.total} Or (${income.domain}Dom, ${income.stewardship}Int, ${income.vassalTax}Vass)`);
            }
        }

        if(char.spouse && char.isMale) {
            const spouse = characters.find(c => c.id === char.spouse);
            if(spouse && !spouse.pregnant && spouse.age >= 16 && Math.random() < 0.04) { spouse.pregnant = true; addLog(`[Famille] ${spouse.name} est enceinte !`); }
        }
    });

    characters.filter(c => c.pregnant).forEach(spouse => {
        if(Math.random() < 0.2) {
            spouse.pregnant = false;
            if(Math.random() < 0.1) { addLog("[Tragédie] L'enfant est mort-né."); }
            else {
                const isMale = Math.random() > 0.5;
                const child = createCharacter(generateName(isMale), spouse.dynasty, 0, null, isMale, true);
                addLog(`[Naissance] ${child.name} ${child.dynasty} est né(e) !`);
            }
        }
    });

    if(Math.random() < 0.03) triggerRandomEvent();
    updateUI(); renderMap();
}

function killCharacter(char) {
    char.alive = false;
    addLog(`[Mort] ${char.name} ${char.dynasty} est décédé(e) à ${char.age} ans.`);
    if(char.spouse) { const ex = characters.find(c => c.id === char.spouse); if(ex) ex.spouse=null; char.spouse=null; }

    if(char.id === playerCharId) handlePlayerSuccession(char);
    else handleAISuccession(char);
}

function handlePlayerSuccession(deadChar) {
    const heir = getHeir(deadChar);
    if(heir) {
        playerCharId = heir.id;
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
        heir.gold += deadChar.gold; heir.prestige += deadChar.prestige;
        addLog(`[Succession] Primogéniture : ${heir.name} hérite de la couronne !`);
        selectCharacter(playerCharId);
    } else {
        setSpeed(0); document.getElementById('game-over-screen').style.display = 'flex';
    }
}

function handleAISuccession(deadChar) {
    // Si l'épouse du joueur meurt (héritière), on récupère son terre
    if(deadChar.spouse === playerCharId && provinces.some(p => p.owner === deadChar.id)) {
        addLog(`[Succession] Les terres de votre épouse ${deadChar.name} reviennent au Domaine Royal !`);
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = playerCharId; });
        return;
    }
    
    const heir = getHeir(deadChar);
    if(heir) {
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
        addLog(`[Succession] ${heir.name} hérite de ${deadChar.name}.`);
    } else {
        provinces.forEach(p => { if(p.owner === deadChar.id) { p.owner = null; addLog(`${p.name} devient neutre.`); }});
    }
}

// --- MARIAGE ---
function openMarriageModal() {
    playClick();
    const modal = document.getElementById('marriage-modal');
    const listDiv = document.getElementById('spouse-list');
    const player = characters.find(c => c.id === playerCharId);
    
    if(player.spouse) { addLog("Déjà marié !"); return; }
    const candidates = characters.filter(c => c.alive && !c.spouse && !c.isMale && c.id !== playerCharId && c.age >= 14);
    listDiv.innerHTML = '';
    
    if(candidates.length === 0) { listDiv.innerHTML = "<p>Aucune femme.</p>"; }
    else {
        candidates.sort((a,b) => (provinces.some(p=>p.owner===b.id)?1:0) - (provinces.some(p=>p.owner===a.id)?1:0) || b.stats.stewardship - a.stats.stewardship);
        candidates.forEach(c => {
            const div = document.createElement('div');
            div.className = 'char-card';
            let territoryStr = "";
            const ownedProv = provinces.find(p => p.owner === c.id);
            if(ownedProv) territoryStr = `<span style='color:gold;'>🧬 Héritière de ${ownedProv.name} ! (Mort = Gain de terre)</span>`;
            div.innerHTML = `${c.name} ${c.dynasty} (Âge:${c.age}, 💰${c.stats.stewardship}) ${territoryStr}`;
            div.onclick = () => marry(playerCharId, c.id);
            listDiv.appendChild(div);
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
    document.getElementById('marriage-modal').style.display = 'none';
    updateUI(); selectCharacter(playerCharId);
}
function closeModal() { document.getElementById('marriage-modal').style.display = 'none'; }

// --- ÉVÉNEMENTS ---
function triggerRandomEvent() {
    const events = [
        { title: "Bonne Récolte", desc: "Les greniers sont pleins.", choices: [{ text: "Taxer (+20 Or)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.gold += 20; addLog("[Événement] +20 Or (Récolte)"); } }] },
        { title: "Pèlerinage", desc: "Un prêtre vous invite à Rome.", choices: [
            { text: "Y aller (+30 Prestige)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.prestige += 30; addLog("[Événement] +30 Prestige"); }},
            { text: "Refuser (-10 Prestige)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.prestige -= 10; addLog("[Événement] -10 Prestige"); }}
        ]},
        { title: "Famine", desc: "Le grain se fait rare.", choices: [
            { text: "Acheter du blé (-30 Or)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.gold -= 30; addLog("[Événement] -30 Or (Famine)"); }},
            { text: "Ignorer (-20% Troupes)", effect: () => { provinces.filter(p=>p.owner===playerCharId).forEach(p=>p.troops=Math.floor(p.troops*0.8)); addLog("[Événement] -20% Troupes (Famine)"); }}
        ]},
        { title: "Mercenaires", desc: "Des soldats cherchent du travail.", choices: [
            { text: "Les recruter (-50 Or, +100 Troupes à Paris)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.gold -= 50; provinces.find(p=>p.id===1).troops += 100; addLog("[Événement] +100 Troupes à Paris"); }},
            { text: "Les ignorer", effect: () => {} }
        ]}
    ];
    showEvent(events[Math.floor(Math.random() * events.length)]);
}

function showEvent(event) {
    setSpeed(0);
    document.getElementById('event-title').textContent = event.title;
    document.getElementById('event-desc').textContent = event.desc;
    const choicesDiv = document.getElementById('event-choices');
    choicesDiv.innerHTML = '';
    event.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.textContent = choice.text;
        btn.onclick = () => { playClick(); choice.effect(); document.getElementById('event-popup').style.display = 'none'; updateUI(); renderMap(); };
        choicesDiv.appendChild(btn);
    });
    document.getElementById('event-popup').style.display = 'block';
}

// --- VITESSE ---
function setSpeed(speed) { gameSpeed = speed; clearInterval(gameLoopId); if(speed > 0) { const ms = [0, 1000, 500, 100][speed]; gameLoopId = setInterval(nextMonth, ms); } }

// --- UTILITAIRES ---
function addLog(msg) {
    const logContent = document.getElementById('log-content');
    const p = document.createElement('p');
    p.textContent = `[${date.year} ${getMonthName(date.month).substring(0,3)}] ${msg}`;
    logContent.prepend(p);
    if(logContent.children.length > 30) logContent.removeChild(logContent.lastChild);
}

function generateName(isMale) {
    const m = ["Louis", "Charles", "Henri", "Robert", "Hugues", "Philippe", "Raoul", "Guillaume", "Thibaud", "Eudes"];
    const f = ["Marie", "Marguerite", "Agnès", "Adèle", "Isabelle", "Jeanne", "Blanche", "Adélaïde", "Mathilde", "Berthe"];
    return isMale ? m[Math.floor(Math.random()*m.length)] : f[Math.floor(Math.random()*f.length)];
}
function getMonthName(month) { return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][month]; }
function getCharName(id) { const c = characters.find(c => c.id === id); return c ? `${c.name} ${c.dynasty}` : 'Inconnu'; }

init();
