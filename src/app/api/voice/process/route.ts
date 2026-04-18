import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, greeting } = await request.json();
    
    // Handle proactive greeting
    if (greeting) {
      console.log('API Service: Generating proactive greeting...');
      const welcomeText = "வணக்கம்! நான் உங்களுக்கு இன்று எப்படி உதவ முடியும்? எதைப் பற்றி தெரிந்து கொள்ள விரும்புகிறீர்கள்?";
      return await generateVoiceResponse(welcomeText);
    }

    console.log('API Service: Received voice request:', text);
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // 1. Get LLM Response in Tamil
    console.log('API Service: Querying OpenAI...');
    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful, friendly, and professional AI voice assistant. Your primary language is Tamil. Always respond in clear, natural-sounding Tamil. Keep your responses very concise (1-3 sentences) suitable for a voice conversation."
          },
          {
            role: "user",
            content: text
          }
        ],
      }),
    });

    const aiData = await aiResp.json();
    
    if (aiData.error) {
      console.error('API Service: OpenAI Error:', aiData.error);
      throw new Error(`OpenAI Error: ${aiData.error.message}`);
    }
    
    const aiResponse = aiData.choices[0].message.content;
    return await generateVoiceResponse(aiResponse);

  } catch (error: any) {
    console.error('API Service Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to generate OpenAI TTS response
async function generateVoiceResponse(text: string) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  console.log('API Service: Generating TTS for:', text);

  const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "nova",
      input: text,
    }),
  });

  if (!ttsResponse.ok) {
    throw new Error('TTS Generation Failed');
  }

  const audioBuffer = await ttsResponse.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  return NextResponse.json({
    text: text,
    audio: `data:audio/mpeg;base64,${base64Audio}`
  });
}
