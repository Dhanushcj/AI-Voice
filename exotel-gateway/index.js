require('dotenv').config();
const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Initialize Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const PORT = process.env.PORT || 5050;

// 2. The WebSocket Server
const wss = new WebSocket.Server({ port: PORT });
console.log(`Exotel Gateway: Server listening on wss://localhost:${PORT}`);

wss.on('connection', (ws) => {
    console.log('Exotel Gateway: New connection established.');

    let streamSid = null;
    let deepgramConnection = null;

    // Initialize Deepgram for 8kHz Linear16 (Exotel standard)
    const setupDeepgram = () => {
        deepgramConnection = deepgram.listen.live({
            model: "nova-2",
            language: "ta", // Tamil
            smart_format: true,
            encoding: "linear16",
            sample_rate: 8000,
            channels: 1,
            interim_results: false
        });

        deepgramConnection.on('open', () => {
            console.log('Deepgram: Connection opened.');
        });

        deepgramConnection.on('Results', async (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript) {
                console.log(`Deepgram: [${data.is_final ? 'FINAL' : 'INTERIM'}] -> ${transcript}`);
                if (data.is_final) {
                    console.log(`User (Phone): ${transcript}`);
                    await handleAiFlow(transcript);
                }
            }
        });

        deepgramConnection.on('error', (err) => {
            console.error('Deepgram Connection Error:', err);
        });
    };

    setupDeepgram();

    // The AI Thought Loop
    const handleAiFlow = async (text) => {
        try {
            console.log('Gemini: Thinking...');
            const prompt = `You are a helpful and professional AI assistant. Your primary language is Tamil. Always respond in natural-sounding Tamil. Keep your responses concise (1-2 sentences). \n\nUser: ${text}`;
            const result = await model.generateContent(prompt);
            const aiReply = result.response.text();
            console.log(`AI Reply: ${aiReply}`);

            await speakToCustomer(aiReply);
        } catch (e) {
            console.error('Gemini Error:', e);
        }
    };

    // The TTS & Streaming Loop
    const speakToCustomer = async (text) => {
        try {
            console.log('OpenAI: Generating Speech...');
            const response = await openai.audio.speech.create({
                model: "tts-1",
                voice: "nova",
                input: text,
                response_format: "pcm", // Returns 24kHz PCM
            });

            const buffer = Buffer.from(await response.arrayBuffer());
            console.log(`OpenAI: Generated ${buffer.length} bytes of PCM audio.`);
            
            // Resample from 24kHz to 8kHz
            const resampledBuffer = resamplePCM24to8(buffer);
            console.log(`Resampler: Converted to ${resampledBuffer.length} bytes at 8kHz.`);
            
            // Send to Exotel in chunks of ~160ms (1284 bytes at 8kHz 16-bit)
            const chunkSize = 1280;
            for (let i = 0; i < resampledBuffer.length; i += chunkSize) {
                const chunk = resampledBuffer.slice(i, i + chunkSize);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        event: 'media',
                        stream_sid: streamSid,
                        media: {
                            payload: chunk.toString('base64'),
                        }
                    }));
                }
            }
            console.log('Exotel: AI Audio sent to customer.');
        } catch (e) {
            console.error('TTS/Exotel Error:', e);
        }
    };

    // Handle Incoming Exotel Messages
    ws.on('message', (message) => {
        const msg = JSON.parse(message);

        switch (msg.event) {
            case 'start':
                streamSid = msg.stream_sid;
                console.log(`Exotel: Stream started (Sid: ${streamSid})`);
                break;
            case 'media':
                const payload = msg.media?.payload;
                if (!payload) {
                    console.warn('Exotel: Media event received without payload!');
                    return;
                }

                if (deepgramConnection) {
                    const state = deepgramConnection.getReadyState();
                    if (state === 1) { // OPEN
                        const audioPayload = Buffer.from(payload, 'base64');
                        // Log chunk stats occasionally or if specifically requested (too quiet to log every chunk)
                        // console.log(`Exotel -> Deepgram: ${audioPayload.length} bytes`);
                        deepgramConnection.send(audioPayload);
                    } else {
                        console.warn(`Exotel: Deepgram not ready (State: ${state}). Buffering or connection issue?`);
                    }
                }
                break;
            case 'stop':
                console.log('Exotel: Stream stopped.');
                if (deepgramConnection) deepgramConnection.finish();
                break;
        }
    });

    ws.on('close', () => {
        console.log('Exotel Gateway: Connection closed.');
        if (deepgramConnection) deepgramConnection.finish();
    });
});

// Resample Logic: Simple Decimation (24kHz -> 8kHz)
// OpenAI PCM is 16-bit (2 bytes per sample).
const resamplePCM24to8 = (buffer) => {
    const resampled = Buffer.alloc(Math.floor(buffer.length / 3));
    let j = 0;
    for (let i = 0; i < buffer.length; i += 6) { // 3 samples of 2-bytes each = 6 bytes
        // Take the first 2-byte sample of every 3 samples
        resampled[j] = buffer[i];
        resampled[j + 1] = buffer[i + 1];
        j += 2;
    }
    return resampled;
};
