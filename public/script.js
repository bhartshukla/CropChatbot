// ChatGPT-like behavior: send/stop toggle, streaming reveal, voice input, history
const API_URL = "http://localhost:3000/api/farming"; // change if needed

let streamingController = { active: false };
let recognition = null;
let chatHistory = []; // local session history

// quick helper to create DOM nodes
function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

// add message to chat
function addMessage(text, who = "bot") {
  const box = document.getElementById("chat-box");
  const row = el("div", "msg-row");
  const bubble = el("div", who === "user" ? "user-msg" : "bot-msg", escapeHtml(text));
  row.appendChild(bubble);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

// Adds raw HTML content (for formatted bot messages) - used internally by streaming
function addBotElement(elm) {
  const box = document.getElementById("chat-box");
  box.appendChild(elm);
  box.scrollTop = box.scrollHeight;
}

// escape HTML utility
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

// send message handler
async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text || streamingController.active) return;

  // save to local history and sidebar
  chatHistory.push({ role: "user", text });
  renderHistory();

  addMessage(text, "user");
  input.value = "";
  input.style.height = ""; // reset

  // prepare UI: disable input, show stop
  toggleInput(true);
  streamingController.active = true;

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!resp.ok) throw new Error(`Server ${resp.status}`);

    const data = await resp.json();
    const reply = data?.reply ?? "I could not generate a response. Please try again.";

    // add streaming container
    const botDiv = el("div", "bot-msg");
    botDiv.innerHTML = ""; // will fill gradually
    addBotElement(botDiv);

    await streamReveal(botDiv, reply);

    // save bot reply to history
    chatHistory.push({ role: "bot", text: reply });
    renderHistory();

  } catch (err) {
    console.error("Send error:", err);
    addMessage("⚠️ Server connection error. Try again later.", "bot");
  }

  streamingController.active = false;
  toggleInput(false);
}

// Stream reveal: prints text char-by-char; stops if controller.active false
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function streamReveal(domNode, text) {
  let out = "";
  const chunkDelay = 15; // ms per char, adjust for speed
  for (let i = 0; i < text.length; i++) {
    if (!streamingController.active) break;
    out += text[i];
    domNode.innerHTML = out.replace(/\n/g, "<br>");
    domNode.parentElement.scrollTop = domNode.parentElement.scrollHeight;
    await sleep(chunkDelay);
  }
  // if stopped early, append notice
  if (!streamingController.active) {
    domNode.innerHTML += "<br><em style='color:#999;font-size:13px;'> — response stopped</em>";
  }
}

// toggle input / buttons
function toggleInput(disable) {
  document.getElementById("user-input").disabled = disable;
  document.getElementById("mic-btn").disabled = disable;
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (disable) {
    sendBtn.style.display = "none";
    stopBtn.style.display = "inline-flex";
  } else {
    sendBtn.style.display = "inline-flex";
    stopBtn.style.display = "none";
  }
}

// Stop button handler
document.getElementById("stop-btn").addEventListener("click", () => {
  streamingController.active = false;
  toggleInput(false);
});

// Send button
document.getElementById("send-btn").addEventListener("click", sendMessage);

// Enter behavior (Enter = send, Shift+Enter = newline)
const textarea = document.getElementById("user-input");
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// auto-resize textarea
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
});

// quick example buttons
window.quickQuestion = (q) => {
  document.getElementById("user-input").value = q;
  document.getElementById("user-input").focus();
  sendMessage();
};

// voice input setup
document.getElementById("mic-btn").addEventListener("click", () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("Speech recognition not supported in this browser.");
    return;
  }
  if (!recognition) initRecognition();
  if (recognition.listening) {
    recognition.stop();
  } else {
    recognition.lang = "hi-IN";
    recognition.start();
  }
});

function initRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRec();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.listening = false;

  recognition.onstart = () => {
    recognition.listening = true;
    document.getElementById("mic-btn").classList.add("listening");
  };
  recognition.onend = () => {
    recognition.listening = false;
    document.getElementById("mic-btn").classList.remove("listening");
  };
  recognition.onerror = (e) => {
    console.error("Speech error", e);
    recognition.listening = false;
    document.getElementById("mic-btn").classList.remove("listening");
  };
  recognition.onresult = (ev) => {
    const txt = ev.results[0][0].transcript;
    document.getElementById("user-input").value = txt;
    // small delay then send
    setTimeout(()=>sendMessage(), 350);
  };
}

// New chat (clears chat box but keeps history)
document.getElementById("new-chat").addEventListener("click", () => {
  document.getElementById("chat-box").innerHTML = "";
  // show welcome again
  const welcome = el("div","welcome");
  welcome.innerHTML = `<h3>Welcome to CropGuard AI</h3>
    <p>Ask about crops, pests, soil, weather, mandi prices and government schemes.</p>
    <div class="examples">
      <button onclick="quickQuestion('धान में ब्लास्ट बीमारी के लक्षण और इलाज क्या हैं?')">धान ब्लास्ट — इलाज</button>
      <button onclick="quickQuestion('When to apply urea for wheat?')">Wheat — urea timing</button>
    </div>`;
  document.getElementById("chat-box").appendChild(welcome);
});

// render local history into sidebar
function renderHistory() {
  const nav = document.getElementById("history");
  nav.innerHTML = "";
  let idx = 1;
  for (let i = 0; i < chatHistory.length; i+=2) {
    const user = chatHistory[i];
    const bot = chatHistory[i+1];
    const label = (user?.text || "Chat") .slice(0,40);
    const item = el("div","chat-item", `<strong>Chat ${idx}</strong><div style="font-size:13px;color:#666;margin-top:6px">${escapeHtml(label)}</div>`);
    item.addEventListener("click", ()=> replayChat(i));
    nav.appendChild(item);
    idx++;
  }
}

// replay chat from history index
function replayChat(startIdx) {
  document.getElementById("chat-box").innerHTML = "";
  for (let i = startIdx; i < chatHistory.length; i++) {
    const e = chatHistory[i];
    addMessage(e.text, e.role === "user" ? "user" : "bot");
  }
}

// initial welcome
(function init(){
  // render welcome card
  const welcome = el("div","welcome");
  welcome.innerHTML = `<h3>Welcome to CropGuard AI</h3>
    <p>Ask about crops, pests, soil, weather, mandi prices and government schemes.</p>
    <div class="examples">
      <button onclick="quickQuestion('धान में ब्लास्ट बीमारी के लक्षण और इलाज क्या हैं?')">धान ब्लास्ट — इलाज</button>
      <button onclick="quickQuestion('When to apply urea for wheat?')">Wheat — urea timing</button>
    </div>`;
  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  box.appendChild(welcome);
})();
