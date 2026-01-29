'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DownloadPage() {
  const params = useParams();
  const id = params.id as string;
  const imageUrl = id ? `/uploads/${id}.png` : '';
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (imageUrl) {
      // Preload image
      const img = new Image();
      img.onload = () => setLoading(false);
      img.onerror = () => {
        setImageError(true);
        setLoading(false);
      };
      img.src = imageUrl;
    }
  }, [imageUrl]);

  const downloadImage = () => {
    if (imageError) return;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `photobooth-${id}.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
          <div className="text-2xl font-semibold text-white">Loading your photo...</div>
        </div>
      </div>
    );
  }

  if (imageError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-3xl font-bold text-white mb-4">Photo Not Found</h1>
          <p className="text-white/80 mb-8">
            Sorry, this photo could not be found or may have been deleted.
          </p>
          <Link 
            href="/"
            className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl py-3 px-8 font-semibold transition-all shadow-lg"
          >
            Take New Photos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-12 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
              Your Photo is Ready! 📸
            </h1>
            <p className="text-white/70 text-lg">
              Download your photo below
            </p>
          </div>

          {/* Image Preview - Centered and Symmetric */}
          <div className="flex justify-center items-center mb-8">
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-2xl inline-block">
              <img 
                src={imageUrl} 
                alt="Photobooth result" 
                className="max-w-full w-auto h-auto rounded-lg shadow-lg"
                style={{ 
                  maxHeight: '70vh',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            </div>
          </div>

          {/* Action Buttons - Centered */}
          <div className="flex flex-col items-center space-y-4 max-w-md mx-auto">
            <button
              onClick={downloadImage}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl py-4 px-8 text-lg font-semibold transition-all shadow-lg transform hover:scale-105 active:scale-95"
            >
              💾 Download Photo
            </button>

            <Link 
              href="/"
              className="w-full bg-white/20 hover:bg-white/30 text-white rounded-xl py-4 px-8 text-lg font-semibold transition-all shadow-lg text-center border border-white/30"
            >
              ← Back to Photo Booth
            </Link>
          </div>

          {/* Instructions */}
          <div className="mt-8 text-center">
            <p className="text-white/60 text-sm">
              💡 Tip: Long press on the image to save it directly (on mobile)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
