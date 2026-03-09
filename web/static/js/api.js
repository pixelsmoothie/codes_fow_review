export const API = "/api";

export function getJson(url, options) {
  var token = localStorage.getItem("chat_token");
  // Merge headers: caller headers first, then auth on top so it can't be overridden
  var headers = Object.assign(
    { "Content-Type": "application/json" },
    (options && options.headers) || {},
    token ? { "Authorization": "Bearer " + token } : {}
  );

  return fetch(url, {
    cache: "no-store",
    ...options,
    headers: headers,  // AFTER ...options so caller can't accidentally stomp auth
  }).then(function (res) {
    var contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || res.statusText);
        return data;
      });
    } else {
      return res.text().then(function (text) {
        console.error("Non-JSON response received:", text);
        var extractTitle = text.match(/<title>(.*?)<\/title>/);
        var titleStr = extractTitle ? extractTitle[1] : "Server Error";
        throw new Error("Server returned HTML error: " + titleStr);
      });
    }
  });
}

export function getText(url) {
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error(res.statusText);
    return res.text();
  });
}