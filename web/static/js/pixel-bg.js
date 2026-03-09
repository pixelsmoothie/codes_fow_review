// Pixelated animated background — subtle falling data pixels (green accent)
(function () {
    var canvas = document.getElementById("pixel-bg");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var PIXEL = 8;
    var COLUMNS, ROWS;
    var grid = [];
    var DROP_CHANCE = 0.012;
    var FADE_SPEED = 0.010;

    var COLORS = [
        { r: 34,  g: 197, b: 94  },   // accent green
        { r: 21,  g: 128, b: 61  },   // accent-dim green
        { r: 74,  g: 222, b: 128 },   // light green
        { r: 96,  g: 165, b: 250 },   // blue accent
    ];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        COLUMNS = Math.ceil(canvas.width / PIXEL);
        ROWS = Math.ceil(canvas.height / PIXEL);
        var newGrid = [];
        for (var c = 0; c < COLUMNS; c++) {
            newGrid[c] = [];
            for (var r = 0; r < ROWS; r++) {
                newGrid[c][r] = (grid[c] && grid[c][r]) ? grid[c][r] : { alpha: 0, color: 0 };
            }
        }
        grid = newGrid;
    }

    function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var c = 0; c < COLUMNS; c++) {
            if (Math.random() < DROP_CHANCE) {
                var r = Math.floor(Math.random() * ROWS);
                grid[c][r] = {
                    alpha: 0.08 + Math.random() * 0.12,
                    color: Math.floor(Math.random() * COLORS.length)
                };
            }

            for (var r = 0; r < ROWS; r++) {
                var cell = grid[c][r];
                if (cell.alpha <= 0) continue;

                var col = COLORS[cell.color];
                ctx.fillStyle = "rgba(" + col.r + "," + col.g + "," + col.b + "," + cell.alpha.toFixed(3) + ")";
                ctx.fillRect(c * PIXEL, r * PIXEL, PIXEL, PIXEL);

                cell.alpha -= FADE_SPEED;
                if (cell.alpha < 0) cell.alpha = 0;
            }
        }

        requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    resize();
    tick();
})();