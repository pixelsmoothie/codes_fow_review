export function initTabs() {
    var tabLinks = Array.from(document.querySelectorAll(".tab-link"));
    var tabPanels = document.querySelectorAll(".tab-panel");

    tabLinks.forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (btn.classList.contains("is-active")) return;
            var targetId = btn.getAttribute("data-tab");
            var currentBtn = tabLinks.find(b => b.classList.contains("is-active"));
            var currentIndex = tabLinks.indexOf(currentBtn);
            var targetIndex = tabLinks.indexOf(btn);

            var direction = targetIndex > currentIndex ? "right" : "left";

            // Outgoing
            var currentPanel = document.querySelector(".tab-panel.is-active");
            if (currentPanel) {
                currentPanel.classList.remove("animate-in-left", "animate-in-right");
                currentPanel.classList.add(direction === "right" ? "animate-out-left" : "animate-out-right");
            }

            tabLinks.forEach(function (b) { b.classList.remove("is-active"); });
            btn.classList.add("is-active");

            setTimeout(function () {
                tabPanels.forEach(function (p) {
                    p.classList.remove("is-active", "animate-out-left", "animate-out-right", "animate-in-left", "animate-in-right");
                });

                var panel = document.getElementById("tab-" + targetId);
                if (panel) {
                    panel.classList.add("is-active");
                    panel.classList.add(direction === "right" ? "animate-in-right" : "animate-in-left");
                }
            }, 50);
        });
    });
}

export function showOutput(el, text, isError) {
    if (!el) return;
    el.innerHTML = text || "";
    el.classList.remove("success", "error");
    if (text) el.classList.add(isError ? "error" : "success");
}

export function initAnalyzeSelector() {
    var selBtns = Array.from(document.querySelectorAll(".analyze-sel-btn"));
    var panels = document.querySelectorAll(".analyze-panel");

    selBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (btn.classList.contains("is-active")) return;
            var targetId = btn.getAttribute("data-panel");
            var currentBtn = selBtns.find(b => b.classList.contains("is-active"));
            var currentIndex = selBtns.indexOf(currentBtn);
            var targetIndex = selBtns.indexOf(btn);

            var direction = targetIndex > currentIndex ? "right" : "left";

            var currentPanel = document.querySelector(".analyze-panel.is-active");
            if (currentPanel) {
                currentPanel.classList.remove("sub-animate-in-left", "sub-animate-in-right");
                currentPanel.classList.add(direction === "right" ? "sub-animate-out-left" : "sub-animate-out-right");
            }

            selBtns.forEach(function (b) { b.classList.remove("is-active"); });
            btn.classList.add("is-active");

            setTimeout(function () {
                panels.forEach(function (p) {
                    p.classList.remove("is-active", "sub-animate-out-left", "sub-animate-out-right", "sub-animate-in-left", "sub-animate-in-right");
                });

                var panel = document.getElementById(targetId);
                if (panel) {
                    panel.classList.add("is-active");
                    panel.classList.add(direction === "right" ? "sub-animate-in-right" : "sub-animate-in-left");
                }

                // Reset UI states when switching modes
                if (window.resetStegoUI) window.resetStegoUI();
            }, 120);
        });
    });
}
