import React, { useEffect, useRef, useState } from "react";
import { HandData, HandGesture } from "../types";
import { Camera as CameraIcon, Check, EyeOff, Loader2, Sparkles, Video, AlertCircle } from "lucide-react";

interface HandDetectorProps {
  onHandUpdate: (data: HandData) => void;
  isActive: boolean;
  isCameraAllowed: boolean;
  setIsCameraAllowed: (allowed: boolean) => void;
}

export default function HandDetector({
  onHandUpdate,
  isActive,
  isCameraAllowed,
  setIsCameraAllowed
}: HandDetectorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [libStatus, setLibStatus] = useState<"uninitialized" | "loading" | "ready" | "error">("uninitialized");
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detectedGesture, setDetectedGesture] = useState<HandGesture>(HandGesture.UNKNOWN);
  
  const cameraInstanceRef = useRef<any>(null);
  const handsInstanceRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeLoopRef = useRef<number | null>(null);

  // Dynamically load MediaPipe script dependencies onto window
  useEffect(() => {
    if (!isActive || !isCameraAllowed) {
      cleanup();
      return;
    }

    if (window.hasOwnProperty("Hands")) {
      setLibStatus("ready");
      initMediaPipe();
      return;
    }

    setLibStatus("loading");
    setErrorMessage("");
    
    // Inject MediaPipe camera_utils script
    const cameraScript = document.createElement("script");
    cameraScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
    cameraScript.async = true;

    // Inject MediaPipe hands script
    const handsScript = document.createElement("script");
    handsScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
    handsScript.async = true;

    let scriptsLoaded = 0;
    const checkReady = () => {
      scriptsLoaded++;
      if (scriptsLoaded === 2) {
        setLibStatus("ready");
        initMediaPipe();
      }
    };

    cameraScript.onload = checkReady;
    handsScript.onload = checkReady;
    cameraScript.onerror = () => {
      // Even if cameraScript fails, handsScript might succeed and we can run native fallback!
      scriptsLoaded++;
      if (scriptsLoaded === 2) {
        setLibStatus("ready");
        initMediaPipe();
      } else {
        setLibStatus("loading");
      }
    };
    handsScript.onerror = () => setLibStatus("error");

    document.head.appendChild(cameraScript);
    document.head.appendChild(handsScript);

    return () => {
      cleanup();
    };
  }, [isActive, isCameraAllowed]);

  const cleanup = () => {
    setErrorMessage("");
    if (cameraInstanceRef.current) {
      try {
        cameraInstanceRef.current.stop();
      } catch (e) {}
      cameraInstanceRef.current = null;
    }
    if (nativeLoopRef.current) {
      cancelAnimationFrame(nativeLoopRef.current);
      nativeLoopRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch (e) {}
    }
    if (handsInstanceRef.current) {
      try {
        handsInstanceRef.current.close();
      } catch (e) {}
      handsInstanceRef.current = null;
    }
    setCameraActive(false);
  };

  const initMediaPipe = async () => {
    try {
      const HandsLib = (window as any).Hands;
      const CameraLib = (window as any).Camera;

      if (!HandsLib) {
        setErrorMessage("手势核心运算引擎加载失败，请刷新重试。");
        return;
      }

      // Initialize hands model
      const hands = new HandsLib({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      hands.onResults(onResults);
      handsInstanceRef.current = hands;

      // Start Camera stream
      if (videoRef.current) {
        try {
          // Attempt using MediaPipe's custom Camera library if loaded successfully
          if (CameraLib) {
            const camera = new CameraLib(videoRef.current, {
              onFrame: async () => {
                if (videoRef.current && handsInstanceRef.current) {
                  try {
                    await handsInstanceRef.current.send({ image: videoRef.current });
                  } catch (e) {}
                }
              },
              width: 320,
              height: 240
            });

            cameraInstanceRef.current = camera;
            await camera.start();
            setCameraActive(true);
          } else {
            throw new Error("MediaPipe Camera class not available, falling back to native mediaStream");
          }
        } catch (mediaPipeCameraError) {
          console.warn("MediaPipe Camera helper failed, falling back to html5 getUserMedia:", mediaPipeCameraError);
          
          // Native getUserMedia Fallback
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("环境安全限制: 无法获取 getUserMedia 摄像头方法。若是内置预览限制，请点击【在此窗口打开】或刷新获取安全上下文。");
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320 },
              height: { ideal: 240 },
              facingMode: "user"
            }
          });

          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("autoplay", "true");
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();

          setCameraActive(true);

          let lastFrameTime = 0;
          const runFallbackLoop = async (now: number) => {
            if (!streamRef.current || !videoRef.current) return;
            
            // Limit processing frequency to keep high frame rate in WebGL
            if (now - lastFrameTime > 45) {
              if (handsInstanceRef.current && videoRef.current) {
                try {
                  await handsInstanceRef.current.send({ image: videoRef.current });
                } catch (sendErr) {
                  console.error("Frame sending errored:", sendErr);
                }
              }
              lastFrameTime = now;
            }

            nativeLoopRef.current = requestAnimationFrame(runFallbackLoop);
          };
          nativeLoopRef.current = requestAnimationFrame(runFallbackLoop);
        }
      }
    } catch (err: any) {
      console.error("Camera setup failed entirely:", err);
      let errMsg = err.message || "请检查权限或设备连接";
      // Helpful guide for users when running inside sandboxed browsers or missing camera permissions
      if (errMsg.includes("permission") || errMsg.includes("Permission") || errMsg.includes("Allowed") || errMsg.includes("denied")) {
        errMsg = "摄像头访问权限已被拒绝或被预览沙箱环境策略限制。";
      }
      setErrorMessage(errMsg);
      setCameraActive(false);
    }
  };

  // Euclidean distance between two points
  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
  };

  const onResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the camera image horizontally flipped (mirror view)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];

      // Draw hand skeletal connections
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0); // reverse x-mirror for points

      // Custom high-aesthetic rendering: Glowing green neon hand lines
      ctx.strokeStyle = "rgba(163, 230, 53, 0.85)"; // Yellow-green (lime-400)
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#a3e635";

      // Connect skeleton
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // index
        [0, 9], [9, 10], [10, 11], [11, 12], // middle
        [0, 13], [13, 14], [14, 15], [15, 16], // ring
        [0, 17], [17, 18], [18, 19], [19, 20], // pinky
        [5, 9], [9, 13], [13, 17], [0, 17] // palm
      ];

      connections.forEach(([from, to]) => {
        const pt1 = landmarks[from];
        const pt2 = landmarks[to];
        ctx.beginPath();
        ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
        ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
        ctx.stroke();
      });

      // Draw glowing nodes on fingertips & joints
      ctx.fillStyle = "#ffffff";
      landmarks.forEach((pt: any) => {
        ctx.beginPath();
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.restore();

      // Determine Gesture State:
      // Compare average distance from finger tips (8, 12, 16, 20) to their respective bases (5, 9, 13, 17)
      const tips = [8, 12, 16, 20];
      const bases = [5, 9, 13, 17];
      let sumDistance = 0;

      for (let i = 0; i < tips.length; i++) {
        sumDistance += getDistance(landmarks[tips[i]], landmarks[bases[i]]);
      }
      const avgDistance = sumDistance / tips.length;

      // Calibration threshold: below 0.12 means fingers are clenched tightly (FIST)
      const gesture = avgDistance < 0.12 ? HandGesture.FIST : HandGesture.OPEN;
      setDetectedGesture(gesture);

      // Map the index tip (landmark 8) or palm center (landmark 9) to normal system coordinates
      // Since camera is mirrored, we must reverse the x point (1 - x) so moving right on camera moves cursor right.
      const rawX = landmarks[9].x;
      const mappedX = 1 - rawX; // Correct mirror effect
      const mappedY = landmarks[9].y;

      onHandUpdate({
        x: Math.min(Math.max(mappedX, 0), 1),
        y: Math.min(Math.max(mappedY, 0), 1),
        gesture,
        confidence: 0.95
      });
    } else {
      setDetectedGesture(HandGesture.UNKNOWN);
    }
  };

  const handleToggleAllowed = () => {
    if (isCameraAllowed) {
      setIsCameraAllowed(false);
      cleanup();
    } else {
      setIsCameraAllowed(true);
    }
  };

  return (
    <div className="flex flex-col bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-lime-500/10 rounded-xl text-lime-400">
            <Video className="w-5 h-5" id="cam_icon" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Webcam 雷达识别</h3>
            <p className="text-xs text-slate-400">使用您的真实手掌探秘夜林</p>
          </div>
        </div>
        <button
          onClick={handleToggleAllowed}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            isCameraAllowed
              ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20"
              : "bg-lime-500/10 text-lime-400 hover:bg-lime-500/20 border border-lime-500/20 animate-pulse"
          }`}
        >
          {isCameraAllowed ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              关闭相机
            </>
          ) : (
            <>
              <CameraIcon className="w-3.5 h-3.5" />
              启用相机
            </>
          )}
        </button>
      </div>

      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
        {/* Mirror invisible streaming video feed */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
          width="320"
          height="240"
        />

        {/* Diagnostic render drawing */}
        <canvas
          ref={canvasRef}
          width="320"
          height="180"
          className={`absolute inset-0 w-full h-full object-cover transform ${
            cameraActive ? "opacity-100 scale-x-100" : "opacity-0"
          } transition-opacity duration-500`}
        />

        {/* Loading overlay */}
        {!isCameraAllowed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none text-slate-400">
            <Video className="w-10 h-10 text-slate-600 mb-3 stroke-[1.5]" />
            <span className="text-xs font-medium text-slate-300">摄像头交互未开启</span>
            <span className="text-[10px] text-slate-500 max-w-[200px] mt-1">
              开启后可识别张开手、捏紧拳。您也可以使用右边面板的虚拟手势控制器进行流畅探索。
            </span>
          </div>
        )}

        {isCameraAllowed && libStatus === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
            <Loader2 className="w-8 h-8 text-lime-400 animate-spin" />
            <span className="text-xs text-slate-300">正在载入手势雷达与内核组件...</span>
          </div>
        )}

        {isCameraAllowed && libStatus === "ready" && !cameraActive && !errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 gap-3 text-center p-4">
            <Loader2 className="w-8 h-8 text-lime-400 animate-spin" />
            <span className="text-xs text-slate-300">正在初始化摄像头捕获...</span>
            <p className="text-[10px] text-slate-500">首次运行时，浏览器可能会弹出摄像头使用请求，请点击允许。</p>
          </div>
        )}

        {isCameraAllowed && errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-2 p-5 text-center text-rose-400">
            <AlertCircle className="w-8 h-8 text-rose-500 animate-bounce" />
            <span className="text-xs font-semibold">摄像头加载未成功</span>
            <p className="text-[10px] text-slate-400 max-w-[240px] leading-relaxed mb-1">{errorMessage}</p>
            <div className="flex flex-col gap-1.5 w-full max-w-[220px]">
              <a 
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-lime-400 hover:bg-lime-300 text-slate-950 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
              >
                <span>在新标签页打开网页 100% 授权</span>
              </a>
              <span className="text-[9px] text-slate-500 leading-normal">
                提示：浏览器安全沙箱默认限制 iframe 中的摄像头访问。在新标签页直接打开，即可顺利允许摄像头运行！
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Glowing Target Tracking State overlay */}
        {cameraActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700 shadow-lg text-[10px]">
            <span className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-ping" />
            <span className="text-slate-300 font-semibold uppercase">Radar Active</span>
          </div>
        )}

        {cameraActive && detectedGesture !== HandGesture.UNKNOWN && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-lime-500/95 text-slate-950 backdrop-blur-md px-3 py-1 rounded-lg shadow-lg text-[10px] font-bold">
            <Sparkles className="w-3 h-3 text-slate-950 animate-pulse" />
            手势识别: {detectedGesture === HandGesture.FIST ? "✊ 握拳捕捉" : "🖐️ 张掌漫步"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-[10px]">
        <div className="bg-slate-950/30 border border-slate-800/40 rounded-lg p-2.5 flex items-start gap-1.5">
          <span className="text-xs leading-none">🖐️</span>
          <div>
            <span className="font-semibold text-slate-300 block mb-0.5">张开手掌</span>
            <span className="text-slate-500">角色缓慢漫步，视角随手掌左右环绕</span>
          </div>
        </div>
        <div className="bg-slate-950/30 border border-slate-800/40 rounded-lg p-2.5 flex items-start gap-1.5">
          <span className="text-xs leading-none">✊</span>
          <div>
            <span className="font-semibold text-slate-300 block mb-0.5">微握成拳</span>
            <span className="text-slate-500">脚步停下，就近萤火虫吸星引向掌心</span>
          </div>
        </div>
      </div>
    </div>
  );
}
