'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';

type PhotoMode = '1' | '4' | null;

export default function Home() {
  const [mode, setMode] = useState<PhotoMode>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [finalImage, setFinalImage] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async (selectedMode: PhotoMode) => {
    if (selectedMode === null) return;
    
    setMode(selectedMode);
    setPhotos([]);
    setCurrentPhotoIndex(0);
    setIsComplete(false);
    setQrCodeUrl('');

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Cari device yang namanya ada kata "DroidCam"
      const droidCam = videoDevices.find(device => 
        device.label.toLowerCase().includes('droidcam')
      );

      const constraints = {
        video: {
          // Jika ketemu DroidCam, kunci ID-nya. Jika tidak, pakai kamera apa saja.
          deviceId: droidCam ? { exact: droidCam.deviceId } : undefined,
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
  }, []);

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
      
      if (mode === '1') {
        // Single photo with polaroid frame
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width + sidePadding * 2;
          canvas.height = img.height + topPadding + bottomPadding;
          
          // White background
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw photo
          context.drawImage(img, sidePadding, topPadding);
          
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = photoList[0];
      } else {
        // 4 photos in vertical strip with polaroid frame
        let loadedCount = 0;
        const images: HTMLImageElement[] = [];
        
        photoList.forEach((photo, index) => {
          const img = new Image();
          img.onload = () => {
            images[index] = img;
            loadedCount++;
            
            if (loadedCount === 4) {
              // Calculate size for vertical layout
              const photoWidth = images[0].width / 2.5;
              const photoHeight = images[0].height / 2.5;
              
              canvas.width = photoWidth + sidePadding * 2;
              canvas.height = (photoHeight * 4) + (photoPadding * 3) + topPadding + bottomPadding;
              
              // White background
              context.fillStyle = '#ffffff';
              context.fillRect(0, 0, canvas.width, canvas.height);
              
              // Draw 4 photos vertically
              images.forEach((img, i) => {
                const x = sidePadding;
                const y = topPadding + (i * (photoHeight + photoPadding));
                
                context.drawImage(img, 0, 0, img.width, img.height, x, y, photoWidth, photoHeight);
              });
              
              resolve(canvas.toDataURL('image/png'));
            }
          };
          img.src = photo;
        });
      }
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
    
    // Save to server and get ID
    const imageId = await saveImage(combinedImage);
    
    // Generate QR code
    const downloadUrl = `${window.location.origin}/download/${imageId}`;
    const qrCode = await QRCode.toDataURL(downloadUrl);
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

  const saveImage = async (imageData: string): Promise<string> => {
    try {
      const response = await fetch('/api/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Error saving image:', error);
      return 'error';
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
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