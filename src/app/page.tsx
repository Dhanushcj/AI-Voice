import CustomVoiceAgent from "@/components/CustomVoiceAgent";
import { 
  Sparkles, 
  BrainCircuit, 
  Settings, 
  History,
  Zap,
  ShieldCheck,
  Languages
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafafa] relative overflow-hidden">
      {/* Background Orbs Decor */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-purple-500/5 blur-[150px] rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Top Navigation */}
      <nav className="relative z-20 px-8 py-6 flex items-center justify-between border-b border-slate-200/50 backdrop-blur-md bg-white/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/10">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Tamil AI Voice</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Neural Protocol 2.0</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            <a href="#" className="hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">API Keys</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Support</a>
          </div>
          <div className="flex items-center gap-2 pl-6 border-l border-slate-200">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative">
              <History className="w-4 h-4 text-slate-400" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Hub */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-24">
        
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="card-pro p-6 bg-white/60 border border-white hover:border-indigo-100 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Languages className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Engine</span>
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Native Recognition</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Highly accurate Tamil speech-to-text powered by browser-native protocols.</p>
          </div>

          <div className="card-pro p-6 bg-white/60 border border-white hover:border-amber-100 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neural Link</span>
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">GPT-4o Reasoning</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Intelligent, context-aware Tamil conversational responses in under 800ms.</p>
          </div>

          <div className="card-pro p-6 bg-white/60 border border-white hover:border-emerald-100 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voice Meta</span>
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">ElevenLabs Audio</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">High-fidelity multilingual v2 voice models for human-like Tamil playback.</p>
          </div>
        </div>

        {/* Central Voice AI Interface */}
        <div className="bg-white/40 backdrop-blur-2xl rounded-[40px] border border-white shadow-2xl shadow-indigo-100/50 overflow-hidden">
          <div className="px-12 py-8 border-b border-indigo-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-800">Advanced NLP Studio</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Session Ready</span>
            </div>
          </div>
          
          <div className="p-8">
            <CustomVoiceAgent />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Integrated Intelligence Ecosystem</p>
        </div>
      </div>
    </main>
  );
}
