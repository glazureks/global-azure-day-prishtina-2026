/**
 * Kosovo in hero: outline stroke + constellation mesh (no area fill).
 * Prishtina (XK-PR): pulse. Map is scaled to fit inside the hero with equal margin on all sides.
 */
(function () {
    var VB_W = 612.56158;
    var VB_H = 696.99365;
    /** Random fill points + one node per municipality path (city “hubs”) */
    var TARGET_POINTS = 195;
    var MAX_EDGE_DIST = 54;
    var MAX_NEIGHBORS = 6;
    var LINE_ALPHA = 0.34;
    var LONG_EDGE_MIN = 56;
    var LONG_EDGE_MAX = 128;
    var LONG_EDGE_COUNT = 48;
    var LONG_LINE_ALPHA = 0.17;
    /** Fraction of width/height reserved as empty space on each side (top, bottom, left, right) */
    var MARGIN_RATIO = 0.075;

    function loadPaths() {
        return fetch('img/kosovo.svg')
            .then(function (r) {
                return r.text();
            })
            .then(function (xml) {
                var doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
                var pathEls = doc.querySelectorAll('path');
                var ds = [];
                for (var i = 0; i < pathEls.length; i++) {
                    var d = pathEls[i].getAttribute('d');
                    if (d) ds.push(d);
                }
                var pr = doc.querySelector('#XK-PR') || doc.querySelector('path[title="Pristina"]');
                return { ds: ds, prD: pr ? pr.getAttribute('d') : null };
            });
    }

    function bboxCenter(d) {
        if (!d) return { x: VB_W * 0.52, y: VB_H * 0.42 };
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H);
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
        document.body.appendChild(svg);
        var box = p.getBBox();
        document.body.removeChild(svg);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }

    function buildCombinedPath(ds) {
        if (typeof Path2D === 'undefined') return null;
        var combined = new Path2D();
        for (var i = 0; i < ds.length; i++) {
            try {
                combined.addPath(new Path2D(ds[i]));
            } catch (e) {
                return null;
            }
        }
        return combined;
    }

    function samplePoints(combined, n, ctx2d) {
        var pts = [];
        var guard = 0;
        while (pts.length < n && guard < n * 120) {
            guard++;
            var x = Math.random() * VB_W;
            var y = Math.random() * VB_H;
            if (ctx2d.isPointInPath(combined, x, y)) {
                pts.push({
                    x: x,
                    y: y,
                    r: 0.95 + Math.random() * 1.25,
                    a: 0.38 + Math.random() * 0.5
                });
            }
        }
        return pts;
    }

    function buildLongRangeEdges(points) {
        var edges = [];
        var seen = {};
        var tries = 0;
        var maxTries = 12000;
        while (edges.length < LONG_EDGE_COUNT && tries < maxTries) {
            tries++;
            var i = Math.floor(Math.random() * points.length);
            var j = Math.floor(Math.random() * points.length);
            if (i === j) continue;
            var a = i < j ? i : j;
            var b = i < j ? j : i;
            var key = a + ',' + b;
            if (seen[key]) continue;
            var dx = points[a].x - points[b].x;
            var dy = points[a].y - points[b].y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d >= LONG_EDGE_MIN && d <= LONG_EDGE_MAX) {
                seen[key] = true;
                edges.push([a, b]);
            }
        }
        return edges;
    }

    function drawScene(ctx, combined, points, longEdges, pr, glowPulse, corePulse, ringT) {
        var cw = ctx.canvas._cssW;
        var ch = ctx.canvas._cssH;
        var dpr = ctx.canvas.width / cw;
        var innerW = cw * (1 - 2 * MARGIN_RATIO);
        var innerH = ch * (1 - 2 * MARGIN_RATIO);
        var scale = Math.min(innerW / VB_W, innerH / VB_H);
        var tx = (cw - VB_W * scale) / 2;
        var ty = (ch - VB_H * scale) / 2;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);

        if (combined) {
            /* Border: softer than inner mesh so network reads first */
            ctx.strokeStyle = 'rgba(200, 230, 245, 0.22)';
            ctx.lineWidth = 1.05 / scale;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(56, 189, 248, 0.12)';
            ctx.shadowBlur = 2 / scale;
            ctx.stroke(combined);
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.clip(combined);
        }

        var drawn = {};
        function edgeKey(a, b) {
            return a < b ? a + ',' + b : b + ',' + a;
        }

        var i;
        var j;
        var k;

        /* Longer “link” segments (region-to-region), drawn fainter first */
        ctx.strokeStyle = 'rgba(255,255,255,' + LONG_LINE_ALPHA + ')';
        ctx.lineWidth = 1.02 / scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (i = 0; i < longEdges.length; i++) {
            var le = longEdges[i];
            ctx.beginPath();
            ctx.moveTo(points[le[0]].x, points[le[0]].y);
            ctx.lineTo(points[le[1]].x, points[le[1]].y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,' + LINE_ALPHA + ')';
        ctx.lineWidth = 1.38 / scale;
        for (i = 0; i < points.length; i++) {
            var dists = [];
            for (j = 0; j < points.length; j++) {
                if (i === j) continue;
                var dx = points[i].x - points[j].x;
                var dy = points[i].y - points[j].y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MAX_EDGE_DIST) dists.push({ j: j, dist: dist });
            }
            dists.sort(function (a, b) {
                return a.dist - b.dist;
            });
            for (k = 0; k < Math.min(MAX_NEIGHBORS, dists.length); k++) {
                j = dists[k].j;
                var ek = edgeKey(i, j);
                if (drawn[ek]) continue;
                drawn[ek] = true;
                ctx.beginPath();
                ctx.moveTo(points[i].x, points[i].y);
                ctx.lineTo(points[j].x, points[j].y);
                ctx.stroke();
            }
        }

        for (i = 0; i < points.length; i++) {
            var pradius = points[i].r;
            if (points[i].hub) {
                pradius = Math.max(pradius, 1.35);
            }
            ctx.fillStyle = 'rgba(255,255,255,' + points[i].a + ')';
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, pradius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (combined) {
            ctx.restore();
        }
        ctx.restore();

        /* Prishtina — above clip */
        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);

        var gx = pr.x;
        var gy = pr.y;
        var gr = 18 * glowPulse;

        var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, 'rgba(186, 230, 253, 0.62)');
        g.addColorStop(0.38, 'rgba(125, 211, 252, 0.24)');
        g.addColorStop(1, 'rgba(125, 211, 252, 0)');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();

        /* Pulsing ring (breathing halo) */
        var ringR = 6 + 5.5 * ringT;
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
        ctx.lineWidth = 0.58 / scale;
        ctx.globalAlpha = 0.14 + 0.4 * ringT;
        ctx.beginPath();
        ctx.arc(gx, gy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(255,255,255,0.97)';
        ctx.shadowColor = 'rgba(186, 230, 253, 0.95)';
        ctx.shadowBlur = (11 + 5 * corePulse) / scale;
        ctx.beginPath();
        ctx.arc(gx, gy, 3.25 * corePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    function init() {
        var wrap = document.querySelector('.hero-map-wrap');
        var canvas = document.getElementById('hero-kosovo-canvas');
        if (!wrap || !canvas) return;

        var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var rafId = null;
        var t0 = 0;
        var combined;
        var points;
        var longEdges;
        var prCenter;

        function paintLoop(t) {
            var glowPulse;
            var corePulse;
            var ringT;
            if (reducedMotion) {
                glowPulse = 1;
                corePulse = 1;
                ringT = 0.5;
            } else {
                var ph = (t - t0) * 0.00315;
                var s = Math.sin(ph);
                /* Glow + core pulse clearly; ring breathes in sync */
                glowPulse = 0.8 + 0.3 * s;
                corePulse = 0.82 + 0.26 * s;
                ringT = 0.5 + 0.5 * s;
            }
            var ctx = canvas.getContext('2d');
            if (ctx && combined && points && longEdges && prCenter) {
                drawScene(ctx, combined, points, longEdges, prCenter, glowPulse, corePulse, ringT);
            }
            if (!reducedMotion) {
                rafId = requestAnimationFrame(paintLoop);
            }
        }

        function startPaint() {
            if (rafId) cancelAnimationFrame(rafId);
            if (reducedMotion) {
                paintLoop(0);
            } else {
                t0 = performance.now();
                rafId = requestAnimationFrame(paintLoop);
            }
        }

        loadPaths()
            .then(function (data) {
                combined = buildCombinedPath(data.ds);
                if (!combined || !data.ds.length) {
                    wrap.style.display = 'none';
                    return;
                }

                prCenter = bboxCenter(data.prD);

                var probe = document.createElement('canvas');
                var pctx = probe.getContext('2d');
                if (!pctx || !pctx.isPointInPath) {
                    wrap.style.display = 'none';
                    return;
                }

                var nRandom = Math.max(48, TARGET_POINTS - data.ds.length);
                points = samplePoints(combined, nRandom, pctx);
                if (points.length < 20) {
                    wrap.style.display = 'none';
                    return;
                }

                var hi;
                for (hi = 0; hi < data.ds.length; hi++) {
                    var hc = bboxCenter(data.ds[hi]);
                    points.push({
                        x: hc.x,
                        y: hc.y,
                        r: 1.2 + Math.random() * 0.35,
                        a: 0.58 + Math.random() * 0.22,
                        hub: true
                    });
                }

                longEdges = buildLongRangeEdges(points);

                function resize() {
                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }
                    var rect = wrap.getBoundingClientRect();
                    var dpr = Math.min(window.devicePixelRatio || 1, 2);
                    var cw = Math.max(1, Math.floor(rect.width));
                    var ch = Math.max(1, Math.floor(rect.height));
                    canvas.width = Math.floor(cw * dpr);
                    canvas.height = Math.floor(ch * dpr);
                    canvas._cssW = cw;
                    canvas._cssH = ch;
                    var ctx = canvas.getContext('2d');
                    if (!ctx) {
                        wrap.style.display = 'none';
                        return;
                    }
                    t0 = performance.now();
                    if (reducedMotion) {
                        drawScene(ctx, combined, points, longEdges, prCenter, 1, 1, 0.5);
                    } else {
                        startPaint();
                    }
                }

                resize();

                if (typeof ResizeObserver !== 'undefined') {
                    var ro = new ResizeObserver(resize);
                    ro.observe(wrap);
                } else {
                    window.addEventListener('resize', resize);
                }
            })
            .catch(function () {
                wrap.style.display = 'none';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
