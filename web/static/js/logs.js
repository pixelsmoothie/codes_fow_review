import { API, getJson } from "./api.js";

let activeLogsTab = "messages";
let cachedLogs = [];

export function initLogs() {
    const refreshBtn = document.getElementById("logs-refresh-btn");
    const tabBtns = document.querySelectorAll(".logs-tab-btn");
    const searchInput = document.getElementById("logs-client-filter");

    if (refreshBtn) {
        refreshBtn.onclick = () => fetchAndRenderLogs();
    }

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeLogsTab = btn.dataset.tab;
            renderLogContent();
        };
    });

    const modal = document.getElementById("logs-overlay");
    const closeBtn = document.getElementById("logs-close-btn");

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.remove("is-open");
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.remove("is-open");
        };
    }

    // Also handle opening the modal via the link
    const seeLogsLink = document.getElementById("see-logs-link");
    if (seeLogsLink) {
        seeLogsLink.onclick = (e) => {
            e.preventDefault();
            const modal = document.getElementById("logs-overlay");
            if (modal) {
                modal.classList.add("is-open");
                // Auto refresh on open
                fetchAndRenderLogs();
            }
        };
    }
}

async function fetchAndRenderLogs() {
    const area = document.getElementById("logs-content-area");
    const searchInput = document.getElementById("logs-client-filter");

    area.innerHTML = '<div style="text-align:center; padding:3rem;"><div class="ml-spinner"></div><div style="margin-top:1rem; font-family:var(--font-mono); color:var(--text-muted);">Fetching encrypted audit trails...</div></div>';

    // Get current client_id from localStorage if not provided in search
    let targetId = searchInput.value.trim();
    if (!targetId) {
        targetId = localStorage.getItem("chat_client_id");
    }

    if (!targetId) {
        area.innerHTML = '<div style="color:var(--red); text-align:center; padding:2rem;">Error: No Client ID identified. Please login or enter an ID manually.</div>';
        return;
    }

    try {
        const res = await getJson(`${API}/chat/logs?client_id=${encodeURIComponent(targetId)}&preview=1`);
        cachedLogs = res.logs || [];
        renderLogContent();
    } catch (err) {
        area.innerHTML = `<div style="color:var(--red); text-align:center; padding:2rem;">Failed to fetch logs: ${err.message}</div>`;
    }
}

function renderLogContent() {
    const area = document.getElementById("logs-content-area");
    if (!cachedLogs.length) {
        area.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:3rem; font-family:var(--font-mono);">No records found in the transformation bypass.</div>';
        return;
    }

    area.innerHTML = "";

    // Sort logs by newest first
    const sortedLogs = [...cachedLogs].reverse();

    sortedLogs.forEach(log => {
        const card = document.createElement("div");
        card.className = "log-card";

        const header = document.createElement("div");
        header.className = "log-card-header";

        const mode = log.mode ? log.mode.toUpperCase() : "SYNC";
        header.innerHTML = `
            <div class="log-card-participants">${log.from} <span>&rarr;</span> ${log.to}</div>
            <div class="log-card-mode">[${mode}]</div>
        `;

        const body = document.createElement("div");
        body.className = "log-card-body";

        // Display content based on tab
        if (activeLogsTab === "messages") {
            body.textContent = log.plaintext || log.plaintext_media || "(Internal Stream)";
        } else if (activeLogsTab === "dh") {
            if (log.dh_debug) {
                body.innerHTML = `
                    <div style="color:var(--yellow); margin-bottom:0.4rem;">Diffie-Hellman Exchange:</div>
                    <div style="font-size:0.8rem; opacity:0.8; margin-bottom:0.2rem;">Shared Secret (Derived):</div>
                    <div style="background:rgba(0,0,0,0.3); padding:0.5rem; word-break:break-all; margin-bottom:0.6rem; color:#60a5fa;">${log.dh_debug.shared_secret_hex}</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                        <div>
                            <div style="font-size:0.7rem; opacity:0.6;">Sender Pub:</div>
                            <div style="word-break:break-all; font-size:0.75rem;">${log.dh_debug.sender_pub.substring(0, 32)}...</div>
                        </div>
                        <div>
                            <div style="font-size:0.7rem; opacity:0.6;">Recipient Pub:</div>
                            <div style="word-break:break-all; font-size:0.75rem;">${log.dh_debug.recipient_pub.substring(0, 32)}...</div>
                        </div>
                    </div>
                `;
            } else {
                body.innerHTML = "<div style='color:var(--text-muted); font-size:0.85rem;'>No DH parameters logged for this frame.</div>";
            }
        } else if (activeLogsTab === "encryption") {
            if (log.cipher_hex) {
                body.innerHTML = `
                    <div style="color:var(--accent); margin-bottom:0.4rem;">AES-256-CBC Ciphertext:</div>
                    <div style="background:rgba(0,0,0,0.4); padding:0.8rem; font-family:var(--font-mono); font-size:0.8rem; border-left:2px solid var(--accent); color:#fff; word-break:break-all;">
                        ${log.cipher_hex}
                    </div>
                    <div style="margin-top:0.6rem; font-size:0.75rem; color:var(--text-muted);">Payload size: ${Math.round(log.cipher_hex.length / 2)} bytes</div>
                `;
            } else {
                body.innerHTML = "<div style='color:var(--text-muted); font-size:0.85rem;'>Message was not encrypted (Transparent mode).</div>";
            }
        } else if (activeLogsTab === "stego") {
            if (log.stego_b64) {
                body.innerHTML = `
                    <div style="color:var(--red); margin-bottom:0.4rem;">Steganographic Carrier:</div>
                    <div style="display:flex; gap:1rem; align-items:flex-start;">
                        <div style="width:100px; height:100px; background:rgba(255,255,255,0.05); border:1px solid var(--accent); border-radius:4px; overflow:hidden;">
                            <img src="data:image/png;base64,${log.stego_b64}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div style="flex:1; font-size:0.85rem; color:var(--text-muted);">
                            <div>Protocol: <span style="color:#fff;">${log.algorithm || "LSB"}</span></div>
                            <div style="margin-top:0.3rem;">Container: PNG Image</div>
                            <div style="margin-top:0.3rem;">Capacity used: 100%</div>
                        </div>
                    </div>
                `;
            } else {
                body.innerHTML = "<div style='color:var(--text-muted); font-size:0.85rem;'>No steganographic encoding was performed.</div>";
            }
        } else if (activeLogsTab === "system") {
            body.innerHTML = `
                <div style="opacity:0.8;">
                    <div style="color:var(--green); font-size:0.8rem; margin-bottom:0.4rem;">FRAME METADATA:</div>
                    <div style="display:grid; grid-template-columns:100px 1fr; gap:0.4rem; font-size:0.8rem; font-family:var(--font-mono);">
                        <span style="opacity:0.6;">timestamp:</span> <span style="color:var(--yellow);">${log.timestamp}</span>
                        <span style="opacity:0.6;">from_uid:</span> <span style="color:#60a5fa;">${log.from_uid || "NONE"}</span>
                        <span style="opacity:0.6;">to_uid:</span> <span style="color:#60a5fa;">${log.to_uid || "NONE"}</span>
                        <span style="opacity:0.6;">direction:</span> <span style="color:#fff;">${log.direction}</span>
                    </div>
                </div>
            `;
        }

        card.appendChild(header);
        card.appendChild(body);
        area.appendChild(card);
    });
}
