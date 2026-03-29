/**
 * Kosovo "constellation" in hero: thin white lines + nodes inside country clip.
 * Prishtina (XK-PR): brighter pulse. CSS masks the map center so hero text stays readable.
 */
(function () {
    var VB_W = 612.56158;
    var VB_H = 696.99365;
    var TARGET_POINTS = 155;
    var MAX_EDGE_DIST = 50;
    var MAX_NEIGHBORS = 4;
    var LINE_ALPHA = 0.26;
    /** Contain: full country visible inside hero, modest inset from edges */
    var FIT_INSET = 0.88;

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

    function drawScene(ctx, combined, points, pr, glowPulse, corePulse, ringT) {
        var cw = ctx.canvas._cssW;
        var ch = ctx.canvas._cssH;
        var dpr = ctx.canvas.width / cw;
        var scale = Math.min(cw / VB_W, ch / VB_H) * FIT_INSET;
        var tx = (cw - VB_W * scale) / 2;
        var ty = (ch - VB_H * scale) / 2;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);

        if (combined) {
            ctx.save();
            ctx.clip(combined);
        }

        ctx.strokeStyle = 'rgba(255,255,255,' + LINE_ALPHA + ')';
        /* ~1.1px on screen regardless of cover zoom */
        ctx.lineWidth = 1.12 / scale;
        ctx.lineCap = 'round';

        var drawn = {};
        function edgeKey(a, b) {
            return a < b ? a + ',' + b : b + ',' + a;
        }

        var i;
        var j;
        var k;
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
            ctx.fillStyle = 'rgba(255,255,255,' + points[i].a + ')';
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, points[i].r, 0, Math.PI * 2);
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
        var gr = 14 * glowPulse;

        var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, 'rgba(186, 230, 253, 0.58)');
        g.addColorStop(0.38, 'rgba(125, 211, 252, 0.22)');
        g.addColorStop(1, 'rgba(125, 211, 252, 0)');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();

        /* Pulsing ring (breathing halo) */
        var ringR = 5.2 + 4.8 * ringT;
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
        ctx.lineWidth = 0.55 / scale;
        ctx.globalAlpha = 0.12 + 0.38 * ringT;
        ctx.beginPath();
        ctx.arc(gx, gy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.shadowColor = 'rgba(186, 230, 253, 0.95)';
        ctx.shadowBlur = (9 + 4 * corePulse) / scale;
        ctx.beginPath();
        ctx.arc(gx, gy, 2.65 * corePulse, 0, Math.PI * 2);
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
                glowPulse = 0.84 + 0.26 * s;
                corePulse = 0.86 + 0.2 * s;
                ringT = 0.5 + 0.5 * s;
            }
            var ctx = canvas.getContext('2d');
            if (ctx && combined && points && prCenter) {
                drawScene(ctx, combined, points, prCenter, glowPulse, corePulse, ringT);
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

                points = samplePoints(combined, TARGET_POINTS, pctx);
                if (points.length < 20) {
                    wrap.style.display = 'none';
                    return;
                }

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
                        drawScene(ctx, combined, points, prCenter, 1, 1, 0.5);
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
