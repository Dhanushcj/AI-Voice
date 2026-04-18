import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // 1. Get LLM Response in Tamil via fetch (Zero-dependency approach)
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
      throw new Error(`OpenAI Error: ${aiData.error.message}`);
    }
    
    const aiResponse = aiData.choices[0].message.content;

    // 2. Convert to Speech using ElevenLabs
    const ELEVENLABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
    const VOICE_ID = "pNInz6obpgnu9PAsWsyA"; // Brian (High-quality Multilingual)
    
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: aiResponse,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorData = await ttsResponse.json();
      throw new Error(`ElevenLabs Error: ${errorData.detail?.message || 'TTS Failed'}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      text: aiResponse,
      audio: `data:audio/mpeg;base64,${base64Audio}`
    });

  } catch (error: any) {
    console.error('Voice Process Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
