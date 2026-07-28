// --- MOTEUR AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playClick() { playSound(800, 'sine', 0.1); }
function playEvent() { playSound(400, 'triangle', 0.5); }
function playWar() { playSound(150, 'sawtooth', 0.4); }
function playVictory() { playSound(600, 'sine', 0.2); setTimeout(()=>playSound(800, 'sine', 0.3), 200); }

// --- DONNÉES DU JEU ---
let gameId = 1;
let date = { year: 1066, month: 0 };
let gameSpeed = 0; // 0=Pause, 1=Lent, 2=Normal, 3=Rapide
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
        provinces.push({ ...p, owner: null, troops: 100 + Math.floor(Math.random()*200) });
    });

    // Historiquement exact pour 1066
    createCharacter("Philippe", "Capet", 14, 1, true); // Roi
    createCharacter("Guillaume", "Normandie", 38, 2, true); // Bâtard
    createCharacter("Robert", "Flandre", 51, 5, true);
    createCharacter("Hugues", "Bourgogne", 51, 7, true);
    createCharacter("Aimeri", "Poitou", 45, 11, true); // Aimeri IV de Thouars/Poitou
    
    assignVassal(2, 1); assignVassal(5, 1); assignVassal(7, 1); assignVassal(11, 1);

    // Courtisans (jeunes femmes et hommes pour le mariage)
    for(let i=0; i<6; i++) {
        const isFemale = Math.random() > 0.3; // Plus de femmes pour le mariage
        createCharacter(generateName(isFemale), "Courtisan", Math.floor(Math.random()*20)+16, null, !isFemale, true);
    }

    renderMap();
    updateUI();
    selectCharacter(playerCharId);
    addLog("Rex Francorum - 1066. Unifiez la France !");
    setSpeed(1); // Démarrage automatique à vitesse lente
}

function createCharacter(name, dynasty, age, ownedProvinceId, isMale, isCourtier = false) {
    const stats = { martial: Math.floor(Math.random()*10)+3, diplomacy: Math.floor(Math.random()*10)+3, stewardship: Math.floor(Math.random()*10)+3 };
    const char = {
        id: gameId++, name, dynasty, age: age || 18, isMale,
        stats, traits: [],
        gold: isCourtier ? 0 : 100, prestige: isCourtier ? 0 : 50,
        spouse: null, children: [], alive: true, isCourtier,
        primaryTitle: null, liege: null, armySize: 0, location: ownedProvinceId || 1
    };
    
    if(ownedProvinceId) {
        char.primaryTitle = `Seigneur de ${provinces[ownedProvinceId-1].name}`;
        provinces[ownedProvinceId-1].owner = char.id;
        char.armySize = provinces[ownedProvinceId-1].troops;
    }
    
    characters.push(char);
    return char;
}

function assignVassal(vassalId, liegeId) {
    let vassal = characters.find(c => c.id === vassalId);
    if(vassal) vassal.liege = liegeId;
}

// --- RENDU & UI ---
function renderMap() {
    provinces.forEach(p => {
        const path = document.getElementById(`prov-${p.id}`);
        if(!path) return;
        let color = "#888"; // Neutre
        if(p.owner === playerCharId) color = "#ffd700"; // Or royal
        else if(p.owner) color = "#cd5c5c"; // Rouge vassal
        
        path.setAttribute("fill", color);
        path.onclick = () => { playClick(); selectProvince(p.id); };
    });
}

function updateUI() {
    document.getElementById('date').textContent = `${getMonthName(date.month)} ${date.year}`;
    const player = characters.find(c => c.id === playerCharId);
    if(player) {
        document.getElementById('gold').textContent = player.gold;
        document.getElementById('troops').textContent = player.armySize;
        document.getElementById('prestige').textContent = player.prestige;
    }
    const royalProvinces = provinces.filter(p => p.owner === playerCharId).length;
    const pct = Math.round((royalProvinces / provinces.length) * 100);
    document.getElementById('unification-bar').value = pct;
    document.getElementById('unification-pct').textContent = `${pct}%`;
    
    if(pct >= 75 && !window.gameWon) {
        window.gameWon = true;
        setSpeed(0);
        playVictory();
        addLog("🏆 VICTOIRE ! Le Royaume est unifié !");
        setTimeout(() => alert("VICTOIRE ! Vous avez unifié le Royaume de France !"), 500);
    }
}

function selectCharacter(id) {
    const char = characters.find(c => c.id === id);
    if(!char || !char.alive) return;

    const infoDiv = document.getElementById('char-info');
    const actionsDiv = document.getElementById('actions');
    const btnClaim = document.getElementById('btn-claim');
    
    let html = `<h3>${char.name} ${char.dynasty}</h3>`;
    html += `<p>Âge: ${char.age} | ${char.isMale ? '♂' : '♀'}</p>`;
    html += `<p>Titre: ${char.primaryTitle || 'Courtisan'}</p>`;
    html += `<p>⚔️${char.stats.martial} 🗣️${char.stats.diplomacy} 💰${char.stats.stewardship}</p>`;
    html += `<p>Armée: ${char.armySize} | Or: ${char.gold}</p>`;
    
    if(char.spouse) {
        const spouse = characters.find(c => c.id === char.spouse);
        html += `<p>Époux/se: ${spouse.name} ${spouse.dynasty}</p>`;
    } else {
        html += `<p>Époux/se: Célibataire</p>`;
    }

    if(char.liege) html += `<p>Vassal de: ${getCharName(char.liege)}</p>`;
    
    infoDiv.innerHTML = html;
    
    if(id === playerCharId) {
        actionsDiv.style.display = 'block';
        btnClaim.style.display = 'none'; // S'affiche via la province
    } else {
        actionsDiv.style.display = 'none';
    }
}

function selectProvince(id) {
    selectedProvinceId = id;
    const prov = provinces[id-1];
    const owner = characters.find(c => c.id === prov.owner);
    const player = characters.find(c => c.id === playerCharId);
    const btnClaim = document.getElementById('btn-claim');
    
    if(owner) selectCharacter(owner.id);
    else {
        document.getElementById('char-info').innerHTML = `<h3>${prov.name}</h3><p>Territoire neutre</p>`;
        document.getElementById('actions').style.display = 'none';
    }

    // Gestion du bouton Revendiquer
    if(owner && owner.id !== playerCharId && owner.liege === playerCharId) {
        document.getElementById('actions').style.display = 'block';
        btnClaim.style.display = 'block';
        btnClaim.textContent = `🛡️ Revendiquer ${prov.name}`;
        
        if(player.prestige >= 50) {
            btnClaim.disabled = false;
            btnClaim.onclick = () => claimProvince(id);
        } else {
            btnClaim.disabled = true;
            btnClaim.title = "Nécessite 50 de Prestige";
        }
    } else {
        btnClaim.style.display = 'none';
    }
}

// --- MÉCANIQUES : GUERRE ---
function claimProvince(provId) {
    playWar();
    const prov = provinces[provId-1];
    const defender = characters.find(c => c.id === prov.owner);
    const player = characters.find(c => c.id === playerCharId);

    player.prestige -= 50;
    addLog(`Vous revendiquez ${prov.name} ! La guerre éclate.`);

    const playerRoll = player.armySize * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
    const defenderRoll = defender.armySize * (0.8 + Math.random() * 0.4) + defender.stats.martial * 10;

    if(playerRoll > defenderRoll) {
        addLog(`Victoire ! ${prov.name} est annexé au domaine royal.`);
        playVictory();
        defender.liege = null; 
        prov.owner = playerCharId; 
        player.armySize += Math.floor(prov.troops / 2); 
        defender.armySize = Math.floor(defender.armySize * 0.3); 
        player.prestige += 30;
        
        // Le vassal perd son titre principal
        const remainingProv = provinces.find(p => p.owner === defender.id);
        if(!remainingProv) {
            defender.alive = false;
            defender.primaryTitle = null;
            addLog(`${defender.name} a perdu toutes ses terres.`);
        } else {
            defender.primaryTitle = `Seigneur de ${remainingProv.name}`;
        }
    } else {
        addLog(`Défaite ! Vos troupes ont été repoussées à ${prov.name}.`);
        player.armySize = Math.floor(player.armySize * 0.6); 
        player.prestige -= 20;
        defender.liege = null; 
        addLog(`${defender.name} s'émancipe de la couronne !`);
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

        // Mort naturelle (risque augmente avec l'âge)
        if(Math.random() < 0.002 + (char.age > 40 ? (char.age-40)*0.001 : 0)) { 
            killCharacter(char); 
            return; 
        }

        // Revenus
        if(char.primaryTitle) {
            const ownedProvinces = provinces.filter(p => p.owner === char.id);
            let income = 0;
            ownedProvinces.forEach(p => income += p.baseIncome);
            char.gold += income + char.stats.stewardship;
            
            // L'IA dépense son or pour des troupes
            if(char.id !== playerCharId && char.gold > 80) {
                char.armySize += Math.floor(char.gold / 10);
                char.gold -= 50;
            }
        }

        // Impôts des Vassaux
        if(char.liege) {
            const liege = characters.find(c => c.id === char.liege);
            if(liege) {
                const tax = Math.floor(char.gold * 0.1); // 10% d'impôts
                if(tax > 0) {
                    liege.gold += tax;
                    char.gold -= tax;
                }
            }
        }

        // Enfants
        if(char.spouse && char.isMale) {
            const spouse = characters.find(c => c.id === char.spouse);
            if(spouse && !spouse.pregnant && Math.random() < 0.03) {
                spouse.pregnant = true;
            }
        }
    });

    // Naissances
    characters.filter(c => c.pregnant).forEach(spouse => {
        if(Math.random() < 0.2) {
            spouse.pregnant = false;
            if(Math.random() < 0.1) {
                addLog("L'enfant est mort-né.");
            } else {
                const isMale = Math.random() > 0.5;
                const child = createCharacter(generateName(isMale), spouse.dynasty, 0, null, isMale, true);
                addLog(`Naissance de ${child.name} ${child.dynasty} !`);
            }
        }
    });

    if(Math.random() < 0.03) triggerRandomEvent();

    updateUI();
    renderMap();
}

function killCharacter(char) {
    char.alive = false;
    addLog(`${char.name} ${char.dynasty} est décédé(e).`);
    
    // Gestion du veuvage
    if(char.spouse) {
        const ex = characters.find(c => c.id === char.spouse);
        if(ex) ex.spouse = null;
        char.spouse = null;
    }

    if(char.id === playerCharId) {
        handlePlayerSuccession(char);
    } else {
        handleAISuccession(char);
    }
}

function handlePlayerSuccession(deadChar) {
    // Primogéniture : l'héritier le plus âgé de la dynastie
    const children = characters.filter(c => c.alive && c.dynasty === deadChar.dynasty && c.age > 0);
    if(children.length > 0) {
        const heir = children.sort((a,b) => b.age - a.age)[0];
        playerCharId = heir.id;
        heir.primaryTitle = deadChar.primaryTitle;
        heir.gold += deadChar.gold;
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
        addLog(`${heir.name} hérite de la couronne !`);
        selectCharacter(playerCharId);
    } else {
        // Game Over
        setSpeed(0);
        document.getElementById('game-over-screen').style.display = 'flex';
    }
}

function handleAISuccession(deadChar) {
    const children = characters.filter(c => c.alive && c.dynasty === deadChar.dynasty && c.age > 0);
    if(children.length > 0) {
        const heir = children.sort((a,b) => b.age - a.age)[0];
        heir.primaryTitle = deadChar.primaryTitle;
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
        addLog(`${heir.name} ${heir.dynasty} hérite des terres de ${deadChar.name}.`);
    } else {
        // Si pas d'héritier, retour au domaine royal
        provinces.forEach(p => { if(p.owner === deadChar.id) { p.owner = playerCharId; addLog(`${p.name} retourne au domaine royal.`); }});
    }
}

// --- MARIAGE ---
function openMarriageModal() {
    playClick();
    const modal = document.getElementById('marriage-modal');
    const listDiv = document.getElementById('spouse-list');
    const player = characters.find(c => c.id === playerCharId);
    
    if(player.spouse) { addLog("Vous êtes déjà marié !"); return; }

    const candidates = characters.filter(c => c.alive && !c.spouse && c.isMale !== player.isMale && c.id !== playerCharId && c.age >= 14);
    listDiv.innerHTML = '';
    
    if(candidates.length === 0) {
        listDiv.innerHTML = "<p>Aucun prétendant disponible.</p>";
    } else {
        candidates.forEach(c => {
            const div = document.createElement('div');
            div.className = 'char-card';
            div.innerHTML = `${c.name} ${c.dynasty} (Âge: ${c.age}, 💰${c.stats.stewardship})`;
            div.onclick = () => marry(playerCharId, c.id);
            listDiv.appendChild(div);
        });
    }
    modal.style.display = 'block';
}

function autoMarry() {
    playClick();
    const player = characters.find(c => c.id === playerCharId);
    const candidates = characters.filter(c => c.alive && !c.spouse && c.isMale !== player.isMale && c.id !== playerCharId && c.age >= 14);
    if(candidates.length > 0) {
        // Trie par statut (les seigneurs d'abord) puis par âge
        candidates.sort((a,b) => (b.primaryTitle ? 1 : 0) - (a.primaryTitle ? 1 : 0) || b.stats.stewardship - a.stats.stewardship);
        marry(playerCharId, candidates[0].id);
    } else {
        addLog("Aucun prétendant disponible.");
    }
}

function marry(id1, id2) {
    const c1 = characters.find(c => c.id === id1);
    const c2 = characters.find(c => c.id === id2);
    c1.spouse = id2; c2.spouse = id1;
    c1.prestige += 20; c2.prestige += 20;
    addLog(`${c1.name} et ${c2.name} se sont mariés !`);
    document.getElementById('marriage-modal').style.display = 'none';
    updateUI();
    selectCharacter(playerCharId);
}

function closeModal() {
    document.getElementById('marriage-modal').style.display = 'none';
}

// --- ÉVÉNEMENTS ---
function triggerRandomEvent() {
    playEvent();
    const events = [
        { title: "Bonne Récolte", desc: "Les paysans sont heureux.", choices: [{ text: "Taxer (+20 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold += 20; } }] },
        { title: "Pèlerinage", desc: "Un prêtre vous invite à Rome.", choices: [
            { text: "Y aller (+30 Prestige)", effect: () => { characters.find(c=>c.id===playerCharId).prestige += 30; }},
            { text: "Refuser (-10 Prestige)", effect: () => { characters.find(c=>c.id===playerCharId).prestige -= 10; }}
        ]},
        { title: "Famine", desc: "Le grain se fait rare.", choices: [
            { text: "Acheter du blé (-30 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold -= 30; }},
            { text: "Ignorer (-20 Troupes)", effect: () => { characters.find(c=>c.id===playerCharId).armySize -= 20; }}
        ]},
        { title: "Troupe de Mercenaires", desc: "Des soldats sans emploi cherchent du travail.", choices: [
            { text: "Les recruter (-50 Or, +50 Troupes)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.gold -= 50; p.armySize += 50; }},
            { text: "Les ignorer", effect: () => {} }
        ]},
        { title: "Intrigues de Cour", desc: "Un vassal complote contre vous.", choices: [
            { text: "L'emprisonner (+10 Prestige, -30 Troupes)", effect: () => { const p = characters.find(c=>c.id===playerCharId); p.prestige += 10; p.armySize -= 30; }},
            { text: "Négocier (-20 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold -= 20; }}
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
        btn.onclick = () => {
            playClick();
            choice.effect(); 
            document.getElementById('event-popup').style.display = 'none'; 
            updateUI();
        };
        choicesDiv.appendChild(btn);
    });
    document.getElementById('event-popup').style.display = 'block';
}

// --- VITESSE DU JEU ---
function setSpeed(speed) {
    gameSpeed = speed;
    clearInterval(gameLoopId);
    
    if(speed > 0) {
        const ms = [0, 1000, 500, 100][speed]; // Pause, Lent, Normal, Rapide
        gameLoopId = setInterval(nextMonth, ms);
    }
}

// --- UTILITAIRES ---
function addLog(msg) {
    const logContent = document.getElementById('log-content');
    const p = document.createElement('p');
    p.textContent = `[${getMonthName(date.month).substring(0,3)} ${date.year}] ${msg}`;
    logContent.prepend(p);
    if(logContent.children.length > 50) logContent.removeChild(logContent.lastChild); // Limite de log
}

function generateName(isMale) {
    const m = ["Louis", "Charles", "Henri", "Robert", "Hugues", "Philippe", "Raoul", "Guillaume", "Thibaud", "Eudes"];
    const f = ["Marie", "Marguerite", "Agnès", "Adèle", "Isabelle", "Jeanne", "Blanche", "Adélaïde", "Mathilde", "Adèle"];
    return isMale ? m[Math.floor(Math.random()*m.length)] : f[Math.floor(Math.random()*f.length)];
}

function getMonthName(month) { return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][month]; }
function getCharName(id) { const c = characters.find(c => c.id === id); return c ? `${c.name} ${c.dynasty}` : 'Inconnu'; }

// Démarrage
init();
