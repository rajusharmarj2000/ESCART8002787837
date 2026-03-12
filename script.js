const app = {
    // --- STATE ---
    user: {
        name: 'You',
        balance: 5000,
        mobile: '',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    },
    settings: { music: true, sfx: true },

    // --- INIT ---
    init: function () {
        // Init logic
        setTimeout(() => {
            document.getElementById('screen-splash').classList.remove('active');
            if (localStorage.getItem('ludo_user_pro')) {
                this.user = JSON.parse(localStorage.getItem('ludo_user_pro'));
            }
            this.nav.to('lobby');
            this.updateUI();
        }, 1000);

        // Sound Unlock
        document.body.addEventListener('click', () => {
            if (this.settings.music) this.ui.playBgm();
        }, { once: true });
    },

    nav: {
        to: function (id) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(`screen-${id}`).classList.add('active');
        },
        back: function () { this.to('lobby'); }
    },

    updateUI: function () {
        if (document.getElementById('lobby-balance')) document.getElementById('lobby-balance').innerText = this.user.balance;
        if (document.getElementById('entry-balance')) document.getElementById('entry-balance').innerText = this.user.balance;
    },

    // --- MATCHMAKING ---
    match: {
        start: function () {
            // Deduct Fee
            if (app.user.balance < 100) return alert("Low Balance!");
            app.user.balance -= 100;
            app.updateUI();

            // Show Animation
            app.nav.to('matchmaking');
            document.getElementById('screen-matchmaking').innerHTML = `
                <div class="match-anim">
                     <img src="${app.user.avatar}" class="my-avatar">
                     <div class="vs-badge">VS</div>
                     <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=CPU" class="opp-avatar">
                </div>
                <h2>Starting...</h2>
            `;

            setTimeout(() => {
                app.nav.to('game');
                app.game.start();
            }, 2000);
        }
    },

    // --- ROBUST GAME ENGINE ---
    game: {
        tokens: {},
        turn: 0, // 0=Red(You), 1=Green(CPU)
        players: ['red', 'green'],
        diceVal: 0,
        state: 'IDLE', // IDLE, ROLLING, MOVING

        start: function () {
            this.createGrid();
            this.resetTokens();
            this.turn = 0;
            this.state = 'IDLE';
            this.updateStatus("YOUR TURN! TAP TO ROLL");

            // Bind Dice Touch - BIG AREA
            const area = document.getElementById('game-bottom-area');
            area.onclick = (e) => {
                // If touching dice area or bottom bar
                if (this.turn === 0 && this.state === 'IDLE') {
                    this.rollDice();
                }
            };
        },

        createGrid: function () {
            const board = document.getElementById('ludo-grid');
            board.innerHTML = '';
            // Simple Grid Generation
            for (let r = 1; r <= 15; r++) {
                for (let c = 1; c <= 15; c++) {
                    const d = document.createElement('div');
                    d.className = 'cell';
                    // Visibility logic
                    if (!((r <= 6 && c <= 6) || (r <= 6 && c >= 10) || (r >= 10 && c <= 6) || (r >= 10 && c >= 10))) {
                        // Visible path
                        d.style.gridRow = r; d.style.gridColumn = c;
                        // Color Paths
                        if (r == 8 && c > 1 && c < 7) d.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                        if (c == 8 && r > 1 && r < 7) d.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                        // Stars
                        if ((r == 9 && c == 14) || (r == 7 && c == 2) || (r == 3 && c == 7)) d.innerHTML = '★';

                        board.appendChild(d);
                    }
                }
            }
            // Add Center
            const center = document.createElement('div');
            center.className = 'center-logo';
            center.innerHTML = '🏆';
            center.style.gridRow = '7/10'; center.style.gridColumn = '7/10';
            board.appendChild(center);
        },

        resetTokens: function () {
            // Clear old
            document.querySelectorAll('.token').forEach(t => t.remove());
            this.tokens = { red: [], green: [] };

            ['red', 'green'].forEach(color => {
                for (let i = 0; i < 4; i++) {
                    const t = { id: `${color}-${i}`, color: color, step: -1, state: 'base' };
                    this.tokens[color].push(t);
                    this.renderToken(t);
                }
            });
        },

        renderToken: function (t) {
            let el = document.getElementById(t.id);
            if (!el) {
                el = document.createElement('div');
                el.id = t.id;
                el.className = `token token-${t.color}`;
                // Direct Click Event
                el.onclick = (e) => {
                    e.stopPropagation();
                    if (this.turn === 0 && this.state === 'WAIT_MOVE') {
                        this.tryMove(t);
                    }
                };
                document.getElementById('ludo-grid').appendChild(el);
            }

            // Positioning Logic
            if (t.state === 'base') {
                // Fixed Base Positions
                const bases = {
                    'red-0': [2, 2], 'red-1': [2, 5], 'red-2': [5, 2], 'red-3': [5, 5],
                    'green-0': [2, 10], 'green-1': [2, 13], 'green-2': [5, 10], 'green-3': [5, 13]
                };
                // We use percentage relative to board-frame (15x15 grid)
                // BUT wait, bases are outside the grid loop in standard CSS.
                // Simpler: Use specific Base Container or absolute %

                // Hack: Map indices 0-3 to corners
                if (t.color === 'red') {
                    const p = [[10, 10], [10, 30], [30, 10], [30, 30]][parseInt(t.id.split('-')[1])];
                    el.style.top = p[0] + '%'; el.style.left = p[1] + '%';
                } else {
                    const p = [[10, 70], [10, 90], [30, 70], [30, 90]][parseInt(t.id.split('-')[1])];
                    el.style.top = p[0] + '%'; el.style.left = p[1] + '%';
                }
                el.style.transform = 'translate(-50%, -50%)';
            } else if (t.state === 'won') {
                el.style.display = 'none';
            } else {
                // On Path
                const pos = this.getPathPos(t.color, t.step);
                // Convert (row,col) to %
                // 15 rows = 100%, 1 row = 6.66%
                // Center of cell = (row-1)*6.66 + 3.33
                const top = (pos[0] - 1) * 6.66 + 3.33;
                const left = (pos[1] - 1) * 6.66 + 3.33;
                el.style.top = top + '%';
                el.style.left = left + '%';
                el.style.transform = 'translate(-50%, -50%)';
            }
        },

        rollDice: function () {
            this.state = 'ROLLING';
            const dice = document.getElementById('dice-val');
            dice.innerText = '🎲';
            dice.classList.add('rolling');
            app.ui.playSfx('sfx-roll');

            setTimeout(() => {
                dice.classList.remove('rolling');
                // Cheat: First roll always 6
                let val = Math.floor(Math.random() * 6) + 1;
                if (this.turn === 0 && !this.tokens.red.some(t => t.state !== 'base')) val = 6;

                this.diceVal = val;
                dice.innerText = val;

                this.checkMoves(val);
            }, 600);
        },

        checkMoves: function (val) {
            const color = this.players[this.turn];
            const myTokens = this.tokens[color];

            // Filter valid moves
            const moves = myTokens.filter(t => {
                if (t.state === 'base') return val === 6;
                if (t.state === 'active') return (t.step + val) <= 56; // Max path
                return false;
            });

            if (moves.length === 0) {
                this.updateStatus("No Moves Possible");
                setTimeout(() => this.nextTurn(), 1000);
            } else if (moves.length === 1 && this.turn === 0) {
                // AUTO MOVE for User if only 1 option!
                this.updateStatus("Auto Moving...");
                setTimeout(() => this.moveToken(moves[0], val), 500);
            } else {
                if (this.turn === 0) {
                    this.state = 'WAIT_MOVE';
                    this.updateStatus("TAP A HIGHLIGHTED TOKEN");
                    // Highlight logic
                    moves.forEach(t => {
                        document.getElementById(t.id).classList.add('pulse');
                    });
                } else {
                    // CPU Move
                    setTimeout(() => {
                        const pick = moves.find(t => t.state === 'active') || moves[0];
                        this.moveToken(pick, val);
                    }, 1000);
                }
            }
        },

        tryMove: function (t) {
            // Validate
            // Check if t in moves? Simple check:
            if (t.color !== 'red') return;
            if (t.state === 'base' && this.diceVal !== 6) return;

            // Clear highlights
            document.querySelectorAll('.token').forEach(e => e.classList.remove('pulse'));
            this.moveToken(t, this.diceVal);
        },

        moveToken: function (t, steps) {
            this.state = 'MOVING';
            if (t.state === 'base') {
                t.state = 'active';
                t.step = 0;
            } else {
                t.step += steps;
            }

            // Check Win
            if (t.step >= 56) {
                t.state = 'won';
                app.ui.playSfx('sfx-win');
            } else {
                app.ui.playSfx('sfx-move');
            }

            this.renderToken(t);

            // Next
            if (this.diceVal === 6) {
                this.state = 'IDLE';
                this.updateStatus(this.turn === 0 ? "YOU ROLLED 6! ROLL AGAIN" : "CPU ROLLED 6");
                if (this.turn === 1) setTimeout(() => this.rollDice(), 1000);
            } else {
                this.nextTurn();
            }
        },

        nextTurn: function () {
            this.turn = (this.turn + 1) % 2;
            this.state = 'IDLE';

            // UI
            if (this.turn === 0) {
                this.updateStatus("YOUR TURN");
                document.getElementById('turn-indicator').style.display = 'block';
            } else {
                this.updateStatus("CPU TURN...");
                document.getElementById('turn-indicator').style.display = 'none';
                setTimeout(() => this.rollDice(), 1000);
            }
        },

        getPathPos: function (color, step) {
            // FULL PATH COORDINATES (Simplified for 15x15)
            // Path sequence for RED: (7,2)->(7,6)->(6,7)->...
            // Let's use a standard list
            const p = [
                [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],  // 0-10
                [1, 8], [1, 9], // 11-12
                [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 10], [7, 11], [7, 12], [7, 13], [7, 14], [7, 15], // 13-23
                [8, 15], [9, 15], // 24-25
                [9, 14], [9, 13], [9, 12], [9, 11], [9, 10], [10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [15, 9], // 26-36
                [15, 8], [15, 7], // 37-38
                [14, 7], [13, 7], [12, 7], [11, 7], [10, 7], [9, 6], [9, 5], [9, 4], [9, 3], [9, 2], [9, 1], // 39-49
                [8, 1], [7, 1] // 50-51 (Ready to enter home)
            ];
            // Home Runs
            const redHome = [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7]];
            const greenHome = [[2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8]];

            // Offset logic
            // Red starts at 0. Green starts at 13.
            if (step > 50) {
                // Return Home Path
                const hIdx = step - 51;
                if (color === 'red') return redHome[hIdx] || [8, 8];
                if (color === 'green') return greenHome[hIdx] || [8, 8];
            }

            const offset = (color === 'red' ? 0 : 13);
            const idx = (offset + step) % 52;
            return p[idx];
        },

        updateStatus: function (msg) {
            document.getElementById('game-msg').innerText = msg;
        }
    },

    ui: {
        playSfx: function (id) {
            const a = document.getElementById(id); if (a) { a.currentTime = 0; a.play().catch(e => { }); }
        },
        playBgm: function () {
            const a = document.getElementById('sfx-bgm'); if (a) a.play().catch(e => { });
        }
    }
};

window.onload = () => app.init();
