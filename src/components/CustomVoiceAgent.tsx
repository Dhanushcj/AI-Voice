'use client';

import { useState, useEffect, useRef } from 'react';
import VoiceOrb from './VoiceOrb';
import { Mic, MicOff, Volume2, Globe, Sparkles, MessageSquare, Clock, Bot, User, Send } from 'lucide-react';

export default function CustomVoiceAgent() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string, time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const isRecognitionActive = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const addMessage = (role: 'user' | 'ai', text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role, text, time }]);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Ref for silence detection timer
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check for secure context
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      alert('Security Warning: Speech recognition requires a secure (HTTPS) connection or localhost. Please check your URL.');
    }
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      console.log('Voice Engine: SpeechRecognition detected.');
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'ta-IN';
      recognitionRef.current.continuous = true; 
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        console.log('Voice Engine: Recognition started (onstart)');
        isRecognitionActive.current = true;
      };

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        if (currentTranscript.trim()) {
           console.log('Voice Engine: Updating transcript ->', currentTranscript);
           setTranscript(currentTranscript);

           // Silence Detection Logic
           if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
           
           silenceTimerRef.current = setTimeout(() => {
             console.log('Voice Engine: Silence detected. Auto-triggering command.');
             processVoiceCommand(currentTranscript);
             setTranscript(''); // Clear for next phrase
           }, 1500); // 1.5 seconds of silence
        }
        
        if (finalTranscript) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          console.log('Voice Engine: Confirmed final phrase:', finalTranscript);
          processVoiceCommand(finalTranscript);
          setTranscript('');
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Voice Engine: Recognition ended (onend)');
        isRecognitionActive.current = false;
        
        // Auto-restart if we are still in "listening" mode
        if (status === 'listening') {
          console.log('Voice Engine: Attempting auto-restart...');
          setTimeout(() => safeStartRecognition(), 300);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        isRecognitionActive.current = false;
        
        // Handle specific errors
        if (event.error === 'no-speech') {
          // Ignore no-speech noise to keep console clean
          return;
        }

        console.error('Voice Engine Error (onerror):', event.error);
        
        if (event.error === 'network') {
          console.warn('Voice Engine: Network issue detected. Backing off for 2s...');
          setTimeout(() => {
            if (status === 'listening') safeStartRecognition();
          }, 2000);
          return;
        }

        if (event.error === 'not-allowed') {
          alert('Microphone permission denied. Please allow mic access in your browser settings.');
        }
        
        if (event.error !== 'aborted') {
          setStatus('idle');
        }
      };
    } else {
      console.error('Voice Engine: Web Speech API (SpeechRecognition) NOT supported in this browser.');
      alert('Your browser does not support Speech Recognition. Please use Chrome, Edge, or Safari.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        isRecognitionActive.current = false;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [status]);

  const safeStartRecognition = () => {
    if (recognitionRef.current && !isRecognitionActive.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Manual SpeechRecognition start suppressed:', e);
      }
    }
  };

  const startListening = async () => {
    try {
      // 1. Initialize and UNLOCK Audio Context (MUST happen in click handler)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('Voice Engine: AudioContext Unlocked and Resumed');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Audio Analyzer
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const updateVolume = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(average);
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      setStatus('listening');
      setTranscript('');
      setAiText('');
      safeStartRecognition();

      // Trigger Proactive Greeting
      try {
        const greetResp = await fetch('/api/voice/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ greeting: true }),
        });
        const greetData = await greetResp.json();
        if (greetResp.ok) {
          setAiText(greetData.text);
          addMessage('ai', greetData.text);
          playNativeVoice(greetData.text);
        }
      } catch (e) {
        console.error('Greeting Error:', e);
      }
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Microphone access is required for the Tamil Voice AI.');
    }
  };

  const stopListening = () => {
    setStatus('idle');
    recognitionRef.current?.stop();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    processVoiceCommand(chatInput);
    setChatInput('');
  };

  const processVoiceCommand = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    
    console.log('Voice Engine: Processing command ->', text);
    addMessage('user', text);
    setStatus('processing');
    
    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Voice Engine: AI Response received successfully.');
        setAiText(data.text);
        addMessage('ai', data.text);
        playNativeVoice(data.text);
      } else {
        console.error('Voice Engine: API Response Error:', data.error);
        if (data.error?.includes('missing')) {
          setAiText('பின்னணி கட்டமைப்பு தேவை (Configuration Required): Please add GEMINI_API_KEY to your Vercel Environment Variables.');
        } else {
          setAiText('Algorithm Error: ' + (data.error || 'Unknown Error'));
        }
        setStatus('idle');
      }
    } catch (err) {
      console.error('Voice Engine: API Communication Error:', err);
      setStatus('idle');
    }
  };

  // Advanced Voice Discovery
  useEffect(() => {
    const logVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('Voice Engine: 🔊 System discovered', voices.length, 'voices.');
      const tamilVoices = voices.filter(v => v.lang.startsWith('ta'));
      if (tamilVoices.length > 0) {
        console.log('Voice Engine: ✅ Tamil voices available:', tamilVoices.map(v => v.name));
      } else {
        console.warn('Voice Engine: ❌ NO Tamil voices found on this system! Falling back to default.');
      }
    };

    logVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = logVoices;
    }
  }, []);

  const playNativeVoice = (text: string) => {
    if (!text) return;
    console.log('Voice Engine: 💬 Attempting to speak:', text);
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ta-IN';
    utterance.rate = 1.1; // Slightly faster for natural Tamil
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const tamilVoice = voices.find(v => v.lang === 'ta-IN' && (v.name.includes('Google') || v.name.includes('Neural'))) || 
                      voices.find(v => v.lang === 'ta-IN') ||
                      voices.find(v => v.lang.startsWith('ta')) ||
                      voices[0];
    
    if (tamilVoice) {
      console.log('Voice Engine: 🎙️ Using Voice:', tamilVoice.name, `(${tamilVoice.lang})`);
      utterance.voice = tamilVoice;
    } else {
      console.warn('Voice Engine: ⚠️ No voices available to the browser yet.');
    }

    utterance.onstart = () => {
      console.log('Voice Engine: ▶️ Audio playback started');
      setStatus('speaking');
    };

    utterance.onend = () => {
      console.log('Voice Engine: ⏹️ Audio playback finished');
      setStatus('idle');
    };

    utterance.onerror = (e) => {
      console.error('Voice Engine: 🛑 Playback Error:', e);
      setStatus('idle');
    };

    window.speechSynthesis.speak(utterance);
    
    // Check if it's actually speaking
    setTimeout(() => {
      if (!window.speechSynthesis.speaking && text.length > 0) {
        console.error('Voice Engine: 🚨 Speech failed to start! Checks mute/volume or browser privacy settings.');
      }
    }, 100);
  };

  const testAudio = async () => {
    console.log('Voice Engine: Running Manual Audio Test...');
    const testPhrase = 'வணக்கம், ஒலி சோதனை வெற்றி'; // Hello, sound test success
    try {
      const resp = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testPhrase }),
      });
      const data = await resp.json();
      if (resp.ok) playNativeVoice(data.text);
    } catch (e) {
      console.error('Test Audio Failed:', e);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-16 py-12 min-h-[600px] animate-in fade-in zoom-in duration-700">
      
      {/* Visual Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center gap-4 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100">
            <Globe className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Native Tamil Protocol v1.0</span>
          </div>
          <button 
            onClick={testAudio}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Test Audio Engine</span>
          </button>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Tamil AI Voice Experience</h2>
        <p className="text-slate-500 max-w-md mx-auto font-medium leading-relaxed">
          The next generation of real-time Tamil NLP. Recognizes and replies in native voice.
        </p>
      </div>

      {/* The Animated Siri Orb */}
      <div className="relative group">
        <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full scale-150 group-hover:bg-indigo-500/15 transition-all duration-1000" />
        <VoiceOrb status={status} volume={volume} />
      </div>

      {/* Transcription & Visualizer */}
      <div className="w-full max-w-2xl space-y-8 z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-pro p-8 bg-white/40 backdrop-blur-xl border border-slate-200/50 min-h-[160px] flex flex-col shadow-xl shadow-slate-200/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Mic className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Listener Transcript</span>
            </div>
            <p className="text-slate-800 text-lg font-bold leading-relaxed tracking-tight">
              {transcript || <span className="text-slate-300 font-normal italic">Speak in Tamil...</span>}
            </p>
          </div>

          <div className="card-pro p-8 bg-slate-900 border-0 min-h-[160px] flex flex-col shadow-2xl shadow-indigo-900/20 group/ai">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Volume2 className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/60">Neural Response</span>
            </div>
            <p className="text-white text-lg font-bold leading-relaxed tracking-tight">
              {aiText || <span className="text-slate-600 font-normal italic">Analyzing context...</span>}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={status === 'idle' ? startListening : stopListening}
            className={`group relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 shadow-2xl active:scale-90 ${
              status === 'idle' 
                ? 'bg-slate-900 hover:bg-slate-800 hover:scale-110 shadow-slate-900/20' 
                : 'bg-red-500 hover:bg-red-600 hover:scale-105 shadow-red-500/30'
            }`}
          >
            {status === 'idle' ? (
              <Mic className="w-10 h-10 text-white" />
            ) : (
              <MicOff className="w-10 h-10 text-white animate-pulse" />
            )}
            
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-0 group-hover:opacity-10 blur-xl transition-opacity animate-pulse" />
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full border border-slate-200 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">
              {status === 'idle' ? 'Ready to Assist' : 
               status === 'listening' ? 'Processing Voice' : 
               status === 'processing' ? 'Thinking...' : 'AI Speaking'}
            </span>
          </div>
        </div>

        {/* Chat History Section */}
        <div className="card-pro p-8 bg-white/40 backdrop-blur-xl border border-slate-200/50 shadow-xl mt-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Neural Chat Log</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Conversation History</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Live Session</span>
            </div>
          </div>

          <div 
            ref={chatContainerRef}
            className="space-y-6 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-40">
                <Bot className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-400">Initialize session to start logging...</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-4 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'ai' ? 'items-start' : 'items-start flex-row-reverse text-right'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-slate-900' : 'bg-indigo-500'}`}>
                    {msg.role === 'ai' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                  </div>
                  <div className="space-y-1 max-w-[80%]">
                    <div className={`p-4 rounded-2xl text-sm font-bold leading-relaxed ${
                      msg.role === 'ai' 
                        ? 'bg-slate-900 text-white shadow-lg' 
                        : 'bg-white text-slate-800 border border-slate-100 shadow-md'
                    }`}>
                      {msg.text}
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter px-1">
                      {msg.role === 'ai' ? 'AI Neural' : 'User'} • {msg.time}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input Fallback */}
          <form 
            onSubmit={handleChatSubmit}
            className="mt-6 flex gap-3 p-2 bg-slate-900 shadow-2xl border border-slate-700/50"
          >
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="உங்களைப் பற்றி சொல்லுங்கள் அல்லது எதாவது கேளுங்கள்..."
              className="flex-1 bg-transparent px-4 py-3 text-white text-sm font-bold placeholder:text-slate-500 focus:outline-none"
            />
            <button 
              type="submit"
              className="bg-indigo-500 hover:bg-indigo-600 p-3 flex items-center justify-center transition-all active:scale-95 group"
            >
              <Send className="w-5 h-5 text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
