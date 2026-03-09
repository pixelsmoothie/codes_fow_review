import { API, getJson } from "./api.js";
import { showOutput } from "./ui.js";

export function initCryptoTab() {
    var aesMessage = document.getElementById("aes-message");
    var aesEncryptBtn = document.getElementById("aes-encrypt-btn");
    var aesCipherOut = document.getElementById("aes-cipher-out");
    var aesCipher = document.getElementById("aes-cipher");
    var aesDecryptBtn = document.getElementById("aes-decrypt-btn");
    var aesMessageOut = document.getElementById("aes-message-out");

    if (aesEncryptBtn) {
        aesEncryptBtn.addEventListener("click", function () {
            var msg = (aesMessage && aesMessage.value) ? aesMessage.value.trim() : "";
            if (!msg) { showOutput(aesCipherOut, "Enter a message first.", true); return; }
            showOutput(aesCipherOut, "Encrypting…");
            getJson(API + "/aes/encrypt", { method: "POST", body: JSON.stringify({ message: msg }) })
                .then(function (data) {
                    showOutput(aesCipherOut, data.cipher_b64 || "");
                    if (aesCipher) aesCipher.value = data.cipher_b64 || "";
                })
                .catch(function (err) { showOutput(aesCipherOut, err.message || "Encrypt failed", true); });
        });
    }

    if (aesDecryptBtn) {
        aesDecryptBtn.addEventListener("click", function () {
            var b64 = (aesCipher && aesCipher.value) ? aesCipher.value.trim() : "";
            if (!b64) { showOutput(aesMessageOut, "Paste cipher (base64) first.", true); return; }
            showOutput(aesMessageOut, "Decrypting…");
            getJson(API + "/aes/decrypt", { method: "POST", body: JSON.stringify({ cipher_b64: b64 }) })
                .then(function (data) { showOutput(aesMessageOut, data.message || ""); })
                .catch(function (err) { showOutput(aesMessageOut, err.message || "Decrypt failed", true); });
        });
    }
}