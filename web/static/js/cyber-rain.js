// Cyber city pixel rain - Extracted from index.html
(function () {
    const canvas = document.getElementById('pixel-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, drops = [];
    const COLORS = ['#f0187b', '#00d4ff', '#b44fff', '#f0187b', '#00d4ff', '#f0187b'];
    const PX = 2;
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        drops = [];
        const count = Math.floor(W / 26);
        for (let i = 0; i < count; i++) {
            drops.push({
                x: Math.floor(Math.random() * (W / PX)) * PX,
                y: Math.random() * -H,
                speed: 1.4 + Math.random() * 3.2,
                len: 6 + Math.floor(Math.random() * 18),
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                alpha: 0.12 + Math.random() * 0.28,
                gap: 2 + Math.floor(Math.random() * 4)
            });
        }
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        drops.forEach(d => {
            for (let i = 0; i < d.len; i++) {
                const fade = Math.pow((d.len - i) / d.len, 2);
                ctx.globalAlpha = d.alpha * fade;
                ctx.fillStyle = d.color;
                const sy = d.y - i * (PX + d.gap);
                if (sy > -PX && sy < H + PX) ctx.fillRect(d.x, Math.round(sy), PX, PX);
            }
            d.y += d.speed;
            if (d.y - d.len * (PX + d.gap) > H) {
                d.y = -20 - Math.random() * 80;
                d.x = Math.floor(Math.random() * (W / PX)) * PX;
                d.color = COLORS[Math.floor(Math.random() * COLORS.length)];
                d.speed = 1.4 + Math.random() * 3.2;
            }
        });
        ctx.globalAlpha = 1;
        requestAnimationFrame(draw);
    }
    resize();
    draw();
    window.addEventListener('resize', resize);
})();
