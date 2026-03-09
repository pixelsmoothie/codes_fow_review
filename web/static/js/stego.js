import { API } from "./api.js";
import { showOutput } from "./ui.js";

function renderLsbTable(containerId, pixels) {
    var wrap = document.getElementById(containerId);
    if (!wrap || !pixels || !pixels.length) return;
    var tbl = document.createElement("table");
    tbl.className = "lsb-table";
    tbl.innerHTML = "<thead><tr><th>#</th><th colspan='3'>BEFORE</th><th colspan='3'>AFTER</th><th>Changed?</th></tr><tr style='background:rgba(168,85,247,0.04)'><th></th><th>R[lsb]</th><th>G[lsb]</th><th>B[lsb]</th><th>R[lsb]</th><th>G[lsb]</th><th>B[lsb]</th><th></th></tr></thead>";
    var tbody = document.createElement("tbody");
    pixels.forEach(function (px) {
        var row = document.createElement("tr");
        if (px.changed) row.className = "changed";
        var b = px.before, a = px.after;
        function cell(val, lsb, hl) { return "<td>" + val + " <span class='" + (hl ? "lsb-bit-mod" : "lsb-bit-ok") + "'>[" + lsb + "]</span></td>"; }
        var rC = b.r_lsb !== a.r_lsb, gC = b.g_lsb !== a.g_lsb, bC = b.b_lsb !== a.b_lsb;
        row.innerHTML = "<td style='color:var(--text-muted)'>" + px.pixel + "</td>" + cell(b.r, b.r_lsb, false) + cell(b.g, b.g_lsb, false) + cell(b.b, b.b_lsb, false) + cell(a.r, a.r_lsb, rC) + cell(a.g, a.g_lsb, gC) + cell(a.b, a.b_lsb, bC) + "<td class='" + (px.changed ? "lsb-changed" : "lsb-clean") + "'>" + (px.changed ? "YES" : "--") + "</td>";
        tbody.appendChild(row);
    });
    tbl.appendChild(tbody);
    wrap.innerHTML = ""; wrap.appendChild(tbl);
    var leg = document.createElement("div");
    leg.style.cssText = "padding:6px 10px;font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);border-top:1px solid rgba(168,85,247,0.1);";
    leg.textContent = "[0]/[1] = LSB. Red = bit modified to embed message. First 10 pixels shown.";
    wrap.appendChild(leg);
}

function renderDctFrequencyChart(containerId, blocks) {
    var wrap = document.getElementById(containerId);
    if (!wrap || !blocks || !blocks.length) return;

    var html = "";
    blocks.forEach(function (b) {
        // SVG line chart
        var W = 960, H = 240, pad = { top: 30, right: 30, bottom: 50, left: 60 };
        var cW = W - pad.left - pad.right;
        var cH = H - pad.top - pad.bottom;
        var n = 63; // AC coefficients (skip DC at index 0)

        var orig = [], steg = [];
        for (var i = 1; i < 64; i++) { orig.push(b.orig_coeffs[i]); steg.push(b.stego_coeffs[i]); }

        var allVals = orig.concat(steg);
        var yMin = Math.min.apply(null, allVals);
        var yMax = Math.max.apply(null, allVals);
        var yRange = (yMax - yMin) || 1;
        yMin -= yRange * 0.05; yMax += yRange * 0.05; yRange = yMax - yMin;

        function toX(idx) { return pad.left + (idx / (n - 1)) * cW; }
        function toY(val) { return pad.top + cH - ((val - yMin) / yRange) * cH; }

        function buildPath(data) {
            var d = "M";
            data.forEach(function (v, i) {
                d += (i > 0 ? " L" : "") + toX(i).toFixed(1) + " " + toY(v).toFixed(1);
            });
            return d;
        }

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;height:auto;background:rgba(0,0,0,0.25);border-radius:6px;">';

        // Gridlines + Y axis labels
        var yTicks = 5;
        for (var t = 0; t <= yTicks; t++) {
            var yVal = yMin + (t / yTicks) * yRange;
            var yPos = toY(yVal);
            svg += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (W - pad.right) + '" y2="' + yPos + '" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3"/>';
            svg += '<text x="' + (pad.left - 6) + '" y="' + (yPos + 4) + '" text-anchor="end" fill="#94a3b8" font-size="9" font-family="monospace">' + yVal.toFixed(0) + '</text>';
        }

        // X axis labels
        for (var x = 0; x < n; x += 10) {
            svg += '<text x="' + toX(x) + '" y="' + (H - pad.bottom + 16) + '" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="monospace">' + (x + 1) + '</text>';
        }

        // Axis lines
        svg += '<line x1="' + pad.left + '" y1="' + pad.top + '" x2="' + pad.left + '" y2="' + (H - pad.bottom) + '" stroke="rgba(255,255,255,0.2)"/>';
        svg += '<line x1="' + pad.left + '" y1="' + (H - pad.bottom) + '" x2="' + (W - pad.right) + '" y2="' + (H - pad.bottom) + '" stroke="rgba(255,255,255,0.2)"/>';

        // Axis titles
        svg += '<text x="' + (pad.left + cW / 2) + '" y="' + (H - 4) + '" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">Frequency Index</text>';
        svg += '<text x="14" y="' + (pad.top + cH / 2) + '" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace" transform="rotate(-90,14,' + (pad.top + cH / 2) + ')">Amplitude</text>';

        // Lines
        svg += '<path d="' + buildPath(orig) + '" fill="none" stroke="#f87171" stroke-width="1.5" opacity="0.85"/>';
        svg += '<path d="' + buildPath(steg) + '" fill="none" stroke="#60a5fa" stroke-width="1.5" opacity="0.85"/>';

        // Legend
        svg += '<rect x="' + (W - pad.right - 140) + '" y="' + (pad.top + 2) + '" width="130" height="32" rx="4" fill="rgba(0,0,0,0.5)"/>';
        svg += '<line x1="' + (W - pad.right - 130) + '" y1="' + (pad.top + 12) + '" x2="' + (W - pad.right - 110) + '" y2="' + (pad.top + 12) + '" stroke="#f87171" stroke-width="2"/>';
        svg += '<text x="' + (W - pad.right - 106) + '" y="' + (pad.top + 16) + '" fill="#f87171" font-size="9" font-family="monospace">Original</text>';
        svg += '<line x1="' + (W - pad.right - 130) + '" y1="' + (pad.top + 26) + '" x2="' + (W - pad.right - 110) + '" y2="' + (pad.top + 26) + '" stroke="#60a5fa" stroke-width="2"/>';
        svg += '<text x="' + (W - pad.right - 106) + '" y="' + (pad.top + 30) + '" fill="#60a5fa" font-size="9" font-family="monospace">Stego</text>';

        svg += '</svg>';

        html += '<div style="margin-bottom:12px;"><div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Block #' + b.block_idx + ' DCT AC Coefficients</div>' + svg + '</div>';
    });

    wrap.innerHTML = html;
}

function renderDctHeatmap(containerId, block) {
    var wrap = document.getElementById(containerId);
    if (!wrap || !block) return;

    var cellSize = 42, gap = 3, pad = 40;
    var gridW = 8 * (cellSize + gap) - gap;
    var W = gridW + pad + 60, H = gridW + pad + 60;

    // Compute differences
    var diffs = [];
    var maxDiff = 0;
    for (var i = 0; i < 64; i++) {
        var d = Math.abs((block.stego_coeffs[i] || 0) - (block.orig_coeffs[i] || 0));
        diffs.push(d);
        if (d > maxDiff) maxDiff = d;
    }
    if (maxDiff === 0) maxDiff = 1;

    function heatColor(diff) {
        var t = diff / maxDiff;
        if (t < 0.01) return "rgba(96,165,250,0.25)";     // blue – unchanged
        var r = Math.round(80 + 175 * t);
        var g = Math.round(60 * (1 - t));
        var b = Math.round(60 * (1 - t));
        return "rgb(" + r + "," + g + "," + b + ")";
    }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;height:auto;background:rgba(0,0,0,0.25);border-radius:6px;margin-top:8px;">';

    // Title
    svg += '<text x="' + (pad + gridW / 2) + '" y="20" text-anchor="middle" fill="#d8b4fe" font-size="12" font-family="monospace">Block #' + block.block_idx + ' — 8×8 DCT Coefficient Modification Heatmap</text>';

    // Grid cells
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            var idx = row * 8 + col;
            var x = pad + col * (cellSize + gap);
            var y = 30 + row * (cellSize + gap);
            var color = heatColor(diffs[idx]);
            var orig = (block.orig_coeffs[idx] || 0).toFixed(1);
            var steg = (block.stego_coeffs[idx] || 0).toFixed(1);
            var diff = diffs[idx].toFixed(2);

            svg += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" fill="' + color + '" rx="2">';
            svg += '<title>(' + row + ',' + col + ') Orig: ' + orig + ' Stego: ' + steg + ' Δ: ' + diff + '</title>';
            svg += '</rect>';
            // Show index text for DC (0,0) or modified cells
            if (diffs[idx] > maxDiff * 0.1 || idx === 0) {
                svg += '<text x="' + (x + cellSize / 2) + '" y="' + (y + cellSize / 2 + 3) + '" text-anchor="middle" fill="#fff" font-size="7" font-family="monospace" opacity="0.9">' + diff + '</text>';
            }
        }
    }

    // Row/col labels
    for (var r = 0; r < 8; r++) {
        svg += '<text x="' + (pad - 8) + '" y="' + (30 + r * (cellSize + gap) + cellSize / 2 + 4) + '" text-anchor="end" fill="#94a3b8" font-size="10" font-family="monospace">' + r + '</text>';
        svg += '<text x="' + (pad + r * (cellSize + gap) + cellSize / 2) + '" y="' + (30 + gridW + 18) + '" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">' + r + '</text>';
    }

    // Color scale legend
    var legY = 24 + gridW + 28;
    svg += '<text x="' + pad + '" y="' + legY + '" fill="#94a3b8" font-size="8" font-family="monospace">No change</text>';
    for (var s = 0; s < 10; s++) {
        svg += '<rect x="' + (pad + 60 + s * 14) + '" y="' + (legY - 8) + '" width="12" height="10" fill="' + heatColor(maxDiff * s / 9) + '" rx="1"/>';
    }
    svg += '<text x="' + (pad + 60 + 10 * 14 + 4) + '" y="' + legY + '" fill="#94a3b8" font-size="8" font-family="monospace">Max Δ=' + maxDiff.toFixed(1) + '</text>';

    svg += '</svg>';

    var div = document.createElement("div");
    div.innerHTML = svg;
    wrap.appendChild(div);
}

function renderMetricsBlock(containerId, metrics) {
    const wrap = document.getElementById(containerId);
    if (!wrap || !metrics) return;
    const div = document.createElement("div");
    div.style.cssText = "text-align:left; background:rgba(255,255,255,0.03); padding:1rem; border-radius:8px; border:1px solid rgba(168,85,247,0.2); margin-top:0.5rem;";

    // Safety fallback for metrics
    const psnr = metrics.psnr || "N/A";
    const mse = metrics.mse || "N/A";
    const ssim = metrics.ssim || "N/A";
    const cap = metrics.capacity_bytes || metrics.capacity || "N/A";
    const ber = (metrics.ber !== undefined) ? (metrics.ber * 100).toFixed(4) + "%" : "N/A";

    const bpp = (metrics.payload_ratio_bpp !== undefined && metrics.payload_ratio_bpp > 0) ? metrics.payload_ratio_bpp.toFixed(3) + " bpp" : "N/A";

    // New Advanced Tests
    const compressCer = (metrics.adv_compress_cer !== undefined && metrics.adv_compress_cer >= 0)
        ? (metrics.adv_compress_cer * 100).toFixed(2) + "%" : "N/A";
    const compressLabel = (metrics.adv_compress_cer > 0.1) ? "<span style='color:var(--red)'>FAILS</span>" : "<span style='color:var(--green)'>SURVIVES</span>";
    const compressImg = metrics.adv_compress_thumb ? `<img src="${metrics.adv_compress_thumb}" onclick="openImagePreview('${metrics.adv_compress_thumb}')" style="width:50px; height:50px; border-radius:4px; object-fit:cover; border:2px solid rgba(255,255,255,0.15); cursor:pointer;" title="Click to preview">` : "";

    const noiseCer = (metrics.adv_noise_cer !== undefined && metrics.adv_noise_cer >= 0)
        ? (metrics.adv_noise_cer * 100).toFixed(2) + "%" : "N/A";
    const noiseLabel = (metrics.adv_noise_cer > 0.1) ? "<span style='color:var(--red)'>FAILS</span>" : "<span style='color:var(--green)'>SURVIVES</span>";
    const noiseImg = metrics.adv_noise_thumb ? `<img src="${metrics.adv_noise_thumb}" onclick="openImagePreview('${metrics.adv_noise_thumb}')" style="width:50px; height:50px; border-radius:4px; object-fit:cover; border:2px solid rgba(255,255,255,0.15); cursor:pointer;" title="Click to preview">` : "";

    const chiSquare = (metrics.adv_detectability_chi !== undefined && metrics.adv_detectability_chi >= 0)
        ? metrics.adv_detectability_chi.toExponential(2) : "N/A";
    const entDiff = (metrics.adv_detectability_entropy_diff !== undefined)
        ? metrics.adv_detectability_entropy_diff.toFixed(6) : "N/A";
    const chiLabel = (metrics.adv_detectability_chi > 100) ? "<span style='color:var(--red)'>HIGH ANOMALY</span>" : "<span style='color:var(--green)'>STEALTHY</span>";
    const stegoImg = metrics.stego_thumb ? `<img src="${metrics.stego_thumb}" onclick="openImagePreview('${metrics.stego_thumb}')" style="width:50px; height:50px; border-radius:4px; object-fit:cover; border:2px solid rgba(255,255,255,0.15); cursor:pointer;" title="Click to preview">` : "";


    div.innerHTML = `
        <div style='display:grid; grid-template-columns: repeat(2, 1fr); gap:1rem; margin-bottom: 1rem; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 1rem;'>
            <div style='grid-column: span 2; display:flex; justify-content:space-between; align-items:center;'>
                <strong style='color:#fff; font-size:1.1rem;'>1. Visual Distortion</strong>
                <span style='font-size:0.75rem; color:var(--text-muted);'>Fidelity Metrics</span>
            </div>
            <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7; text-transform:uppercase;'>PSNR (dB)</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#a5f3fc;'>${psnr}</span></div>
            <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7; text-transform:uppercase;'>SSIM</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#fde68a;'>${ssim}</span></div>
            <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7; text-transform:uppercase;'>MSE</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#86efac;'>${mse}</span></div>
            <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7; text-transform:uppercase;'>Payload Ratio</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#fbbf24;'>${bpp}</span></div>
        </div>
        
        <div style='display:grid; grid-template-columns: 1fr; gap:1rem;'>
            <div style='display:flex; gap:1rem; align-items:center; background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:6px;'>
                 ${compressImg}
                 <div style='flex:1;'><strong style='color:#fff; display:block; margin-bottom:0.25rem; font-size:0.95rem;'>2. Compression Resistance (JPEG Q=75)</strong>
                     <div style='display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem;'>
                        <span>CER Error Rate: <span style='color:#fbbf24;'>${compressCer}</span></span>
                        ${compressLabel}
                     </div>
                 </div>
            </div>
            
            <div style='display:flex; gap:1rem; align-items:center; background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:6px;'>
                 ${noiseImg}
                 <div style='flex:1;'><strong style='color:#fff; display:block; margin-bottom:0.25rem; font-size:0.95rem;'>3. Noise Resistance (Gaussian σ=5)</strong>
                     <div style='display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem;'>
                        <span>CER Error Rate: <span style='color:#fbbf24;'>${noiseCer}</span></span>
                        ${noiseLabel}
                     </div>
                 </div>
            </div>
            
            <div style='display:flex; gap:1rem; align-items:center; background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:6px;'>
                 ${stegoImg}
                 <div style='flex:1;'><strong style='color:#fff; display:block; margin-bottom:0.25rem; font-size:0.95rem;'>4. Steganalysis Detectability</strong>
                     <div style='display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem;'>
                        <span>Chi-Sq: <span style='color:#f472b6;'>${chiSquare}</span> | Ent-Δ: <span style='color:#a78bfa;'>${entDiff}</span></span>
                        ${chiLabel}
                     </div>
                 </div>
            </div>
        </div>
    `;
    wrap.appendChild(div);
}


// --- Modal Logic ---
let lastStegoData = null;
let lastBothData = null;
let lastCompareData = null;
let currentActiveAnalysisData = null;

let stegoAdvBtn, bothAdvBtn, compareAdvBtn;

function openAdvancedAnalysisModal(data, source) {
    console.log("[Modal] Opening with source:", source, "Data keys:", Object.keys(data));
    currentActiveAnalysisData = data;
    const modal = document.getElementById("analysis-modal");
    const content = document.getElementById("analysis-content");
    if (!modal || !content) {
        console.error("[Modal] Elements missing: modal or content");
        return;
    }

    content.innerHTML = "";
    modal.classList.add("is-visible");
    modal.style.display = "flex"; // Fallback if class doesn't handle display

    // Header section
    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem; margin-bottom:1rem;";
    header.innerHTML = `<h2 style='margin:0; font-family:var(--font-main); color:var(--text); font-size:1.1rem; font-weight:600; letter-spacing:0.02em;'>Evaluation: ${source.toUpperCase()}</h2>`;
    content.appendChild(header);

    // Tab Navigation
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex; gap:0.5rem; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem; overflow-x:auto; scrollbar-width: none;";
    const tabs = [
        { id: "visual", label: "Visual Distortion" },
        { id: "compression", label: "Compression Resistance" },
        { id: "noise", label: "Noise Resistance" },
        { id: "detectability", label: "Steganalysis Detectability" },
        { id: "overall", label: "Overall Summary" }
    ];

    // Check for spectral data
    const hasSpectral = (data.dct_frequency_comparison && data.dct_frequency_comparison.length > 0) ||
        (data.dct && data.dct.dct_frequency_comparison && data.dct.dct_frequency_comparison.length > 0);
    if (hasSpectral) {
        tabs.splice(4, 0, { id: "spectral", label: "Spectral Analysis" });
    }

    const tabButtons = {};
    tabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = "btn btn-card";
        btn.style.cssText = "padding:0.6rem 1.2rem; font-size:0.85rem; white-space:nowrap; border-radius:4px; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1);";
        btn.textContent = tab.label;
        btn.onclick = () => switchTab(tab.id);
        nav.appendChild(btn);
        tabButtons[tab.id] = btn;
    });
    content.appendChild(nav);

    const displayArea = document.createElement("div");
    displayArea.style.cssText = "min-height:450px; width:100%; overflow-y:auto; padding-right:5px;";
    content.appendChild(displayArea);

    function switchTab(tabId) {
        console.log("[Modal] Switching to tab:", tabId, "with source:", source);
        Object.values(tabButtons).forEach(btn => {
            btn.style.background = "transparent";
            btn.style.borderColor = "rgba(255,255,255,0.1)";
            btn.style.color = "var(--text-muted)";
            btn.classList.remove("active-tab");
        });
        tabButtons[tabId].style.background = "rgba(168,85,247,0.15)";
        tabButtons[tabId].style.borderColor = "var(--accent)";
        tabButtons[tabId].style.color = "var(--text)";
        tabButtons[tabId].classList.add("active-tab");

        displayArea.innerHTML = "";
        const container = document.createElement("div");
        container.style.cssText = "display:grid; grid-template-columns: 1fr; gap:1.5rem; width:100%; animation:fadeIn 0.2s ease;";
        displayArea.appendChild(container);

        if (tabId === "visual") renderVisualTab(container, data, source);
        else if (tabId === "compression") renderCompressionTab(container, data, source);
        else if (tabId === "noise") renderNoiseTab(container, data, source);
        else if (tabId === "detectability") renderDetectabilityTab(container, data, source);
        else if (tabId === "spectral") renderSpectralTab(container, data, source);
        else if (tabId === "overall") renderOverallTab(container, data, source);
    }

    switchTab("visual");
}

function renderSideBySide(container, lsbData, dctData, lsbRender, dctRender) {
    container.innerHTML = "";
    container.style.display = "grid";
    container.style.gridTemplateColumns = "1fr 1fr";
    container.style.gap = "1.5rem";

    const lsbWrap = document.createElement("div");
    lsbWrap.innerHTML = "<h3 style='margin:0 0 0.75rem 0; font-family:var(--font-pixel); color:#60a5fa; font-size:0.9rem; text-transform:uppercase;'>LSB Algorithm</h3>";
    container.appendChild(lsbWrap);
    lsbRender(lsbWrap, lsbData);

    const dctWrap = document.createElement("div");
    dctWrap.innerHTML = "<h3 style='margin:0 0 0.75rem 0; font-family:var(--font-pixel); color:#f87171; font-size:0.9rem; text-transform:uppercase;'>DCT Algorithm</h3>";
    dctWrap.style.borderLeft = "1px solid rgba(255,255,255,0.1)";
    dctWrap.style.paddingLeft = "1.5rem";
    container.appendChild(dctWrap);
    dctRender(dctWrap, dctData);
}

function renderSpectralTab(container, data, source) {
    const isCompare = source.toLowerCase().includes("compare") || source.toLowerCase().includes("comparison");
    container.innerHTML = "";
    container.style.display = "block";

    if (isCompare) {
        const note = document.createElement("div");
        note.style.cssText = "margin-bottom:1.5rem; padding:0.75rem; background:rgba(255,255,255,0.03); border-left:3px solid var(--accent); font-size:0.8rem; color:var(--text-muted);";
        note.innerHTML = "<strong>LSB:</strong> Spatial domain only. Spectral data not available (Frequency analysis applies to transform-domain algorithms like DCT).";
        container.appendChild(note);

        const dctData = (data.dct && data.dct.dct_frequency_comparison) ? data.dct : (data.lsb ? null : null);
        if (!dctData || !dctData.dct_frequency_comparison) {
            container.innerHTML += "<div style='color:var(--text-muted); padding:2rem; text-align:center;'>No spectral data available for DCT.</div>";
            return;
        }

        const toolboxHeader = document.createElement("h3");
        toolboxHeader.style.cssText = "margin:0 0 1rem 0; font-family:var(--font-pixel); color:#f87171; font-size:1rem; text-transform:uppercase;";
        toolboxHeader.textContent = "DCT SECURE SPECTROMETER";
        container.appendChild(toolboxHeader);

        renderDctToolbox(container, dctData);
    } else {
        const dctData = data.dct_frequency_comparison ? data : null;
        if (!dctData) {
            container.innerHTML = "<div style='color:var(--text-muted); padding:2rem; text-align:center;'>No spectral data available for this algorithm.</div>";
            return;
        }
        renderDctToolbox(container, dctData);
    }
}

function renderDctToolbox(parent, dctData) {
    const specWrap = document.createElement("div");
    parent.appendChild(specWrap);
    const displayArea = document.createElement("div");

    const tabs = document.createElement("div");
    tabs.style.cssText = "display:flex; gap:0.5rem; margin-bottom:0.8rem;";
    const b1 = document.createElement("button"); b1.className = "btn btn-card active-tab"; b1.textContent = "Frequency spectrum"; b1.style.padding = "0.4rem 0.8rem"; b1.style.fontSize = "0.8rem";
    const b2 = document.createElement("button"); b2.className = "btn btn-card"; b2.textContent = "8x8 Coefficient heatmap"; b2.style.padding = "0.4rem 0.8rem"; b2.style.fontSize = "0.8rem";
    tabs.appendChild(b1); tabs.appendChild(b2);
    specWrap.appendChild(tabs);
    specWrap.appendChild(displayArea);

    b1.onclick = () => {
        displayArea.innerHTML = "";
        b1.style.background = "rgba(168,85,247,0.12)"; b1.classList.add("active-tab");
        b2.style.background = "transparent"; b2.classList.remove("active-tab");
        renderJustFrequency(displayArea, dctData.dct_frequency_comparison);
    };
    b2.onclick = () => {
        displayArea.innerHTML = "";
        b2.style.background = "rgba(168,85,247,0.12)"; b2.classList.add("active-tab");
        b1.style.background = "transparent"; b1.classList.remove("active-tab");
        renderJustHeatmaps(displayArea, dctData.dct_frequency_comparison);
    };
    b1.onclick();
}

function renderVisualTab(container, data, source) {
    const isCompare = source.toLowerCase().includes("compare") || source.toLowerCase().includes("comparison");
    console.log("[VisualTab] isCompare:", isCompare);

    const renderContent = (parent, m, label) => {
        console.log(`[VisualTab Render] ${label || 'Metrics'}:`, m);
        if (!m) { parent.innerHTML += "<div style='color:var(--text-muted)'>Metric data unavailable</div>"; return; }
        const bpp = (m.payload_ratio_bpp !== undefined) ? m.payload_ratio_bpp.toFixed(3) : "0.000";
        parent.innerHTML += `
            <div class='card' style='padding:1.25rem; background:rgba(255,255,255,0.02);'>
                <div style='display:grid; grid-template-columns: 1fr 1fr; gap:1rem;'>
                    <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7;'>PSNR</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#a5f3fc;'>${m.psnr} dB</span></div>
                    <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7;'>SSIM</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#fde68a;'>${m.ssim}</span></div>
                    <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7;'>MSE</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#86efac;'>${m.mse}</span></div>
                    <div><span style='color:var(--accent); font-size:0.75rem; display:block; opacity:0.7;'>PAYLOAD RATIO</span><span style='font-family:var(--font-mono); font-size:1.1rem; color:#fbbf24;'>${bpp} bpp</span></div>
                </div>
                <div style='margin-top:1rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.05); font-size:0.85rem; color:var(--text-muted);'>
                    Lower MSE and higher PSNR/SSIM indicate better visual fidelity.
                </div>
            </div>
        `;
    };

    if (isCompare) {
        renderSideBySide(container, data.lsb ? data.lsb.metrics : null, data.dct ? data.dct.metrics : null,
            (p, m) => renderContent(p, m, "LSB"), (p, m) => renderContent(p, m, "DCT"));
    } else {
        container.style.gridTemplateColumns = "1fr";
        renderContent(container, data.metrics);
    }
}

function renderCompressionTab(container, data, source) {
    const isCompare = source.toLowerCase().includes("compare") || source.toLowerCase().includes("comparison");
    const renderContent = (parent, m, label) => {
        console.log(`[CompressionTab Render] ${label || 'Metrics'}:`, m);
        if (!m) { parent.innerHTML += "<div style='color:var(--text-muted)'>Metric data unavailable</div>"; return; }
        const eber = (m.adv_compress_cer !== undefined && m.adv_compress_cer >= 0) ? (m.adv_compress_cer * 100).toFixed(2) + "%" : "N/A";
        const labelText = (m.adv_compress_cer > 0.1) ? "<span style='color:var(--red); font-weight:bold;'>FAILS</span>" : "<span style='color:var(--green); font-weight:bold;'>SURVIVES</span>";
        parent.innerHTML += `
            <div class='card' style='padding:1.25rem; background:rgba(255,255,255,0.02);'>
                <div style='text-align:center; margin-bottom:1rem;'>
                    <img src="${m.adv_compress_thumb}" onclick="openImagePreview('${m.adv_compress_full || m.adv_compress_thumb}')" style='width:100%; max-width:280px; height:auto; border-radius:8px; border:2px solid var(--accent); cursor:pointer;'>
                    <div style='font-size:0.7rem; color:var(--text-muted); margin-top:0.4rem;'>Attacked Image (JPEG Q=75)</div>
                </div>
                <div style='background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; font-family:var(--font-mono);'>
                    <div style='display:flex; justify-content:space-between; align-items:center;'>
                        <span style='color:var(--text-muted);'>Stego Channel Error Rate:</span>
                        <span style='color:#fbbf24; font-size:1.1rem;'>${eber}</span>
                    </div>
                    <div style='text-align:right; margin-top:0.5rem;'>${labelText}</div>
                </div>
            </div>
        `;
    };

    if (isCompare) {
        renderSideBySide(container, data.lsb ? data.lsb.metrics : null, data.dct ? data.dct.metrics : null,
            (p, m) => renderContent(p, m, "LSB"), (p, m) => renderContent(p, m, "DCT"));
    } else {
        container.style.gridTemplateColumns = "1fr";
        renderContent(container, data.metrics);
    }
}

function renderNoiseTab(container, data, source) {
    const isCompare = source.toLowerCase().includes("compare") || source.toLowerCase().includes("comparison");
    const renderContent = (parent, m, label) => {
        console.log(`[NoiseTab Render] ${label || 'Metrics'}:`, m);
        if (!m) { parent.innerHTML += "<div style='color:var(--text-muted)'>Metric data unavailable</div>"; return; }
        const eber = (m.adv_noise_cer !== undefined && m.adv_noise_cer >= 0) ? (m.adv_noise_cer * 100).toFixed(2) + "%" : "N/A";
        const labelText = (m.adv_noise_cer > 0.1) ? "<span style='color:var(--red); font-weight:bold;'>FAILS</span>" : "<span style='color:var(--green); font-weight:bold;'>SURVIVES</span>";
        parent.innerHTML += `
            <div class='card' style='padding:1.25rem; background:rgba(255,255,255,0.02);'>
                <div style='text-align:center; margin-bottom:1rem;'>
                    <img src="${m.adv_noise_thumb}" onclick="openImagePreview('${m.adv_noise_full || m.adv_noise_thumb}')" style='width:100%; max-width:280px; height:auto; border-radius:8px; border:2px solid var(--accent); cursor:pointer;'>
                    <div style='font-size:0.7rem; color:var(--text-muted); margin-top:0.4rem;'>Attacked Image (Gaussian Noise σ=5)</div>
                </div>
                <div style='background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; font-family:var(--font-mono);'>
                    <div style='display:flex; justify-content:space-between; align-items:center;'>
                        <span style='color:var(--text-muted);'>Stego Channel Error Rate:</span>
                        <span style='color:#fbbf24; font-size:1.1rem;'>${eber}</span>
                    </div>
                    <div style='text-align:right; margin-top:0.5rem;'>${labelText}</div>
                </div>
            </div>
        `;
    };

    if (isCompare) {
        renderSideBySide(container, data.lsb ? data.lsb.metrics : null, data.dct ? data.dct.metrics : null,
            (p, m) => renderContent(p, m, "LSB"), (p, m) => renderContent(p, m, "DCT"));
    } else {
        container.style.gridTemplateColumns = "1fr";
        renderContent(container, data.metrics);
    }
}

function renderDetectabilityTab(container, data, source) {
    const isCompare = source.toLowerCase().includes("compare") || source.toLowerCase().includes("comparison");
    const renderContent = (parent, m, label) => {
        console.log(`[DetectabilityTab Render] ${label || 'Metrics'}:`, m);
        if (!m) { parent.innerHTML += "<div style='color:var(--text-muted)'>Metric data unavailable</div>"; return; }
        const chi = (m.adv_detectability_chi !== undefined && typeof m.adv_detectability_chi === 'number') ? m.adv_detectability_chi.toExponential(2) : "N/A";
        const ent = (m.adv_detectability_entropy_diff !== undefined && typeof m.adv_detectability_entropy_diff === 'number') ? m.adv_detectability_entropy_diff.toFixed(6) : "N/A";
        const labelText = (m.adv_detectability_chi > 100 || Math.abs(m.adv_detectability_entropy_diff) > 0.05) ? "<span style='color:var(--red); font-weight:bold;'>ANOMALY</span>" : "<span style='color:var(--green); font-weight:bold;'>STEALTHY</span>";
        parent.innerHTML += `
            <div class='card' style='padding:1.25rem; background:rgba(255,255,255,0.02);'>
                <div style='text-align:center; margin-bottom:1rem;'>
                    <img src="${m.stego_thumb}" onclick="openImagePreview('${m.stego_full || m.stego_thumb}')" style='width:100%; max-width:280px; height:auto; border-radius:4px; border:1px solid rgba(255,255,255,0.1); cursor:pointer;'>
                    <div style='font-size:0.7rem; color:var(--text-muted); margin-top:0.4rem;'>Statistical Distribution (Grayscale)</div>
                </div>
                <div style='grid-template-columns:1fr; gap:0.5rem; display:grid; font-family:var(--font-mono);'>
                    <div style='background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:4px;'>
                        <div style='color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;'>Chi-Square</div>
                        <div style='color:#f472b6; font-size:1.1rem;'>${chi}</div>
                    </div>
                    <div style='background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:4px;'>
                        <div style='color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;'>Entropy Diff</div>
                        <div style='color:#a78bfa; font-size:1.1rem;'>${ent}</div>
                    </div>
                    <div style='text-align:center; padding-top:0.5rem;'>${labelText}</div>
                </div>
            </div>
        `;
    };

    if (isCompare) {
        renderSideBySide(container, data.lsb ? data.lsb.metrics : null, data.dct ? data.dct.metrics : null,
            (p, m) => renderContent(p, m, "LSB"), (p, m) => renderContent(p, m, "DCT"));
    } else {
        container.style.gridTemplateColumns = "1fr";
        renderContent(container, data.metrics);
    }
}

function downloadAnalysisReport(btn) {
    if (!currentActiveAnalysisData || !btn) return;
    showOutput(btn, "⏳ Generating...", false);
    const originalText = btn.innerHTML;

    fetch(API + "/stego/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentActiveAnalysisData)
    })
        .then(res => {
            if (!res.ok) throw new Error("Report generation failed");
            return res.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "stego_battle_report.pdf";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                btn.innerHTML = originalText;
                btn.classList.add("success");
            }, 1000);
        })
        .catch(err => {
            console.error(err);
            showOutput(btn, "❌ Error", true);
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        });
}

function renderOverallTab(container, data, source) {
    const isCompare = source.toLowerCase().includes("compare") || source.toLowerCase().includes("comparison");
    container.style.gridTemplateColumns = "1fr";
    if (!isCompare) {
        container.innerHTML = "<div style='text-align:center; padding:2rem; color:var(--text-muted); font-family:var(--font-pixel); font-size:1.2rem;'>Comparison Mode only.</div>";
        return;
    }

    const lm = data.lsb ? data.lsb.metrics : null;
    const dm = data.dct ? data.dct.metrics : null;
    if (!lm || !dm) {
        container.innerHTML = "<div style='color:var(--red)'>Error: Comparison metrics missing.</div>";
        return;
    }

    const getVal = (v, defaultVal) => isNaN(parseFloat(v)) ? defaultVal : parseFloat(v);
    const vVisual = getVal(lm.psnr, 0) > getVal(dm.psnr, 0) ? "LSB" : "DCT";
    const vComp = getVal(lm.adv_compress_cer, 1) < getVal(dm.adv_compress_cer, 1) ? "LSB" : "DCT";
    const vNoise = getVal(lm.adv_noise_cer, 1) < getVal(dm.adv_noise_cer, 1) ? "LSB" : "DCT";
    const vDetect = getVal(lm.adv_detectability_chi, 999) < getVal(dm.adv_detectability_chi, 999) ? "LSB" : "DCT";

    container.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
            <button id="download-report-btn" class="btn btn-primary" style="font-size: 0.8rem; padding: 0.6rem 1.2rem;">
              <span style="margin-right: 8px;">&#128196;</span> Download PDF Report
            </button>
        </div>
        <div class='card' style='padding:2rem; border-color:var(--accent); box-shadow:none; font-family:var(--font-main);'>
            <h3 style='text-align:center; margin-bottom:1.5rem; color:#fff; font-size:1.3rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:1rem;'>COMPREHENSIVE BATTLE REPORT</h3>
            <table style='width:100%; border-collapse:collapse; font-family:var(--font-mono);'>
                <thead>
                    <tr style='border-bottom:2px solid var(--accent);'>
                        <th style='text-align:left; padding:10px; color:var(--text-muted);'>MODULE</th>
                        <th style='padding:10px; color:#60a5fa;'>LSB</th>
                        <th style='padding:10px; color:#f87171;'>DCT</th>
                        <th style='padding:10px; color:var(--yellow);'>WINNER</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Visual: PSNR (Higher is better)</td>
                        <td style='text-align:center;'>${lm.psnr} dB</td>
                        <td style='text-align:center;'>${dm.psnr} dB</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${vVisual}</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Visual: MSE (Lower is better)</td>
                        <td style='text-align:center;'>${lm.mse}</td>
                        <td style='text-align:center;'>${dm.mse}</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${getVal(lm.mse, 999) < getVal(dm.mse, 999) ? "LSB" : "DCT"}</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Visual: SSIM (Higher is better)</td>
                        <td style='text-align:center;'>${lm.ssim}</td>
                        <td style='text-align:center;'>${dm.ssim}</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${getVal(lm.ssim, 0) > getVal(dm.ssim, 0) ? "LSB" : "DCT"}</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Visual: Payload Ratio (bpp)</td>
                        <td style='text-align:center;'>${lm.payload_ratio_bpp}</td>
                        <td style='text-align:center;'>${dm.payload_ratio_bpp}</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>--</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Robustness: Compression CER (Lower is better)</td>
                        <td style='text-align:center;'>${(lm.adv_compress_cer * 100).toFixed(2)}%</td>
                        <td style='text-align:center;'>${(dm.adv_compress_cer * 100).toFixed(2)}%</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${vComp}</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Robustness: Noise CER (Lower is better)</td>
                        <td style='text-align:center;'>${(lm.adv_noise_cer * 100).toFixed(2)}%</td>
                        <td style='text-align:center;'>${(dm.adv_noise_cer * 100).toFixed(2)}%</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${vNoise}</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Stealth: Chi-Square (Lower is better)</td>
                        <td style='text-align:center;'>${(typeof lm.adv_detectability_chi === 'number') ? lm.adv_detectability_chi.toExponential(1) : 'N/A'}</td>
                        <td style='text-align:center;'>${(typeof dm.adv_detectability_chi === 'number') ? dm.adv_detectability_chi.toExponential(1) : 'N/A'}</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${vDetect}</td>
                    </tr>
                    <tr style='border-bottom:1px solid rgba(255,255,255,0.05);'>
                        <td style='padding:12px;'>Stealth: Entropy Diff (Closer to 0 is better)</td>
                        <td style='text-align:center;'>${(typeof lm.adv_detectability_entropy_diff === 'number') ? lm.adv_detectability_entropy_diff.toFixed(4) : 'N/A'}</td>
                        <td style='text-align:center;'>${(typeof dm.adv_detectability_entropy_diff === 'number') ? dm.adv_detectability_entropy_diff.toFixed(4) : 'N/A'}</td>
                        <td style='text-align:center; font-weight:bold; color:var(--accent);'>${Math.abs(getVal(lm.adv_detectability_entropy_diff, 9)) < Math.abs(getVal(dm.adv_detectability_entropy_diff, 9)) ? "LSB" : "DCT"}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Re-bind the report button if it was just injected
    const reportBtn = document.getElementById("download-report-btn");
    if (reportBtn) {
        reportBtn.onclick = () => downloadAnalysisReport(reportBtn);
    }
}

// Granular DCT renderers
function renderJustFrequency(container, blocks) {
    if (!container || !blocks) return;
    container.style.display = "block";

    const tempId = "temp-freq-" + Math.random().toString(36).substr(2, 9);
    container.id = tempId;
    renderDctFrequencyChart(tempId, blocks);
}

function renderJustHeatmaps(container, blocks) {
    if (!container || !blocks) return;
    container.style.display = "grid";
    container.style.gridTemplateColumns = "1fr 1fr";
    container.style.gap = "1.5rem";

    blocks.forEach(b => {
        const wrap = document.createElement("div");
        const tid = "heatmap-" + b.block_idx + "-" + Math.random().toString(36).substr(2, 6);
        wrap.id = tid;
        container.appendChild(wrap);
        renderDctHeatmap(tid, b);
    });
}

export function initStegoTab() {
    const modal = document.getElementById("analysis-modal");
    const closeBtn = document.getElementById("analysis-modal-close");
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
            modal.classList.remove("is-visible");
        });
        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
                modal.classList.remove("is-visible");
            }
        });
    }

    // Advanced Buttons mapping
    stegoAdvBtn = document.getElementById("stego-advanced-btn");
    if (stegoAdvBtn) stegoAdvBtn.addEventListener("click", () => { if (lastStegoData) openAdvancedAnalysisModal(lastStegoData, "stego only"); });

    bothAdvBtn = document.getElementById("both-advanced-btn");
    if (bothAdvBtn) bothAdvBtn.addEventListener("click", () => { if (lastBothData) openAdvancedAnalysisModal(lastBothData, "both (aes + stego)"); });

    compareAdvBtn = document.getElementById("compare-advanced-btn");
    if (compareAdvBtn) compareAdvBtn.addEventListener("click", () => { if (lastCompareData) openAdvancedAnalysisModal(lastCompareData, "dual comparison"); });
}
// ----- Stego only -----
var stegoMessage = document.getElementById("stego-message");
var stegoCarrier = document.getElementById("stego-carrier");
var stegoHideBtn = document.getElementById("stego-hide-btn");
var stegoDownload = document.getElementById("stego-download");
var stegoExtractFile = document.getElementById("stego-extract-file");
var stegoExtractBtn = document.getElementById("stego-extract-btn");
var stegoExtractOut = document.getElementById("stego-extract-out");

if (stegoHideBtn) {
    stegoHideBtn.addEventListener("click", function () {
        var msg = (stegoMessage && stegoMessage.value) ? stegoMessage.value.trim() : "";
        if (!msg) { showOutput(stegoDownload, "Enter a message first.", true); return; }
        showOutput(stegoDownload, "Hiding…");
        var form = new FormData();
        form.append("message", msg);
        form.append("mode", "stego");
        var algoSelect = document.getElementById("stego-algorithm-select");
        form.append("algorithm", (algoSelect ? algoSelect.value : "lsb"));
        if (stegoCarrier && stegoCarrier.files && stegoCarrier.files[0]) {
            form.append("carrier", stegoCarrier.files[0]);
        }

        // Attack Sim flags
        var applyJpeg = document.getElementById("stego-apply-jpeg");
        var applyNoise = document.getElementById("stego-apply-noise");
        if (applyJpeg && applyJpeg.checked) form.append("apply_jpeg", "true");
        if (applyNoise && applyNoise.checked) form.append("apply_noise", "true");
        fetch(API + "/stego/hide", { method: "POST", body: form })
            .then(function (res) {
                return res.json().then(function (d) {
                    if (!res.ok) throw new Error(d.error || res.statusText);
                    return d;
                });
            })
            .then(function (data) {
                lastStegoData = data;
                if (stegoAdvBtn) stegoAdvBtn.style.display = "inline-block";

                var mime = data.mime_type || "image/png";
                var ext = data.extension || "png";
                fetch("data:" + mime + ";base64," + data.image_b64)
                    .then(res => res.blob())
                    .then(blob => {
                        var url = URL.createObjectURL(blob);
                        var a = document.createElement("a");
                        a.href = url;
                        a.download = "stego." + ext;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(function () { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 0);
                    });

                showOutput(stegoDownload, "Encrypted data in the image. Downloading image...");
            })
            .catch(function (err) { showOutput(stegoDownload, err.message || "Hide failed", true); });
    });
}

if (stegoExtractBtn) {
    stegoExtractBtn.addEventListener("click", function () {
        var file = stegoExtractFile && stegoExtractFile.files && stegoExtractFile.files[0];
        if (!file) { showOutput(stegoExtractOut, "Choose an image first.", true); return; }
        showOutput(stegoExtractOut, "Extracting…");
        var form = new FormData();
        form.append("stego_image", file);
        form.append("mode", "stego");
        var algoSelect = document.getElementById("stego-algorithm-select");
        form.append("algorithm", (algoSelect ? algoSelect.value : "lsb"));
        fetch(API + "/stego/extract", { method: "POST", body: form })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                showOutput(stegoExtractOut, data.message || "(empty)");
                // Show advanced button if extraction provided comparison data (optional, but we can save it)
                if (data.pixel_lsb_comparison || data.dct_frequency_comparison) {
                    lastStegoData = data;
                    if (stegoAdvBtn) stegoAdvBtn.style.display = "inline-block";
                }
            })
            .catch(function (err) { showOutput(stegoExtractOut, err.message || "Extract failed", true); });
    });
}

// ----- Both (AES + Stego) -----
var bothMessage = document.getElementById("both-message");
var bothCarrier = document.getElementById("both-carrier");
var bothHideBtn = document.getElementById("both-hide-btn");
var bothDownload = document.getElementById("both-download");
var bothExtractFile = document.getElementById("both-extract-file");
var bothExtractBtn = document.getElementById("both-extract-btn");
var bothExtractOut = document.getElementById("both-extract-out");

if (bothHideBtn) {
    bothHideBtn.addEventListener("click", function () {
        var msg = (bothMessage && bothMessage.value) ? bothMessage.value.trim() : "";
        if (!msg) { showOutput(bothDownload, "Enter a message first.", true); return; }
        showOutput(bothDownload, "Encrypting & hiding…");
        var form = new FormData();
        form.append("message", msg);
        form.append("mode", "both");
        var algoSelect = document.getElementById("both-algorithm-select");
        form.append("algorithm", (algoSelect ? algoSelect.value : "lsb"));
        if (bothCarrier && bothCarrier.files && bothCarrier.files[0]) {
            form.append("carrier", bothCarrier.files[0]);
        }

        // Attack Sim flags
        var applyJpeg = document.getElementById("both-apply-jpeg");
        var applyNoise = document.getElementById("both-apply-noise");
        if (applyJpeg && applyJpeg.checked) form.append("apply_jpeg", "true");
        if (applyNoise && applyNoise.checked) form.append("apply_noise", "true");
        fetch(API + "/stego/hide", { method: "POST", body: form })
            .then(function (res) {
                return res.json().then(function (d) {
                    if (!res.ok) throw new Error(d.error || res.statusText);
                    return d;
                });
            })
            .then(function (data) {
                lastBothData = data;
                if (bothAdvBtn) bothAdvBtn.style.display = "inline-block";

                var mime = data.mime_type || "image/png";
                var ext = data.extension || "png";
                fetch("data:" + mime + ";base64," + data.image_b64)
                    .then(res => res.blob())
                    .then(blob => {
                        var url = URL.createObjectURL(blob);
                        var a = document.createElement("a");
                        a.href = url;
                        a.download = "stego." + ext;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(function () { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 0);
                    });

                showOutput(bothDownload, "Encrypted data in the image. Downloading image...");
                var bAes = document.getElementById("both-aes-out"); if (bAes) { bAes.style.display = "block"; bAes.textContent = "AES ciphertext embedded in PNG. Use Extract & Decrypt below to recover."; bAes.className = "output-box success"; }

                // Cleanup download message after a few seconds
                setTimeout(() => {
                    if (bothDownload.innerHTML.includes("Downloading image")) {
                        bothDownload.innerHTML = "";
                        bothDownload.classList.remove("success");
                    }
                }, 3000);
            })
            .catch(function (err) { showOutput(bothDownload, err.message || "Hide failed", true); });
    });
}

if (bothExtractBtn) {
    bothExtractBtn.addEventListener("click", function () {
        var file = bothExtractFile && bothExtractFile.files && bothExtractFile.files[0];
        if (!file) { showOutput(bothExtractOut, "Choose an image first.", true); return; }
        showOutput(bothExtractOut, "Extracting & decrypting…");
        var form = new FormData();
        form.append("stego_image", file);
        form.append("mode", "both");
        var algoSelect = document.getElementById("both-algorithm-select");
        form.append("algorithm", (algoSelect ? algoSelect.value : "lsb"));
        fetch(API + "/stego/extract", { method: "POST", body: form })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                showOutput(bothExtractOut, data.message || "(empty)");
                var bAes2 = document.getElementById("both-aes-out"); if (bAes2 && data.cipher_b64) { bAes2.style.display = "block"; bAes2.textContent = "Cipher (b64): " + (data.cipher_b64.slice(0, 80)) + (data.cipher_b64.length > 80 ? "..." : ""); bAes2.className = "output-box success"; }
                if (data.pixel_lsb_comparison || data.dct_frequency_comparison) {
                    lastBothData = data;
                    if (bothAdvBtn) bothAdvBtn.style.display = "inline-block";
                }
            })
            .catch(function (err) { showOutput(bothExtractOut, err.message || "Extract failed", true); });
    });
}

// ----- Comparison tab -----
var compareBtn = document.getElementById("compare-run-btn");
var compareStatus = document.getElementById("compare-status");
if (compareBtn) {
    compareBtn.addEventListener("click", function () {
        var msg = document.getElementById("compare-message");
        var text = (msg && msg.value) ? msg.value.trim() : "";
        if (!text) { showOutput(compareStatus, "Enter a message first.", true); return; }
        showOutput(compareStatus, "Running LSB and DCT comparison…");
        var form = new FormData();
        form.append("message", text);
        var carrier = document.getElementById("compare-carrier");
        if (carrier && carrier.files && carrier.files[0]) form.append("carrier", carrier.files[0]);
        fetch(API + "/stego/compare", { method: "POST", body: form })
            .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error || res.statusText); return d; }); })
            .then(function (data) {
                showOutput(compareStatus, "Comparison complete!");
                lastCompareData = data;
                if (compareAdvBtn) compareAdvBtn.style.display = "inline-block";

                var out = document.getElementById("compare-results");
                if (!out) return;

                var lm = data.lsb && data.lsb.metrics;
                var dm = data.dct && data.dct.metrics;

                var html = "<div style='display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;'>";

                // LSB card summary
                html += "<div style='background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.3);border-radius:8px;padding:14px;'>";
                html += "<div style='font-weight:bold;color:#60a5fa;margin-bottom:8px;font-size:0.95rem;'>LSB Summary</div>";
                if (lm) {
                    html += "<div style='font-family:var(--font-mono);font-size:0.82rem;'>PSNR: " + lm.psnr + " dB | SSIM: " + lm.ssim + "</div>";
                } else { html += "<div style='color:#94a3b8;'>Unavailable</div>"; }
                html += "</div>";

                // DCT card summary
                html += "<div style='background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:14px;'>";
                html += "<div style='font-weight:bold;color:#f87171;margin-bottom:8px;font-size:0.95rem;'>DCT Summary</div>";
                if (dm) {
                    html += "<div style='font-family:var(--font-mono);font-size:0.82rem;'>PSNR: " + dm.psnr + " dB | SSIM: " + dm.ssim + "</div>";
                } else { html += "<div style='color:#94a3b8;'>Unavailable</div>"; }
                html += "</div></div>";

                // Winner summary
                if (lm && dm) {
                    var better = (parseFloat(lm.psnr) || 0) > (parseFloat(dm.psnr) || 0) ? "LSB" : "DCT";
                    html += "<div style='background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:8px;padding:12px;font-family:var(--font-mono);font-size:0.85rem;'>";
                    html += "<strong style='color:#d8b4fe;'>Verdict:</strong> <span style='color:#e2e8f0;'>" + better + " is visually cleaner. Click button below for deep spectral data.</span></div>";
                }

                out.innerHTML = html;
            })
            .catch(function (err) { showOutput(compareStatus, err.message || "Comparison failed", true); });
    });
}

// Global reset for stego UI elements when switching modes
window.resetStegoUI = function () {
    const outputs = [
        "stego-download", "stego-extract-out",
        "both-download", "both-extract-out", "both-aes-out",
        "compare-status", "compare-results"
    ];
    outputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = "";
            el.classList.remove("success", "error");
            if (id === "both-aes-out") el.style.display = "none";
        }
    });

    // Hide all analysis buttons
    const advButtons = ["stego-advanced-btn", "both-advanced-btn", "compare-advanced-btn"];
    advButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "none";
    });
};

// Also export renderLsbTable and renderDctFrequencyChart for use in chat logs if needed
export { renderLsbTable, renderDctFrequencyChart };

// --- Image Preview Logic ---
window.openImagePreview = function (src) {
    const modal = document.getElementById("image-preview-modal");
    const img = document.getElementById("image-preview-img");
    if (!modal || !img) return;
    img.src = src;
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("is-open"), 10);
};

document.addEventListener("DOMContentLoaded", () => {
    // Image Preview Modal Logic
    const previewModal = document.getElementById("image-preview-modal");
    const previewClose = document.getElementById("image-preview-close");
    if (previewClose) {
        previewClose.onclick = () => {
            if (previewModal) {
                previewModal.classList.remove("is-open");
                setTimeout(() => { previewModal.style.display = "none"; }, 250);
            }
        };
    }
    window.addEventListener("click", (e) => {
        if (e.target === previewModal) previewClose.click();
    });
});
