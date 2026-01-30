'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';

type PhotoMode = '1' | '4' | null;

interface BorderElement {
  id: string;
  type: 'image' | 'star';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  src?: string;
  color?: string;
  points?: number;
}

interface Template {
  id: string;
  name: string;
  backgroundColor: string;
  elements: BorderElement[];
  layoutType?: '1' | '4';
  createdAt: number;
}

export default function Home() {
  const [mode, setMode] = useState<PhotoMode>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [finalImage, setFinalImage] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load active template from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('activeTemplate');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate basic template structure
        if (parsed && typeof parsed === 'object' && parsed.elements && Array.isArray(parsed.elements)) {
          setActiveTemplate(parsed);
        } else {
          console.error('Invalid template format, clearing...');
          localStorage.removeItem('activeTemplate');
        }
      }
    } catch (error) {
      console.error('Error loading active template:', error);
      localStorage.removeItem('activeTemplate');
      setActiveTemplate(null);
    }
  }, []);

  // Load available cameras
  useEffect(() => {
    const loadCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Auto-select DroidCam if available, otherwise first camera
        const droidCam = videoDevices.find(device => 
          device.label.toLowerCase().includes('droidcam')
        );
        if (droidCam) {
          setSelectedCamera(droidCam.deviceId);
        } else if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error loading cameras:', error);
      }
    };
    
    loadCameras();
  }, []);

  const startCamera = useCallback(async (selectedMode: PhotoMode) => {
    if (selectedMode === null) return;
    
    setMode(selectedMode);
    setPhotos([]);
    setCurrentPhotoIndex(0);
    setIsComplete(false);
    setQrCodeUrl('');

    try {
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
    }
  }, [selectedCamera]);

  const startCountdown = useCallback(() => {
    if (isCapturing) return;
    setIsCapturing(true);
    setCountdown(4);
  }, [isCapturing]);

  const generateCombinedImage = (photoList: string[]): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const topPadding = 40;
      const sidePadding = 40;
      const bottomPadding = 120; // Polaroid style - wider bottom
      const photoPadding = 15;
      
      // Helper function to draw star
      const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, points: number, color: string) => {
        ctx.beginPath();
        ctx.fillStyle = color;
        
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? radius : radius / 2;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        ctx.fill();
      };

      // Draw template elements on border
      const drawTemplateElements = async (canvasWidth: number, canvasHeight: number) => {
        if (!activeTemplate || activeTemplate.elements.length === 0) return;

        // Scale factors based on template's original dimensions
        // Template editor uses 400x360 for single, 250x700 for strip
        const templateWidth = activeTemplate.layoutType === '4' ? 250 : 400;
        const templateHeight = activeTemplate.layoutType === '4' ? 700 : 360;
        
        const scaleX = canvasWidth / templateWidth;
        const scaleY = canvasHeight / templateHeight;
        
        for (const element of activeTemplate.elements) {
          const scaledX = element.x * scaleX;
          const scaledY = element.y * scaleY;
          const scaledWidth = element.width * scaleX;
          const scaledHeight = element.height * scaleY;

          context.save();
          context.globalAlpha = element.opacity;
          context.translate(scaledX + scaledWidth / 2, scaledY + scaledHeight / 2);
          context.rotate((element.rotation * Math.PI) / 180);

          if (element.type === 'star') {
            drawStar(context, 0, 0, scaledWidth / 2, element.points || 5, element.color || '#FFD700');
          } else if (element.type === 'image' && element.src) {
            const img = new Image();
            await new Promise<void>((imgResolve) => {
              img.onload = () => {
                context.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
                imgResolve();
              };
              img.onerror = () => imgResolve();
              img.src = element.src!;
            });
          }

          context.restore();
        }
        
        context.globalAlpha = 1.0;
      };
      
      const processImages = async () => {
        // Use template background color, or check if template layout matches mode
        const useTemplate = activeTemplate && 
          ((mode === '1' && activeTemplate.layoutType !== '4') || 
           (mode === '4' && activeTemplate.layoutType === '4'));
        const bgColor = useTemplate ? activeTemplate.backgroundColor : '#ffffff';
        
        if (mode === '1') {
          // Single photo with polaroid frame
          const img = new Image();
          img.onload = async () => {
            canvas.width = img.width + sidePadding * 2;
            canvas.height = img.height + topPadding + bottomPadding;
            
            // Background color from template
            context.fillStyle = bgColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw photo first
            context.drawImage(img, sidePadding, topPadding);
            
            // Draw template elements on top (highest z-index) if template matches mode
            if (activeTemplate && activeTemplate.layoutType !== '4') {
              await drawTemplateElements(canvas.width, canvas.height);
            }
            
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = photoList[0];
        } else {
          // 4 photos in vertical strip with polaroid frame
          let loadedCount = 0;
          const images: HTMLImageElement[] = [];
          
          photoList.forEach((photo, index) => {
            const img = new Image();
            img.onload = async () => {
              images[index] = img;
              loadedCount++;
              
              if (loadedCount === 4) {
                // Calculate size for vertical layout
                const photoWidth = images[0].width / 2.5;
                const photoHeight = images[0].height / 2.5;
                
                canvas.width = photoWidth + sidePadding * 2;
                canvas.height = (photoHeight * 4) + (photoPadding * 3) + topPadding + bottomPadding;
                
                // Background color from template
                context.fillStyle = bgColor;
                context.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw 4 photos vertically
                images.forEach((img, i) => {
                  const x = sidePadding;
                  const y = topPadding + (i * (photoHeight + photoPadding));
                  
                  context.drawImage(img, 0, 0, img.width, img.height, x, y, photoWidth, photoHeight);
                });
                
                // Draw template elements on top (highest z-index) if template matches mode
                if (activeTemplate && activeTemplate.layoutType === '4') {
                  await drawTemplateElements(canvas.width, canvas.height);
                }
                
                resolve(canvas.toDataURL('image/png'));
              }
            };
            img.src = photo;
          });
        }
      };
      
      processImages();
    });
  };

  const finishSession = useCallback(async (finalPhotos: string[]) => {
    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Generate combined image
    const combinedImage = await generateCombinedImage(finalPhotos);
    setFinalImage(combinedImage);
    
    // Save to Cloudinary and get URL
    const result = await saveImage(combinedImage);
    
    // Generate QR code LANGSUNG ke URL Cloudinary (bukan ke halaman download)
    // User scan QR -> langsung ke gambar Cloudinary -> bisa download/save
    const qrCode = await QRCode.toDataURL(result.url);
    setQrCodeUrl(qrCode);
    
    setIsComplete(true);
  }, [stream, mode]);

  useEffect(() => {
    if (countdown === null || !isCapturing) return;

    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else {
      // Capture photo when countdown reaches 0
      capturePhoto();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown, isCapturing]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const photoData = canvas.toDataURL('image/png');
    const newPhotos = [...photos, photoData];
    setPhotos(newPhotos);

    const totalPhotos = mode === '1' ? 1 : 4;
    if (newPhotos.length >= totalPhotos) {
      setIsCapturing(false);
      setCountdown(null);
      finishSession(newPhotos);
    } else {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
      // Start next countdown
      setCountdown(4);
    }
  }, [photos, currentPhotoIndex, mode, finishSession]);

  const saveImage = async (imageData: string): Promise<{ id: string; url: string }> => {
    try {
      const response = await fetch('/api/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      const data = await response.json();
      return { id: data.id, url: data.url };
    } catch (error) {
      console.error('Error saving image:', error);
      return { id: 'error', url: '' };
    }
  };

  const downloadImage = async () => {
    if (photos.length === 0) return;
    
    const combinedImage = await generateCombinedImage(photos);
    const link = document.createElement('a');
    link.download = `photobooth-${Date.now()}.png`;
    link.href = combinedImage;
    link.click();
  };

  const reset = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setMode(null);
    setPhotos([]);
    setCurrentPhotoIndex(0);
    setIsComplete(false);
    setQrCodeUrl('');
    setCountdown(null);
    setIsCapturing(false);
    setFinalImage('');
    setStream(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-12 text-white tracking-tight">
          Photo Booth
        </h1>

        {!mode && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-12 border border-white/20">
            <h2 className="text-3xl font-semibold text-center mb-10 text-white">
              Select Photo Mode
            </h2>
            
            {/* Camera Selection */}
            {availableCameras.length > 0 && (
              <div className="mb-8 p-4 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <label className="text-white text-sm font-medium mb-2 block text-center">
                  📹 Select Camera
                </label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:border-blue-500 text-center"
                >
                  {availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId} className="bg-slate-800">
                      {camera.label || `Camera ${camera.deviceId.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Active Template Info */}
            {activeTemplate && (
              <div className="mb-8 p-4 bg-green-500/20 rounded-xl border border-green-500/30 text-center">
                <p className="text-green-300 text-sm">Active Template:</p>
                <p className="text-white font-semibold">{activeTemplate.name}</p>
                <p className="text-white/60 text-xs mt-1">
                  Layout: {activeTemplate.layoutType === '4' ? '4 Photo Strip' : 'Single Photo'}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto mb-8">
              <button
                onClick={() => startCamera('1')}
                className="bg-white/20 backdrop-blur hover:bg-white/30 text-white rounded-xl p-12 text-2xl font-semibold transition-all transform hover:scale-105 shadow-xl border border-white/30"
              >
                <div className="text-5xl font-bold mb-4">Single</div>
                <div className="text-base font-normal opacity-80">1 Photo</div>
              </button>
              <button
                onClick={() => startCamera('4')}
                className="bg-white/20 backdrop-blur hover:bg-white/30 text-white rounded-xl p-12 text-2xl font-semibold transition-all transform hover:scale-105 shadow-xl border border-white/30"
              >
                <div className="text-5xl font-bold mb-4">Strip</div>
                <div className="text-base font-normal opacity-80">4 Photos</div>
              </button>
            </div>
            
            {/* Link to Template Editor */}
            <div className="text-center">
              <Link
                href="/template"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-lg"
              >
                ✨ Create Border Template
              </Link>
            </div>
          </div>
        )}

        {mode && !isComplete && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Camera Section */}
            <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Photo {currentPhotoIndex + 1} of {mode === '1' ? '1' : '4'}
                </h2>
                
                {/* Camera Selector in capture mode */}
                {availableCameras.length > 1 && !isCapturing && (
                  <div className="mb-4 max-w-md mx-auto">
                    <select
                      value={selectedCamera}
                      onChange={(e) => {
                        setSelectedCamera(e.target.value);
                        // Restart camera with new selection
                        if (stream) {
                          stream.getTracks().forEach(track => track.stop());
                        }
                        startCamera(mode);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none text-sm"
                    >
                      {availableCameras.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId} className="bg-slate-800">
                          {camera.label || `Camera ${camera.deviceId.substring(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {isCapturing && countdown !== null && (
                  <div className="text-8xl font-bold text-white mt-8 animate-pulse">
                    {countdown > 0 ? countdown : 'Smile!'}
                  </div>
                )}
              </div>

              <div className="relative bg-black rounded-xl overflow-hidden mb-6 aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {countdown !== null && countdown === 0 && (
                  <div className="absolute inset-0 bg-white animate-flash"></div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={startCountdown}
                  disabled={isCapturing}
                  className={`flex-1 ${
                    isCapturing
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                  } text-white rounded-xl py-4 text-lg font-semibold transition-all shadow-lg`}
                >
                  {isCapturing ? 'Capturing...' : 'Start Capture'}
                </button>
                <button
                  onClick={reset}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-8 py-4 text-lg font-semibold transition-all shadow-lg"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold mb-4 text-white text-center">
                Preview
              </h3>
              <div className="space-y-3">
                {Array.from({ length: mode === '1' ? 1 : 4 }).map((_, index) => (
                  <div
                    key={index}
                    className={`aspect-video rounded-lg overflow-hidden ${
                      photos[index] ? 'bg-white' : 'bg-white/20'
                    }`}
                  >
                    {photos[index] ? (
                      <img
                        src={photos[index]}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50">
                        {index + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-12 border border-white/20">
            <h2 className="text-4xl font-semibold text-center mb-10 text-white">
              Your Photos Are Ready!
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Final Image Preview */}
              <div className="flex justify-center">
                <div className="bg-white p-6 rounded-2xl shadow-2xl inline-block">
                  {finalImage && (
                    <img 
                      src={finalImage} 
                      alt="Final result" 
                      className="max-w-full h-auto rounded-lg shadow-lg"
                      style={{ maxHeight: '600px' }}
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-6">
                <div className="bg-white/20 backdrop-blur rounded-xl p-8 border border-white/30">
                  <h3 className="text-2xl font-semibold mb-4 text-white text-center">
                    Scan to Download
                  </h3>
                  {qrCodeUrl && (
                    <div className="flex justify-center mb-6">
                      <div className="bg-white p-4 rounded-xl">
                        <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                      </div>
                    </div>
                  )}
                  <p className="text-white/80 text-center text-sm">
                    Scan this QR code with your phone to download the photo
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={downloadImage}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl py-4 text-lg font-semibold transition-all shadow-lg"
                  >
                    Download Now
                  </button>
                  <button
                    onClick={reset}
                    className="w-full bg-white/20 backdrop-blur hover:bg-white/30 text-white rounded-xl py-4 text-lg font-semibold transition-all shadow-lg border border-white/30"
                  >
                    Take New Photos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}