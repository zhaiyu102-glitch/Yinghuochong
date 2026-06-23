import React, { useEffect, useRef, useState } from "react";
import { Firefly, HandGesture, HandData, JourneyStage, POELog } from "./types";
import {
  fadeInRain,
  fadeOutRain,
  fadeInForestAmbient,
  playGrabSound,
  playReleaseSound,
  startAmbientSynth,
  stopAllAmbientSynth
} from "./utils/audio";
import HandDetector from "./components/HandDetector";
import RainCanvas from "./components/RainCanvas";
import {
  BookOpen,
  ChevronRight,
  Compass,
  CornerDownRight,
  Eye,
  Feather,
  History,
  Info,
  Moon,
  Music,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  EyeOff,
  Video,
  Camera
} from "lucide-react";

import rainyForestNight from "./assets/images/rainy_forest_1782139204033.jpg";
import deepEnchantedForest from "./assets/images/enchanted_forest_1782139215309.jpg";
import creekSideNight from "./assets/images/creek_side_night_1782200784523.jpg";
import valleySideNight from "./assets/images/valley_night_firefly_1782201258689.jpg";

// Pre-load background images for high-performance canvas rendering
const forestBgImg = new Image();
forestBgImg.src = deepEnchantedForest;

const creekBgImg = new Image();
creekBgImg.src = creekSideNight;

const valleyBgImg = new Image();
valleyBgImg.src = valleySideNight;

const LOCAL_POETRY_POOL = [
  "夜雨初霁，林壑生风。指尖凝聚的一缕微光，是落叶里未写完的安眠短笺。",
  "轻握五指，拢住一星坠落的流金。生物的微茫在掌纹间跳动，温暖了夜宿人的寂色。",
  "木叶阴阴，萤光如织。你归还了一束星火，它便在古老枝桠间燃起整条银河。",
  "清露坠叶，星霜点衣。被放飞的光芒点亮了苔原，也点亮了不眠的深夜。",
  "雨歇林霏开，萤火绕千林。掌心一粒孤单的琥珀，终将飞回无尽 of 幽邃之中。"
];

const getFireflyTraits = (hue: number) => {
  let colorName = "草木黄绿 (Chlorophyll)";
  let spectralName = "545nm | 绿光波频";
  let rarity = "林间常见 (Common)";
  let description = "端黑萤的最典型亚种，广泛栖息于湿润苔藓与蕨类丛中，对微风与湿汽极其敏感，是森林里跳动的绿色音符。";
  
  if (hue < 35) {
    colorName = "琥珀朱红 (Ember Crimson)";
    spectralName = "615nm | 暖红波频";
    rarity = "至臻稀世 (Legendary)";
    description = "传说中的赤翼金心萤，其发光的生物化学效率是普通品种的数倍，在微凉的深秋夜雨中，能为落叶提供一丝温暖。";
  } else if (hue < 60) {
    colorName = "极光晨橙 (Auroral Gold)";
    spectralName = "585nm | 曦黄波频";
    rarity = "罕见史诗 (Epic)";
    description = "金斑织网萤，其体色偏向灿烂金黄。它们喜欢结阵盘旋在巨木枝头，微缩的姿态在空中拉出金色丝线，美得惊心动魄。";
  } else if (hue > 100) {
    colorName = "幽空冷靛 (Cosmic Indigo)";
    spectralName = "505nm | 冰蓝波频";
    rarity = "传世神话 (Mythic)";
    description = "极寒幽魂萤，荧光的周期极长且带有微弱的磁性。往往在冷杉古老腐木处游荡，带有微温的热力感，非常神异。";
  }
  return { colorName, spectralName, rarity, description };
};

export default function App() {
  // Experience Stages & Progression States
  const [stage, setStage] = useState<JourneyStage>(JourneyStage.AWA_RAIN);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showOptions, setShowOptions] = useState(false);

  // Audio Mute and Permission
  const [isMuted, setIsMuted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);

  // Gesture Tracker States (Real Webcam vs. Virtual Mouse Simulation)
  const [isCameraAllowed, setIsCameraAllowed] = useState(false);
  const [handPos, setHandPos] = useState({ x: 0.5, y: 0.5 });
  const [activeGesture, setActiveGesture] = useState<HandGesture>(HandGesture.OPEN);
  const [stabilizedGesture, setStabilizedGesture] = useState<HandGesture>(HandGesture.OPEN);
  const [trackingConfidence, setTrackingConfidence] = useState(0.85);
  const [controlMode, setControlMode] = useState<"webcam" | "virtual">("virtual");

  // Forest exploration variables
  const [forestDepth, setForestDepth] = useState(1); // walking progress deep in forest
  const [rotationAngle, setRotationAngle] = useState(0); // perspective look-at drift
  const [capturedFireflies, setCapturedFireflies] = useState<string[]>([]);
  const [capturedAtTime, setCapturedAtTime] = useState<number | null>(null);
  const [observationPerspective, setObservationPerspective] = useState<"top" | "side" | "macro" | "spectral">("top");

  // Scene modes and cumulative capture states
  const [currentScene, setCurrentScene] = useState<"forest" | "creek" | "valley">("forest");
  const [totalCaptured, setTotalCaptured] = useState<number>(0);
  const [totalReleased, setTotalReleased] = useState<number>(0);
  const [lastSceneChangeNotify, setLastSceneChangeNotify] = useState<string | null>(null);
  const [, setBgTrigger] = useState(0);

  // Monitor image load completions to trigger instant canvas re-render upon dynamic fetching
  useEffect(() => {
    const handleLoad = () => {
      setBgTrigger(prev => prev + 1);
    };
    forestBgImg.onload = handleLoad;
    creekBgImg.onload = handleLoad;
    valleyBgImg.onload = handleLoad;
    
    if (forestBgImg.complete || creekBgImg.complete || valleyBgImg.complete) {
      handleLoad();
    }
  }, []);

  // Gemini Poetic Logging system states
  const [poeLogs, setPoeLogs] = useState<POELog[]>([]);
  const [isGeneratingLog, setIsGeneratingLog] = useState(false);
  const [showLogSidebar, setShowLogSidebar] = useState(false);
  const [tempActivitySummary, setTempActivitySummary] = useState<string>("");
  const [userStayedInRain, setUserStayedInRain] = useState(false);
  const [activeDiaryPopup, setActiveDiaryPopup] = useState<POELog | null>(null);
  const [isDiaryPopupLoading, setIsDiaryPopupLoading] = useState(false);

  // Canvas-based real-time 2.5D simulation variables
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const firefliesRef = useRef<Firefly[]>([]);
  const particlesRef = useRef<Array<{ x: number, y: number, vx: number, vy: number, alpha: number, size: number, hue: number }>>([]);
  const requestRef = useRef<number | null>(null);

  // Find the primary caught firefly to inspect closely
  const observedFirefly = firefliesRef.current.find(f => f.id === capturedFireflies[0]) || {
    id: "default",
    x: 50,
    y: 50,
    z: 1.0,
    vx: 0,
    vy: 0,
    hue: 82,
    brightness: 0.8,
    pulseSpeed: 1.8,
    pulsePhase: 0,
    glowIntensity: 1.2,
    isCaptured: true
  } as Firefly;
  const traits = getFireflyTraits(observedFirefly.hue);

  // Render the interactive microscopic specimen graphic depending on selected perspective & caught firefly stats
  const renderSpecimenGraphic = () => {
    const glowColor = `hsla(${observedFirefly.hue}, 100%, 65%, 0.95)`;

    switch (observationPerspective) {
      case "top":
        return (
          <div className="relative w-full h-[320px] flex items-center justify-center bg-gradient-to-b from-[#060e14] to-[#010306] border border-slate-900 rounded-2xl overflow-hidden p-6 shadow-inner">
            {/* Ambient Pulse Light Reflection */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
              <div 
                className="absolute w-[250px] h-[250px] rounded-full filter blur-3xl animate-pulse" 
                style={{ 
                  background: glowColor, 
                  left: "50%", 
                  top: "50%", 
                  transform: "translate(-50%, -50%)",
                  animationDuration: `${observedFirefly.pulseSpeed}s`
                }} 
              />
            </div>

            {/* Glowing insect outline */}
            <svg viewBox="0 0 200 200" className="w-56 h-56 drop-shadow-[0_0_20px_rgba(163,230,53,0.3)] select-none">
              <g transform="translate(0, -10)">
                {/* Antennae */}
                <path d="M 100 50 Q 80 20 60 25" stroke="#4a5568" strokeWidth="2.5" fill="none" className="animate-pulse" />
                <path d="M 100 50 Q 120 20 140 25" stroke="#4a5568" strokeWidth="2.5" fill="none" className="animate-pulse" />
                
                {/* Compound Eyes */}
                <circle cx="88" cy="54" r="5" fill="#020617" />
                <circle cx="112" cy="54" r="5" fill="#020617" />
                
                {/* Head */}
                <ellipse cx="100" cy="55" rx="15" ry="11" fill="#1e293b" />
                
                {/* Pronotum / Thorax (Luminous red-orange shell of typical fireflies) */}
                <path d="M 80 66 C 80 50, 120 50, 120 66 C 120 80, 80 80, 80 66 Z" fill="#f87171" opacity="0.9" />
                <rect x="94" y="62" width="12" height="14" rx="3" fill="#0f172a" />
                
                {/* Translucent Wings with pulsing veins matching hue */}
                <g className="animate-pulse" style={{ animationDuration: `${observedFirefly.pulseSpeed}s` }}>
                  {/* Left Outer Wing (Elytra) */}
                  <path d="M 88 74 C 40 82 45 152 92 165 C 93 120 90 92 88 74" fill="rgba(15,23,42,0.85)" stroke="#475569" strokeWidth="1.8" />
                  <path d="M 88 74 C 55 92 64 125 90 142" stroke={glowColor} strokeWidth="1.2" strokeDasharray="3,1.5" fill="none" />
                  
                  {/* Right Outer Wing (Elytra) */}
                  <path d="M 112 74 C 160 82 155 152 108 165 C 107 120 110 92 112 74" fill="rgba(15,23,42,0.85)" stroke="#475569" strokeWidth="1.8" />
                  <path d="M 112 74 C 145 92 136 125 110 142" stroke={glowColor} strokeWidth="1.2" strokeDasharray="3,1.5" fill="none" />
                </g>

                {/* Highly bright Lantern light organ on dynamic layout pulse */}
                <ellipse cx="100" cy="148" rx="14" ry="10" fill="rgba(30,41,59,0.9)" />
                <ellipse cx="100" cy="152" rx="11" ry="6.5" fill={glowColor} className="animate-pulse" style={{ animationDuration: `${observedFirefly.pulseSpeed}s` }} />
                <ellipse cx="100" cy="152" rx="7" ry="4" fill="#ffffff" className="animate-pulse opacity-90" style={{ animationDuration: `${observedFirefly.pulseSpeed}s` }} />
              </g>
            </svg>

            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-900 tracking-wider">
              🔬 DORSAL MICROANATOMY CAPTURED
            </span>
          </div>
        );

      case "side":
        return (
          <div className="relative w-full h-[320px] flex items-center justify-center bg-gradient-to-b from-[#060e14] to-[#010306] border border-slate-900 rounded-2xl overflow-hidden p-6 shadow-inner">
            {/* Expanding Concentric Bioluminescent Waves */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-30">
              <div className="absolute w-36 h-36 rounded-full border border-sky-400/20 animate-[ping_2.2s_infinite]" />
              <div 
                className="absolute w-52 h-52 rounded-full border border-dashed animate-[ping_3.5s_infinite_0.4s]" 
                style={{ borderColor: glowColor, opacity: 0.2 }} 
              />
              <div className="absolute w-[300px] h-[300px] rounded-full bg-radial-[circle_at_center,transparent_40%,rgba(0,0,0,0.8)] filter blur-md" />
            </div>

            {/* Side-profile view focusing heavily on the chemical glow organ segments */}
            <svg viewBox="0 0 200 200" className="w-56 h-56">
              <g transform="translate(0, -5)">
                {/* Abdomen segmentation */}
                <ellipse cx="100" cy="100" rx="46" ry="24" fill="#1e293b" transform="rotate(-10,100,100)" />
                
                {/* Segment joints */}
                <path d="M 75 88 Q 80 100 78 112" stroke="#475569" strokeWidth="2" fill="none" />
                <path d="M 94 82 Q 98 100 96 118" stroke="#475569" strokeWidth="2" fill="none" />
                <path d="M 112 80 Q 116 100 114 120" stroke="#475569" strokeWidth="2" fill="none" />

                {/* Reacting Phosphor Lantern segments */}
                <path 
                  d="M 114 86 C 138 86 144 100 144 105 C 140 120 120 120 114 116 Z" 
                  fill={glowColor} 
                  className="animate-pulse" 
                  style={{ animationDuration: `${observedFirefly.pulseSpeed * 0.7}s` }} 
                />
                
                {/* Supercharged white-hot center core */}
                <path 
                  d="M 122 92 C 134 92 138 98 138 102 C 134 112 122 112 118 108 Z" 
                  fill="#ffffff" 
                  className="animate-pulse" 
                  style={{ animationDuration: `${observedFirefly.pulseSpeed * 0.7}s` }} 
                />

                {/* Outward light halo circle */}
                <circle 
                  cx="130" 
                  cy="104" 
                  r="30" 
                  fill="none" 
                  stroke={glowColor} 
                  strokeWidth="1.2" 
                  className="animate-ping" 
                  style={{ animationDuration: `${observedFirefly.pulseSpeed}s` }} 
                />
              </g>
            </svg>

            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-900 tracking-wider">
              ⚡ GLOW REACTION CORE ZOOM-IN
            </span>
          </div>
        );

      case "macro":
        return (
          <div className="relative w-full h-[320px] flex items-center justify-center bg-gradient-to-b from-[#060e14] to-[#010306] border border-slate-900 rounded-2xl overflow-hidden p-6 shadow-inner">
            {/* Scientific grid mesh background representing insect perception */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                 style={{ backgroundImage: "radial-gradient(circle, #fff 1.2px, transparent 1.2px)", backgroundSize: "18px 18px" }} />

            {/* Close-up on the highly complex feathery touch sensory antennae */}
            <svg viewBox="0 0 200 200" className="w-56 h-56">
              <g stroke="#475569" strokeWidth="2.5" fill="none" strokeLinecap="round">
                {/* Antenna stem left */}
                <path d="M 100 160 Q 94 100 45 60" className="animate-[pulse_2.2s_infinite]" />
                {/* Lateral sensory hairs on left */}
                <path d="M 91 135 L 75 133" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 86 120 L 70 116" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 80 105 L 62 100" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 72 90 L 53 82" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 60 76 L 42 66" strokeWidth="1.5" stroke={glowColor} />

                {/* Antenna stem right */}
                <path d="M 100 160 Q 106 100 155 60" className="animate-[pulse_1.8s_infinite]" />
                {/* Lateral sensory hairs on right */}
                <path d="M 109 135 L 124 133" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 114 120 L 130 116" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 120 105 L 138 100" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 128 90 L 147 82" strokeWidth="1.5" stroke={glowColor} />
                <path d="M 140 76 L 158 66" strokeWidth="1.5" stroke={glowColor} />
              </g>

              {/* Luminous pheromone active nodes */}
              <circle cx="45" cy="60" r="5" fill={glowColor} className="animate-ping" />
              <circle cx="45" cy="60" r="3" fill="#ffffff" />
              <circle cx="155" cy="60" r="5" fill={glowColor} className="animate-ping" />
              <circle cx="155" cy="60" r="3" fill="#ffffff" />

              <ellipse cx="100" cy="164" rx="18" ry="10" fill="#0f172a" />
            </svg>

            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-900 tracking-wider">
              📡 PHEROMONE ANTENNAE & COMPOUND LENS
            </span>
          </div>
        );

      case "spectral":
        return (
          <div className="relative w-full h-[320px] flex items-center justify-center bg-gradient-to-b from-[#060e14] to-[#010306] border border-slate-900 rounded-2xl overflow-hidden p-6 shadow-inner">
            {/* Scientific tracking layout with glowing thermal coordinates */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e1e30_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
            
            <div className="absolute inset-x-4 bottom-4 h-12 pointer-events-none opacity-40">
              <svg viewBox="0 0 100 45" className="w-full h-full text-rose-500">
                <path 
                  d="M0,25 Q15,5 30,38 T60,25 T90,12 T100,25" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  className="animate-[dash_2s_linear_infinite]" 
                  strokeDasharray="100" 
                />
              </svg>
            </div>

            <div className="relative flex items-center justify-center scale-110">
              {/* Star orbit outlines */}
              <div className="absolute w-36 h-36 rounded-full border border-dashed border-rose-500/15 animate-[spin_12s_linear_infinite]" />
              <div className="absolute w-44 h-44 rounded-full border border-dotted border-cyan-500/20 animate-[spin_18s_linear_infinite_reverse]" />

              {/* Thermography hotspots */}
              <div 
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-600 via-rose-500 to-amber-300 filter blur-xl animate-pulse opacity-85" 
                style={{ animationDuration: "1.2s" }} 
              />
              <div className="absolute w-3 h-3 rounded-full bg-white animate-ping" />
              
              {/* Micro specs of sparks */}
              <div className="absolute w-1 h-1 rounded-full bg-cyan-300 top-2 left-10 animate-bounce" />
              <div className="absolute w-1 h-1 rounded-full bg-amber-300 bottom-4 right-8 animate-ping" />
            </div>

            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-900 tracking-wider">
              🌡️ THERMODYNAMIC ENERGY SPECTRUM
            </span>
          </div>
        );
    }
  };

  // Trigger audio initialization safely on user microgesture
  const startAtmosphereAndAudio = () => {
    if (!audioStarted) {
      startAmbientSynth();
      setAudioStarted(true);
    }
  };

  // --- INTERACTION FLOW TRIGGER ---
  const handleIntialInteract = () => {
    setHasInteracted(true);
    startAtmosphereAndAudio();
    fadeInRain(1.5);
  };

  const enterForest腹地 = () => {
    startAtmosphereAndAudio();
    fadeOutRain(4);
    fadeInForestAmbient(3);
    setStage(JourneyStage.FOREST);
    initializeFireflies(24);
  };

  const handleMutedRainStay = () => {
    setUserStayedInRain(true);
  };

  // --- ACT 3: Simulation and Canvas Setup ---
  const initializeFireflies = (count: number) => {
    const list: Firefly[] = [];
    for (let i = 0; i < count; i++) {
      list.push(createRandomFirefly());
    }
    firefliesRef.current = list;
  };

  const createRandomFirefly = (atDepth: boolean = false): Firefly => {
    const isSpecialColor = Math.random() > 0.85;
    let hue = 78 + Math.floor(Math.random() * 20); // standard yellow-green
    if (isSpecialColor) {
      hue = Math.random() > 0.5 ? 45 + Math.floor(Math.random() * 8) : 22 + Math.floor(Math.random() * 10);
    }

    return {
      id: Math.random().toString(36).substring(2, 11),
      x: Math.random() * 100,
      y: 25 + Math.random() * 55, // keep within comfortable height bounds of forest eye level
      z: 0.4 + Math.random() * 1.3, // depth factor for 3D parallax
      vx: (Math.random() * 2 - 1) * 0.12,
      vy: (Math.random() * 2 - 1) * 0.1,
      hue,
      brightness: 0.3 + Math.random() * 0.7,
      pulseSpeed: 1 + Math.random() * 2.5,
      pulsePhase: Math.random() * Math.PI * 2,
      glowIntensity: 1.0,
      isCaptured: false
    };
  };

  // Switch between webcam capture and virtual drag control
  const handleToggleControlMode = (mode: "webcam" | "virtual") => {
    startAtmosphereAndAudio();
    setControlMode(mode);
    if (mode === "webcam") {
      setIsCameraAllowed(true);
    } else {
      setIsCameraAllowed(false);
    }
  };

  const cycleNextScene = () => {
    setCurrentScene(prev => {
      if (prev === "forest") return "creek";
      if (prev === "creek") return "valley";
      return "forest";
    });
  };

  // Real webcam MediaPipe callback
  const handleHandUpdate = (hand: HandData) => {
    setHandPos({ x: hand.x, y: hand.y });
    setActiveGesture(hand.gesture);
    setTrackingConfidence(hand.confidence);

    if (hand.gesture === HandGesture.OK) {
      setActiveDiaryPopup(null);
    }
  };

  // Synchronize background image src with active scene mode & load audio/visual transitions
  useEffect(() => {
    if (stage !== JourneyStage.FOREST) return;
    if (currentScene === "creek") {
      setLastSceneChangeNotify("🌊 已切换至【萤流溪畔】场景：潺潺微波，蛙鸣微吟，萤光落水...");
    } else if (currentScene === "valley") {
      setLastSceneChangeNotify("🌌 已切换至【奇幻幽谷】场景：神木参天，幽蓝荧光，万流归谷...");
    } else {
      setLastSceneChangeNotify("🌲 已回到【幽谧林野】场景：古树参天，云霓微渺，夜林幽谧...");
    }
    const timer = setTimeout(() => {
      setLastSceneChangeNotify(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [currentScene, stage]);

  // Debounce/stabilize rapid gesture toggles to simulate rich physics and trigger sound effects
  useEffect(() => {
    if (stage !== JourneyStage.FOREST) return;

    if (activeGesture !== stabilizedGesture) {
      const timeout = setTimeout(() => {
        setStabilizedGesture(activeGesture);

        // Sound cues
        if (activeGesture === HandGesture.FIST) {
          playGrabSound();
          triggerFireflyCapture();
        } else if (activeGesture === HandGesture.OPEN && stabilizedGesture === HandGesture.FIST) {
          playReleaseSound();
          triggerFireflyRelease();
        } else if (activeGesture === HandGesture.OK) {
          setActiveDiaryPopup(null);
        } else if (activeGesture === HandGesture.DOUBLE_OPEN) {
          cycleNextScene();
        }
      }, 150); // 150ms stabilization filter
      return () => clearTimeout(timeout);
    }
  }, [activeGesture, stabilizedGesture, stage]);

  // --- CAPTURE & RELEASE ACTIONS ---
  const triggerFireflyCapture = () => {
    const list = firefliesRef.current;
    if (list.length === 0) return;

    const handXPercent = handPos.x * 100;
    const handYPercent = handPos.y * 100;

    const withDist = list.map(f => {
      const d = Math.sqrt(Math.pow(f.x - handXPercent, 2) + Math.pow(f.y - handYPercent, 2));
      return { f, d };
    });

    withDist.sort((a, b) => a.d - b.d);

    const grabLimit = 3;
    const capturedIds: string[] = [];
    let newlyCapturedCount = 0;

    for (let i = 0; i < Math.min(grabLimit, withDist.length); i++) {
      const item = withDist[i];
      if (item.d < 45) {
        if (!item.f.isCaptured) {
          newlyCapturedCount++;
        }
        item.f.isCaptured = true;
        item.f.capturedAt = Date.now();
        capturedIds.push(item.f.id);
      }
    }

    if (newlyCapturedCount > 0) {
      setTotalCaptured(prev => prev + newlyCapturedCount);
    }

    setCapturedFireflies(capturedIds);
    setCapturedAtTime(Date.now());
  };

  const triggerFireflyRelease = () => {
    const list = firefliesRef.current;
    let releasedCount = 0;
    let fireflyColorCN = "黄绿";

    list.forEach(f => {
      if (f.isCaptured) {
        f.isCaptured = false;
        f.capturedAt = undefined;
        releasedCount++;

        if (f.hue < 35) fireflyColorCN = "幽橙";
        else if (f.hue < 60) fireflyColorCN = "金黄";
        else fireflyColorCN = "黄绿";

        // Produce burst scatter particles
        for (let p = 0; p < 15; p++) {
          particlesRef.current.push({
            x: f.x,
            y: f.y,
            vx: (Math.random() * 2 - 1) * 0.5,
            vy: (Math.random() * 2 - 1) * 0.5,
            alpha: 1.0,
            size: 2.5 + Math.random() * 3.5,
            hue: f.hue
          });
        }
      }
    });

    if (releasedCount > 0) {
      setTotalReleased(prev => prev + releasedCount);
      const durationSec = capturedAtTime ? Math.round((Date.now() - capturedAtTime) / 1000) : 3;
      const countAround = list.length + Math.floor(forestDepth);
      const humidity = 85 + Math.floor(Math.sin(forestDepth / 5) * 8);
      
      const rawSummary = `用户在奇客森林中行走，前方有约${countAround}只萤火虫飘动。用户出拳合拢捕获了${releasedCount}只腹部散发${fireflyColorCN}荧光的奇妙萤火虫，手心贴近观察${durationSec}秒后张手再次放归。环境湿度${humidity}%，幽静微寒，主要由柔弱生物萤光辉映。`;
      
      setTempActivitySummary(rawSummary);
      setIsDiaryPopupLoading(true); // Open diary popup in loading state instantly!
      requestAICategoryLog(rawSummary, durationSec, fireflyColorCN);
    }

    setCapturedFireflies([]);
    setCapturedAtTime(null);
  };

  const requestAICategoryLog = async (summary: string, duration: number, color: string) => {
    setIsGeneratingLog(true);
    try {
      const response = await fetch("/api/generate-poetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: summary })
      });
      const data = await response.json();
      
      const newLog: POELog = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rawSummary: summary,
        poeticLog: data.poetry || LOCAL_POETRY_POOL[Math.floor(Math.random() * LOCAL_POETRY_POOL.length)],
        durationSec: duration,
        fireflyColor: color,
        isAI: !data.poetry?.includes("Fallback")
      };

      setPoeLogs(prev => [newLog, ...prev]);
      setActiveDiaryPopup(newLog); // Show completed diary instantly
    } catch (err) {
      console.error("AI log query failed, using local reserve", err);
      const fallbackLog: POELog = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rawSummary: summary,
        poeticLog: LOCAL_POETRY_POOL[Math.floor(Math.random() * LOCAL_POETRY_POOL.length)],
        durationSec: duration,
        fireflyColor: color,
        isAI: false
      };
      setPoeLogs(prev => [fallbackLog, ...prev]);
      setActiveDiaryPopup(fallbackLog); // Show completed diary instantly
    } finally {
      setIsGeneratingLog(false);
      setIsDiaryPopupLoading(false); // Stop loading animation
    }
  };

  // --- CANVAS LOOP FOR DYNAMIC 2.5D PHYSICS PARALLAX ---
  useEffect(() => {
    if (stage !== JourneyStage.FOREST) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localDepth = forestDepth;

    const gameLoop = () => {
      // Handle custom resolution mapping first
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // 2. Base Background Layer: Enchanted Forest Silhouette with 2.5D parallax
      const lookTiltX = (handPos.x - 0.5) * -50; 
      const lookTiltY = (handPos.y - 0.5) * -25; 

      ctx.save();
      ctx.translate(lookTiltX, lookTiltY);
      
      ctx.fillStyle = "#090f14";
      ctx.fillRect(-60, -60, width + 120, height + 120);
      try {
        ctx.globalAlpha = 0.58;
        const activeBg = currentScene === "creek" 
          ? creekBgImg 
          : currentScene === "valley" 
            ? valleyBgImg 
            : forestBgImg;
        ctx.drawImage(activeBg, -70, -50, width + 140, height + 100);
      } catch (e) {}
      ctx.restore();

      // Atmospheric mist overlays
      const mistGradient = ctx.createLinearGradient(0, 0, 0, height);
      mistGradient.addColorStop(0, "rgba(5, 12, 19, 0.4)");
      mistGradient.addColorStop(0.5, "rgba(12, 33, 29, 0.2)");
      mistGradient.addColorStop(1, "rgba(4, 9, 12, 0.82)");
      
      ctx.fillStyle = mistGradient;
      ctx.fillRect(0, 0, width, height);

      // 3. Movement Logic: Walking if OPEN or DOUBLE_OPEN
      const isWalking = stabilizedGesture === HandGesture.OPEN || stabilizedGesture === HandGesture.DOUBLE_OPEN;
      let depthSpeed = 0;
      if (stabilizedGesture === HandGesture.DOUBLE_OPEN) {
        depthSpeed = 0.16; // Double palms move deeper faster!
      } else if (stabilizedGesture === HandGesture.OPEN) {
        depthSpeed = 0.08;
      }
      if (depthSpeed > 0) {
        localDepth += depthSpeed;
        setForestDepth(localDepth);

        const targetAngle = (handPos.x - 0.5) * 0.35;
        setRotationAngle(prev => prev + (targetAngle - prev) * 0.05);
      }

      // 4. Update and Render Active Fireflies
      const list = firefliesRef.current;
      const handXPercent = handPos.x * 100;
      const handYPercent = handPos.y * 100;

      if (list.length < 32 && isWalking && Math.random() > 0.94) {
        list.push(createRandomFirefly(true));
      }

      list.forEach(f => {
        if (f.isCaptured) {
          const targetX = handXPercent;
          const targetY = handYPercent;
          
          const idleBuzzX = Math.sin(Date.now() / 140 + f.pulsePhase) * 1.8;
          const idleBuzzY = Math.cos(Date.now() / 140 + f.pulsePhase) * 1.8;
          
          f.x += (targetX - f.x) * 0.12 + idleBuzzX * 0.04;
          f.y += (targetY - f.y) * 0.12 + idleBuzzY * 0.04;

          f.pulseSpeed = 6.5;
          f.glowIntensity = 2.4;
        } else {
          let forwardPush = 0;
          if (isWalking) {
            forwardPush = depthSpeed * 0.7 * f.z;
          }

          f.x += f.vx;
          f.y += f.vy + Math.sin(Date.now() / 750 + f.pulsePhase) * 0.025;

          if (isWalking) {
            const dx = f.x - 50;
            const dy = f.y - 45;
            f.x += dx * 0.002 * f.z;
            f.y += dy * 0.002 * f.z;
          }

          if (f.x < -15) { f.x = 115; f.y = 25 + Math.random() * 55; }
          if (f.x > 115) { f.x = -15; f.y = 25 + Math.random() * 55; }
          if (f.y < -15) f.y = 100;
          if (f.y > 115) f.y = 0;

          f.pulseSpeed = 1.3 + Math.sin(f.pulsePhase);
          f.glowIntensity = 1.0;
        }

        const currentReflectTime = Date.now() / 1000;
        const pulseRatio = (Math.sin(currentReflectTime * f.pulseSpeed + f.pulsePhase) + 1.0) / 2.0;
        const brightness = (0.28 + pulseRatio * 0.72) * f.glowIntensity;
        const sizeMultiplier = f.z * (3.5 + brightness * 5.5);

        const drawX = (f.x / 100) * width;
        const drawY = (f.y / 100) * height;

        ctx.save();
        const innerGlowRadius = sizeMultiplier * 0.75;
        const outerHaloRadius = sizeMultiplier * 3.6;

        const glowGrad = ctx.createRadialGradient(drawX, drawY, innerGlowRadius * 0.1, drawX, drawY, outerHaloRadius);
        glowGrad.addColorStop(0, `hsla(${f.hue}, 95%, 78%, ${brightness})`);
        glowGrad.addColorStop(0.25, `hsla(${f.hue}, 95%, 66%, ${brightness * 0.58})`);
        glowGrad.addColorStop(0.65, `hsla(${f.hue}, 90%, 48%, ${brightness * 0.14})`);
        glowGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(drawX, drawY, outerHaloRadius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = `hsla(${f.hue}, 100%, 95%, ${brightness})`;
        ctx.beginPath();
        ctx.arc(drawX, drawY, Math.max(1.8, sizeMultiplier * 0.24), 0, 2 * Math.PI);
        ctx.fill();

        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${f.hue}, 100%, 62%, 0.85)`;
        ctx.restore();
      });

      // 5. Render Scatter Particles
      const pList = particlesRef.current;
      for (let i = pList.length - 1; i >= 0; i--) {
        const p = pList[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.022;
        p.size *= 0.97;

        if (p.alpha <= 0) {
          pList.splice(i, 1);
          continue;
        }

        const pDrawX = (p.x / 100) * width;
        const pDrawY = (p.y / 100) * height;

        ctx.save();
        ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${p.alpha})`;
        ctx.shadowBlur = 7;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 55%, 0.9)`;
        ctx.beginPath();
        ctx.arc(pDrawX, pDrawY, p.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }

      // 6. Draw Virtual Target Pointer
      const targetPxX = handPos.x * width;
      const targetPxY = handPos.y * height;

      ctx.save();
      ctx.beginPath();
      ctx.arc(targetPxX, targetPxY, stabilizedGesture === HandGesture.FIST ? 7 : 11, 0, 2 * Math.PI);
      ctx.strokeStyle = stabilizedGesture === HandGesture.FIST ? "rgba(224, 242, 254, 0.5)" : "rgba(163, 230, 53, 0.55)";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(targetPxX, targetPxY, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = stabilizedGesture === HandGesture.FIST ? "#38bdf8" : "#a3e635";
      ctx.shadowBlur = stabilizedGesture === HandGesture.FIST ? 14 : 7;
      ctx.shadowColor = "#a3e635";
      ctx.fill();
      ctx.restore();

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [stage, handPos, stabilizedGesture, forestDepth, currentScene]);

  const handleVirtualClickStage = (gesture: HandGesture) => {
    startAtmosphereAndAudio();
    setActiveGesture(gesture);
    if (gesture === HandGesture.OK) {
      setActiveDiaryPopup(null);
    }
    if (gesture === HandGesture.DOUBLE_OPEN) {
      cycleNextScene();
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (controlMode !== "virtual") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setHandPos({ x, y });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      stopAllAmbientSynth();
    } else {
      if (audioStarted) {
        startAmbientSynth();
        if (stage === JourneyStage.AWA_RAIN) {
          fadeInRain(1.2);
        } else if (stage === JourneyStage.INVITATION) {
          fadeInRain(2);
          fadeInForestAmbient(2);
        } else {
          fadeInForestAmbient(1.5);
        }
      } else {
        startAtmosphereAndAudio();
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#03070c] text-slate-100 font-sans select-none overflow-hidden flex flex-col justify-between">
      
      {/* Invisible deep pre-loaders to guarantee perfect background graphic loads in production deployments */}
      <div className="hidden pointer-events-none" aria-hidden="true" style={{ display: "none" }}>
        <img src={deepEnchantedForest} alt="forest-background-preloader" />
        <img src={creekSideNight} alt="creek-background-preloader" />
        <img src={valleySideNight} alt="valley-background-preloader" />
        <img src={rainyForestNight} alt="rainy-background-preloader" />
      </div>
      {/* 1. INITIAL COVER WALL (Secure user microgesture to run high-quality Web Audio context) */}
      {!hasInteracted && (
        <div 
          onClick={handleIntialInteract}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black cursor-pointer transition-all duration-1000"
          id="intial_interact_screen"
        >
          <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(16,36,24,0.15),transparent] animate-pulse" />
          
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <div className="w-20 h-20 rounded-full border border-lime-500/30 bg-lime-500/5 flex items-center justify-center mb-8 shadow-[0_0_35px_rgba(163,230,53,0.1)] hover:scale-105 transition-transform duration-500">
              <span className="w-4 h-4 bg-lime-400 rounded-full animate-ping" />
              <span className="absolute w-4 h-4 bg-lime-400 rounded-full" />
            </div>

            <h1 className="text-xl md:text-2xl font-light tracking-widest text-[#f8fafc]">
              奇秘森林 · 萤火手势交互
            </h1>
            <p className="text-slate-400 text-xs tracking-wider mt-2.5 max-w-md leading-relaxed font-mono">
              The Ambient Whispers of Luminaries
            </p>

            <span className="mt-14 inline-flex items-center gap-2 text-xs text-lime-400 bg-lime-950/30 border border-lime-500/20 px-5 py-2.5 rounded-full font-medium tracking-widest animate-pulse shadow-[0_0_15px_rgba(163,230,53,0.1)]">
              🌿 点击触碰 开启寻光之旅 🌿
            </span>
            
            <p className="text-slate-600 text-[10px] sm:text-xs mt-6 tracking-wide max-w-xs leading-normal">
              此操作将呼唤云端声谱合成，伴随林间雨鸣
            </p>
          </div>
        </div>
      )}

      {/* 2. ACT 1 & ACT 2 SCREEN CONTAINER: Pitch-Black, Floating Rain Text, Delayed stop, isExplore Dialog */}
      {hasInteracted && stage !== JourneyStage.FOREST && (
        <div 
          onClick={() => {
            if (secondsElapsed === 0) {
              setSecondsElapsed(1);
              setShowOptions(true);
            }
          }}
          className={`absolute inset-0 z-40 bg-black flex flex-col items-center justify-center text-center transition-all duration-700 ${secondsElapsed === 0 ? "cursor-pointer select-none" : ""}`}
        >
          
          {/* Immersive HTML5 canvas-based interactive rainfall animation */}
          <RainCanvas isRaining={secondsElapsed === 0} />
          
          {/* Subtle lightning dust particles or rain droplets animation layer */}
          {secondsElapsed === 0 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
              <div className="absolute top-[-200px] left-0 right-0 bottom-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1.2px,transparent_1.2px)] bg-[size:120px_50px] animate-[slide_0.5s_linear_infinite]" 
                   style={{ transform: "rotate(10deg) scale(1.6)" }} />
            </div>
          )}
          
          <div className="relative z-10 flex flex-col items-center px-6 max-w-lg transition-transform duration-500">
            
            {/* Act Stages Text Rendering */}
            {secondsElapsed === 0 ? (
              <div className="animate-fade-in flex flex-col items-center justify-center space-y-5">
                <div className="w-12 h-12 rounded-full border border-blue-400/30 bg-blue-500/5 flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.25)]">
                  <Music className="w-4 h-4 text-blue-400 animate-bounce" />
                </div>
                <h2 className="text-2xl md:text-3xl font-light tracking-widest font-sans text-slate-100 animate-pulse">
                  下雨了...
                </h2>
                <div className="bg-slate-950/80 py-2.5 px-5 rounded-full border border-slate-900 shadow-lg">
                  <p className="text-lime-405 text-xs tracking-widest font-sans font-medium text-lime-400 animate-pulse">
                    💡 点击屏幕任意位置让雨停下来
                  </p>
                </div>
                <p className="text-slate-500 text-[10px] tracking-wider font-mono">Click anywhere to stop the rain</p>
              </div>
            ) : (
              <div className="animate-fade-in flex flex-col items-center justify-center">
                
                {/* Check if user chosen "NO" (Stay under Eaves) */}
                {userStayedInRain ? (
                  <div className="flex flex-col items-center space-y-6">
                    <div className="w-14 h-14 rounded-full border border-amber-500/30 bg-amber-500/5 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.08)]">
                      <Moon className="w-5 h-5 text-amber-400 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-light text-slate-200 tracking-wide">
                        檐下听雨 · 闲度寂夜
                      </h3>
                      <p className="text-slate-400 text-xs tracking-wide max-w-sm leading-relaxed">
                        你静静留在屋檐下避雨。细雨淅沥，在昏黑的虚空里织成长卷。远方林野的树叶间，隐约闪动起小片淡绿色的流光。
                      </p>
                    </div>

                    <div className="pt-8 flex flex-col gap-3 w-full">
                      <button
                        onClick={() => {
                          setUserStayedInRain(false);
                          enterForest腹地();
                        }}
                        className="w-full bg-lime-400 hover:bg-lime-300 text-slate-950 font-bold text-xs tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-[0_4px_30px_rgba(163,230,53,0.15)] flex items-center justify-center gap-2"
                      >
                        <span>🌿 改变主意：进入森林探奇</span>
                        <ChevronRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-6">
                    <div className="w-14 h-14 rounded-full border border-lime-400/20 bg-lime-400/5 flex items-center justify-center shadow-[0_0_25px_rgba(163,230,53,0.12)]">
                      <Moon className="w-5 h-5 text-lime-400 animate-pulse" />
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-lime-400 text-[10px] font-mono tracking-widest uppercase animate-pulse">NATURAL APPRECIATION</p>
                      <h2 className="text-2xl md:text-3xl font-light tracking-widest font-sans text-slate-100">
                        雨停了
                      </h2>
                    </div>

                    <div className="bg-slate-950/80 p-4 border border-slate-900 rounded-xl">
                      <p className="text-slate-300 text-xs tracking-wider max-w-xs leading-relaxed">
                        细雨渐歇，夜空凝出幽邃深青。<br />
                        前方的森林，深潭般幽深寂静。<br />
                        是否要独自进去探查一番？
                      </p>
                    </div>

                    {showOptions && (
                      <div className="flex flex-col sm:flex-row gap-4 w-full pt-4">
                        <button
                          onClick={enterForest腹地}
                          className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 font-bold text-xs tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-[0_4px_25px_rgba(163,230,53,0.25)] flex items-center justify-center gap-2"
                          id="btn_explore_yes"
                        >
                          <span>是</span>
                          <ChevronRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                        </button>

                        <button
                          onClick={handleMutedRainStay}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs tracking-widest px-6 py-3.5 rounded-xl transition-all flex items-center justify-center"
                          id="btn_explore_no"
                        >
                          <span>否</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Quick exit interaction cover on top right of intro */}
          <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-xl border transition-all ${
                isMuted
                  ? "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400"
                  : "bg-blue-950/20 border-blue-500/20 text-blue-400 hover:bg-blue-950/40"
              }`}
              title={isMuted ? "开启声音" : "静音环境音"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* 3. ACT 3 & 4 FULL-SCREEN IMMERSIVE EXPERIENTIAL CANVAS */}
      {stage === JourneyStage.FOREST && (
        <div className="absolute inset-0 w-screen h-screen z-0 overflow-hidden" onMouseMove={handlePointerMove}>
          
          {/* THE REAL-TIME 3D PERSPECTIVE PHYSICS CANVAS */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block bg-[#03070c]"
            id="enchanted_forest_canvas"
          />

          {/* HUD GLASS PANEL 1: Title Header Bar */}
          <header className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-between items-center sm:items-start">
            <div className="p-3 bg-slate-950/70 backdrop-blur-md border border-slate-900 rounded-xl flex items-center gap-3 shadow-lg pointer-events-auto">
              <div className="w-2.5 h-2.5 bg-lime-400 rounded-full animate-pulse relative">
                <span className="absolute inset-0 rounded-full bg-lime-400 animate-ping opacity-75" />
              </div>
              <div>
                <h1 className="font-extrabold text-[11px] tracking-widest uppercase text-slate-200">萤火交互 · 奇秘森林</h1>
                <p className="text-[9px] font-mono text-lime-400 tracking-wider">
                  Depth Level: {forestDepth.toFixed(1)}m | 累计捕捉: <span className="font-bold text-sky-400">{totalCaptured}</span> 只 | 已放飞: <span className="font-bold text-emerald-400">{totalReleased}</span> 只
                </p>
              </div>
            </div>

            {/* Real-time Scene Transition Overlay Notification Banner */}
            {lastSceneChangeNotify && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 text-lime-450 border border-lime-500/30 px-4 py-2 rounded-xl shadow-[0_0_25px_rgba(163,230,53,0.15)] flex items-center gap-2 animate-pulse pointer-events-none text-[10px] sm:text-xs">
                <span className="w-2 h-2 bg-lime-400 rounded-full animate-ping mr-1" />
                <span className="text-slate-200">{lastSceneChangeNotify}</span>
              </div>
            )}

            {/* Muted and control modes floats */}
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={toggleMute}
                className={`p-2.5 rounded-xl border backdrop-blur-md transition-all shadow-md ${
                  isMuted
                    ? "bg-slate-950/80 border-slate-900 text-slate-500"
                    : "bg-lime-950/30 border-lime-500/30 text-lime-400 hover:bg-lime-950/50"
                }`}
                title={isMuted ? "解锁扬声器" : "静音自然音"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowLogSidebar(!showLogSidebar)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border backdrop-blur-md transition-all text-xs font-semibold shadow-md ${
                  showLogSidebar
                    ? "bg-lime-400 border-lime-400 text-slate-950 font-bold"
                    : "bg-slate-950/80 border-slate-900 text-slate-300 hover:text-white"
                }`}
              >
                <Feather className="w-3.5 h-3.5" />
                <span>诗意日记 ({poeLogs.length})</span>
              </button>
            </div>
          </header>

          {/* HUD GLASS PANEL 2: Interactive Controls Widget (Bottom Left Floating overlays) */}
          <div className="absolute bottom-4 left-4 z-30 max-w-sm flex flex-col gap-3 pointer-events-none">
            
            {/* Environment telemetry metrics */}
            <div className="p-3.5 bg-slate-950/75 backdrop-blur-xl border border-slate-900 rounded-xl shadow-lg pointer-events-auto">
              <div className="flex items-center justify-between gap-6 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Forest Radar</span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  {controlMode === "webcam" ? "💻 CAMERA ACTIVE" : "🖱️ VIRTUAL HOVER"}
                </span>
              </div>
              
              <p className="text-xs text-slate-300 tracking-wide mb-3 animate-fade-in">
                {stabilizedGesture === HandGesture.DOUBLE_OPEN
                  ? "🖐️🖐️ 状态：双掌齐开。正在唤醒时空法则，切换场景，当前引导您倍速漫步幽邃 (加速 0.16m/s)。"
                  : stabilizedGesture === HandGesture.OPEN 
                    ? "🖐️ 状态：展开手掌。正在树林腹地缓慢漫步探查 (0.08m/s)..." 
                    : stabilizedGesture === HandGesture.OK
                      ? "👌 状态：OK手势。灵敏合拢已弹出的日记诗集窗口。"
                      : "✊ 状态：五指握拢。萤火虫凝聚于掌心，可供超微距观察特性。"
                }
              </p>

              {/* Active Scene Switcher Button Group */}
              <div className="mb-3 font-sans">
                <span className="text-[8px] uppercase font-bold tracking-widest text-slate-500 font-mono block mb-1">Active Scene (当前场景)</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-black/60 border border-slate-900 rounded-lg">
                  <button
                    onClick={() => setCurrentScene("forest")}
                    className={`py-1 text-[8px] font-bold rounded transition-all whitespace-nowrap ${
                      currentScene === "forest"
                        ? "bg-lime-500/20 text-lime-400 border border-lime-500/40"
                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    🌲 幽谧林野
                  </button>
                  <button
                    onClick={() => setCurrentScene("creek")}
                    className={`py-1 text-[8px] font-bold rounded transition-all whitespace-nowrap ${
                      currentScene === "creek"
                        ? "bg-sky-500/20 text-sky-450 border border-sky-500/40"
                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    🌊 潺潺溪畔
                  </button>
                  <button
                    onClick={() => setCurrentScene("valley")}
                    className={`py-1 text-[8px] font-bold rounded transition-all whitespace-nowrap ${
                      currentScene === "valley"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                        : "text-slate-500 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    🌌 奇幻幽谷
                  </button>
                </div>
              </div>

              {/* Mode Control Selector */}
              <div className="flex gap-2 p-1 bg-black border border-slate-900 rounded-lg font-sans">
                <button
                  onClick={() => handleToggleControlMode("virtual")}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all ${
                    controlMode === "virtual"
                      ? "bg-lime-400 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🖱️ 鼠标交互
                </button>
                <button
                  onClick={() => handleToggleControlMode("webcam")}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all ${
                    controlMode === "webcam"
                      ? "bg-lime-400 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📷 摄像头识别
                </button>
              </div>

              {/* Control helper inside virtual mode */}
              {controlMode === "virtual" && (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleVirtualClickStage(HandGesture.OPEN)}
                    className={`py-2 px-0.5 rounded-lg border text-[9px] font-bold flex flex-col items-center gap-1 transition-all ${
                      stabilizedGesture === HandGesture.OPEN
                        ? "bg-lime-400/20 border-lime-400 text-lime-300 shadow-md"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-sm">🖐️</span>
                    <span>张手(前行)</span>
                  </button>

                  <button
                    onClick={() => handleVirtualClickStage(HandGesture.FIST)}
                    className={`py-2 px-0.5 rounded-lg border text-[9px] font-bold flex flex-col items-center gap-1 transition-all ${
                      stabilizedGesture === HandGesture.FIST
                        ? "bg-sky-400/20 border-sky-400 text-sky-300 shadow-md"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-sm">✊</span>
                    <span>握拳(捕捉)</span>
                  </button>

                  <button
                    onClick={() => handleVirtualClickStage(HandGesture.OK)}
                    className={`py-2 px-0.5 rounded-lg border text-[9px] font-bold flex flex-col items-center gap-1 transition-all ${
                      stabilizedGesture === HandGesture.OK
                        ? "bg-amber-400/20 border-amber-400 text-amber-300 shadow-md"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-xs">👌</span>
                    <span>OK(关闭)</span>
                  </button>

                  <button
                    onClick={() => handleVirtualClickStage(HandGesture.DOUBLE_OPEN)}
                    className={`py-2 px-0.5 rounded-lg border text-[9px] font-bold flex flex-col items-center gap-1 transition-all ${
                      stabilizedGesture === HandGesture.DOUBLE_OPEN
                        ? "bg-emerald-400/20 border-emerald-400 text-emerald-300 shadow-md"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-sm">🖐️🖐️</span>
                    <span>双掌(溪边)</span>
                  </button>
                </div>
              )}
            </div>

            {/* WEBCAM DETECTOR DRAWER: Renders Webcam frame securely and displays live */}
            <div className="pointer-events-auto">
              <HandDetector
                onHandUpdate={handleHandUpdate}
                isActive={stage === JourneyStage.FOREST && controlMode === "webcam"}
                isCameraAllowed={isCameraAllowed}
                setIsCameraAllowed={setIsCameraAllowed}
              />
            </div>

          </div>

          {/* HUD GLASS PANEL 3: Slide-out Poetic Logs (Expanding Sidebar on the Right) */}
          {showLogSidebar && (
            <section className="absolute right-4 top-20 bottom-4 w-80 z-30 bg-slate-950/85 backdrop-blur-xl border border-slate-900 rounded-2xl p-4 flex flex-col justify-between shadow-2xl pointer-events-auto animate-fade-in">
              
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-4">
                  <div className="flex items-center gap-2">
                    <Feather className="w-4 h-4 text-lime-400" />
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs tracking-wider">星光密语日记</h4>
                      <p className="text-[9px] text-slate-400">Google AI 捕捉你的动作诗意</p>
                    </div>
                  </div>
                  
                  <span className="text-[8px] tracking-widest font-bold bg-cyan-950 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono uppercase">
                    Model: Flash
                  </span>
                </div>

                {/* Latest Technical summary tracker */}
                <div className="bg-slate-900/50 border border-slate-900 rounded-xl p-3 mb-4 text-[11px] leading-relaxed">
                  <span className="text-[8px] font-extrabold text-slate-400 block tracking-widest mb-1">CURRENT SENSORY FEED:</span>
                  <p className="text-slate-300 italic text-[11px]">
                    {tempActivitySummary ? `"${tempActivitySummary}"` : "「无活动捕捉，请收拢五指(✊)吸附萤火虫并展开(🖐️)放生，以更新旅途日记。」"}
                  </p>
                </div>

                {/* Poetry listing wrapper */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
                  <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase block mb-1">
                    行走游记 ({poeLogs.length})
                  </span>

                  {isGeneratingLog && (
                    <div className="bg-lime-950/20 border border-lime-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 animate-pulse">
                      <Sparkles className="w-4 h-4 text-lime-400 animate-spin" />
                      <span className="text-[10px] text-lime-300 font-medium leading-none">正在呼唤密林精灵转译古语诗集...</span>
                    </div>
                  )}

                  {poeLogs.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-900 rounded-xl bg-slate-900/10">
                      <BookOpen className="w-7 h-7 text-slate-700 mb-2" />
                      <p className="text-slate-400 text-xs">日记空白中</p>
                      <p className="text-[10px] text-slate-500 max-w-[200px] mt-1 pr-1 pl-1">
                        握拢五指近距离捕获观察萤火虫，并在放飞后将实时生成一首幽美日记诗。
                      </p>
                    </div>
                  ) : (
                    poeLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="relative pl-3.5 pr-2 py-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-900 hover:border-slate-800 rounded-xl transition-all flex flex-col gap-1.5 overflow-hidden group"
                      >
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-lime-400" />
                        
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-slate-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                            {log.timestamp}
                          </span>
                          <span className="text-slate-400 font-mono">
                            观察 <strong className="text-lime-400 font-bold">{log.durationSec}s</strong> | <strong className="text-sky-300">{log.fireflyColor}</strong>
                          </span>
                        </div>

                        <p className="text-xs font-serif italic text-lime-100 font-bold leading-relaxed mt-1">
                          {log.poeticLog}
                        </p>

                        <p className="text-[9px] text-slate-500 truncate mt-1">
                          {log.rawSummary}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sidebar bottom signature */}
              <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between text-[8px] text-slate-500 font-mono">
                <span>HUMIDITY: 88%</span>
                <span>WIND SPEED: 0.2M/S</span>
              </div>
            </section>
          )}

          {/* Floating Instruction Guides overlay at top center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none hidden md:block">
            <div className="px-4 py-2 bg-slate-950/70 border border-slate-900 rounded-full backdrop-blur-md shadow-md text-[10px] text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
              <span>💡 指南：<strong>拖拽/掠拂屏幕</strong>改变视角和位移；使用下方或摄像头指令，握拳<strong>✊ 抓取萤火虫</strong></span>
            </div>
          </div>

          {/* Captured Immersive Detailed Observation Page Overlay */}
          {capturedFireflies.length > 0 && (
            <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div 
                className="bg-slate-950/90 border border-slate-850/80 rounded-3xl p-5 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(163,230,53,0.15)] flex flex-col gap-6"
                id="firefly-observation-deck"
              >
                
                {/* Header info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-900 pb-4">
                  <div>
                    <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">
                      🔍 Microscopic Specimen Inspection
                    </span>
                    <h3 className="text-xl md:text-2xl font-light tracking-wider text-slate-100 flex items-center gap-2 mt-1">
                      <span>仔细观察手里的萤火虫</span>
                      <span className="inline-block w-2 h-2 rounded-full bg-lime-400 animate-ping" />
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">
                      已捕获数量: <strong className="text-sky-400 font-bold">{capturedFireflies.length}</strong> 只
                    </span>
                  </div>
                </div>

                {/* Main Grid: Left Specimen Visualizer, Right Perspective Switches & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                  
                  {/* Left Side: Dynamic Visualizer View (5 cols) */}
                  <div className="md:col-span-5 flex flex-col gap-3 justify-center">
                    {renderSpecimenGraphic()}
                    
                    {/* Tiny micro metrics */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-900/40 border border-slate-900 rounded-xl p-3">
                      <div>
                        <span className="text-slate-500 block text-[8px] tracking-wider font-extrabold">WAVE RANGE</span>
                        <span className="text-slate-300 font-bold">{traits.spectralName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] tracking-wider font-extrabold">ENERGY BASE</span>
                        <span className="text-slate-300 font-bold">~{(observedFirefly.brightness * 12).toFixed(1)} mCd</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Perspectives and biological taxonomy logs (7 cols) */}
                  <div className="md:col-span-7 flex flex-col justify-between gap-4">
                    
                    {/* Viewpoint Selector Switches */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block mb-2.5 font-mono">
                        切换观察视角 (Switch Observation Points)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => setObservationPerspective("top")}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                            observationPerspective === "top"
                              ? "bg-lime-400/20 border-lime-400 text-lime-400 shadow-lg"
                              : "bg-slate-900/60 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          <span>背部特写</span>
                        </button>

                        <button
                          onClick={() => setObservationPerspective("side")}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                            observationPerspective === "side"
                              ? "bg-lime-400/20 border-lime-400 text-lime-400 shadow-lg"
                              : "bg-slate-900/60 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                        >
                          <Compass className="w-4 h-4" />
                          <span>发光腺体</span>
                        </button>

                        <button
                          onClick={() => setObservationPerspective("macro")}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                            observationPerspective === "macro"
                              ? "bg-lime-400/20 border-lime-400 text-lime-400 shadow-lg"
                              : "bg-slate-900/60 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                        >
                          <Wind className="w-4 h-4" />
                          <span>触角复眼</span>
                        </button>

                        <button
                          onClick={() => setObservationPerspective("spectral")}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                            observationPerspective === "spectral"
                              ? "bg-lime-400/20 border-lime-400 text-lime-400 shadow-lg"
                              : "bg-slate-900/60 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                          }`}
                        >
                          <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: "12s" }} />
                          <span>能量热谱</span>
                        </button>
                      </div>
                    </div>

                    {/* Taxonomy scientific analysis */}
                    <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">学名 (English Name):</span>
                        <strong className="text-slate-200 font-mono italic">Luciola laticollis (端黑萤)</strong>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">发光主色 (Emission Color):</span>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: `hsla(${observedFirefly.hue}, 100%, 15%, 0.5)`, color: `hsla(${observedFirefly.hue}, 100%, 75%, 1)` }}>
                          {traits.colorName}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">珍惜度评估 (Species Rarity):</span>
                        <strong className="text-sky-300 tracking-wide font-mono font-bold text-[11px]">{traits.rarity}</strong>
                      </div>

                      <div className="border-t border-slate-800/80 pt-2.5 text-xs text-slate-300 leading-relaxed font-sans">
                        <span className="font-bold text-slate-400 block mb-1">生态特征 (Eco-Profile):</span>
                        {traits.description}
                      </div>
                    </div>

                    {/* Natural release rules callout box */}
                    <div className="bg-lime-950/30 border border-lime-500/20 p-4 rounded-xl flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400 text-xs mt-0.5 font-bold">
                        🖐️
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-emerald-300">自然法则：张开手掌即可放飞</h5>
                        <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                          {controlMode === "webcam"
                            ? "📷 摄像头模块正在密切侦测。请在镜头前【张开手掌 (🖐️)】，小精灵就会受本能指引张翅飞走。"
                            : "🖱️ 鼠标交互模式下。点击下方按钮，或在侧边栏切换回【🖐️ 张手 (前行)】状态，便能将它放回树木深处。"}
                        </p>
                      </div>
                    </div>

                    {/* Return buttons */}
                    {controlMode === "virtual" && (
                      <button
                        onClick={() => handleVirtualClickStage(HandGesture.OPEN)}
                        className="w-full bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs tracking-widest py-3.5 rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 animate-bounce-short"
                      >
                        <span>🖐️ 张开手掌，将萤火虫放归森林</span>
                      </button>
                    )}

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Poetic Diary Popup Modal Card when released */}
          {(isDiaryPopupLoading || activeDiaryPopup !== null) && (
            <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div 
                className="bg-slate-950/90 border border-slate-900 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-[0_0_50px_rgba(163,230,53,0.12)] relative overflow-hidden flex flex-col gap-6"
                id="poetic-diary-deck"
              >
                {/* Glow ring in background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-lime-500/5 filter blur-3xl pointer-events-none" />

                {isDiaryPopupLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border border-lime-500/25 bg-lime-950/30 flex items-center justify-center shadow-lg">
                        <Sparkles className="w-6 h-6 text-lime-400 animate-spin" style={{ animationDuration: "3s" }} />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 tracking-widest font-mono">
                        研墨落笔
                      </h4>
                      <p className="text-xs text-lime-404/80 text-lime-300 mt-1 max-w-xs mx-auto leading-relaxed">
                        微风正摇动枝桠，转译你的行迹为诗篇...
                      </p>
                    </div>
                  </div>
                ) : activeDiaryPopup && (
                  <div className="relative flex flex-col gap-5 text-center animate-scale-up">
                    {/* Header */}
                    <div className="flex flex-col items-center justify-center gap-1.5 border-b border-slate-900 pb-4">
                      <span className="text-[9px] bg-lime-950 text-lime-405 text-lime-400 border border-lime-500/20 px-2.5 py-1 rounded-full font-mono font-bold tracking-widest uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>旅人诗意游记 • POETRY JOURNAL</span>
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        时间: {activeDiaryPopup.timestamp} | 观察时长: {activeDiaryPopup.durationSec}秒 | 品种: {activeDiaryPopup.fireflyColor}
                      </p>
                    </div>

                    {/* Poetic Lines Display */}
                    <div className="py-5 px-3 my-2 bg-slate-900/30 rounded-2xl border border-slate-900/40 relative">
                      {/* Decorative quotes icons */}
                      <span className="absolute top-1 left-3 text-7xl text-slate-800 font-serif leading-none select-none opacity-30 pointer-events-none">“</span>
                      <p className="text-sm md:text-base font-serif italic text-lime-100 font-bold leading-loose tracking-wider max-w-md mx-auto pt-4 pb-2 relative z-10">
                        {activeDiaryPopup.poeticLog}
                      </p>
                      <span className="absolute bottom-[-1.5rem] right-3 text-7xl text-slate-800 font-serif leading-none select-none opacity-30 pointer-events-none">”</span>
                    </div>

                    {/* Technical details context feed */}
                    <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 text-left">
                      <span className="text-[8px] font-extrabold text-slate-500 block tracking-wider uppercase mb-1">
                        🌲 触觉细节记录 (SENSORY FEED)
                      </span>
                      <p className="text-slate-400 text-[10px] leading-relaxed italic">
                        {activeDiaryPopup.rawSummary}
                      </p>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      onClick={() => setActiveDiaryPopup(null)}
                      className="mt-2 w-full bg-slate-900 hover:bg-slate-800 text-lime-400 font-bold text-xs tracking-widest py-3.5 rounded-xl transition-all shadow-md active:scale-95 border border-slate-800 flex items-center justify-center gap-2 group"
                    >
                      <span>抚袖去，归于深林 (Return to Forest)</span>
                      <ChevronRight className="w-4 h-4 text-lime-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 4. FOOTER CREDITS OUTCOME */}
      {stage !== JourneyStage.FOREST && (
        <footer className="relative z-10 py-5 bg-black/80 text-center text-[10px] text-slate-600 border-t border-slate-950">
          <p>© 2026 奇秘森林萤火交互 · Powered by Antigravity and @google/genai TypeScript SDK.</p>
        </footer>
      )}
    </div>
  );
}
