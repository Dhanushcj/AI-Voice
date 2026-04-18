import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text, greeting, includeAudio } = await request.json();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.error('API Service Error: GEMINI_API_KEY is missing!');
      throw new Error('GEMINI_API_KEY is missing');
    }

    // Handle proactive greeting
    if (greeting) {
      const greetingText = "வணக்கம்! நான் உங்களுக்கு இன்று எப்படி உதவ முடியும்? எதைப் பற்றி தெரிந்து கொள்ள விரும்புகிறீர்கள்?";
      console.log('API Service: Returning proactive greeting...');
      
      let audioResult = null;
      if (includeAudio) {
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: "nova",
          input: greetingText,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        audioResult = buffer.toString('base64');
      }

      return NextResponse.json({ 
        text: greetingText,
        audio: audioResult
      });
    }

    console.log('API Service: Querying Gemini for ->', text);

    // 1. Get Gemini 2.5 Flash Response
    const systemPrompt = "You are a helpful, friendly, and professional AI voice assistant. Your primary language is Tamil. Always respond in clear, natural-sounding Tamil. Keep your responses very concise (1-3 sentences) suitable for a voice conversation.";
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nUser Question: ${text}` }]
        }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.7,
        }
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Service: Gemini Error:', data);
      throw new Error(`Gemini API Error: ${data.error?.message || 'Failed'}`);
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "மன்னிக்கவும், என்னால் பதிலளிக்க முடியவில்லை.";
    const trimmedAiResponse = aiResponse.trim();
    console.log('API Service: Gemini Response:', trimmedAiResponse);

    // 2. Optional: Generate Cloud TTS Fallback
    let audioBase64 = null;
    if (includeAudio) {
      console.log('API Service: Generating Cloud TTS fallback audio...');
      try {
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: "nova",
          input: trimmedAiResponse,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        audioBase64 = buffer.toString('base64');
      } catch (ttsErr) {
        console.error('API Service: TTS Generation Failed:', ttsErr);
        // We don't throw here to ensure the text still gets back to the user
      }
    }

    return NextResponse.json({
      text: trimmedAiResponse,
      audio: audioBase64
    });

  } catch (error: any) {
    console.error('API Service Fatal Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      details: error.stack
    }, { status: 500 });
  }
}
