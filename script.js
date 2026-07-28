// --- DONNÉES DU JEU ---
let gameId = 1;
let date = { year: 1066, month: 0 };
let isPaused = true;
let playerCharId = 1;
let selectedProvinceId = null;

const provincesData = [
    { id: 1, name: "Île-de-France", path: "M200,150 L250,120 L280,160 L250,200 Z", baseIncome: 10 },
    { id: 2, name: "Normandie", path: "M150,80 L250,120 L200,150 L130,130 Z", baseIncome: 8 },
    { id: 3, name: "Bretagne", path: "M60,150 L130,130 L150,80 L100,100 Z", baseIncome: 6 },
    { id: 4, name: "Champagne", path: "M280,160 L350,130 L380,180 L320,200 Z", baseIncome: 7 },
    { id: 5, name: "Flandre", path: "M250,40 L350,60 L350,130 L280,160 L250,120 Z", baseIncome: 9 },
    { id: 6, name: "Aquitaine", path: "M130,300 L250,300 L280,380 L150,380 Z", baseIncome: 8 },
    { id: 7, name: "Bourgogne", path: "M280,240 L380,180 L400,260 L300,280 Z", baseIncome: 7 },
    { id: 8, name: "Toulouse", path: "M150,380 L280,380 L300,450 L180,460 Z", baseIncome: 6 },
    { id: 9, name: "Orléanais", path: "M200,150 L250,200 L280,240 L220,250 L170,220 Z", baseIncome: 7 },
    { id: 10, name: "Anjou", path: "M130,130 L200,150 L170,220 L100,200 Z", baseIncome: 6 },
    { id: 11, name: "Poitou", path: "M100,200 L170,220 L130,300 L80,270 Z", baseIncome: 6 },
    { id: 12, name: "Dauphiné", path: "M380,180 L450,220 L440,320 L350,300 L300,280 Z", baseIncome: 5 }
];

let characters = [];
let provinces = [];

// --- INITIALISATION ---
function init() {
    provincesData.forEach(p => {
        provinces.push({ ...p, owner: null, troops: 100 + Math.floor(Math.random()*100) });
    });

    // Créer les personnages historiques
    createCharacter("Philippe", "Capet", 1, 1, true); // Roi (Joueur)
    createCharacter("Guillaume", "Normandie", 2, 2, true); 
    createCharacter("Hugues", "Bourgogne", 7, 7, true); 
    createCharacter("Aliénor", "Aquitaine", 6, 6, false); 
    createCharacter("Robert", "Flandre", 5, 5, true); 
    createCharacter("Henri", "Champagne", 4, 4, true);
    
    // Vassaux du Roi au début
    assignVassal(2, 1); assignVassal(7, 1); assignVassal(6, 1); assignVassal(5, 1); assignVassal(4, 1);

    // Courtisans
    for(let i=0; i<6; i++) createCharacter(generateName(), "Courtisan", null, null, Math.random()>0.5, true);

    renderMap();
    updateUI();
    selectCharacter(playerCharId);
    addLog("Rex Francorum - 1066. Le Roi Philippe règne, mais ses vassaux sont puissants. Unifiez la France !");
}

function createCharacter(name, dynasty, age, ownedProvinceId, isMale, isCourtier = false) {
    const stats = { martial: Math.floor(Math.random()*10)+3, diplomacy: Math.floor(Math.random()*10)+3, stewardship: Math.floor(Math.random()*10)+3 };
    const char = {
        id: gameId++, name, dynasty, age: age || (Math.floor(Math.random()*30)+18), isMale,
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
    const svg = document.getElementById("map");
    svg.innerHTML = '';
    provinces.forEach(p => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", p.path);
        // Couleur : Or si au Roi, Rouge si vassal, Gris si neutre
        let color = "#888";
        if(p.owner === playerCharId) color = "#ffd700"; // Or royal
        else if(p.owner) color = "#cd5c5c"; // Rouge vassal
        
        path.setAttribute("fill", color);
        path.setAttribute("id", `prov-${p.id}`);
        path.classList.add("province");
        path.addEventListener("click", () => selectProvince(p.id));
        svg.appendChild(path);
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
    // Calcul de l'unification
    const royalProvinces = provinces.filter(p => p.owner === playerCharId).length;
    const pct = Math.round((royalProvinces / provinces.length) * 100);
    document.getElementById('unification-bar').value = pct;
    document.getElementById('unification-pct').textContent = `${pct}%`;
    
    if(pct >= 75 && !window.gameWon) {
        window.gameWon = true;
        isPaused = true;
        addLog("🏆 VICTOIRE ! Vous avez unifié le Royaume de France sous la Couronne !");
        alert("VICTOIRE ! Le Royaume de France est unifié !");
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
    html += `<p>Époux/se: ${char.spouse ? getCharName(char.spouse) : 'Célibataire'}</p>`;
    if(char.liege) html += `<p>Vassal de: ${getCharName(char.liege)}</p>`;
    
    infoDiv.innerHTML = html;
    
    if(id === playerCharId) {
        actionsDiv.style.display = 'block';
        btnClaim.style.display = 'none'; // On ne se déclare pas la guerre à soi-même
    } else {
        actionsDiv.style.display = 'none';
    }
}

function selectProvince(id) {
    selectedProvinceId = id;
    const prov = provinces[id-1];
    const owner = characters.find(c => c.id === prov.owner);
    
    if(owner) selectCharacter(owner.id);
    else {
        document.getElementById('char-info').innerHTML = `<h3>${prov.name}</h3><p>Territoire neutre</p>`;
        document.getElementById('actions').style.display = 'none';
    }

    // Gestion du bouton Revendiquer
    const btnClaim = document.getElementById('btn-claim');
    const player = characters.find(c => c.id === playerCharId);
    
    if(owner && owner.id !== playerCharId && owner.liege === playerCharId) {
        btnClaim.style.display = 'block';
        btnClaim.textContent = `🛡️ Revendiquer ${prov.name}`;
        btnClaim.onclick = () => claimProvince(id);
    } else {
        btnClaim.style.display = 'none';
    }
}

// --- MÉCANIQUES : GUERRE & UNIFICATION ---
function claimProvince(provId) {
    const prov = provinces[provId-1];
    const defender = characters.find(c => c.id === prov.owner);
    const player = characters.find(c => c.id === playerCharId);

    if(player.prestige < 50) {
        addLog("Pas assez de prestige pour revendiquer (50 requis).");
        return;
    }

    player.prestige -= 50;
    addLog(`Vous revendiquez ${prov.name} ! La guerre éclate.`);

    // Résolution simplifiée de la guerre
    const playerRoll = player.armySize * (0.8 + Math.random() * 0.4) + player.stats.martial * 10;
    const defenderRoll = defender.armySize * (0.8 + Math.random() * 0.4) + defender.stats.martial * 10;

    if(playerRoll > defenderRoll) {
        // Victoire
        addLog(`Victoire ! ${prov.name} est annexé au domaine royal.`);
        defender.liege = null; // N'est plus vassal
        prov.owner = playerCharId; // Le roi prend la province
        player.armySize += Math.floor(prov.troops / 2); // Intégration des troupes
        defender.armySize = Math.floor(defender.armySize * 0.3); // Le vassal est décimé
        player.prestige += 30;
        // Si le vassal n'a plus de province, il meurt ou fuit
        if(!provinces.some(p => p.owner === defender.id)) {
            defender.alive = false;
            addLog(`${defender.name} ${defender.dynasty} a perdu toutes ses terres.`);
        }
    } else {
        // Défaite
        addLog(`Défaite ! Vos troupes ont été repoussées à ${prov.name}.`);
        player.armySize = Math.floor(player.armySize * 0.6); // Pertes lourdes
        player.prestige -= 20;
        defender.liege = null; // Le vassal s'émancipe
        addLog(`${defender.name} ${defender.dynasty} s'émancipe de la couronne !`);
    }

    renderMap();
    updateUI();
    selectProvince(provId); // Rafraîchir l'affichage
}

// --- MÉCANIQUES : TEMPS & MARIAGE ---
function nextMonth() {
    date.month++;
    if(date.month > 11) { date.month = 0; date.year++; }

    characters.forEach(char => {
        if(!char.alive) return;

        // Vieillissement et mort
        if(Math.random() < 0.005 + (char.age*0.001)) { killCharacter(char); return; }

        // Revenus
        if(char.primaryTitle) {
            const ownedProvinces = provinces.filter(p => p.owner === char.id);
            let income = 0;
            ownedProvinces.forEach(p => income += p.baseIncome);
            char.gold += income + char.stats.stewardship;
        }

        // Enfants
        if(char.spouse && char.isMale) {
            const spouse = characters.find(c => c.id === char.spouse);
            if(spouse && !spouse.pregnant && Math.random() < 0.04) {
                spouse.pregnant = true;
            }
        }
        
        // Renforcement des armées pour l'IA
        if(char.id !== playerCharId && char.gold > 50) {
            char.armySize += Math.floor(char.gold / 10);
            char.gold -= 50;
        }
    });

    // Naissances
    characters.filter(c => c.pregnant).forEach(spouse => {
        if(Math.random() < 0.2) {
            spouse.pregnant = false;
            if(Math.random() < 0.1) {
                addLog("L'enfant est mort-né.");
            } else {
                const child = createCharacter(generateName(), spouse.dynasty, 0, null, Math.random()>0.5, true);
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
    if(char.id === playerCharId) handlePlayerSuccession(char);
    else handleAISuccession(char);
}

function handlePlayerSuccession(deadChar) {
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
        addLog("Game Over ! Votre lignée s'est éteinte.");
        isPaused = true;
    }
}

function handleAISuccession(deadChar) {
    const children = characters.filter(c => c.alive && c.dynasty === deadChar.dynasty && c.age > 0);
    if(children.length > 0) {
        const heir = children.sort((a,b) => b.age - a.age)[0];
        heir.primaryTitle = deadChar.primaryTitle;
        provinces.forEach(p => { if(p.owner === deadChar.id) p.owner = heir.id; });
    } else {
        provinces.forEach(p => { if(p.owner === deadChar.id) { p.owner = playerCharId; addLog(`${p.name} retourne au domaine royal.`); }});
    }
}

function openMarriageModal() {
    const modal = document.getElementById('marriage-modal');
    const listDiv = document.getElementById('spouse-list');
    const player = characters.find(c => c.id === playerCharId);
    
    if(player.spouse) { addLog("Vous êtes déjà marié !"); return; }

    const candidates = characters.filter(c => c.alive && !c.spouse && c.isMale !== player.isMale && c.id !== playerCharId);
    listDiv.innerHTML = '';
    
    candidates.forEach(c => {
        const div = document.createElement('div');
        div.className = 'char-card';
        div.innerHTML = `${c.name} ${c.dynasty} (Age: ${c.age}, 💰${c.stats.stewardship})`;
        div.onclick = () => marry(playerCharId, c.id);
        listDiv.appendChild(div);
    });

    modal.style.display = 'block';
}

function autoMarry() {
    const player = characters.find(c => c.id === playerCharId);
    const candidates = characters.filter(c => c.alive && !c.spouse && c.isMale !== player.isMale && c.id !== playerCharId);
    if(candidates.length > 0) marry(playerCharId, candidates[0].id);
}

function marry(id1, id2) {
    const c1 = characters.find(c => c.id === id1);
    const c2 = characters.find(c => c.id === id2);
    c1.spouse = id2; c2.spouse = id1;
    c1.prestige += 20;
    addLog(`${c1.name} et ${c2.name} se sont mariés !`);
    document.getElementById('marriage-modal').style.display = 'none';
    updateUI();
}

// --- ÉVÉNEMENTS ---
function triggerRandomEvent() {
    const events = [
        { title: "Bonne Récolte", desc: "Les paysans sont heureux.", choices: [{ text: "Taxer (+20 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold += 20; } }] },
        { title: "Pèlerinage", desc: "Un prêtre vous invite à Rome.", choices: [
            { text: "Y aller (+30 Prestige)", effect: () => { characters.find(c=>c.id===playerCharId).prestige += 30; }},
            { text: "Refuser (-10 Prestige)", effect: () => { characters.find(c=>c.id===playerCharId).prestige -= 10; }}
        ]},
        { title: "Famine", desc: "Le grain se fait rare.", choices: [
            { text: "Acheter du blé (-30 Or)", effect: () => { characters.find(c=>c.id===playerCharId).gold -= 30; }},
            { text: "Ignorer (-20 Troupes)", effect: () => { characters.find(c=>c.id===playerCharId).armySize -= 20; }}
        ]}
    ];
    showEvent(events[Math.floor(Math.random() * events.length)]);
}

function showEvent(event) {
    isPaused = true;
    document.getElementById('event-title').textContent = event.title;
    document.getElementById('event-desc').textContent = event.desc;
    const choicesDiv = document.getElementById('event-choices');
    choicesDiv.innerHTML = '';
    event.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.textContent = choice.text;
        btn.onclick = () => { choice.effect(); document.getElementById('event-popup').style.display = 'none'; updateUI(); };
        choicesDiv.appendChild(btn);
    });
    document.getElementById('event-popup').style.display = 'block';
}

// --- UTILITAIRES ---
function addLog(msg) {
    const logContent = document.getElementById('log-content');
    const p = document.createElement('p');
    p.textContent = `[${getMonthName(date.month).substring(0,3)} ${date.year}] ${msg}`;
    logContent.prepend(p); // Le plus récent en haut
}

function generateName() {
    const m = ["Louis", "Charles", "Henri", "Robert", "Hugues", "Philippe", "Raoul", "Guillaume"];
    const f = ["Marie", "Marguerite", "Agnès", "Adèle", "Isabelle", "Jeanne", "Blanche", "Adélaïde"];
    return Math.random() > 0.5 ? m[Math.floor(Math.random()*m.length)] : f[Math.floor(Math.random()*f.length)];
}

function getMonthName(month) { return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][month]; }
function getCharName(id) { const c = characters.find(c => c.id === id); return c ? `${c.name} ${c.dynasty}` : 'Inconnu'; }

// --- ÉVÉNEMENTS HTML ---
document.getElementById('btn-play').addEventListener('click', () => { isPaused = false; });
document.getElementById('btn-pause').addEventListener('click', () => { isPaused = true; });
document.getElementById('btn-marry').addEventListener('click', openMarriageModal);
document.getElementById('btn-auto-marry').addEventListener('click', autoMarry);
document.getElementById('btn-close-modal').addEventListener('click', () => { document.getElementById('marriage-modal').style.display = 'none'; });

// Boucle de jeu
setInterval(() => { if(!isPaused) nextMonth(); }, 1000);

// Démarrage
init();
