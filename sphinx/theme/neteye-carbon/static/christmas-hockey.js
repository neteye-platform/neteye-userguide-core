/*
 * Christmas hockey easter egg: Santa Clauses vs Humbugs, refereed by a red panda.
 *
 * The present icon in the top bar (#xmas-game) is only revealed during the
 * Christmas season (1 Dec - 6 Jan). Add ?xmas to the URL to force it on.
 * Everything is drawn on a <canvas>; no external dependencies.
 */
(function () {
    "use strict";

    const SCRIPT_SRC = document.currentScript ? document.currentScript.src : "";
    const STATIC_BASE = SCRIPT_SRC.replace(/[^/]*$/, "");

    function isChristmasSeason(date) {
        const month = date.getMonth();
        return month === 11 || (month === 0 && date.getDate() <= 6);
    }

    function isForced() {
        try {
            return new URLSearchParams(window.location.search).has("xmas");
        } catch (e) {
            return false;
        }
    }

    function initTrigger() {
        const trigger = document.getElementById("xmas-game");
        if (!trigger || !(isChristmasSeason(new Date()) || isForced())) {
            return;
        }
        trigger.classList.remove("xmas-hidden");
        trigger.addEventListener("click", () => {
            if (!game) {
                game = createGame(trigger);
            }
            game.open();
        });
    }

    let game = null;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTrigger);
    } else {
        initTrigger();
    }

    /* ------------------------------------------------------------------ */
    /* Game                                                               */
    /* ------------------------------------------------------------------ */

    // World geometry (rink units, independent from screen size)
    const W = 1000, H = 500, M = 20;          // rink size and board margin
    const CORNER = 90;                        // rounded corner radius
    const GOAL_LINE = 70;                     // distance of goal line from the end boards
    const NET_MOUTH = 86, NET_DEPTH = 28;
    const SKATER_R = 16, PUCK_R = 6;
    const GOALIE_REACH = 12;                  // pads and glove beyond the goalie body
    const GAME_SECONDS = 180;
    const SANTA = 0, HUMBUG = 1;
    const TEAM_NAMES = ["Santa Clauses", "Humbugs"];

    const COLORS = {
        ice: "#f4f9ff",
        iceLine: "#d6e6f5",
        red: "#da1e28",
        blue: "#0f62fe",
        crease: "rgba(69, 137, 255, 0.25)",
        santa: "#da1e28",
        santaDark: "#a2191f",
        skin: "#ffd8bd",
        humbug: "#4f9d1d",
        humbugFace: "#9bd33b",
        humbugJersey: "#0e6027",
        panda: "#c4501a",
        pandaDark: "#5a2410",
        stick: "#8a5a2b",
    };

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (lo, hi) => lo + Math.random() * (hi - lo);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    function goalX(team) {
        // x of the goal line that `team` defends
        return team === SANTA ? GOAL_LINE : W - GOAL_LINE;
    }

    function attackDir(team) {
        return team === SANTA ? 1 : -1;
    }

    function createGame(trigger) {
        loadStylesheet();
        const sponsors = loadSponsors();

        /* ---------- DOM ---------- */
        const overlay = document.createElement("div");
        overlay.className = "xh-overlay";
        overlay.hidden = true;
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Christmas hockey game");
        overlay.innerHTML = `
            <div class="xh-panel">
                <div class="xh-header">
                    <span class="xh-title">&#127877; Santa Clauses vs Humbugs &#127954;</span>
                    <button type="button" class="xh-close" aria-label="Close game">&times;</button>
                </div>
                <div class="xh-hud" aria-live="polite">
                    <div class="xh-team santa"><span>Santa Clauses</span><b data-score="0">0</b></div>
                    <div class="xh-clock">3:00</div>
                    <div class="xh-team humbug"><b data-score="1">0</b><span>Humbugs</span></div>
                </div>
                <div class="xh-stage">
                    <canvas aria-label="Hockey rink"></canvas>
                    <div class="xh-screen"></div>
                </div>
                <div class="xh-help">
                    <kbd>&larr;&uarr;&rarr;&darr;</kbd>/<kbd>WASD</kbd> skate &middot;
                    <kbd>Space</kbd> shoot (hold to charge) / poke check &middot;
                    <kbd>E</kbd> pass &middot; <kbd>Q</kbd> switch player &middot;
                    <kbd>P</kbd> pause &middot; <kbd>M</kbd> mute &middot; <kbd>Esc</kbd> close
                </div>
                <div class="xh-touch">
                    <button type="button" class="xh-btn secondary" data-touch="switch">Switch</button>
                    <button type="button" class="xh-btn secondary" data-touch="pass">Pass</button>
                    <button type="button" class="xh-btn" data-touch="shoot">Shoot</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const canvas = overlay.querySelector("canvas");
        const ctx = canvas.getContext("2d");
        const screenEl = overlay.querySelector(".xh-screen");
        const clockEl = overlay.querySelector(".xh-clock");
        const scoreEls = overlay.querySelectorAll("[data-score]");
        const closeBtn = overlay.querySelector(".xh-close");

        /* ---------- State ---------- */
        const keys = new Set();
        const touchStick = {active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0};
        let isOpen = false;
        let rafId = 0;
        let lastTime = 0;
        let elapsed = 0;
        let muted = false;
        let audio = null;

        let state = "title";       // title | faceoff | play | goal | paused | over
        let pausedFrom = null;
        let stateTimer = 0;
        let clock = GAME_SECONDS;
        let overtime = false;
        let score = [0, 0];
        let lastScorer = null;
        let controlled = null;
        let charging = false;
        let charge = 0;
        let banner = null;         // {text, t}

        const skaters = [];
        const puck = {x: W / 2, y: H / 2, vx: 0, vy: 0, owner: null, ignore: null, ignoreTimer: 0, beat: null, lastTouch: null, inNet: null};
        const referee = {x: W / 2, y: 24, vx: 0, vy: 0, bubble: null, bubbleT: 0, arm: 0};
        const flakes = Array.from({length: 70}, () => ({
            x: rand(0, W + 2 * M), y: rand(0, H + 2 * M), r: rand(1, 3), s: rand(15, 45), w: rand(0, 6.28),
        }));
        const confetti = [];

        function makeTeam(team) {
            const names = team === SANTA
                ? ["Santa Nick", "Santa Kris", "Santa Klaus", "Santa Noel"]
                : ["Grumbles", "Sourpuss", "Mean-o", "Scowl"];
            const members = [];
            for (let role = 0; role < 4; role++) {
                members.push({
                    team, role, goalie: role === 3, name: names[role],
                    x: 0, y: 0, vx: 0, vy: 0, a: team === SANTA ? 0 : Math.PI,
                    cooldown: 0, stealT: 0, holdT: 0, decideT: rand(0, 1),
                });
            }
            return members;
        }

        skaters.push(...makeTeam(SANTA), ...makeTeam(HUMBUG));

        function faceoffSpot(s) {
            const d = attackDir(s.team);
            if (s.goalie) return {x: goalX(s.team) + d * 18, y: H / 2};
            if (s.role === 0) return {x: W / 2 - d * 24, y: H / 2};
            return {x: W / 2 - d * 140, y: H / 2 + (s.role === 1 ? -120 : 120)};
        }

        function resetPositions(snap) {
            for (const s of skaters) {
                const spot = faceoffSpot(s);
                if (snap) {
                    s.x = spot.x;
                    s.y = spot.y;
                    s.vx = s.vy = 0;
                }
                s.a = s.team === SANTA ? 0 : Math.PI;
                s.cooldown = 0;
                s.holdT = 0;
            }
            puck.x = W / 2;
            puck.y = H / 2;
            puck.vx = puck.vy = 0;
            puck.owner = null;
            puck.ignore = null;
            puck.inNet = null;
            if (snap) {
                referee.x = W / 2;
                referee.y = H / 2 - 40;
            }
        }

        function startFaceoff() {
            state = "faceoff";
            stateTimer = 0;
            charging = false;
            resetPositions(false);
            puck.x = -1000;            // puck is in the referee's paw until the drop
            controlled = skaters.find(s => s.team === SANTA && s.role === 0);
            say("Faceoff!", 1.4);
        }

        function newGame() {
            score = [0, 0];
            clock = GAME_SECONDS;
            overtime = false;
            lastScorer = null;
            confetti.length = 0;
            resetPositions(true);
            updateHud();
            hideScreen();
            startFaceoff();
        }

        /* ---------- Screens ---------- */
        function showScreen(title, text, buttonLabel, onClick) {
            screenEl.innerHTML = "";
            const h = document.createElement("h2");
            h.textContent = title;
            screenEl.appendChild(h);
            if (text) {
                const p = document.createElement("p");
                p.innerHTML = text;
                screenEl.appendChild(p);
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "xh-btn";
            btn.textContent = buttonLabel;
            btn.addEventListener("click", () => {
                ensureAudio();
                onClick();
            });
            screenEl.appendChild(btn);
            screenEl.hidden = false;
            btn.focus({preventScroll: true});
        }

        function hideScreen() {
            screenEl.hidden = true;
            canvas.focus({preventScroll: true});
        }

        function showTitle() {
            state = "title";
            resetPositions(true);
            showScreen(
                "Santa Clauses vs Humbugs",
                "The Humbugs think Christmas is overrated &mdash; show them some holiday spirit on the ice! " +
                "You control the Santa with the yellow ring. " +
                "Our head referee, the red panda, drops the puck. 3 minutes, sudden death if tied.",
                "Play",
                newGame,
            );
        }

        function pause() {
            if (state === "paused" || state === "title" || state === "over") return;
            pausedFrom = state;
            state = "paused";
            charging = false;
            showScreen("Paused", "Take a sip of hot cocoa &#9749;", "Resume", resume);
        }

        function resume() {
            if (state !== "paused") return;
            state = pausedFrom;
            hideScreen();
        }

        function endGame() {
            state = "over";
            const [s, g] = score;
            let title, text;
            if (s > g) {
                title = "Christmas is saved! \u{1F384}";
                text = `The Santa Clauses win ${s}&ndash;${g}. The red panda approves.`;
                burstConfetti(W / 2, H / 2, 160);
            } else {
                title = "Bah, humbug! The Humbugs win";
                text = `They beat the Santa Clauses ${g}&ndash;${s}. Lace up your skates and try again before the 25th!`;
            }
            showScreen(title, text, "Play again", newGame);
        }

        /* ---------- Open / close ---------- */
        function open() {
            if (isOpen) return;
            isOpen = true;
            overlay.hidden = false;
            document.documentElement.style.overflow = "hidden";
            overlay.classList.toggle("is-touch", window.matchMedia("(pointer: coarse)").matches);
            resizeCanvas();
            if (state === "title") showTitle();
            else if (state !== "over") pause();
            closeBtn.focus({preventScroll: true});
            window.addEventListener("keydown", onKeyDown, true);
            window.addEventListener("keyup", onKeyUp, true);
            window.addEventListener("resize", resizeCanvas);
            window.addEventListener("blur", pause);
            lastTime = performance.now();
            rafId = requestAnimationFrame(frame);
        }

        function close() {
            if (!isOpen) return;
            pause();
            isOpen = false;
            overlay.hidden = true;
            document.documentElement.style.overflow = "";
            keys.clear();
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("keyup", onKeyUp, true);
            window.removeEventListener("resize", resizeCanvas);
            window.removeEventListener("blur", pause);
            cancelAnimationFrame(rafId);
            trigger.focus();
        }

        closeBtn.addEventListener("click", close);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });
        canvas.tabIndex = 0;

        // Called every frame: cheap, and also catches the lazily loaded stylesheet
        function resizeCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.round(Math.max(canvas.clientWidth, 320) * dpr);
            if (Math.abs(width - canvas.width) > 1) {
                canvas.width = width;
                canvas.height = Math.round(width * (H + 2 * M) / (W + 2 * M));
            }
        }

        /* ---------- Input ---------- */
        const KEY_DIRS = {
            ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
            ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
        };

        function onKeyDown(e) {
            if (e.code === "Escape") {
                e.preventDefault();
                close();
                return;
            }
            // Let buttons on the overlay screens work with Enter/Space
            if (!screenEl.hidden && (e.code === "Enter" || e.code === "Space")) return;
            if (e.code === "Tab") {
                trapFocus(e);
                return;
            }
            if (KEY_DIRS[e.code] || e.code === "Space") e.preventDefault();
            if (e.repeat) return;
            keys.add(e.code);
            ensureAudio();
            if (e.code === "Space") actionShootDown();
            else if (e.code === "KeyE" || e.code === "KeyX") actionPass();
            else if (e.code === "KeyQ") actionSwitch();
            else if (e.code === "KeyP") state === "paused" ? resume() : pause();
            else if (e.code === "KeyM") muted = !muted;
        }

        function onKeyUp(e) {
            keys.delete(e.code);
            if (e.code === "Space") actionShootUp();
        }

        function trapFocus(e) {
            const focusables = [...overlay.querySelectorAll("button, canvas")].filter(el => el.offsetParent !== null);
            if (!focusables.length) return;
            const first = focusables[0], last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        function inputVector() {
            let x = 0, y = 0;
            for (const code of keys) {
                const d = KEY_DIRS[code];
                if (d) {
                    x += d[0];
                    y += d[1];
                }
            }
            if (touchStick.active) {
                x += touchStick.dx;
                y += touchStick.dy;
            }
            const len = Math.hypot(x, y);
            return len > 0.15 ? {x: x / Math.max(len, 1), y: y / Math.max(len, 1)} : {x: 0, y: 0};
        }

        function actionShootDown() {
            if (state !== "play" || !controlled) return;
            if (puck.owner === controlled) {
                charging = true;
                charge = 0;
            } else {
                pokeCheck(controlled);
            }
        }

        function actionShootUp() {
            if (!charging) return;
            charging = false;
            if (state === "play" && puck.owner === controlled) {
                shoot(controlled, 0.25 + charge * 0.75, true);
            }
        }

        function actionPass() {
            if (state === "play" && controlled && puck.owner === controlled) {
                const target = pickPassTarget(controlled, true);
                if (target) pass(controlled, target);
            }
        }

        function actionSwitch() {
            if (state !== "play" && state !== "faceoff") return;
            const candidates = skaters.filter(s => s.team === SANTA && !s.goalie && s !== controlled);
            candidates.sort((a, b) => dist(a, puck) - dist(b, puck));
            if (candidates[0]) controlled = candidates[0];
        }

        // Touch: drag anywhere on the rink to skate, buttons below for actions
        canvas.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "mouse") return;
            touchStick.active = true;
            touchStick.id = e.pointerId;
            touchStick.ox = e.clientX;
            touchStick.oy = e.clientY;
            touchStick.dx = touchStick.dy = 0;
            canvas.setPointerCapture(e.pointerId);
            ensureAudio();
        });
        canvas.addEventListener("pointermove", (e) => {
            if (!touchStick.active || e.pointerId !== touchStick.id) return;
            const dx = e.clientX - touchStick.ox, dy = e.clientY - touchStick.oy;
            const len = Math.hypot(dx, dy), max = 40;
            touchStick.dx = len > 0 ? (dx / len) * Math.min(len / max, 1) : 0;
            touchStick.dy = len > 0 ? (dy / len) * Math.min(len / max, 1) : 0;
        });
        const endTouch = (e) => {
            if (e.pointerId === touchStick.id) {
                touchStick.active = false;
                touchStick.dx = touchStick.dy = 0;
            }
        };
        canvas.addEventListener("pointerup", endTouch);
        canvas.addEventListener("pointercancel", endTouch);

        overlay.querySelectorAll("[data-touch]").forEach((btn) => {
            const action = btn.dataset.touch;
            btn.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                ensureAudio();
                if (action === "shoot") actionShootDown();
                if (action === "pass") actionPass();
                if (action === "switch") actionSwitch();
            });
            if (action === "shoot") {
                btn.addEventListener("pointerup", actionShootUp);
                btn.addEventListener("pointerleave", actionShootUp);
            }
        });

        /* ---------- Audio (tiny WebAudio synth, no files) ---------- */
        function ensureAudio() {
            if (audio || !(window.AudioContext || window.webkitAudioContext)) return;
            try {
                audio = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                audio = null;
            }
        }

        function tone(freq, duration, type, volume, slideTo) {
            if (!audio || muted) return;
            const t = audio.currentTime;
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            osc.connect(gain).connect(audio.destination);
            osc.start(t);
            osc.stop(t + duration);
        }

        const sfx = {
            whistle: () => {
                tone(2900, 0.12, "sine", 0.12);
                setTimeout(() => tone(3100, 0.35, "sine", 0.12), 120);
            },
            shot: () => tone(180, 0.08, "square", 0.08, 60),
            pass: () => tone(320, 0.05, "triangle", 0.06, 200),
            board: () => tone(110, 0.1, "triangle", 0.06),
            horn: () => {
                tone(196, 1.1, "sawtooth", 0.07);
                tone(247, 1.1, "sawtooth", 0.05);
            },
            jingle: () => [659, 659, 659, 0, 659, 659, 659, 0, 659, 784, 523, 587, 659].forEach((f, i) => {
                if (f) setTimeout(() => tone(f, 0.18, "triangle", 0.07), i * 150);
            }),
        };

        /* ---------- Referee ---------- */
        function say(text, seconds) {
            referee.bubble = text;
            referee.bubbleT = seconds;
        }

        function updateReferee(dt) {
            let tx, ty;
            if (state === "faceoff") {
                tx = W / 2;
                ty = H / 2 - 40;
            } else if (state === "goal" && lastScorer !== null) {
                const gx = goalX(1 - lastScorer);
                tx = gx + attackDir(1 - lastScorer) * 80;
                ty = H / 2 - 110;
            } else {
                // Follow the play along the top boards, step aside if the puck comes close
                tx = clamp(puck.x, CORNER, W - CORNER);
                ty = puck.y < 110 ? H - 26 : 26;
            }
            const dx = tx - referee.x, dy = ty - referee.y;
            const d = Math.hypot(dx, dy);
            const speed = d > 4 ? Math.min(220, d * 3) : 0;
            const desiredVx = d > 0 ? (dx / d) * speed : 0;
            const desiredVy = d > 0 ? (dy / d) * speed : 0;
            referee.vx = lerp(referee.vx, desiredVx, Math.min(1, dt * 4));
            referee.vy = lerp(referee.vy, desiredVy, Math.min(1, dt * 4));
            referee.x += referee.vx * dt;
            referee.y += referee.vy * dt;
            referee.arm = lerp(referee.arm, state === "goal" ? 1 : 0, Math.min(1, dt * 6));
            if (referee.bubbleT > 0) referee.bubbleT -= dt;
        }

        /* ---------- Puck actions ---------- */
        function stickPoint(s) {
            const reach = s.goalie ? 20 : 22;
            return {x: s.x + Math.cos(s.a) * reach, y: s.y + Math.sin(s.a) * reach};
        }

        function releasePuck(s, angle, speed) {
            const p = stickPoint(s);
            puck.owner = null;
            puck.x = p.x;
            puck.y = p.y;
            puck.vx = Math.cos(angle) * speed + s.vx * 0.3;
            puck.vy = Math.sin(angle) * speed + s.vy * 0.3;
            puck.ignore = s;
            puck.ignoreTimer = 0.25;
            puck.beat = null;
            s.cooldown = 0.35;
        }

        function shoot(s, power, human) {
            const d = attackDir(s.team);
            const gx = goalX(1 - s.team);
            const speed = 420 + power * 560;
            if (human) {
                // Aim at the net whenever a shot there is physically possible: the stick blade is
                // in front of the goal line, the shooter is not facing away from the net and the
                // angle is not so sharp that the puck would clip the near post. The target is on
                // the goal line, where checkGoal counts the puck.
                const toNet = Math.atan2(H / 2 - s.y, gx - s.x);
                const diff = Math.atan2(Math.sin(toNet - s.a), Math.cos(toNet - s.a));
                const slope = Math.abs(H / 2 - s.y) / Math.max(1, Math.abs(gx - s.x));
                const near = PUCK_R + 2 + PUCK_R * slope;   // the puck's edge reaches the near post first
                const far = PUCK_R + 2;
                const lo = s.y > H / 2 ? -NET_MOUTH / 2 + far : -NET_MOUTH / 2 + near;
                const hi = s.y > H / 2 ? NET_MOUTH / 2 - near : NET_MOUTH / 2 - far;
                if ((gx - s.x) * d > 24 && Math.abs(diff) < 1.75 && lo < hi) {
                    const ty = H / 2 + rand(lo, hi);
                    s.a = Math.atan2(ty - s.y, gx - s.x);
                    releasePuckAt(s, gx, ty, speed);
                } else {
                    releasePuck(s, s.a, speed);
                }
            } else {
                const targetY = H / 2 + rand(-NET_MOUTH / 2 - 14, NET_MOUTH / 2 + 14);
                const toGoal = Math.atan2(targetY - s.y, gx + d * 8 - s.x);
                releasePuck(s, toGoal + rand(-0.08, 0.08), speed);
            }
            sfx.shot();
        }

        // Release the puck so that it travels exactly towards (tx, ty), compensating for the
        // share of the skater's own velocity that releasePuck adds
        function releasePuckAt(s, tx, ty, speed) {
            const p = stickPoint(s);
            const len = Math.hypot(tx - p.x, ty - p.y) || 1;
            const ux = (tx - p.x) / len, uy = (ty - p.y) / len;
            const wx = s.vx * 0.3, wy = s.vy * 0.3;
            // Solve |k*u - w| = speed for the puck's final speed k along u
            const uw = ux * wx + uy * wy;
            const k = uw + Math.sqrt(Math.max(0, uw * uw - (wx * wx + wy * wy) + speed * speed));
            releasePuck(s, Math.atan2(k * uy - wy, k * ux - wx), speed);
        }

        function pickPassTarget(s, human) {
            const mates = skaters.filter(m => m.team === s.team && m !== s && !m.goalie);
            let best = null, bestScore = -Infinity;
            for (const m of mates) {
                const ang = Math.atan2(m.y - s.y, m.x - s.x);
                const facing = Math.cos(ang - s.a);
                const openness = Math.min(...skaters.filter(o => o.team !== s.team).map(o => dist(o, m)));
                const forward = (m.x - s.x) * attackDir(s.team);
                const sc = human
                    ? facing * 3 + openness / 120 - dist(s, m) / 600
                    : openness / 60 + forward / 150 - dist(s, m) / 500;
                if (sc > bestScore) {
                    bestScore = sc;
                    best = m;
                }
            }
            return best;
        }

        function pass(s, target) {
            const lead = 0.35;
            const tx = target.x + target.vx * lead, ty = target.y + target.vy * lead;
            const d = Math.hypot(tx - s.x, ty - s.y);
            s.a = Math.atan2(ty - s.y, tx - s.x);
            releasePuck(s, s.a, clamp(d * 1.4 + 180, 320, 720));
            sfx.pass();
        }

        function pokeCheck(s) {
            const carrier = puck.owner;
            const p = stickPoint(s);
            if (carrier && carrier.team !== s.team && Math.hypot(p.x - puck.x, p.y - puck.y) < 30) {
                if (Math.random() < (carrier.goalie ? 0.25 : 0.65)) takePuck(s, carrier);
            } else if (!carrier && Math.hypot(p.x - puck.x, p.y - puck.y) < 34) {
                takePuck(s, null);
            }
            s.cooldown = Math.max(s.cooldown, 0.2);
        }

        function takePuck(s, from) {
            puck.owner = s;
            puck.lastTouch = s.team;
            puck.beat = null;
            s.holdT = 0;
            if (from) {
                from.cooldown = 0.6;
                from.vx *= 0.5;
                from.vy *= 0.5;
            }
            if (s.team === SANTA && !s.goalie) {
                controlled = s;
            } else if (s.team === HUMBUG && controlled) {
                // Auto-switch to the Santa closest to the puck when defending
                const closest = skaters
                    .filter(m => m.team === SANTA && !m.goalie)
                    .sort((a, b) => dist(a, s) - dist(b, s))[0];
                if (closest) controlled = closest;
            }
            if (s.team !== SANTA || s !== controlled) charging = false;
        }

        /* ---------- AI ---------- */
        function aiTarget(s, dt) {
            const d = attackDir(s.team);
            const own = goalX(s.team), opp = goalX(1 - s.team);
            const carrier = puck.owner;

            if (s.goalie) {
                if (carrier === s) {
                    s.holdT += dt;
                    if (s.holdT > 0.8) {
                        const t = pickPassTarget(s, false);
                        if (t) pass(s, t);
                    }
                }
                const py = clamp(puck.y, H / 2 - NET_MOUTH / 2 + 6, H / 2 + NET_MOUTH / 2 - 6);
                return {x: own + d * 20, y: lerp(H / 2, py, 0.9), speed: 170};
            }

            const teamHasPuck = carrier && carrier.team === s.team;
            const mates = skaters.filter(m => m.team === s.team && !m.goalie);
            const chaser = mates
                .filter(m => !(m.team === SANTA && m === controlled))
                .sort((a, b) => dist(a, puck) - dist(b, puck))[0];

            if (carrier === s) {
                // Skate toward the net, dodge the closest defender, shoot or pass
                const opponents = skaters.filter(o => o.team !== s.team);
                const nearest = opponents.sort((a, b) => dist(a, s) - dist(b, s))[0];
                let tx = opp - d * 90, ty = H / 2 + Math.sin(elapsed * 1.3 + s.role) * 60;
                if (nearest && dist(nearest, s) < 90) {
                    const side = (s.y - nearest.y) >= 0 ? 1 : -1;
                    ty = s.y + side * 90;
                }
                const toGoal = Math.hypot(opp - s.x, H / 2 - s.y);
                const aheadOfNet = (opp - s.x) * d > 20;
                s.decideT -= dt;
                if (s.decideT <= 0) {
                    s.decideT = rand(0.25, 0.5);
                    if (aheadOfNet && toGoal < 170) {
                        shoot(s, rand(0.6, 1), false);
                    } else if (aheadOfNet && toGoal < 320 && Math.random() < 0.35) {
                        shoot(s, rand(0.5, 1), false);
                    } else if (nearest && dist(nearest, s) < 55 && Math.random() < 0.5) {
                        const t = pickPassTarget(s, false);
                        if (t) pass(s, t);
                    }
                }
                return {x: tx, y: clamp(ty, 40, H - 40), speed: s.team === SANTA ? 190 : 185};
            }

            if (teamHasPuck) {
                // Support the carrier: get open ahead and to the side
                const side = s.role === 1 ? -1 : s.role === 2 ? 1 : (carrier.y > H / 2 ? -1 : 1);
                return {
                    x: clamp(carrier.x + d * 130, GOAL_LINE + 60, W - GOAL_LINE - 60),
                    y: H / 2 + side * 130,
                    speed: 200,
                };
            }

            if (s === chaser) {
                const target = carrier ? stickPoint(carrier) : {x: puck.x + puck.vx * 0.15, y: puck.y + puck.vy * 0.15};
                if (carrier && dist(s, carrier) < SKATER_R * 2 + 10) {
                    s.stealT -= dt;
                    if (s.stealT <= 0) {
                        s.stealT = 0.35;
                        pokeCheck(s);
                    }
                }
                return {x: target.x, y: target.y, speed: s.team === HUMBUG ? 215 : 205};
            }

            // Defend: sit between the puck and our own net
            const side = s.role === 1 ? -1 : 1;
            return {
                x: lerp(own, puck.x, 0.45),
                y: lerp(H / 2, puck.y, 0.5) + side * 55,
                speed: 190,
            };
        }

        /* ---------- Physics ---------- */
        function reflect(o, nx, ny, bounce) {
            const vn = o.vx * nx + o.vy * ny;
            if (vn > 0) {
                o.vx -= (1 + bounce) * vn * nx;
                o.vy -= (1 + bounce) * vn * ny;
                return vn;
            }
            return 0;
        }

        // Keep a circle inside the rounded rink; returns the impact speed
        function collideBoards(o, r, bounce) {
            let cx = null, cy = null;
            if (o.x < CORNER) cx = CORNER; else if (o.x > W - CORNER) cx = W - CORNER;
            if (o.y < CORNER) cy = CORNER; else if (o.y > H - CORNER) cy = H - CORNER;
            if (cx !== null && cy !== null) {
                const dx = o.x - cx, dy = o.y - cy;
                const d = Math.hypot(dx, dy), max = CORNER - r;
                if (d > max) {
                    const nx = dx / d, ny = dy / d;
                    o.x = cx + nx * max;
                    o.y = cy + ny * max;
                    return reflect(o, nx, ny, bounce);
                }
                return 0;
            }
            let impact = 0;
            if (o.x < r) { o.x = r; impact = reflect(o, -1, 0, bounce); }
            if (o.x > W - r) { o.x = W - r; impact = reflect(o, 1, 0, bounce); }
            if (o.y < r) { o.y = r; impact = reflect(o, 0, -1, bounce); }
            if (o.y > H - r) { o.y = H - r; impact = reflect(o, 0, 1, bounce); }
            return impact;
        }

        // Nets are solid on the back and sides; the front is open for the puck only
        function collideNet(o, r, team, openFront, bounce) {
            const gl = goalX(team);
            const x0 = team === SANTA ? gl - NET_DEPTH : gl;
            const x1 = team === SANTA ? gl : gl + NET_DEPTH;
            const y0 = H / 2 - NET_MOUTH / 2, y1 = H / 2 + NET_MOUTH / 2;
            if (o.x < x0 - r || o.x > x1 + r || o.y < y0 - r || o.y > y1 + r) return;
            const options = [
                [o.y - (y0 - r), 0, -1],      // push up
                [(y1 + r) - o.y, 0, 1],       // push down
            ];
            const backLeft = [o.x - (x0 - r), -1, 0];
            const backRight = [(x1 + r) - o.x, 1, 0];
            if (team === SANTA) {
                options.push(backLeft);
                if (!openFront) options.push(backRight);
            } else {
                options.push(backRight);
                if (!openFront) options.push(backLeft);
            }
            // Puck between the posts and in front of the back wall: it is entering through the
            // open front (or already inside after a goal), so let it in instead of pushing it
            // out through the back of the net
            const beforeBack = team === SANTA ? o.x > x0 : o.x < x1;
            if (openFront && o.y > y0 && o.y < y1 && beforeBack) return;
            options.sort((a, b) => a[0] - b[0]);
            const [pen, nx, ny] = options[0];
            o.x += nx * pen;
            o.y += ny * pen;
            reflect(o, nx, ny, bounce);
        }

        function moveSkater(s, tx, ty, maxSpeed, dt, isInput) {
            let dvx = 0, dvy = 0, accel;
            if (isInput) {
                dvx = tx * maxSpeed;
                dvy = ty * maxSpeed;
                accel = (tx || ty) ? 5 : 1.6;
            } else {
                const dx = tx - s.x, dy = ty - s.y;
                const d = Math.hypot(dx, dy);
                if (d > 3) {
                    const sp = Math.min(maxSpeed, d * 4);
                    dvx = (dx / d) * sp;
                    dvy = (dy / d) * sp;
                }
                accel = 4;
            }
            if (puck.owner === s) {
                dvx *= 0.9;
                dvy *= 0.9;
            }
            const k = Math.min(1, accel * dt);
            s.vx = lerp(s.vx, dvx, k);
            s.vy = lerp(s.vy, dvy, k);
            s.x += s.vx * dt;
            s.y += s.vy * dt;

            // Facing: follow movement, AI defenders look at the puck
            let wanted = null;
            if (isInput && (tx || ty)) wanted = Math.atan2(ty, tx);
            else if (!isInput && Math.hypot(s.vx, s.vy) > 40) wanted = Math.atan2(s.vy, s.vx);
            if (!isInput && puck.owner !== s && dist(s, puck) < 200) wanted = Math.atan2(puck.y - s.y, puck.x - s.x);
            if (s.goalie) wanted = s.team === SANTA ? 0 : Math.PI;
            if (wanted !== null) {
                const diff = Math.atan2(Math.sin(wanted - s.a), Math.cos(wanted - s.a));
                s.a += diff * Math.min(1, dt * (isInput ? 14 : 8));
            }

            collideBoards(s, SKATER_R, 0.2);
            collideNet(s, SKATER_R, SANTA, false, 0.2);
            collideNet(s, SKATER_R, HUMBUG, false, 0.2);
        }

        function separateSkaters() {
            for (let i = 0; i < skaters.length; i++) {
                for (let j = i + 1; j < skaters.length; j++) {
                    const a = skaters[i], b = skaters[j];
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const d = Math.hypot(dx, dy) || 0.01, min = SKATER_R * 2;
                    if (d < min) {
                        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
                        const wa = a.goalie ? 0.2 : 1, wb = b.goalie ? 0.2 : 1;
                        a.x -= nx * push * wa;
                        a.y -= ny * push * wa;
                        b.x += nx * push * wb;
                        b.y += ny * push * wb;
                    }
                }
            }
        }

        function updatePuck(dt) {
            if (puck.ignoreTimer > 0) {
                puck.ignoreTimer -= dt;
                if (puck.ignoreTimer <= 0) puck.ignore = null;
            }

            if (puck.owner) {
                const s = puck.owner;
                const p = stickPoint(s);
                const prevX = puck.x;
                puck.x = p.x;
                puck.y = p.y;
                puck.vx = s.vx;
                puck.vy = s.vy;
                collideBoards(puck, PUCK_R, 0);
                checkGoal(prevX);
                return;
            }

            if (state === "goal" && puck.inNet !== null) {
                keepInNet(dt);
                return;
            }

            const steps = 3;
            const h = dt / steps;
            for (let i = 0; i < steps; i++) {
                const prevX = puck.x;
                puck.x += puck.vx * h;
                puck.y += puck.vy * h;
                if (state === "play" && checkGoal(prevX)) return;
                const impact = collideBoards(puck, PUCK_R, 0.75);
                if (impact > 200) sfx.board();
                collideNet(puck, PUCK_R, SANTA, true, 0.5);
                collideNet(puck, PUCK_R, HUMBUG, true, 0.5);
            }
            const friction = Math.pow(0.6, dt);
            puck.vx *= friction;
            puck.vy *= friction;

            if (state !== "play") return;

            // Pick-ups, saves and blocks
            const speed = Math.hypot(puck.vx, puck.vy);
            for (const s of skaters) {
                if (s === puck.ignore || s.cooldown > 0) continue;
                const p = stickPoint(s);
                const reach = SKATER_R + PUCK_R + (s.goalie ? GOALIE_REACH : 3);
                const near = Math.hypot(p.x - puck.x, p.y - puck.y) < 18 || dist(s, puck) < reach;
                if (!near) continue;
                if (s.goalie) {
                    // A puck that hits the goalie's body is always stopped; one that only reaches
                    // the stick, pads or glove can slip past, the more often the faster it is
                    const body = dist(s, puck) < SKATER_R + PUCK_R + 3;
                    if (!body && puck.beat === s) break;
                    const saveChance = clamp(1.6 - speed / 850, 0.2, 0.98);
                    if (body || Math.random() < saveChance) {
                        if (speed > 650) {
                            // Rebound
                            const d = attackDir(s.team);
                            puck.vx = Math.abs(puck.vx) * d * 0.45;
                            puck.vy = rand(-1, 1) * speed * 0.4;
                            puck.ignore = s;
                            puck.ignoreTimer = 0.3;
                        } else {
                            takePuck(s, null);
                        }
                    } else {
                        // Slipped past the stick: no second try with it, but the body still counts
                        puck.beat = s;
                    }
                    break;
                }
                if (speed < 620 || Math.random() < 0.35) {
                    takePuck(s, null);
                } else {
                    puck.ignore = s;
                    puck.ignoreTimer = 0.3;
                    puck.vx *= -0.3;
                    puck.vy *= 0.6;
                }
                break;
            }
        }

        function keepInNet(dt) {
            const gl = goalX(puck.inNet);
            const x0 = (puck.inNet === SANTA ? gl - NET_DEPTH : gl) + PUCK_R;
            const x1 = (puck.inNet === SANTA ? gl : gl + NET_DEPTH) - PUCK_R;
            const y0 = H / 2 - NET_MOUTH / 2 + PUCK_R, y1 = H / 2 + NET_MOUTH / 2 - PUCK_R;
            puck.x += puck.vx * dt;
            puck.y += puck.vy * dt;
            if (puck.x < x0 || puck.x > x1) { puck.x = clamp(puck.x, x0, x1); puck.vx *= -0.4; }
            if (puck.y < y0 || puck.y > y1) { puck.y = clamp(puck.y, y0, y1); puck.vy *= -0.4; }
            puck.vx *= Math.pow(0.2, dt);
            puck.vy *= Math.pow(0.2, dt);
        }

        function checkGoal(prevX) {
            const inMouth = puck.y > H / 2 - NET_MOUTH / 2 && puck.y < H / 2 + NET_MOUTH / 2;
            if (!inMouth || state !== "play") return false;
            if (prevX >= goalX(SANTA) && puck.x < goalX(SANTA)) {
                goalScored(HUMBUG);
                return true;
            }
            if (prevX <= goalX(HUMBUG) && puck.x > goalX(HUMBUG)) {
                goalScored(SANTA);
                return true;
            }
            return false;
        }

        function goalScored(team) {
            score[team]++;
            lastScorer = team;
            puck.inNet = 1 - team;
            state = "goal";
            stateTimer = 0;
            charging = false;
            puck.owner = null;
            puck.vx *= 0.15;
            puck.vy *= 0.15;
            updateHud();
            sfx.horn();
            if (team === SANTA) {
                setTimeout(sfx.jingle, 600);
                burstConfetti(goalX(HUMBUG), H / 2, 90);
                banner = {text: "HO HO HO! GOAL!", t: 2.4, color: COLORS.red};
            } else {
                banner = {text: "Humbug goal… bah!", t: 2.4, color: COLORS.humbug};
            }
            say("GOAL!", 2);
        }

        function burstConfetti(x, y, n) {
            const palette = ["#da1e28", "#24a148", "#f1c21b", "#ffffff", "#4589ff"];
            for (let i = 0; i < n; i++) {
                const a = rand(0, Math.PI * 2), sp = rand(80, 380);
                confetti.push({
                    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    life: rand(1.2, 2.4), c: palette[i % palette.length], r: rand(2, 4),
                });
            }
        }

        /* ---------- Main update ---------- */
        function update(dt) {
            elapsed += dt;

            for (const f of flakes) {
                f.y += f.s * dt;
                f.x += Math.sin(elapsed + f.w) * 8 * dt;
                if (f.y > H + 2 * M) {
                    f.y = -5;
                    f.x = rand(0, W + 2 * M);
                }
            }
            for (let i = confetti.length - 1; i >= 0; i--) {
                const c = confetti[i];
                c.x += c.vx * dt;
                c.y += c.vy * dt;
                c.vx *= Math.pow(0.3, dt);
                c.vy *= Math.pow(0.3, dt);
                c.life -= dt;
                if (c.life <= 0) confetti.splice(i, 1);
            }
            if (banner && (banner.t -= dt) <= 0) banner = null;

            if (state === "paused" || state === "title" || state === "over") return;

            stateTimer += dt;
            updateReferee(dt);

            if (state === "faceoff") {
                for (const s of skaters) {
                    const spot = faceoffSpot(s);
                    moveSkater(s, spot.x, spot.y, 260, dt, false);
                    s.a = s.team === SANTA ? 0 : Math.PI;
                }
                separateSkaters();
                const ready = skaters.every(s => dist(s, faceoffSpot(s)) < 12) && dist(referee, {x: W / 2, y: H / 2 - 40}) < 10;
                if ((ready && stateTimer > 1.2) || stateTimer > 3.5) {
                    puck.x = W / 2;
                    puck.y = H / 2;
                    puck.vx = rand(-30, 30);
                    puck.vy = rand(-30, 30);
                    state = "play";
                    sfx.whistle();
                    say("*tweeet!*", 0.9);
                }
                return;
            }

            if (state === "goal") {
                for (const s of skaters) {
                    if (s.team === lastScorer && !s.goalie) {
                        // Celebration lap around center ice
                        const ang = elapsed * 2 + s.role * 2.1;
                        moveSkater(s, W / 2 + Math.cos(ang) * 140 * attackDir(lastScorer),
                            H / 2 + Math.sin(ang) * 110, 200, dt, false);
                    } else {
                        moveSkater(s, s.x, s.y, 0, dt, false);
                    }
                }
                separateSkaters();
                updatePuck(dt);
                if (stateTimer > 2.8) {
                    if (overtime) endGame();
                    else startFaceoff();
                }
                return;
            }

            // state === "play"
            clock -= dt;
            if (clock <= 0) {
                clock = 0;
                updateHud();
                if (score[0] === score[1]) {
                    if (!overtime) {
                        overtime = true;
                        banner = {text: "Sudden death overtime!", t: 2.2, color: "#f1c21b"};
                        sfx.whistle();
                    }
                } else {
                    sfx.whistle();
                    say("Game over!", 3);
                    endGame();
                    return;
                }
            }

            if (charging) charge = Math.min(1, charge + dt * 1.3);
            if (charging && puck.owner !== controlled) charging = false;
            // A fully charged shot goes off by itself; releasing the key afterwards does nothing
            if (charging && charge >= 1) actionShootUp();

            for (const s of skaters) {
                if (s.cooldown > 0) s.cooldown -= dt;
                if (s === controlled) {
                    const v = inputVector();
                    moveSkater(s, v.x, v.y, 235, dt, true);
                } else {
                    const t = aiTarget(s, dt);
                    moveSkater(s, t.x, t.y, t.speed, dt, false);
                }
            }
            separateSkaters();
            updatePuck(dt);
            updateHud();
        }

        let hudCache = "";

        function updateHud() {
            const secs = Math.ceil(clock);
            const text = overtime ? "OT" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
            const key = text + score.join("-");
            if (key === hudCache) return;
            hudCache = key;
            clockEl.textContent = text;
            scoreEls[0].textContent = score[0];
            scoreEls[1].textContent = score[1];
        }

        /* ---------- Drawing ---------- */
        function roundedRink(c, inset) {
            const r = CORNER - inset;
            c.beginPath();
            c.moveTo(inset + r, inset);
            c.lineTo(W - inset - r, inset);
            c.arc(W - inset - r, inset + r, r, -Math.PI / 2, 0);
            c.lineTo(W - inset, H - inset - r);
            c.arc(W - inset - r, H - inset - r, r, 0, Math.PI / 2);
            c.lineTo(inset + r, H - inset);
            c.arc(inset + r, H - inset - r, r, Math.PI / 2, Math.PI);
            c.lineTo(inset, inset + r);
            c.arc(inset + r, inset + r, r, Math.PI, Math.PI * 1.5);
            c.closePath();
        }

        // Sponsors centred in the faceoff circles, crosswise: the NetEye eye top-left and
        // bottom-right (the faceoff dot lands on its red dot), Würth IT in the other two
        function drawSponsors(c) {
            const eye = sponsors.neteye, wuerth = sponsors.wuerth;
            c.save();
            c.globalAlpha = 0.3;
            for (const [fx, fy, logo] of [
                [GOAL_LINE + 110, H / 2 - 120, eye], [W - GOAL_LINE - 110, H / 2 + 120, eye],
                [W - GOAL_LINE - 110, H / 2 - 120, wuerth], [GOAL_LINE + 110, H / 2 + 120, wuerth],
            ]) {
                if (!logo) continue;
                const w = logo === eye ? 64 : 104, h = w * logo.height / logo.width;
                // The Würth PNG has a white background: multiply lets it vanish into the ice.
                // It sits just below the faceoff dot so the dot does not cover its letters.
                c.globalCompositeOperation = logo === wuerth ? "multiply" : "source-over";
                const dy = logo === wuerth ? 14 : 0;
                c.drawImage(logo, fx - w / 2, fy + dy - h / 2, w, h);
            }
            c.restore();
        }

        function drawRink(c) {
            // Background outside the rink: dark night with a garland glow
            c.fillStyle = "#0b1a2e";
            c.fillRect(-M, -M, W + 2 * M, H + 2 * M);

            c.save();
            roundedRink(c, 0);
            c.fillStyle = COLORS.ice;
            c.fill();
            c.clip();

            // Sponsors frozen under the ice: drawn faded and before the scratches and lines
            drawSponsors(c);

            // Ice scratches
            c.strokeStyle = COLORS.iceLine;
            c.lineWidth = 1;
            for (let i = 0; i < 14; i++) {
                c.beginPath();
                const y = (i * 37) % H;
                c.moveTo(0, y);
                c.bezierCurveTo(W * 0.3, y + 20, W * 0.6, y - 20, W, y + 10);
                c.stroke();
            }

            // Lines
            c.fillStyle = COLORS.red;
            c.fillRect(W / 2 - 3, 0, 6, H);
            c.fillStyle = COLORS.blue;
            c.fillRect(W / 2 - 160 - 5, 0, 10, H);
            c.fillRect(W / 2 + 160 - 5, 0, 10, H);
            c.fillStyle = COLORS.red;
            c.fillRect(GOAL_LINE - 1.5, 0, 3, H);
            c.fillRect(W - GOAL_LINE - 1.5, 0, 3, H);

            // Center circle with a snowflake
            c.strokeStyle = COLORS.blue;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
            c.stroke();
            drawSnowflake(c, W / 2, H / 2, 34, "rgba(15, 98, 254, 0.35)");

            // Faceoff circles
            c.strokeStyle = COLORS.red;
            c.lineWidth = 2;
            for (const fx of [GOAL_LINE + 110, W - GOAL_LINE - 110]) {
                for (const fy of [H / 2 - 120, H / 2 + 120]) {
                    c.beginPath();
                    c.arc(fx, fy, 55, 0, Math.PI * 2);
                    c.stroke();
                    c.fillStyle = COLORS.red;
                    c.beginPath();
                    c.arc(fx, fy, 5, 0, Math.PI * 2);
                    c.fill();
                }
            }

            // Creases
            c.fillStyle = COLORS.crease;
            c.strokeStyle = COLORS.red;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(GOAL_LINE, H / 2, 48, -Math.PI / 2, Math.PI / 2);
            c.fill();
            c.stroke();
            c.beginPath();
            c.arc(W - GOAL_LINE, H / 2, 48, Math.PI / 2, Math.PI * 1.5);
            c.fill();
            c.stroke();

            c.restore();

            // Candy cane boards
            roundedRink(c, -4);
            c.lineWidth = 9;
            c.strokeStyle = "#ffffff";
            c.setLineDash([]);
            c.stroke();
            c.strokeStyle = COLORS.red;
            c.setLineDash([14, 14]);
            c.stroke();
            c.setLineDash([]);

            // Garland lights on the outside
            const bulbColors = ["#ff8389", "#6fdc8c", "#f1c21b", "#78a9ff"];
            for (let i = 0; i < 26; i++) {
                const x = CORNER + (i / 25) * (W - 2 * CORNER);
                const glow = 0.5 + 0.5 * Math.sin(elapsed * 3 + i);
                for (const y of [-14, H + 14]) {
                    c.fillStyle = bulbColors[i % 4];
                    c.globalAlpha = 0.45 + glow * 0.55;
                    c.beginPath();
                    c.arc(x, y, 3.5, 0, Math.PI * 2);
                    c.fill();
                }
            }
            c.globalAlpha = 1;
        }

        function drawSnowflake(c, x, y, r, color) {
            c.save();
            c.translate(x, y);
            c.strokeStyle = color;
            c.lineWidth = 3;
            c.lineCap = "round";
            for (let i = 0; i < 6; i++) {
                c.rotate(Math.PI / 3);
                c.beginPath();
                c.moveTo(0, 0);
                c.lineTo(0, -r);
                c.moveTo(0, -r * 0.6);
                c.lineTo(-r * 0.25, -r * 0.8);
                c.moveTo(0, -r * 0.6);
                c.lineTo(r * 0.25, -r * 0.8);
                c.stroke();
            }
            c.restore();
        }

        function drawNet(c, team) {
            const gl = goalX(team);
            const x0 = team === SANTA ? gl - NET_DEPTH : gl;
            const y0 = H / 2 - NET_MOUTH / 2;
            c.fillStyle = "rgba(255, 255, 255, 0.85)";
            c.fillRect(x0, y0, NET_DEPTH, NET_MOUTH);
            c.strokeStyle = "rgba(0, 0, 0, 0.18)";
            c.lineWidth = 1;
            for (let i = 6; i < NET_MOUTH; i += 6) {
                c.beginPath();
                c.moveTo(x0, y0 + i);
                c.lineTo(x0 + NET_DEPTH, y0 + i);
                c.stroke();
            }
            for (let i = 6; i < NET_DEPTH; i += 6) {
                c.beginPath();
                c.moveTo(x0 + i, y0);
                c.lineTo(x0 + i, y0 + NET_MOUTH);
                c.stroke();
            }
            c.strokeStyle = COLORS.red;
            c.lineWidth = 4;
            c.beginPath();
            if (team === SANTA) {
                c.moveTo(gl, y0);
                c.lineTo(x0, y0);
                c.lineTo(x0, y0 + NET_MOUTH);
                c.lineTo(gl, y0 + NET_MOUTH);
            } else {
                c.moveTo(gl, y0);
                c.lineTo(gl + NET_DEPTH, y0);
                c.lineTo(gl + NET_DEPTH, y0 + NET_MOUTH);
                c.lineTo(gl, y0 + NET_MOUTH);
            }
            c.stroke();
        }

        function drawShadow(c, x, y, r) {
            c.fillStyle = "rgba(0, 30, 60, 0.15)";
            c.beginPath();
            c.ellipse(x + 2, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
            c.fill();
        }

        function drawStick(c, s) {
            const p = stickPoint(s);
            const handX = s.x + Math.cos(s.a + 0.6) * 8, handY = s.y + Math.sin(s.a + 0.6) * 8;
            c.strokeStyle = COLORS.stick;
            c.lineWidth = 3;
            c.lineCap = "round";
            c.beginPath();
            c.moveTo(handX, handY);
            c.lineTo(p.x, p.y);
            c.stroke();
            c.strokeStyle = "#262626";
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.x + Math.cos(s.a + 1.4) * 7, p.y + Math.sin(s.a + 1.4) * 7);
            c.stroke();
        }

        function drawSanta(c, s) {
            const {x, y} = s;
            const r = s.goalie ? SKATER_R + 3 : SKATER_R;
            // body
            c.fillStyle = COLORS.santa;
            c.beginPath();
            c.arc(x, y + 3, r, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#fff";
            c.fillRect(x - r * 0.9, y + 7, r * 1.8, 3);
            c.fillStyle = "#262626";
            c.fillRect(x - r * 0.9, y + 11, r * 1.8, 3);
            // face
            c.fillStyle = COLORS.skin;
            c.beginPath();
            c.arc(x, y - 6, 9, 0, Math.PI * 2);
            c.fill();
            // beard
            c.fillStyle = "#fff";
            c.beginPath();
            c.arc(x, y - 3, 9, 0.1, Math.PI - 0.1);
            c.quadraticCurveTo(x, y + 14, x + 9, y - 2);
            c.fill();
            // eyes and nose
            c.fillStyle = "#262626";
            c.fillRect(x - 4, y - 9, 2, 2);
            c.fillRect(x + 2, y - 9, 2, 2);
            c.fillStyle = "#ff8389";
            c.beginPath();
            c.arc(x, y - 5, 1.8, 0, Math.PI * 2);
            c.fill();
            // hat (goalie gets a cage helmet)
            if (s.goalie) {
                c.strokeStyle = "#8d8d8d";
                c.lineWidth = 1.2;
                for (let i = -6; i <= 6; i += 4) {
                    c.beginPath();
                    c.moveTo(x + i, y - 13);
                    c.lineTo(x + i, y + 1);
                    c.stroke();
                }
                c.fillStyle = COLORS.santaDark;
                c.beginPath();
                c.arc(x, y - 9, 10, Math.PI, 0);
                c.fill();
            } else {
                c.fillStyle = "#fff";
                c.fillRect(x - 10, y - 15, 20, 4);
                c.fillStyle = COLORS.santa;
                c.beginPath();
                c.moveTo(x - 9, y - 15);
                c.quadraticCurveTo(x + 2, y - 30, x + 13, y - 24);
                c.lineTo(x + 9, y - 15);
                c.fill();
                c.fillStyle = "#fff";
                c.beginPath();
                c.arc(x + 13, y - 24, 3.5, 0, Math.PI * 2);
                c.fill();
            }
        }

        function drawHumbug(c, s) {
            const {x, y} = s;
            const r = s.goalie ? SKATER_R + 3 : SKATER_R;
            c.fillStyle = COLORS.humbugJersey;
            c.beginPath();
            c.arc(x, y + 3, r, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#f1c21b";
            c.fillRect(x - r * 0.9, y + 8, r * 1.8, 3);
            // furry head
            c.fillStyle = COLORS.humbugFace;
            c.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                const rr = i % 2 ? 9 : 10.5;
                const px = x + Math.cos(a) * rr, py = y - 6 + Math.sin(a) * rr;
                i ? c.lineTo(px, py) : c.moveTo(px, py);
            }
            c.closePath();
            c.fill();
            // grumpy brows, yellow eyes, sly grin
            c.fillStyle = "#f1c21b";
            c.beginPath();
            c.ellipse(x - 3.5, y - 7, 2.6, 1.8, 0, 0, Math.PI * 2);
            c.ellipse(x + 3.5, y - 7, 2.6, 1.8, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#b11e1e";
            c.fillRect(x - 4, y - 7.5, 1.5, 1.5);
            c.fillRect(x + 3, y - 7.5, 1.5, 1.5);
            c.strokeStyle = "#1c3d0a";
            c.lineWidth = 1.6;
            c.beginPath();
            c.moveTo(x - 7, y - 12);
            c.lineTo(x - 1.5, y - 9.5);
            c.moveTo(x + 7, y - 12);
            c.lineTo(x + 1.5, y - 9.5);
            c.moveTo(x - 5, y - 2);
            c.quadraticCurveTo(x, y + 0.5, x + 6, y - 4);
            c.stroke();
            if (s.goalie) {
                c.strokeStyle = "#c6c6c6";
                c.lineWidth = 1.2;
                c.beginPath();
                c.arc(x, y - 6, 11, Math.PI * 1.05, Math.PI * 1.95);
                c.stroke();
            }
        }

        function drawReferee(c) {
            const {x, y} = referee;
            const wag = Math.sin(elapsed * 6) * 0.35;
            drawShadow(c, x, y, 15);

            // Ringed tail behind the body
            for (let i = 0; i < 6; i++) {
                const t = i / 5;
                const ang = Math.PI * 0.75 + wag * t;
                const tx = x + Math.cos(ang) * (10 + t * 16) - t * 6;
                const ty = y + 8 + Math.sin(ang) * (6 + t * 8);
                c.fillStyle = i % 2 ? COLORS.pandaDark : COLORS.panda;
                c.beginPath();
                c.arc(tx, ty, 6 - t * 1.2, 0, Math.PI * 2);
                c.fill();
            }

            // Striped referee shirt
            c.save();
            c.beginPath();
            c.arc(x, y + 3, 14, 0, Math.PI * 2);
            c.clip();
            c.fillStyle = "#fff";
            c.fillRect(x - 15, y - 12, 30, 30);
            c.fillStyle = "#161616";
            for (let i = -14; i < 16; i += 6) c.fillRect(x + i, y - 12, 3, 30);
            c.restore();

            // Raised arm when signalling a goal
            if (referee.arm > 0.05) {
                c.strokeStyle = COLORS.pandaDark;
                c.lineWidth = 4;
                c.lineCap = "round";
                c.beginPath();
                c.moveTo(x + 10, y);
                c.lineTo(x + 14 + referee.arm * 4, y - 6 - referee.arm * 18);
                c.stroke();
            }

            // Head
            c.fillStyle = COLORS.panda;
            c.beginPath();
            c.ellipse(x, y - 8, 11, 9.5, 0, 0, Math.PI * 2);
            c.fill();
            // Ears
            for (const side of [-1, 1]) {
                c.fillStyle = COLORS.panda;
                c.beginPath();
                c.moveTo(x + side * 4, y - 15);
                c.lineTo(x + side * 11, y - 21);
                c.lineTo(x + side * 11, y - 11);
                c.fill();
                c.fillStyle = "#fff";
                c.beginPath();
                c.moveTo(x + side * 7, y - 15);
                c.lineTo(x + side * 10, y - 18);
                c.lineTo(x + side * 10, y - 13);
                c.fill();
            }
            // White face markings
            c.fillStyle = "#fff";
            c.beginPath();
            c.ellipse(x - 5, y - 12, 2.8, 1.8, -0.3, 0, Math.PI * 2);
            c.ellipse(x + 5, y - 12, 2.8, 1.8, 0.3, 0, Math.PI * 2);
            c.fill();
            c.beginPath();
            c.ellipse(x, y - 4, 6, 4, 0, 0, Math.PI * 2);
            c.fill();
            // Tear marks, eyes, nose
            c.fillStyle = COLORS.pandaDark;
            c.beginPath();
            c.ellipse(x - 4.5, y - 7, 2, 3, 0.4, 0, Math.PI * 2);
            c.ellipse(x + 4.5, y - 7, 2, 3, -0.4, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#161616";
            c.beginPath();
            c.arc(x - 4.5, y - 8, 1.4, 0, Math.PI * 2);
            c.arc(x + 4.5, y - 8, 1.4, 0, Math.PI * 2);
            c.fill();
            c.beginPath();
            c.ellipse(x, y - 5, 1.8, 1.2, 0, 0, Math.PI * 2);
            c.fill();
            // Whistle
            c.fillStyle = "#f1c21b";
            c.fillRect(x + 2, y - 2, 5, 2.5);

            // Puck in paw before the drop
            if (state === "faceoff") {
                c.fillStyle = "#161616";
                c.beginPath();
                c.ellipse(x - 13, y + 2, 5, 3, 0, 0, Math.PI * 2);
                c.fill();
            }

            c.font = "600 10px 'IBM Plex Sans', sans-serif";
            c.textAlign = "center";
            c.textBaseline = "top";
            c.fillStyle = "rgba(22, 22, 22, 0.65)";
            c.fillText("REF", x, y + 18);

            if (referee.bubble && referee.bubbleT > 0) drawBubble(c, x, y - 28, referee.bubble);
        }

        function drawBubble(c, x, y, text) {
            c.font = "600 13px 'IBM Plex Sans', sans-serif";
            const w = c.measureText(text).width + 16, h = 22;
            const bx = clamp(x - w / 2, 4, W - w - 4), by = Math.max(y - h, 4);
            c.fillStyle = "#fff";
            c.strokeStyle = "#161616";
            c.lineWidth = 1.5;
            c.beginPath();
            c.rect(bx, by, w, h);
            c.fill();
            c.stroke();
            c.beginPath();
            c.moveTo(x - 5, by + h);
            c.lineTo(x, by + h + 6);
            c.lineTo(x + 5, by + h);
            c.fill();
            c.fillStyle = "#161616";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(text, bx + w / 2, by + h / 2 + 1);
        }

        function drawPuck(c) {
            if (puck.x < -100) return;
            c.fillStyle = "rgba(0, 30, 60, 0.2)";
            c.beginPath();
            c.ellipse(puck.x + 1.5, puck.y + 2, PUCK_R, PUCK_R * 0.6, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#161616";
            c.beginPath();
            c.arc(puck.x, puck.y, PUCK_R, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = "#525252";
            c.lineWidth = 1;
            c.stroke();
        }

        function draw() {
            const scale = canvas.width / (W + 2 * M);
            ctx.setTransform(scale, 0, 0, scale, M * scale, M * scale);

            drawRink(ctx);
            drawNet(ctx, SANTA);
            drawNet(ctx, HUMBUG);

            // Controlled player marker under the feet
            if (controlled && state !== "title") {
                ctx.strokeStyle = "#f1c21b";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(controlled.x, controlled.y + 12, 18, 7, 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            const sorted = skaters.slice().sort((a, b) => a.y - b.y);
            for (const s of sorted) drawShadow(ctx, s.x, s.y, SKATER_R);
            drawPuck(ctx);
            for (const s of sorted) {
                drawStick(ctx, s);
                if (s.team === SANTA) drawSanta(ctx, s);
                else drawHumbug(ctx, s);
            }
            if (puck.owner) drawPuck(ctx);
            drawReferee(ctx);

            // Charge bar
            if (charging && controlled) {
                const bx = controlled.x - 20, by = controlled.y - 40;
                ctx.fillStyle = "rgba(22, 22, 22, 0.6)";
                ctx.fillRect(bx, by, 40, 6);
                ctx.fillStyle = charge > 0.85 ? "#da1e28" : "#f1c21b";
                ctx.fillRect(bx, by, 40 * charge, 6);
            }

            for (const p of confetti) {
                ctx.globalAlpha = Math.min(1, p.life);
                ctx.fillStyle = p.c;
                ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r * 1.6);
            }
            ctx.globalAlpha = 1;

            if (banner) {
                ctx.font = "700 44px 'IBM Plex Sans', sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.lineWidth = 6;
                ctx.strokeStyle = "#fff";
                ctx.globalAlpha = Math.min(1, banner.t * 2);
                ctx.strokeText(banner.text, W / 2, H / 2 - 80);
                ctx.fillStyle = banner.color;
                ctx.fillText(banner.text, W / 2, H / 2 - 80);
                ctx.globalAlpha = 1;
            }

            // Snowfall on top of everything
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            for (const f of flakes) {
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fill();
            }
            if (muted) {
                ctx.font = "600 12px 'IBM Plex Sans', sans-serif";
                ctx.textAlign = "right";
                ctx.textBaseline = "top";
                ctx.fillStyle = "#fff";
                ctx.fillText("muted", W + 2 * M - 6, 4);
            }
        }

        function frame(now) {
            if (!isOpen) return;
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;
            resizeCanvas();
            update(dt);
            draw();
            rafId = requestAnimationFrame(frame);
        }

        // Debug/test hook (harmless in production)
        window.__xmasHockey = {
            get state() { return state; },
            get score() { return score.slice(); },
            get puck() { return {x: puck.x, y: puck.y, owner: puck.owner ? puck.owner.name : null}; },
            forceGoal: (team) => goalScored(team),
        };

        return {open, close};
    }

    function loadStylesheet() {
        if (document.querySelector("link[data-xmas-hockey]")) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = STATIC_BASE + "christmas-hockey.css";
        link.dataset.xmasHockey = "";
        document.head.appendChild(link);
    }

    // Sponsor logos for the faceoff circles, taken from the theme's own SVGs. The NetEye eye
    // has a white swoosh for the dark top bar, so it is recoloured for the ice.
    function loadSponsors() {
        const sponsors = {neteye: null, wuerth: null};
        const load = (key, path, recolor) => {
            fetch(STATIC_BASE + path)
                .then(r => (r.ok ? r.text() : Promise.reject(r.status)))
                .then(svg => {
                    const img = new Image();
                    img.onload = () => { sponsors[key] = img; };
                    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(recolor(svg));
                })
                .catch(() => {});  // no logo is fine, the rink just stays plain
        };
        load("neteye", "img/mobile-neteye-logo.svg", svg => svg.replace(/fill="white"/g, 'fill="#161616"'));
        const wuerth = new Image();
        wuerth.onload = () => { sponsors.wuerth = wuerth; };
        wuerth.src = STATIC_BASE + "img/wuerth-it-logo.png";
        return sponsors;
    }
})();
