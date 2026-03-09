import { initTabs, initAnalyzeSelector } from "./ui.js";
import { initCryptoTab } from "./crypto.js";
import { initStegoTab } from "./stego.js";
import { initMlTab } from "./ml.js";
import { initChatTab } from "./chat.js";
import { initLogs } from "./logs.js";

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initAnalyzeSelector();
    initCryptoTab();
    initStegoTab();
    initMlTab();
    initChatTab();
    initLogs();
});
