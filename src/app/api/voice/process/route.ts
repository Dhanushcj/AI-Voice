import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    console.log('API Service: Received voice request:', text);

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // 1. Get LLM Response in Tamil via fetch (Zero-dependency approach)
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
    console.log('API Service: AI Response text:', aiResponse);

    // 2. Convert to Speech using OpenAI TTS
    console.log('API Service: Querying OpenAI TTS...');
    
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "nova", // Nova is a clear, versatile voice
        input: aiResponse,
      }),
    });

    if (!ttsResponse.ok) {
      const errorData = await ttsResponse.json();
      console.error('API Service: OpenAI TTS Error:', errorData);
      throw new Error(`OpenAI TTS Error: ${errorData.error?.message || 'TTS Failed'}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log('API Service: OpenAI TTS Audio generated. Size:', audioBuffer.byteLength, 'bytes');
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      text: aiResponse,
      audio: `data:audio/mpeg;base64,${base64Audio}`
    });

  } catch (error: any) {
    console.error('API Service Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
