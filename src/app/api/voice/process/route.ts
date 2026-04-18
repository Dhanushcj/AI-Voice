import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, greeting } = await request.json();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.error('API Service Error: GEMINI_API_KEY is missing!');
      throw new Error('GEMINI_API_KEY is missing');
    }

    // Handle proactive greeting
    if (greeting) {
      console.log('API Service: Returning proactive greeting...');
      return NextResponse.json({ text: "வணக்கம்! நான் உங்களுக்கு இன்று எப்படி உதவ முடியும்? எதைப் பற்றி தெரிந்து கொள்ள விரும்புகிறீர்கள்?" });
    }

    console.log('API Service: Querying Gemini for ->', text);

    // 1. Get Gemini 1.5 Flash Response
    const systemPrompt = "You are a helpful, friendly, and professional AI voice assistant. Your primary language is Tamil. Always respond in clear, natural-sounding Tamil. Keep your responses very concise (1-3 sentences) suitable for a voice conversation.";
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
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
    console.log('API Service: Gemini Response:', aiResponse);

    return NextResponse.json({
      text: aiResponse.trim()
    });

  } catch (error: any) {
    console.error('API Service Fatal Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      details: error.stack
    }, { status: 500 });
  }
}
