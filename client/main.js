window.addEventListener('load', onLoad);

/*
Globals
*/
const NEGATIVES = [
    'The city has poor drainage systems.',
    'There was a fire at the super-market.',
    'Crime rate has gone up since the beginning of last year.',
    'The president was brutally murdered.',
    'There is a deadly animal on the loose.',
    'The central bank was robbed.',
    'The chemical factory dumps its waste into the city river.',
    'Air pollution has been rising gradually.',
    'The central park had to be closed due to a sewage leak.'
];
const SIZES = {
    1: {
        w: 2, h: 2
    },
    2: {
        w: 4, h: 4
    },
    3: {
        w: 6, h: 6
    }
}, GAME_TIME = 180,
    MAX_POPULATION = 200,
    VICINITY_RANGE = 4,
    GROUP_WAIT_TIME = 5000,
    NEW_CHAR_TIME_GAP = 500,
    MIN_VELOCITY = 0.5,
    MAX_VELOCITY = 1,
    MAX_INSANITY_LIMIT = 2,
    MINIMUM_BEFORE_NEXT_TALK = -1 * Math.ceil(6 * (MIN_VELOCITY + MAX_VELOCITY) / 2),
    BUILT_IN_MEMORIES = [{
        message: 'The government is incompetent.'
    }, {
        message: 'The city is full of shit.'
    }, {
        message: 'I like how the parks are maintained!'
    }, {
        message: 'The mayor was part of a bad scandal.'
    }, {
        message: 'Good that the electricity prices have fallen.'
    }],
    BACKGROUND = '#16161d', SERVER_URL = 'http://ec2-18-176-52-136.ap-northeast-1.compute.amazonaws.com:8000';
let COLORMAP = [];

//timers
let mainTimer, memoryAddn, charGen;

let ctx, cH, cW, newMemory, globalInsanity = 0, globalInsanityDelta = 0;

function onLoad() {
    const cnvs = document.getElementById('main');
    ctx = cnvs.getContext("2d");
    if (window.innerHeight < cnvs.height || window.innerWidth < cnvs.width) {
        let size = window.innerHeight < cnvs.height ? (window.innerHeight < window.innerWidth ? window.innerHeight : window.innerWidth) : (window.innerWidth < window.innerHeight ? window.innerWidth : window.innerHeight);
        cnvs.setAttribute('height', size - 10)
        cnvs.setAttribute('width', size - 10)
    }
    cH = cnvs.height;
    cW = cnvs.width;
    newMemory = document.getElementById('newMemory');
    newMemory.setAttribute('placeholder', 'A sane message')
    document.getElementById('beginGame').addEventListener('click', () => {
        init().then(() => {
            start();
            document.getElementById('introModalContainer').style.display = 'none';
        });
    })
}

function beginAgain() {
    window.location = '/';
}

function getSentiment(phrase) {
    return fetch(`${SERVER_URL}/sentiment?phrase=${phrase}`).then(res => res.json())
}

/*
char: {
    id,
    x, y,
    sizeType,
    vx, vy
}
*/
/*
talking: [
    { id, members: [char] }
]
*/
let chars = [], talking = [];
function init() {
    return new Promise(res => {
        let promises = []
        BUILT_IN_MEMORIES.forEach(m => {
            promises.push(
                getSentiment(m.message).then(res => {
                    m.iQ = res.insanity;
                })
            )
        })
        promises.push(
            fetch(`${SERVER_URL}/colormap`).then(res => res.json()).then(res => {
                COLORMAP = res.map;
                const heatmap = document.getElementById('heat');
                heatmap.style.display = 'flex';
                COLORMAP.forEach(c => {
                    let sp = document.createElement('div');
                    sp.style.background = c;
                    sp.style.height = '20px';
                    sp.style.width = '20px';
                    heatmap.appendChild(sp);
                })
            })
        )
        Promise.all(promises).then(res);
    })
}

function start() {
    startTimer();
    startCharGeneration();
    startMemoryAddition();
    updateBoard();
    run();
}

let gameStart, timeRemaining;
function startTimer() {
    const timer = document.getElementById('timer');
    gameStart = Date.now();
    mainTimer = setInterval(() => {
        timeRemaining = GAME_TIME + 1 - Math.floor((Date.now() - gameStart) / 1000);
        timer.textContent = timeRemaining + ' seconds remaining';
    }, 1000);
}

function addNewMemory(p) {
    if (!p) {
        document.getElementById('addNewMemory').disabled = true;
        document.getElementById('addNewMemory').textContent = 'Wait For Some Time'
        setTimeout(() => {
            document.getElementById('addNewMemory').disabled = false;
            document.getElementById('addNewMemory').textContent = 'Add'
        }, 6500);
    }
    let phrase = p || newMemory.value;
    if (!p) newMemory.value = '';
    phrase.trim().length && getSentiment(phrase).then(res => {
        let char = chars.find(c => !c.memory);
        if (char) {
            char.memory = {
                message: phrase,
                iQ: res.insanity
            }
        } else {
            chars.shift();
            addChar({
                memory: {
                    message: phrase,
                    iQ: res.insanity
                }
            })
        }
    })
}

function startMemoryAddition() {
    memoryAddn = setInterval(() => {
        const val = chars.slice().reduce((acc, c) => acc + c.insanity, 0) / chars.length;
        globalInsanityDelta = val - globalInsanity;
        globalInsanity = val;
        let cityInsanity = document.getElementById('cityInsanity');
        cityInsanity.innerHTML = 'Insanity: ' + val.toFixed(4) + ' / ' + MAX_INSANITY_LIMIT;
        if (globalInsanityDelta <= 0.05) {
            addNewMemory(NEGATIVES[Math.floor(Math.random() * NEGATIVES.length)]);
        }
    }, 5500)
}

function startCharGeneration() {
    charGen = setInterval(addChar, NEW_CHAR_TIME_GAP);
}

function addChar(props = {}) {
    if (chars.length > MAX_POPULATION) {
        clearInterval(charGen);
        return
    }
    chars.push({
        id: 'char_' + uuidv4(),
        x: Math.floor(Math.random() * cW),
        y: Math.floor(Math.random() * cH),
        vx: randomVel(),
        vy: randomVel(),
        sizeType: 3,
        isTalking: 0,
        memory: getInitialMemory(),
        insanity: 0.01 + Number(0.5 * Math.random().toFixed(2)),
        gullibility: getCharGullibility(),
        ...props
    })
}

function randomVel() {
    return (Math.random() < 0.5 ? 1 : -1) * (MIN_VELOCITY + Math.random() * (MAX_VELOCITY - MIN_VELOCITY));
}

function getInitialMemory() {
    return Math.floor(Math.random() * 10) % 2 ? BUILT_IN_MEMORIES[Math.floor(Math.random() * BUILT_IN_MEMORIES.length)] : null
}

function getCharGullibility() {
    if (chars.length % 10) {
        return 0.5 + Math.random() * 0.5
    } else {
        return Math.random() * 0.5
    }
}

let animationId
function run() {
    if (exitCondition()) {
        cancelAnimationFrame(animationId);
        endGame();
        return
    }
    animationId = requestAnimationFrame(run);
    fillBackground();

    placeChars();
    vicinity();
    updatePosition();
}

function exitCondition() {
    return timeRemaining <= 0 || globalInsanity > MAX_INSANITY_LIMIT;
}

function endGame() {
    clearTimers();
    document.getElementById('mainDiv').style.display = 'none';
    if (globalInsanity <= MAX_INSANITY_LIMIT) {
        document.getElementById('winModal').style.display = 'flex';
    } else {
        document.getElementById('loseModal').style.display = 'flex';
    }
}

function clearTimers() {
    clearInterval(mainTimer);
    clearInterval(charGen);
    clearInterval(memoryAddn);
}

function fillBackground() {
    let temp = ctx.fillStyle;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, cW, cH);
    ctx.fillStyle = temp;
}

function placeChars() {
    chars.forEach(c => {
        fillChar(c);
    });
}

function fillChar(c) {
    let { w, h } = SIZES[c.sizeType || 1];
    let temp = ctx.fillStyle;
    ctx.fillStyle = getFillStyle(c);
    ctx.fillRect(c.x, c.y, w, h);
    ctx.fillStyle = temp;
}

function getFillStyle(c) {
    return c.insanity < 0 ? COLORMAP[0] : (Math.floor(c.insanity) > 4 ? COLORMAP[4] : COLORMAP[Math.floor(c.insanity)])
}

function vicinity() {
    let coords = chars.map((c, i) => [c.x, c.y, c.id, i]);
    coords.forEach(a => {
        coords.forEach(comp => {
            if (a[2] !== comp[2]) {
                if (Math.abs(a[0] - comp[0]) < VICINITY_RANGE && Math.abs(a[1] - comp[1]) < VICINITY_RANGE) {
                    stopThemFor(chars[a[3]], chars[comp[3]]);
                }
            }
        })
    })
}

function stopThemFor(one, two, time = GROUP_WAIT_TIME) {
    if (one.isTalking < 0) {
        one.isTalking += 1;
        return
    }
    if (two.isTalking < 0) {
        two.isTalking += 1;
        return
    }
    if (one.isTalking && two.isTalking) return;
    let group, newMemberId;
    if (one.isTalking) {
        group = talking.find(talk => talk.id === one.isTalking);
        group.members.push(two);
        two.isTalking = group.id;
        two.vx = 0;
        two.vy = 0;
        newMemberId = two.id;
    } else if (two.isTalking) {
        group = talking.find(talk => talk.id === two.isTalking);
        group.members.push(one);
        one.isTalking = group.id;
        one.vx = 0;
        one.vy = 0;
        newMemberId = one.id;
    } else {
        one.vx = 0;
        one.vy = 0;
        two.vx = 0;
        two.vy = 0;
        group = {
            id: 'group_' + uuidv4(),
        }
        one.isTalking = group.id;
        two.isTalking = group.id;
        group.members = [one, two];
        talking.push(group);
        setTimeout(() => endTalkIfDone(group.id), time);
        newMemberId = null;
    }
    updateBoard();
    talk(group.id, newMemberId);
}

function updateBoard() {
    let grps = document.getElementById('groups');
    let memories = document.getElementById('memories');
    grps.innerHTML = '';
    memories.innerHTML = '<tr><th>Message</th><th>People talking</th></tr>';
    talking.forEach(group => {
        let div = document.createElement('div');
        let netInsanity = (group.members.reduce((acc, m) => acc + m.insanity, 0) / group.members.length).toFixed(2);
        div.style.background = getFillStyle({ insanity: netInsanity });
        div.appendChild(document.createTextNode(netInsanity));
        grps.appendChild(div);
    })
    let charMemoryMap = {}
    chars.forEach(c => {
        if (c.memory && charMemoryMap[c.memory.message]) {
            charMemoryMap[c.memory.message] += 1;
        } else if (c.memory) {
            charMemoryMap[c.memory.message] = 1;
        }
    });
    let keys = Object.keys(charMemoryMap);
    keys.sort((a, b) => charMemoryMap[b] - charMemoryMap[a]);
    keys.forEach(k => {
        let tr = memories.insertRow(-1);
        let td1 = tr.insertCell(0);
        td1.textContent = k;
        let td2 = tr.insertCell(1);
        td2.textContent = charMemoryMap[k];
    });
}

function talk(gId, newMemberId) {
    let group = talking.find(g => g.id === gId);
    if (!newMemberId) {
        group.members.forEach(m1 => {
            group.members.forEach(m2 => {
                if (m1.id !== m2.id) {
                    if (m1.gullibility < 0.5 || m1.gullibility > m2.gullibility) {
                        if (m2.memory) {
                            if (m1.memory && m2.gullibility > 0.1) {
                                m2.gullibility -= 0.01
                            }
                            m1.memory = m2.memory;
                            m1.insanity += m2.memory.iQ;
                        }
                    } else if (m2.gullibility < 0.5 || m2.gullibility > m1.gullibility) {
                        if (m1.memory) {
                            if (m2.memory && m1.gullibility > 0.1) {
                                m1.gullibility -= 0.01
                            }
                            m2.memory = m1.memory;
                            m2.insanity += m1.memory.iQ;
                        }
                    }
                }
            })
        })
    } else {
        let newMember = group.members.find(m => m.id === newMemberId);
        group.members.forEach(m1 => {
            if (m1.id !== newMemberId) {
                if (m1.gullibility >= newMember.gullibility) {
                    m1.memory = newMember.memory;
                    if (newMember.memory)
                        m1.insanity += newMember.memory.iQ;
                } else {
                    newMember.memory = m1.memory;
                    if (m1.memory)
                        newMember.insanity += m1.memory.iQ;
                }
            }
        })
    }
}

function endTalkIfDone(id) {
    let idx = talking.findIndex(x => x.id === id);
    let t = talking[idx];
    t.members.forEach(mem => {
        mem.vx = randomVel();
        mem.vy = randomVel();
        mem.isTalking = t.members.length * MINIMUM_BEFORE_NEXT_TALK;
    })
    talking.splice(idx, 1);
    updateBoard();
}

function updatePosition() {
    chars.forEach(c => {
        c.x += c.vx;
        c.y += c.vy;
        if (c.x > cW || c.x < 0) c.vx = -c.vx;
        if (c.y > cH || c.y < 0) c.vy = -c.vy;
    });
}