'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function DownloadPage() {
  const params = useParams();
  const id = params.id as string;
  const imageUrl = id ? `/uploads/${id}.png` : '';
  const loading = !id;

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `photobooth-${id}.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-2xl font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-12 border border-white/20">
          <h1 className="text-5xl font-bold text-center mb-12 text-white tracking-tight">
            Photo Booth
          </h1>

          <div className="mb-10 flex justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-2xl inline-block">
              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt="Photobooth result" 
                  className="max-w-full w-auto max-h-[70vh] rounded-lg shadow-lg"
                  onError={(e) => {
                    console.error('Image load error');
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage Not Found%3C/text%3E%3C/svg%3E';
                  }}
                />
              )}
            </div>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <button
              onClick={downloadImage}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl py-4 px-12 text-lg font-semibold transition-all shadow-lg transform hover:scale-105"
            >
              Download Photo
            </button>

            <div className="text-center">
              <Link 
                href="/"
                className="text-white/80 hover:text-white font-semibold text-lg inline-block"
              >
                ← Back to Photo Booth
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
