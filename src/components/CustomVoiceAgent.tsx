'use client';

import { useState, useEffect, useRef } from 'react';
import VoiceOrb from './VoiceOrb';
import { Mic, MicOff, Volume2, Globe, Sparkles } from 'lucide-react';

export default function CustomVoiceAgent() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const isRecognitionActive = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      recognitionRef.current.continuous = true; // Use continuous for better stability
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
        console.log('Voice Engine: Result updating:', currentTranscript);
        setTranscript(currentTranscript);
        
        if (finalTranscript) {
          console.log('Voice Engine: Confirmed final phrase:', finalTranscript);
          processVoiceCommand(finalTranscript);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Audio Analyzer for volume visualization
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
          playAiVoice(greetData.audio);
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

  const processVoiceCommand = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    
    console.log('Voice Engine: Processing command ->', text);
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
        if (data.audio) {
          playAiVoice(data.audio);
        } else {
          console.warn('Voice Engine: No audio data returned from API.');
          setStatus('idle');
        }
      } else {
        console.error('Voice Engine: API Response Error:', data.error);
        setStatus('idle');
      }
    } catch (err) {
      console.error('Voice Engine: API Communication Error:', err);
      setStatus('idle');
    }
  };

  const playAiVoice = (audioBase64: string) => {
    console.log('Voice Engine: Initializing audio playback...');
    setStatus('speaking');
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    audioRef.current = new Audio(audioBase64);
    
    audioRef.current.onplay = () => {
      console.log('Voice Engine: Audio playing.');
    };

    audioRef.current.onerror = (e) => {
      console.error('Voice Engine: Audio playback error:', e);
      setStatus('idle');
    };

    audioRef.current.onended = () => {
      console.log('Voice Engine: Audio finished.');
      setStatus('idle');
    };

    audioRef.current.play().catch(e => {
      console.error('Voice Engine: Playback failed (Interaction required?):', e);
      setStatus('idle');
    });
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-16 py-12 min-h-[600px] animate-in fade-in zoom-in duration-700">
      
      {/* Visual Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 mb-2">
          <Globe className="w-3 h-3 text-indigo-500" />
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Native Tamil Protocol v1.0</span>
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
      </div>
    </div>
  );
}
