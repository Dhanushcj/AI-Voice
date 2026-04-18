const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, OPEN } = require('ws');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const googleTTS = require('google-tts-api');
const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3001;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize WebSocket Server on the same HTTP server
  const wss = new WebSocketServer({ server });

  console.log(`\n--- ✨ Unified Voice Server Starting ---`);
  console.log(`🌐 Dashboard: http://${hostname}:${port}`);
  console.log(`🎙️ Exotel WSS: wss://${hostname}:${port}`);
  console.log(`-----------------------------------------\n`);

  wss.on('connection', (ws, req) => {
    const parsedUrl = parse(req.url, true);
    
    // Check if this is an Exotel stream connection
    // Usually Exotel connects to the root or a specific path
    console.log(`WSS: New connection from ${req.socket.remoteAddress}`);

    let streamSid = null;
    let dgSocket = null;

    // Initialize Raw Deepgram WebSocket
    const setupDeepgramRaw = () => {
        const url = 'wss://api.deepgram.com/v1/listen?language=ta&model=nova-2-phonecall&encoding=linear16&sample_rate=8000&smart_format=true&interim_results=false';
        
        const socket = new (require('ws'))(url, {
            headers: {
                Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
            }
        });

        socket.on('open', () => console.log('Deepgram (Unified): Connection opened.'));

        socket.on('message', async (data) => {
            const response = JSON.parse(data);
            if (response.channel && response.channel.alternatives[0].transcript) {
                const transcript = response.channel.alternatives[0].transcript;
                const isFinal = response.is_final;
                
                if (transcript) {
                    console.log(`Deepgram: [${isFinal ? 'FINAL' : 'INTERIM'}] -> ${transcript}`);
                    if (isFinal) {
                        console.log(`User (Phone): ${transcript}`);
                        await handleAiFlow(transcript);
                    }
                }
            }
        });

        socket.on('error', (err) => console.error('Deepgram Socket Error:', err));
        return socket;
    };

    dgSocket = setupDeepgramRaw();

    // The AI Thought Loop
    const handleAiFlow = async (text) => {
        try {
            console.log('Gemini: Thinking...');
            const prompt = `You are a highly intelligent, helpful, and professional AI assistant. Your primary language is Tamil. Always respond in clear, detailed, and natural-sounding Tamil. Explain concepts fully and provide comprehensive answers when requested. Do not restrict yourself to short sentences. \n\nUser: ${text}`;
            const result = await model.generateContent(prompt);
            const aiReply = result.response.text();
            console.log(`AI Reply: ${aiReply}`);

            await speakToCustomer(aiReply);
        } catch (e) {
            console.error('Gemini Error:', e);
        }
    };

    // Zero-Cost TTS (Google Translate)
    const speakToCustomer = async (text) => {
        try {
            console.log('Google TTS: Fetching Free Voice...');
            const chunks = text.match(/.{1,180}(?:\s|$|[.,!?;])/g) || [text];
            
            for (const chunk of chunks) {
                if (!chunk.trim()) continue;

                const url = googleTTS.getAudioUrl(chunk, {
                    lang: 'ta',
                    slow: false,
                    host: 'https://translate.google.com',
                });

                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const mp3Buffer = Buffer.from(response.data);

                // MP3 to PCM 8k conversion for Telephony
                const pcmBuffer = await new Promise((resolve, reject) => {
                    const audioChunks = [];
                    const readable = new Readable();
                    readable.push(mp3Buffer);
                    readable.push(null);

                    ffmpeg(readable)
                        .toFormat('s16le')
                        .audioChannels(1)
                        .audioFrequency(8000)
                        .on('error', reject)
                        .pipe()
                        .on('data', (d) => audioChunks.push(d))
                        .on('end', () => resolve(Buffer.concat(audioChunks)));
                });

                // Send PCM to Exotel
                const chunkSize = 1280;
                for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
                    const chunkData = pcmBuffer.slice(i, i + chunkSize);
                    if (ws.readyState === OPEN) {
                        ws.send(JSON.stringify({
                            event: 'media',
                            stream_sid: streamSid,
                            media: { payload: chunkData.toString('base64') }
                        }));
                    }
                }
            }
        } catch (e) {
            console.error('Telephony Error:', e);
        }
    };

    // Handle Incoming Exotel Binary Data
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            switch (msg.event) {
                case 'start':
                    streamSid = msg.stream_sid;
                    console.log(`Exotel: Unified Stream started (Sid: ${streamSid})`);
                    // Immediate proactive greeting
                    await speakToCustomer("வணக்கம்! நான் உங்களுக்கு இன்று எப்படி உதவ முடியும்? எதைப் பற்றி தெரிந்து கொள்ள விரும்புகிறீர்கள்?");
                    break;
                case 'media':
                    const payload = msg.media?.payload;
                    if (!payload) return;

                    if (dgSocket && dgSocket.readyState === OPEN) {
                        dgSocket.send(Buffer.from(payload, 'base64'));
                    }
                    break;
                case 'stop':
                    console.log('Exotel: Unified Stream stopped.');
                    if (dgSocket) dgSocket.close();
                    break;
            }
        } catch (e) {
            // Ignore non-json if any
        }
    });

    ws.on('close', () => {
        console.log('Exotel WSS: Connection closed.');
        if (dgSocket) dgSocket.close();
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
