import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();
    
    // Generate unique ID untuk public_id
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    // Upload ke Cloudinary
    const uploadResult = await cloudinary.uploader.upload(image, {
      public_id: `photobooth/${id}`,
      folder: 'photobooth',
      resource_type: 'image',
    });
    
    // Return ID dan URL Cloudinary
    return NextResponse.json({ 
      id: uploadResult.public_id,
      url: uploadResult.secure_url 
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
