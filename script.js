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
    { id: 1, name: "Île-de-France", baseIncome: 10 },
    { id: 2, name: "Normandie", baseIncome: 8 },
    { id: 3, name: "Bretagne", baseIncome: 6 },
    { id: 4, name: "Champagne", baseIncome: 7 },
    { id: 5, name: "Flandre", baseIncome: 9 },
    { id: 6, name: "Aquitaine", baseIncome: 8 },
    { id: 7, name: "Bourgogne", baseIncome: 7 },
    { id: 8, name: "Toulouse", baseIncome: 6 },
    { id: 9, name: "Orléanais", baseIncome: 7 },
    { id: 10, name: "Anjou", baseIncome: 6 },
    { id: 11, name: "Poitou", baseIncome: 6 },
    { id: 12, name: "Dauphiné", baseIncome: 5 }
];

let characters = [];
let provinces = [];

// --- INITIALISATION ---
function init() {
    provincesData.forEach(p => {
        provinces.push({ ...p, owner: null, troops: 150 + Math.floor(Math.random()*150) });
    });

    // Personnages Historiques (1066)
    const philippe = createCharacter("Philippe", "Capet", 14, 1, true); // Roi (Joueur)
    createCharacter("Guillaume", "Normandie", 38, 2, true); // Duc indépendant (Ennemi)
    createCharacter("Conan", "Bretagne", 41, 3, true); // Duc indépendant (Ennemi)
    
    // Vassaux initiaux
    createCharacter("Hugues", "Bourgogne", 51, 7, true);
    createCharacter("Aimeri", "Poitou", 45, 11, true);
    createCharacter("Foulques", "Anjou", 37, 10, true);
    assignVassal(7, 1); assignVassal(11, 1); assignVassal(10, 1);

    // Femmes Héritières (Pour le mariage stratégique)
    createCharacter("Berthe", "Hollande", 16, null, false, true); // Courtisan
    createCharacter("Adèle", "Champagne", 20, 4, false); // Héritière de Champagne (Ennemi)
    createCharacter("Mathilde", "Flandre", 15, 5, false); // Héritière de Flandre (Ennemi)
    // Adèle et Mathilde sont indépendantes (héritières ennemies), les épouser = gain de territoire futur

    // Autres courtisans femmes
    for(let i=0; i<4; i++) createCharacter(generateName(false), "Courtisan", Math.floor(Math.random()*15)+16, null, false, true);

    renderMap();
    updateUI();
    selectCharacter(playerCharId);
    addLog("1066. Le Roi Philippe règne sur un domaine restreint. Unifiez la France !");
    setSpeed(1);
}

function createCharacter(name, dynasty, age, ownedProvinceId, isMale, isCourtier = false) {
    const stats = { martial: Math.floor(Math.random()*10)+3, diplomacy: Math.floor(Math.random()*10)+3, stewardship: Math.floor(Math.random()*10)+3 };
    const char = {
        id: gameId++, name, dynasty, age: age || 18, isMale,
        stats, traits: [],
        gold: isCourtier ? 0 : 100, prestige: isCourtier ? 0 : 50,
        spouse: null, alive: true, isCourtier,
        primaryTitle: null, liege: null, armySize: 0
    };
    
    if(ownedProvinceId) {
        char.primaryTitle = `Héritier(e) de ${provinces[ownedProvinceId-1].name}`;
        provinces[ownedProvinceId-1].owner = char.id;
        char.armySize = provinces[ownedProvinceId-1].troops;
    }
    
    characters.push(char);
    return char;
}

function assignVassal(vassalId, liegeId) {
    let vassal = characters.find(c => c.id === vassalId);
    if(vassal) { vassal.liege = liegeId; vassal.primaryTitle = `Vassal de ${provinces.find(p=>p.owner===vassalId)?.name || 'Couronne'}`; }
}

// --- RENDU & UI ---
function renderMap() {
    provinces.forEach(p => {
        const path = document.getElementById(`prov-${p.id}`);
        if(!path) return;
        let color = "#aaa"; // Neutre
        const owner = characters.find(c => c.id === p.owner);
        if(p.owner === playerCharId) color = "#ffd700"; // Domaine Royal (Or)
        else if(owner && owner.liege === playerCharId) color = "#cd5c5c"; // Vassal (Rouge)
        else if(owner) color = "#5555ff"; // Ennemi Indépendant (Bleu)
        
        path.setAttribute("fill", color);
        path.onclick = () => { playClick(); selectProvince(p.id); };
    });
}

function updateUI() {
    document.getElementById('date').textContent = `${getMonthName(date.month)} ${date.year}`;
    const player = characters.find(c => c.id === playerCharId);
    if(player) {
        document.getElementById('gold').textContent = Math.floor(player.gold);
        document.getElementById('troops').textContent = player.armySize;
        document.getElementById('prestige').textContent = player.prestige;
    }
    const royalProvinces = provinces.filter(p => p.owner === playerCharId).length;
    const pct = Math.round((royalProvinces / provinces.length) * 100);
    document.getElementById('unification-bar').value = pct;
    document.getElementById('unification-pct').textContent = `${pct}%`;
    
    if(pct >= 75 && !window.gameWon) {
        window.gameWon = true; setSpeed(0); playVictory();
        addLog("🏆 VICTOIRE ! Le Royaume est unifié !");
        setTimeout(() => alert("VICTOIRE ! Vous avez unifié le Royaume de France !"), 500);
    }
}

function selectCharacter(id) {
    const char = characters.find(c => c.id === id);
    if(!char || !char.alive) return;

    const infoDiv = document.getElementById('char-info');
    const actionsDiv = document.getElementById('actions');
    const btnWar = document.getElementById('btn-war');
    const btnMarry = document.getElementById('btn-marry');
    
    let html = `<h3>${char.name} ${char.dynasty}</h3>`;
    html += `<p>Âge: ${char.age} | ${char.isMale ? '♂' : '♀'}</p>`;
    html += `<p>Titre: ${char.primaryTitle || 'Courtisan'}</p>`;
    html += `<p>⚔️${char.stats.martial} 🗣️${char.stats.diplomacy} 💰${char.stats.stewardship}</p>`;
    html += `<p>Armée: ${char.armySize} | Or: ${Math.floor(char.gold)}</p>`;
    
    const spouse = char.spouse ? characters.find(c => c.id === char.spouse) : null;
    html += `<p>Époux/se: ${spouse ? `${spouse.name} ${spouse.dynasty}` : 'Célibataire'}</p>`;
    if(char.liege) html += `<p>Vassal de: ${getCharName(char.liege)}</p>`;
    
    infoDiv.innerHTML = html;
    
    // Si c'est le joueur, afficher mariage
    if(id === playerCharId) {
        actionsDiv.style.display = 'block';
        btnMarry.style.display = char.spouse ? 'none' : 'block';
        btnWar.style.display = 'none'; // On gère la guerre via la province
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
    
    document.getElementById('panel-title').innerText = `Province de ${prov.name}`;

    if(owner) {
        selectCharacter(owner.id);
        // Afficher le bouton de guerre si ce n'est pas notre province
        if(owner.id !== playerCharId) {
            actionsDiv.style.display = 'block';
            btnMarry.style.display = 'none'; // On ne se marie pas via la province
            btnWar.style.display = 'block';

            if(owner.liege === playerCharId) {
                // VASSAL
                btnWar.innerText = `🛡️ Revendiquer ${prov.name} (Vassal) [-50 Prestige]`;
                btnWar.disabled = player.prestige < 50;
                btnWar.onclick = () => claimProvince(id, 'vassal');
            } else {
                // ENNEMI
                btnWar.innerText = `⚔️ Conquérir ${prov.name} (Ennemi) [-80 Prestige]`;
                btnWar.disabled = player.prestige < 80;
                btnWar.onclick = () => claimProvince(id, 'enemy');
            }
        } else {
            actionsDiv.style.display = 'block';
            btnMarry.style.display = player.spouse ? 'none' : 'block';
            btnWar.style.display = 'none';
        }
    } else {
        // NEUTRE
        document.getElementById('char-info').innerHTML = `<h3>${prov.name}</h3><p>Territoire neutre et sauvage.</p><p>Troupes locales: ${prov.troops}</p>`;
        actionsDiv.style.display = 'block';
        btnMarry.style.display = 'none';
        btnWar.innerText = `🏕️ Coloniser ${prov.name} (Neutre) [-30 Or]`;
        btnWar.disabled = player.gold < 30;
        btnWar.onclick = () => claimProvince(id, 'neutral');
    }
}

// --- MÉCANIQUES : GUERRE & CONQUÊTE ---
function claimProvince(provId, warType) {
    playWar();
    const prov = provinces[provId-1];
    const player = characters.find(c => c.id === playerCharId);
    const owner = characters.find(c => c.id === prov.owner);

    if(warType === 'neutral') {
        player.gold -= 30;
        // Les troupes locales résistent un peu
        if(player.armySize > prov.troops * 0.5) {
            prov.owner = playerCharId;
            player.armySize -= Math.floor(prov.troops * 0.2); // Pertes légères
            addLog(`${prov.name} a été colonisé et ajouté au domaine royal !`);
            playVictory();
        } else {
            addLog(`Trop faible pour coloniser ${prov.name}. Vos troupes ont été repoussées.`);
            player.armySize -= Math.floor(player.armySize * 0.3);
        }
    } 
    else if(warType === 'vassal') {
        player.prestige -= 50;
        const defender = owner;
        addLog(`Vous revendiquez ${prov.name} sur votre vassal ${defender.name} !`);

        const playerRoll = player.armySize * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
        const defenderRoll = defender.armySize * (0.8 + Math.random() * 0.4) + defender.stats.martial * 10;

        if(playerRoll > defenderRoll) {
            playVictory();
            addLog(`Victoire ! ${prov.name} annexé au domaine royal. ${defender.name} est déchu.`);
            prov.owner = playerCharId;
            player.armySize += Math.floor(prov.troops / 2);
            defender.armySize = Math.floor(defender.armySize * 0.2);
            defender.liege = null; // Déchu
            defender.primaryTitle = "Sans-terre";
            // S'il n'a plus de terre, il meurt ou fuit
            if(!provinces.some(p => p.owner === defender.id)) { defender.alive = false; addLog(`${defender.name} a été exilé.`); }
        } else {
            addLog(`Défaite ! ${defender.name} s'émancipe de la couronne et conserve ${prov.name}.`);
            player.armySize = Math.floor(player.armySize * 0.6);
            defender.liege = null; // Indépendant désormais
        }
    }
    else if(warType === 'enemy') {
        player.prestige -= 80;
        const defender = owner;
        addLog(`Vous lancez une invasion sur ${prov.name}, territoire de ${defender.name} !`);

        const playerRoll = player.armySize * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
        const defenderRoll = defender.armySize * (0.8 + Math.random() * 0.4) + defender.stats.martial * 10;

        if(playerRoll > defenderRoll) {
            playVictory();
            addLog(`Victoire éclatante ! ${prov.name} est conquis. ${defender.name} est mort au combat.`);
            prov.owner = playerCharId;
            player.armySize += Math.floor(prov.troops / 2);
            player.prestige += 50;
            defender.alive = false;
            // Si l'ennemi avait une épouse, elle devient disponible (potentiellement héritière si elle survit)
            if(defender.spouse) { 
                const widow = characters.find(c => c.id === defender.spouse);
                if(widow) { widow.spouse = null; widow.primaryTitle = `Héritière de ${prov.name}`; } // Elle revient avec le titre en mémoire
            }
        } else {
            addLog(`Défaite humiliante ! Vos troupes sont décimées devant ${prov.name}.`);
            player.armySize = Math.floor(player.armySize * 0.4);
            player.prestige -= 30;
        }
    }

    renderMap();
    updateUI();
    selectProvince(provId);
}

// --- MÉCANIQUES : TEMPS & MARIAGE ---
function nextMonth() {
    date.month++;
    if(date.month > 11) { date.month = 0; date.year++; }

    characters.forEach(char => {
        if(!char.alive) return;

        // Mort
        if(Math.random() < 0.002 + (char.age > 40 ? (char.age-40)*0.001 : 0)) { killCharacter(char); return; }

        // Revenus & Impôts
        if(char.primaryTitle && !char.isCourtier) {
            const ownedProvinces = provinces.filter(p => p.owner === char.id);
            let income = 0;
            ownedProvinces.forEach(p => income += p.baseIncome);
            char.gold += income + char.stats.stewardship;
            
            // Impôt vassal
            if(char.liege) {
                const liege = characters.find(c => c.id === char.liege);
                if(liege) { const tax = Math.floor(char.gold * 0.1); liege.gold += tax; char.gold -= tax; }
            }
        }

        // Armée IA
        if(char.id !== playerCharId && char.gold > 80) { char.armySize += Math.floor(char.gold / 10); char.gold -= 50; }

        // Enfants
        if(char.spouse && char.isMale) {
            const spouse = characters.find(c => c.id === char.spouse);
            if(spouse && !spouse.pregnant && spouse.age >= 16 && Math.random() < 0.04) { spouse.pregnant = true; addLog(`${spouse.name} est enceinte !`); }
        }
    });

    // Naissances
    characters.filter(c => c.pregnant).forEach(spouse => {
        if(Math.random() < 0.2) {
            spouse.pregnant = false;
            if(Math.random() < 0.1) { addLog("L'enfant est mort-né."); }
            else {
                const isMale = Math.random() > 0.5;
                const child = createCharacter(generateName(isMale), spouse.dynasty, 0, null, isMale, true);
                addLog(`Naissance de ${child.name} !`);
            }
        }
    });

    if(Math.random() < 0.03) triggerRandomEvent();
    updateUI(); renderMap();
}

function killCharacter(char) {
    char.alive = false;
    addLog(`${char.name} ${char.dynasty} est décédé(e).`);
    
    // Veuuvage
    if(char.spouse) {
        const ex = characters.find(c => c.id === char.spouse);
        if(ex) { ex.spouse = null; }
        char.spouse = null;
    }

    if(char.id === playerCharId) handlePlayerSuccession(char);
    else handleAISuccession(char);
}

function handlePlayerSuccession(deadChar) {
    const children = characters.filter(c => c.alive && c.dynasty === deadChar.dynasty && c.age > 0);
    if(children.length > 0) {
        const heir = children.sort((a,b) => b.age - a.age)[0]; // Primogéniture
        playerCharId = heir.id;
        heir.gold += deadChar.gold; heir.prestige += deadChar.prestige;
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
        addLog(`${heir.name} hérite de la couronne !`);
        selectCharacter(playerCharId);
    } else {
        setSpeed(0); document.getElementById('game-over-screen').style.display = 'flex';
    }
}

function handleAISuccession(deadChar) {
    const children = characters.filter(c => c.alive && c.dynasty === deadChar.dynasty && c.age > 0);
    
    // Si le mort était l'épouse d'un Capet (héritière), les terres passent à la Couronne Capet !
    if(deadChar.spouse === playerCharId && provinces.some(p => p.owner === deadChar.id)) {
        addLog(`Les terres de ${deadChar.name} sont intégrées au domaine royal par droit de mariage !`);
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = playerCharId; });
        const player = characters.find(c => c.id === playerCharId);
        player.armySize += Math.floor(deadChar.armySize/2); // Gain militaire
        return;
    }

    if(children.length > 0) {
        const heir = children.sort((a,b) => b.age - a.age)[0];
        heir.primaryTitle = deadChar.primaryTitle;
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
        addLog(`${heir.name} hérite de ${deadChar.name}.`);
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
    
    if(player.spouse) { addLog("Vous êtes déjà marié !"); return; }

    // Filtrer : Femmes, vivantes, célibataires, pas le joueur
    const candidates = characters.filter(c => c.alive && !c.spouse && !c.isMale && c.id !== playerCharId && c.age >= 14);
    listDiv.innerHTML = '';
    
    if(candidates.length === 0) { listDiv.innerHTML = "<p>Aucune femme disponible.</p>"; }
    else {
        // Trier : Héritières en premier
        candidates.sort((a,b) => (b.primaryTitle ? 1 : 0) - (a.primaryTitle ? 1 : 0));
        candidates.forEach(c => {
            const div = document.createElement('div');
            div.className = 'char-card';
            let territoryStr = "";
            if(c.primaryTitle && !c.isCourtier) territoryStr = `<br><span style='color:gold;'>🧬 Héritière de terre ! Mort = Gain de province.</span>`;
            div.innerHTML = `${c.name} ${c.dynasty} (Âge: ${c.age}, 💰${c.stats.stewardship}) ${territoryStr}`;
            div.onclick = () => marry(playerCharId, c.id);
            listDiv.appendChild(div);
        });
    }
    modal.style.display = 'block';
}

function autoMarry() {
    playClick();
    const player = characters.find(c => c.id === playerCharId);
    const candidates = characters.filter(c => c.alive && !c.spouse && !c.isMale && c.id !== playerCharId && c.age >= 14);
    if(candidates.length > 0) {
        candidates.sort((a,b) => (b.primaryTitle ? 1 : 0) - (a.primaryTitle ? 1 : 0) || b.stats.stewardship - a.stats.stewardship);
        marry(playerCharId, candidates[0].id);
    } else { addLog("Aucune femme disponible."); }
}

function marry(id1, id2) {
    const c1 = characters.find(c => c.id === id1);
    const c2 = characters.find(c => c.id === id2);
    c1.spouse = id2; c2.spouse = id1;
    c1.prestige += 20;
    // Si on épouse une héritière ennemie, elle devient vassale (ou neutre) et ses terres reviendront au Roi à sa mort
    if(c2.liege && c2.liege !== playerCharId) { c2.liege = null; addLog(`${c2.name} rompt ses liens pour rejoindre la couronne.`); }
    addLog(`${c1.name} et ${c2.name} se sont mariés !`);
    document.getElementById('marriage-modal').style.display = 'none';
    updateUI(); selectCharacter(playerCharId);
}

function closeModal() { document.getElementById('marriage-modal').style.display = 'none'; }

// --- ÉVÉNEMENTS ---
function triggerRandomEvent() {
    const events = [
        { title: "Bonne Récolte", desc: "Les paysans sont heureux.", choices: [{ text: "Taxer (+20 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold += 20; } }] },
        { title: "Pèlerinage", desc: "Un prêtre vous invite à Rome.", choices: [
            { text: "Y aller (+30 Prestige)", effect: () => { characters.find(c=>c.id===playerCharId).prestige += 30; }},
            { text: "Refuser (-10 Prestige)", effect: () => { characters.find(c=>c.id===playerCharId).prestige -= 10; }}
        ]},
        { title: "Troupe de Mercenaires", desc: "Des soldats cherchent du travail.", choices: [
            { text: "Les recruter (-50 Or, +50 Troupes)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.gold -= 50; p.armySize += 50; }},
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
        btn.onclick = () => { playClick(); choice.effect(); document.getElementById('event-popup').style.display = 'none'; updateUI(); };
        choicesDiv.appendChild(btn);
    });
    document.getElementById('event-popup').style.display = 'block';
}

// --- VITESSE DU JEU ---
function setSpeed(speed) {
    gameSpeed = speed;
    clearInterval(gameLoopId);
    if(speed > 0) { const ms = [0, 1000, 500, 100][speed]; gameLoopId = setInterval(nextMonth, ms); }
}

// --- UTILITAIRES ---
function addLog(msg) {
    const logContent = document.getElementById('log-content');
    const p = document.createElement('p');
    p.textContent = `[${getMonthName(date.month).substring(0,3)} ${date.year}] ${msg}`;
    logContent.prepend(p);
    if(logContent.children.length > 50) logContent.removeChild(logContent.lastChild);
}

function generateName(isMale) {
    const m = ["Louis", "Charles", "Henri", "Robert", "Hugues", "Philippe", "Raoul", "Guillaume", "Thibaud", "Eudes"];
    const f = ["Marie", "Marguerite", "Agnès", "Adèle", "Isabelle", "Jeanne", "Blanche", "Adélaïde", "Mathilde", "Berthe"];
    return isMale ? m[Math.floor(Math.random()*m.length)] : f[Math.floor(Math.random()*f.length)];
}

function getMonthName(month) { return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][month]; }
function getCharName(id) { const c = characters.find(c => c.id === id); return c ? `${c.name} ${c.dynasty}` : 'Inconnu'; }

init();
