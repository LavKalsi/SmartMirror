const axios = require('axios');
const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  const gifEl = document.getElementById('status-gif');
  const clockEl = document.getElementById('clock');
  const weatherEl = document.getElementById('weather');
  const newsEl = document.getElementById('news');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const chatbotEl = document.getElementById('chatbot');

  // GIF State Manager
  const gifs = {
    idle: 'bot/idle.gif',
    listening: 'bot/listening.gif',
    thinking: 'bot/thinking.gif',
    error: 'bot/error.gif'
  };

  function setGif(state) {
    const src = gifs[state] || gifs.idle;
    gifEl.onerror = () => {
      gifEl.onerror = null;
      gifEl.src = gifs.error;
    };
    gifEl.src = src;
  }

  // Visibility toggle
  function setVisibility(state) {
    const visible = state === 'show';
    [
      weatherEl,
      newsEl,
      chatbotEl,
      document.getElementById('chat-header'),
      document.getElementById('status-gif'),
      document.getElementById('company-logo')
    ].forEach(el => {
      el.style.opacity = visible ? '1' : '0';
      el.style.transition = 'opacity 1s ease';
    });
  }

  // Append message to chat
  function addChatMessage(sender, message) {
    const formatted = message.replace(/\n/g, '<br>');
    chatMessages.innerHTML += `<div><strong>${sender}:</strong> ${formatted}</div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Mic state
  ipcRenderer.on('mic-state', (_, micState) => {
    chatInput.placeholder = micState === 'listening' ? '🎤 Listening...' : 'Say the wake word...';
    setGif(micState === 'listening' ? 'listening' : 'idle');
  });

  // Sensor visibility
  ipcRenderer.on('sensor-state', (_, message) => setVisibility(message));

  // Mic messages
  ipcRenderer.on('mic-user', (_, userText) => {
    addChatMessage('You', userText);
  });

  ipcRenderer.on('mic-bot', (_, botText) => {
    addChatMessage('Bot', botText);
    setGif('idle');
  });

  // Chat input event
  const webhookURL = 'https://shardcarecubs.app.n8n.cloud/webhook/a8df4b22-922c-4f6d-9c34-2d25d8ff37a9';

  chatInput.addEventListener('keypress', async e => {
    if (e.key !== 'Enter') return;
    const message = chatInput.value.trim();
    if (!message) return;

    addChatMessage('You', message);
    chatInput.value = '';

    setGif('thinking');
    const thinkingId = `thinking-${Date.now()}`;
    chatMessages.innerHTML += `<div id="${thinkingId}"><em>🤔 Thinking…</em></div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await axios.post(webhookURL, { message });
      const reply = res.data.reply || 'No response from bot.';
      document.getElementById(thinkingId)?.remove();
      addChatMessage('Bot', reply);
      setGif('idle');
      ipcRenderer.send('say-text', reply);
    } catch (error) {
      document.getElementById(thinkingId)?.remove();
      chatMessages.innerHTML += `<div style="color:red;"><strong>Error:</strong> Chatbot failed.</div>`;
      chatMessages.scrollTop = chatMessages.scrollHeight;
      setGif('error');
    }
  });

  // Clock update with 12-hour format and seconds
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
    clockEl.textContent = formattedTime;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Weather (using Open-Meteo for Punjab)
  const latitude = 30.9;  // Ludhiana, Punjab
  const longitude = 75.85;
  const openMeteoURL = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,relative_humidity_2m&timezone=auto`;

  axios.get(openMeteoURL)
    .then(response => {
      const current = response.data.current;
      weatherEl.innerHTML = `
        <h2>Weather</h2>
        <p>🌡️ Temperature: ${current.temperature_2m}°C</p>
        <p>💧 Humidity: ${current.relative_humidity_2m}%</p>
        <p>🌬️ Wind Speed: ${current.wind_speed_10m} km/h</p>
      `;
    })
    .catch(() => {
      weatherEl.innerHTML = `<p style="color: red;">Failed to load weather data.</p>`;
    });

  // News
  const mediastackKey = '6657ba40b2f000f7bfcaaf5595fe8ab1';
  const rawNewsURL = `http://api.mediastack.com/v1/news?access_key=${mediastackKey}&countries=in&languages=en&limit=50&sort=published_desc`;
  const proxyURL = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawNewsURL)}`;

  axios.get(proxyURL)
    .then(res => {
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const articles = data.data || [];
      let index = 0;
      newsEl.innerHTML = `<h2>📰 News</h2><p>${articles[0].title}</p>`;
      setInterval(() => {
        index = (index + 1) % articles.length;
        newsEl.innerHTML = `<h2>📰 News</h2><p>${articles[index].title}</p>`;
      }, 10000);
    })
    .catch(() => {
      newsEl.innerHTML = `<p style="color: red;">Failed to load news.</p>`;
    });

  // Init
  setVisibility('show');
  setGif('idle');
});
