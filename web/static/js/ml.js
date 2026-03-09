import { API, getJson } from "./api.js";

function drawTrafficCanvas(data) {
    var trafficCanvas = document.getElementById("traffic-canvas");
    var trafficCtx = trafficCanvas ? trafficCanvas.getContext("2d") : null;
    // Use window to keep history persisting across module loads or route changes
    window.__trafficHistory = window.__trafficHistory || [];

    if (!trafficCtx || !trafficCanvas) return;
    var w = trafficCanvas.offsetWidth || 800;
    var h = trafficCanvas.height;
    trafficCanvas.width = w;

    var ctx = trafficCtx;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = "rgba(168,85,247,0.06)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx < w; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (var gy = 0; gy < h; gy += 20) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // Add current packet count to history
    var count = (data && data.features) ? (data.features.packet_count || 0) : 0;
    window.__trafficHistory.push(count);
    if (window.__trafficHistory.length > 60) window.__trafficHistory.shift();

    if (window.__trafficHistory.length < 2) return;
    var maxVal = Math.max.apply(null, window.__trafficHistory) || 1;
    var isAnomaly = data && data.anomaly;

    // Draw sparkline
    var baseColor = isAnomaly ? "#f87171" : "#a855f7";
    var fillColor = isAnomaly ? "rgba(248,113,113,0.15)" : "rgba(168,85,247,0.12)";

    ctx.beginPath();
    ctx.moveTo(0, h);
    window.__trafficHistory.forEach(function (val, i) {
        var x = (i / (window.__trafficHistory.length - 1)) * w;
        var y = h - (val / maxVal) * (h - 8) - 4;
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    window.__trafficHistory.forEach(function (val, i) {
        var x = (i / (window.__trafficHistory.length - 1)) * w;
        var y = h - (val / maxVal) * (h - 8) - 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pixel dots at data points
    ctx.fillStyle = baseColor;
    window.__trafficHistory.forEach(function (val, i) {
        var x = (i / (window.__trafficHistory.length - 1)) * w;
        var y = h - (val / maxVal) * (h - 8) - 4;
        ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    });

    // Anomaly warning overlay
    if (isAnomaly) {
        ctx.fillStyle = "rgba(248,113,113,0.08)";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(248,113,113,0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.setLineDash([]);
    }
}

function updateTrafficUI(raw) {
    var wa = (raw && raw.window_analysis) || {};
    var features = wa.features || (raw && raw.features) || {};
    var isAnom = !!(raw && raw.anomaly_detected) || !!wa.anomaly;
    var alerts = wa.alerts || (raw && raw.alerts) || [];
    var connStats = (raw && raw.connection_stats) || [];

    var statPackets = document.getElementById("stat-packets");
    var statAnomaly = document.getElementById("stat-anomaly");
    var statAlerts = document.getElementById("stat-alerts");
    var statIps = document.getElementById("stat-ips");

    if (statPackets) statPackets.textContent = (raw && raw.total_packets != null) ? raw.total_packets : (features.packet_count || "—");
    if (statAnomaly) {
        statAnomaly.textContent = isAnom ? "⚠ ANOMALY" : "✓ NORMAL";
        statAnomaly.style.color = isAnom ? "#f87171" : "#4ade80";
    }
    if (statAlerts) statAlerts.textContent = alerts.length || "0";
    if (statIps) statIps.textContent = (features.unique_src_ips != null) ? features.unique_src_ips : "—";

    var alertBox = document.getElementById("traffic-alert-log");
    if (alertBox) {
        if (!alerts.length) {
            alertBox.innerHTML = '<div class="ml-alert-empty">No anomalies detected. Traffic is normal.</div>';
        } else {
            alertBox.innerHTML = "";
            alerts.forEach(function (alert) {
                var item = document.createElement("div");
                item.className = "ml-alert-item";
                var sev = (alert.severity || "").toUpperCase();
                var type = (alert.type || "").replace(/_/g, " ").toUpperCase();
                var val = (alert.value != null) ? " — " + (typeof alert.value === "number" ? alert.value.toFixed(1) : alert.value) : "";
                var sc = (alert.anomaly_score != null) ? " — score: " + alert.anomaly_score.toFixed(3) : "";
                item.textContent = "⚠ [" + sev + "] " + type + val + sc;
                alertBox.appendChild(item);
            });
        }
    }

    var connWrap = document.getElementById("traffic-connections");
    if (connWrap) {
        if (!connStats.length) {
            connWrap.innerHTML = '<div class="ml-alert-empty">No connection data yet. Send chat messages or simulate an attack.</div>';
        } else {
            var tbl = document.createElement("table");
            tbl.className = "ml-conn-table";
            tbl.innerHTML = '<thead><tr><th>Src IP</th><th>Dst IP</th><th>Pkts</th><th>Bytes</th><th>Ports</th></tr></thead>';
            var tbody = document.createElement("tbody");
            connStats.forEach(function (conn) {
                var row = document.createElement("tr");
                var ports = Array.isArray(conn.ports) ? conn.ports.slice(0, 5).join(", ") : (conn.unique_ports || "—");
                row.innerHTML = "<td>" + (conn.src_ip || "—") + "</td><td>" + (conn.dst_ip || "—") + "</td>" +
                    "<td>" + (conn.packet_count || conn.count || "—") + "</td>" +
                    "<td>" + (conn.total_bytes != null ? conn.total_bytes.toLocaleString() : "—") + "</td>" +
                    "<td style=\"font-size:0.75rem\">" + ports + "</td>";
                tbody.appendChild(row);
            });
            tbl.appendChild(tbody);
            connWrap.innerHTML = "";
            connWrap.appendChild(tbl);
        }
    }

    drawTrafficCanvas({ features: features, anomaly: isAnom });
}

function fetchTraffic(simulate) {
    var alertBox = document.getElementById("traffic-alert-log");
    var url = API + "/ml/traffic" + (simulate ? "?simulate=" + encodeURIComponent(simulate) : "");
    return fetch(url)
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
            if (!r.ok || r.data.error) {
                if (alertBox) alertBox.innerHTML = '<div class="ml-alert-item">⚠ Error: ' + (r.data.error || "Traffic endpoint failed") + '</div>';
                return;
            }
            updateTrafficUI(r.data);
        })
        .catch(function (err) {
            if (alertBox) alertBox.innerHTML = '<div class="ml-alert-item">⚠ ' + (err.message || "Request failed") + '</div>';
        });
}

function runSteganalysis(file) {
    var results = document.getElementById("steg-results");
    var loading = document.getElementById("steg-loading");
    var errorEl = document.getElementById("steg-error");
    var uploadZ = document.getElementById("steg-upload-zone");

    if (results) results.style.display = "none";
    if (errorEl) errorEl.style.display = "none";
    if (loading) loading.style.display = "flex";
    if (uploadZ) uploadZ.style.opacity = "0.4";

    var form = new FormData();
    form.append("image", file);

    fetch(API + "/ml/rs-analysis", { method: "POST", body: form })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
            if (loading) loading.style.display = "none";
            if (uploadZ) uploadZ.style.opacity = "1";

            if (!r.ok || r.data.error) {
                if (errorEl) { errorEl.textContent = "Error: " + (r.data.error || "RS analysis failed"); errorEl.style.display = "block"; }
                return;
            }

            var d = r.data;
            var hasHidden = d.hidden_data;

            // Verdict banner
            var banner = document.getElementById("steg-verdict-banner");
            var iconEl = document.getElementById("steg-verdict-icon");
            var textEl = document.getElementById("steg-verdict-text");
            var confEl = document.getElementById("steg-verdict-conf");

            if (banner) {
                banner.classList.remove("is-hidden", "is-clean", "is-tampered");
                banner.classList.add(hasHidden ? "is-hidden" : "is-clean");
            }
            if (iconEl) iconEl.textContent = hasHidden ? "⚠" : "✓";
            if (textEl) {
                textEl.textContent = d.verdict || (hasHidden ? "HIDDEN DATA DETECTED" : "CLEAN");
                textEl.style.color = hasHidden ? "#f87171" : "#4ade80";
            }
            if (confEl) confEl.textContent = "Confidence: " + (d.confidence || 0) + "% — avg hidden ratio: " + (d.avg_hidden_ratio || 0);

            // RS grid
            var grid = document.getElementById("steg-rs-grid");
            if (grid && d.channels) {
                grid.innerHTML = "";
                ["r", "g", "b"].forEach(function (ch) {
                    var stats = d.channels[ch];
                    if (!stats) return;
                    var card = document.createElement("div");
                    card.className = "ml-rs-channel " + ch;
                    var label = document.createElement("div");
                    label.className = "ml-rs-channel-name";
                    label.textContent = { r: "Red Channel", g: "Green Channel", b: "Blue Channel" }[ch];
                    card.appendChild(label);

                    [["Rm (regular+)", stats.rm], ["Sm (singular+)", stats.sm],
                    ["Rm- (regular-)", stats.rm_neg], ["Sm- (singular-)", stats.sm_neg],
                    ["Hidden ratio", stats.hidden_ratio]].forEach(function (pair) {
                        var row = document.createElement("div");
                        row.className = "ml-rs-row";
                        row.innerHTML = pair[0] + ": <span>" + pair[1] + "</span>";
                        card.appendChild(row);
                    });
                    grid.appendChild(card);
                });
            }

            // LSB chart
            var lsbChart = document.getElementById("steg-lsb-chart");
            if (lsbChart && d.lsb_distribution) {
                lsbChart.innerHTML = "";
                ["r", "g", "b"].forEach(function (ch) {
                    var arr = d.lsb_distribution[ch];
                    if (!arr) return;
                    var zeros = arr[0], ones = arr[1], total = zeros + ones || 1;
                    var zeropct = (zeros / total * 100).toFixed(1);
                    var onespct = (ones / total * 100).toFixed(1);

                    var row = document.createElement("div");
                    row.className = "ml-lsb-channel";

                    var lbl = document.createElement("div");
                    lbl.className = "ml-lsb-label " + ch;
                    lbl.textContent = ch.toUpperCase();

                    var barWrap = document.createElement("div");
                    barWrap.className = "ml-lsb-bar-wrap";

                    var zeroBar = document.createElement("div");
                    zeroBar.className = "ml-lsb-zeros";
                    zeroBar.style.width = zeropct + "%";
                    zeroBar.title = "0s: " + zeros;

                    var oneBar = document.createElement("div");
                    oneBar.className = "ml-lsb-ones";
                    oneBar.style.width = onespct + "%";
                    oneBar.title = "1s: " + ones;

                    barWrap.appendChild(zeroBar);
                    barWrap.appendChild(oneBar);

                    var nums = document.createElement("div");
                    nums.className = "ml-lsb-nums";
                    nums.textContent = "0s:" + zeros + " 1s:" + ones;

                    row.appendChild(lbl);
                    row.appendChild(barWrap);
                    row.appendChild(nums);
                    lsbChart.appendChild(row);
                });
            }

            if (results) results.style.display = "block";
        })
        .catch(function (err) {
            if (loading) loading.style.display = "none";
            if (uploadZ) uploadZ.style.opacity = "1";
            if (errorEl) { errorEl.textContent = "Error: " + (err.message || "Request failed"); errorEl.style.display = "block"; }
        });
}

function runTampering(file) {
    var results = document.getElementById("tamp-results");
    var loading = document.getElementById("tamp-loading");
    var errorEl = document.getElementById("tamp-error");
    var uploadZ = document.getElementById("tamp-upload-zone");

    if (results) results.style.display = "none";
    if (errorEl) errorEl.style.display = "none";
    if (loading) loading.style.display = "flex";
    if (uploadZ) uploadZ.style.opacity = "0.4";

    var form = new FormData();
    form.append("image", file);

    fetch(API + "/ml/tampering", { method: "POST", body: form })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
            if (loading) loading.style.display = "none";
            if (uploadZ) uploadZ.style.opacity = "1";

            if (!r.ok || r.data.error) {
                if (errorEl) { errorEl.textContent = "Error: " + (r.data.error || "Tampering endpoint failed"); errorEl.style.display = "block"; }
                return;
            }

            var d = r.data;
            var isTampered = d.tampered;

            // Verdict banner
            var banner = document.getElementById("tamp-verdict-banner");
            var iconEl = document.getElementById("tamp-verdict-icon");
            var textEl = document.getElementById("tamp-verdict-text");
            var confEl = document.getElementById("tamp-verdict-conf");

            if (banner) {
                banner.classList.remove("is-tampered", "is-clean");
                banner.classList.add(isTampered ? "is-tampered" : "is-clean");
            }
            if (iconEl) iconEl.textContent = isTampered ? "⚠" : "✓";
            if (textEl) {
                textEl.textContent = d.verdict || (isTampered ? "TAMPERED" : "AUTHENTIC");
                textEl.style.color = isTampered ? "#f87171" : "#4ade80";
            }
            if (confEl) confEl.textContent = "ELA SVM confidence: " + (d.confidence || 0) + "% — trained on CASIA2 (86% accuracy)";

            // ELA feature cards
            var meanEl = document.getElementById("tamp-mean-ela");
            var maxEl = document.getElementById("tamp-max-ela");
            var stdEl = document.getElementById("tamp-std-ela");
            if (d.features) {
                if (meanEl) meanEl.textContent = d.features.mean_ela != null ? d.features.mean_ela : "—";
                if (maxEl) maxEl.textContent = d.features.max_ela != null ? d.features.max_ela : "—";
                if (stdEl) stdEl.textContent = d.features.std_ela != null ? d.features.std_ela : "—";
            }

            // Images
            var origImg = document.getElementById("tamp-original-img");
            var heatImg = document.getElementById("tamp-heatmap-img");
            if (origImg && d.original_b64) { origImg.src = "data:image/png;base64," + d.original_b64; }
            if (heatImg && d.heatmap_b64) { heatImg.src = "data:image/png;base64," + d.heatmap_b64; }

            if (results) results.style.display = "block";
        })
        .catch(function (err) {
            if (loading) loading.style.display = "none";
            if (uploadZ) uploadZ.style.opacity = "1";
            if (errorEl) { errorEl.textContent = "Error: " + (err.message || "Request failed"); errorEl.style.display = "block"; }
        });
}

export function initMlTab() {
    // ML sub-tabs
    var btns = Array.from(document.querySelectorAll(".ml-subtab-btn"));
    var panels = document.querySelectorAll(".ml-panel");

    btns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (btn.classList.contains("is-active")) return;
            var targetId = btn.getAttribute("data-mltab");
            var currentBtn = btns.find(b => b.classList.contains("is-active"));
            var currentIndex = btns.indexOf(currentBtn);
            var targetIndex = btns.indexOf(btn);

            var direction = targetIndex > currentIndex ? "right" : "left";

            var currentPanel = document.querySelector(".ml-panel.is-active");
            if (currentPanel) {
                currentPanel.classList.remove("sub-animate-in-left", "sub-animate-in-right");
                currentPanel.classList.add(direction === "right" ? "sub-animate-out-left" : "sub-animate-out-right");
            }

            btns.forEach(function (b) { b.classList.remove("is-active"); });
            btn.classList.add("is-active");

            setTimeout(function () {
                panels.forEach(function (p) {
                    p.classList.remove("is-active", "sub-animate-out-left", "sub-animate-out-right", "sub-animate-in-left", "sub-animate-in-right");
                });

                var panel = document.getElementById("ml-panel-" + targetId);
                if (panel) {
                    panel.classList.add("is-active");
                    panel.classList.add(direction === "right" ? "sub-animate-in-right" : "sub-animate-in-left");
                }
            }, 120);
        });
    });

    // Traffic
    var trafficRefreshBtn = document.getElementById("traffic-refresh-btn");
    var trafficResetBtn = document.getElementById("traffic-reset-btn");

    if (trafficRefreshBtn) {
        trafficRefreshBtn.addEventListener("click", function () { fetchTraffic(); });
    }

    if (trafficResetBtn) {
        trafficResetBtn.addEventListener("click", function () {
            window.__trafficHistory = [];
            fetchTraffic("reset");
        });
    }

    document.querySelectorAll(".ml-btn-attack").forEach(function (btn) {
        btn.addEventListener("click", function () {
            fetchTraffic(btn.getAttribute("data-attack"));
        });
    });

    var trafficPollInterval = null;
    document.querySelectorAll(".tab-link").forEach(function (link) {
        link.addEventListener("click", function () {
            var tab = link.getAttribute("data-tab");
            if (tab === "ml") {
                fetchTraffic();
                if (!trafficPollInterval) {
                    trafficPollInterval = setInterval(function () { fetchTraffic(); }, 5000);
                }
            } else {
                if (trafficPollInterval) { clearInterval(trafficPollInterval); trafficPollInterval = null; }
            }
        });
    });

    // Steganalysis
    var stegFileInput = document.getElementById("steg-file-input");
    if (stegFileInput) {
        stegFileInput.addEventListener("change", function () {
            if (stegFileInput.files && stegFileInput.files[0]) runSteganalysis(stegFileInput.files[0]);
        });
    }

    var stegZone = document.getElementById("steg-upload-zone");
    if (stegZone) {
        stegZone.addEventListener("dragover", function (e) { e.preventDefault(); stegZone.style.borderColor = "var(--accent)"; });
        stegZone.addEventListener("dragleave", function () { stegZone.style.borderColor = ""; });
        stegZone.addEventListener("drop", function (e) {
            e.preventDefault();
            stegZone.style.borderColor = "";
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) runSteganalysis(file);
        });
    }

    // Tampering
    var tampFileInput = document.getElementById("tamp-file-input");
    if (tampFileInput) {
        tampFileInput.addEventListener("change", function () {
            if (tampFileInput.files && tampFileInput.files[0]) runTampering(tampFileInput.files[0]);
        });
    }

    var tampZone = document.getElementById("tamp-upload-zone");
    if (tampZone) {
        tampZone.addEventListener("dragover", function (e) { e.preventDefault(); tampZone.style.borderColor = "var(--accent)"; });
        tampZone.addEventListener("dragleave", function () { tampZone.style.borderColor = ""; });
        tampZone.addEventListener("drop", function (e) {
            e.preventDefault();
            tampZone.style.borderColor = "";
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) runTampering(file);
        });
    }

    // ─── NEW: ML Robustness & Metrics ───
    const applyParamsBtn = document.getElementById('ml-apply-params-btn');
    const paramContam = document.getElementById('param-contam');
    const paramNest = document.getElementById('param-nest');
    const pcapUploadZone = document.getElementById('pcap-upload-zone');
    const pcapFileInput = document.getElementById('pcap-file-input');

    function showToast(msg, isError) {
        const t = document.getElementById("req-toast");
        if (!t) { alert(msg); return; }
        t.textContent = msg;
        t.style.display = "block";
        t.style.borderColor = isError ? "var(--red)" : "var(--accent)";
        t.style.color = isError ? "var(--red)" : "var(--text)";
        setTimeout(() => { t.style.display = "none"; }, 3000);
    }

    if (paramContam) {
        paramContam.addEventListener('input', e => {
            document.getElementById('param-contam-val').textContent = e.target.value;
        });
    }
    if (paramNest) {
        paramNest.addEventListener('input', e => {
            document.getElementById('param-nest-val').textContent = e.target.value;
        });
    }

    async function loadMLMetrics() {
        try {
            const data = await getJson('/api/ml/params');
            if (data.params) {
                if (paramContam) paramContam.value = data.params.contamination;
                if (paramNest) paramNest.value = data.params.n_estimators;
                const cVal = document.getElementById('param-contam-val');
                const nVal = document.getElementById('param-nest-val');
                if (cVal) cVal.textContent = data.params.contamination;
                if (nVal) nVal.textContent = data.params.n_estimators;
            }
            if (data.confusion_matrix) renderConfusionMatrix(data.confusion_matrix);
            if (data.roc_curve) renderROCCurve(data.roc_curve);
        } catch (err) {
            console.error("Failed to load ML metrics:", err);
        }
    }

    if (applyParamsBtn) {
        applyParamsBtn.addEventListener('click', async () => {
            const contam = parseFloat(paramContam.value);
            const nest = parseInt(paramNest.value);
            applyParamsBtn.disabled = true;
            applyParamsBtn.textContent = "Retraining...";
            try {
                await fetch('/api/ml/params', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contamination: contam, n_estimators: nest })
                });
                showToast("Model retrained with new parameters", false);
                loadMLMetrics();
            } catch (err) {
                showToast("Failed to update parameters", true);
            } finally {
                applyParamsBtn.disabled = false;
                applyParamsBtn.textContent = "Apply & Retrain";
            }
        });
    }

    function renderConfusionMatrix(cm) {
        const container = document.getElementById('ml-confusion-matrix');
        if (!container) return;
        container.innerHTML = `
            <table class="ml-cm-table">
                <tr>
                    <td class="ml-cm-label">True Pos</td>
                    <td class="ml-cm-label">False Pos</td>
                </tr>
                <tr>
                    <td class="ml-cm-cell-tp"><span class="ml-cm-val">${cm.tp}</span></td>
                    <td class="ml-cm-cell-fp"><span class="ml-cm-val">${cm.fp}</span></td>
                </tr>
                <tr>
                    <td class="ml-cm-label">False Neg</td>
                    <td class="ml-cm-label">True Neg</td>
                </tr>
                <tr>
                    <td class="ml-cm-cell-fn"><span class="ml-cm-val">${cm.fn}</span></td>
                    <td class="ml-cm-cell-tn"><span class="ml-cm-val">${cm.tn}</span></td>
                </tr>
            </table>
        `;
    }

    function renderROCCurve(roc) {
        const canvas = document.getElementById('roc-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.moveTo(25, 10); ctx.lineTo(25, h - 25); ctx.lineTo(w - 10, h - 25); ctx.stroke();

        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(25, h - 25); ctx.lineTo(w - 10, 10); ctx.stroke();
        ctx.setLineDash([]);

        if (roc.fpr && roc.tpr) {
            ctx.strokeStyle = 'var(--accent)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            roc.fpr.forEach((f, i) => {
                const x = 25 + f * (w - 35);
                const y = (h - 25) - roc.tpr[i] * (h - 35);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
    }

    if (pcapUploadZone) {
        pcapUploadZone.addEventListener('click', () => pcapFileInput.click());
        if (pcapFileInput) {
            pcapFileInput.addEventListener('change', async e => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('file', file);

                const statusBox = document.getElementById('pcap-status');
                if (statusBox) {
                    statusBox.textContent = "Analyzing " + file.name + "...";
                    statusBox.style.color = "var(--accent)";
                }

                try {
                    const res = await fetch('/api/ml/pcap', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.error) {
                        if (statusBox) statusBox.textContent = "Error: " + data.error;
                        showToast(data.error, true);
                    } else {
                        if (statusBox) {
                            statusBox.textContent = `Done: ${data.total_packets} pkts, ${data.anomaly_detected ? 'ANOMALY' : 'Clean'}`;
                            statusBox.style.color = data.anomaly_detected ? "var(--red)" : "#4ade80";
                        }
                        if (data.anomaly_detected) showToast("Anomaly detected in PCAP!", true);
                        else showToast("PCAP analysis complete: Clean", false);
                    }
                } catch (err) {
                    if (statusBox) statusBox.textContent = "Upload failed.";
                    showToast("PCAP upload failed", true);
                }
            });
        }
    }

    loadMLMetrics();
}
