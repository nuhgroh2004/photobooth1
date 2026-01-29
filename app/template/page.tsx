'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

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
  layoutType: '1' | '4';
  createdAt: number;
}

type LayoutType = '1' | '4';

export default function TemplateEditor() {
  const [elements, setElements] = useState<BorderElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('My Template');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [starColor, setStarColor] = useState('#FFD700');
  const [starPoints, setStarPoints] = useState(5);
  const [layoutType, setLayoutType] = useState<LayoutType>('1');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Border dimensions based on layout type
  const borderConfig = useMemo(() => {
    if (layoutType === '1') {
      return {
        width: 400,
        height: 360,
        topPadding: 40,
        sidePadding: 40,
        bottomPadding: 120,
        photoWidth: 320,
        photoHeight: 200,
      };
    } else {
      // 4 photo strip layout
      return {
        width: 250,
        height: 700,
        topPadding: 40,
        sidePadding: 40,
        bottomPadding: 120,
        photoWidth: 170,
        photoHeight: 115,
        photoPadding: 15,
      };
    }
  }, [layoutType]);

  const photoAreas = useMemo(() => {
    if (layoutType === '1') {
      return [{
        x: borderConfig.sidePadding,
        y: borderConfig.topPadding,
        width: borderConfig.photoWidth,
        height: borderConfig.photoHeight,
      }];
    } else {
      // 4 photos stacked vertically
      const areas = [];
      const photoPadding = 15;
      for (let i = 0; i < 4; i++) {
        areas.push({
          x: borderConfig.sidePadding,
          y: borderConfig.topPadding + i * (borderConfig.photoHeight + photoPadding),
          width: borderConfig.photoWidth,
          height: borderConfig.photoHeight,
        });
      }
      return areas;
    }
  }, [layoutType, borderConfig]);

  // Draw star shape function - defined before drawCanvas
  const drawStar = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, points: number, color: string) => {
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
    
    // Add glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  // Load saved templates from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('photoboothTemplates');
    if (saved) {
      setSavedTemplates(JSON.parse(saved));
    }
  }, []);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = borderConfig.width;
    canvas.height = borderConfig.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background (border)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw photo area placeholders
    photoAreas.forEach((area, index) => {
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(area.x, area.y, area.width, area.height);
      
      // Draw "Photo" text
      ctx.fillStyle = '#999';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(layoutType === '1' ? 'Photo Area' : `Photo ${index + 1}`, area.x + area.width / 2, area.y + area.height / 2 + 5);
    });

    // Draw elements
    elements.forEach((element) => {
      ctx.save();
      ctx.globalAlpha = element.opacity;
      ctx.translate(element.x + element.width / 2, element.y + element.height / 2);
      ctx.rotate((element.rotation * Math.PI) / 180);

      if (element.type === 'star') {
        drawStar(ctx, 0, 0, element.width / 2, element.points || 5, element.color || '#FFD700');
      } else if (element.type === 'image' && element.src) {
        const img = new Image();
        img.src = element.src;
        ctx.drawImage(img, -element.width / 2, -element.height / 2, element.width, element.height);
      }

      ctx.restore();

      // Draw selection border
      if (selectedElement === element.id) {
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);
        ctx.setLineDash([]);
      }
    });
  }, [elements, selectedElement, backgroundColor, borderConfig, photoAreas, layoutType, drawStar]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Add star element
  const addStar = () => {
    const newStar: BorderElement = {
      id: `star-${Date.now()}`,
      type: 'star',
      x: borderConfig.width / 2 - 25,
      y: borderConfig.height - borderConfig.bottomPadding / 2 - 25,
      width: 50,
      height: 50,
      rotation: Math.random() * 30 - 15,
      opacity: 0.9,
      color: starColor,
      points: starPoints,
    };
    setElements([...elements, newStar]);
    setSelectedElement(newStar.id);
  };

  // Add random stars scattered on borders
  const addScatteredStars = () => {
    const newStars: BorderElement[] = [];
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
    
    // Get photo area bounds
    const photoTop = photoAreas[0].y;
    const photoBottom = photoAreas[photoAreas.length - 1].y + photoAreas[photoAreas.length - 1].height;
    
    for (let i = 0; i < 8; i++) {
      let x, y;
      const zone = Math.floor(Math.random() * 4);
      
      if (zone === 0) { // Top border
        x = Math.random() * (borderConfig.width - 40) + 20;
        y = Math.random() * (borderConfig.topPadding - 20) + 5;
      } else if (zone === 1) { // Bottom border
        x = Math.random() * (borderConfig.width - 40) + 20;
        y = photoBottom + Math.random() * (borderConfig.bottomPadding - 40) + 10;
      } else if (zone === 2) { // Left border
        x = Math.random() * (borderConfig.sidePadding - 20) + 5;
        y = photoTop + Math.random() * (photoBottom - photoTop - 30);
      } else { // Right border
        x = borderConfig.width - borderConfig.sidePadding + Math.random() * (borderConfig.sidePadding - 20) + 5;
        y = photoTop + Math.random() * (photoBottom - photoTop - 30);
      }

      const size = 15 + Math.random() * 25;
      newStars.push({
        id: `star-${Date.now()}-${i}`,
        type: 'star',
        x: x - size / 2,
        y: y - size / 2,
        width: size,
        height: size,
        rotation: Math.random() * 360,
        opacity: 0.6 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        points: Math.random() > 0.5 ? 5 : 4,
      });
    }
    
    setElements([...elements, ...newStars]);
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const newImage: BorderElement = {
        id: `img-${Date.now()}`,
        type: 'image',
        x: borderConfig.width / 2 - 30,
        y: borderConfig.height - borderConfig.bottomPadding / 2 - 30,
        width: 60,
        height: 60,
        rotation: 0,
        opacity: 1,
        src,
      };
      setElements([...elements, newImage]);
      setSelectedElement(newImage.id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle canvas mouse events
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicked on any element (reverse order for top elements first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        setSelectedElement(el.id);
        setIsDragging(true);
        setDragOffset({ x: x - el.x, y: y - el.y });
        return;
      }
    }
    
    setSelectedElement(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX - dragOffset.x;
    const y = (e.clientY - rect.top) * scaleY - dragOffset.y;

    setElements(elements.map(el => 
      el.id === selectedElement ? { ...el, x, y } : el
    ));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  // Update selected element
  const updateElement = (updates: Partial<BorderElement>) => {
    if (!selectedElement) return;
    setElements(elements.map(el => 
      el.id === selectedElement ? { ...el, ...updates } : el
    ));
  };

  // Delete selected element
  const deleteElement = () => {
    if (!selectedElement) return;
    setElements(elements.filter(el => el.id !== selectedElement));
    setSelectedElement(null);
  };

  // Save template
  const saveTemplate = () => {
    const template: Template = {
      id: `template-${Date.now()}`,
      name: templateName,
      backgroundColor,
      elements,
      layoutType,
      createdAt: Date.now(),
    };

    const newTemplates = [...savedTemplates, template];
    setSavedTemplates(newTemplates);
    localStorage.setItem('photoboothTemplates', JSON.stringify(newTemplates));
    localStorage.setItem('activeTemplate', JSON.stringify(template));
    alert('Template saved! This template will be used in the photobooth.');
  };

  // Load template
  const loadTemplate = (template: Template) => {
    setTemplateName(template.name);
    setBackgroundColor(template.backgroundColor);
    setElements(template.elements);
    setLayoutType(template.layoutType || '1');
    setSelectedElement(null);
  };

  // Delete template
  const deleteTemplate = (templateId: string) => {
    const newTemplates = savedTemplates.filter(t => t.id !== templateId);
    setSavedTemplates(newTemplates);
    localStorage.setItem('photoboothTemplates', JSON.stringify(newTemplates));
  };

  // Set as active template
  const setActiveTemplate = (template: Template) => {
    localStorage.setItem('activeTemplate', JSON.stringify(template));
    alert(`"${template.name}" is now the active template for photobooth!`);
  };

  // Change layout type
  const handleLayoutChange = (newLayout: LayoutType) => {
    setLayoutType(newLayout);
    setElements([]); // Clear elements when changing layout
    setSelectedElement(null);
  };

  const selectedEl = elements.find(el => el.id === selectedElement);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Template Editor</h1>
          <Link 
            href="/"
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all"
          >
            Back to Photobooth
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas Area */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            {/* Layout Type Selector */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => handleLayoutChange('1')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  layoutType === '1' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white/20 text-white/70 hover:bg-white/30'
                }`}
              >
                Single Photo
              </button>
              <button
                onClick={() => handleLayoutChange('4')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  layoutType === '4' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white/20 text-white/70 hover:bg-white/30'
                }`}
              >
                4 Photo Strip
              </button>
            </div>

            <div className="flex justify-center mb-4">
              <canvas
                ref={canvasRef}
                width={borderConfig.width}
                height={borderConfig.height}
                className="border-2 border-white/30 rounded-lg cursor-move shadow-2xl"
                style={{ maxHeight: '600px', width: 'auto' }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>
            
            <p className="text-white/60 text-center text-sm">
              Click and drag elements to reposition them. Gray areas represent where photos will appear.
            </p>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Template Name */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <label className="text-white text-sm font-medium mb-2 block">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Background Color */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <label className="text-white text-sm font-medium mb-2 block">Border Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none"
                />
              </div>
              {/* Quick color presets */}
              <div className="flex gap-2 mt-2">
                {['#ffffff', '#000000', '#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD'].map(color => (
                  <button
                    key={color}
                    onClick={() => setBackgroundColor(color)}
                    className="w-8 h-8 rounded-lg border-2 border-white/30 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Add Elements */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <h3 className="text-white font-semibold mb-3">Add Elements</h3>
              
              {/* Star options */}
              <div className="mb-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={starColor}
                    onChange={(e) => setStarColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <select
                    value={starPoints}
                    onChange={(e) => setStarPoints(Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                  >
                    <option value={4}>4 Points</option>
                    <option value={5}>5 Points</option>
                    <option value={6}>6 Points</option>
                    <option value={8}>8 Points</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={addStar}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  ⭐ Add Star
                </button>
                <button
                  onClick={addScatteredStars}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  ✨ Scatter Stars
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="col-span-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  🖼️ Add Image/Logo
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Element Properties */}
            {selectedEl && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Element Properties</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/70 text-sm">Size: {selectedEl.width}px</label>
                    <input
                      type="range"
                      min="20"
                      max="150"
                      value={selectedEl.width}
                      onChange={(e) => updateElement({ width: Number(e.target.value), height: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm">Rotation: {selectedEl.rotation}°</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={selectedEl.rotation}
                      onChange={(e) => updateElement({ rotation: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm">Opacity: {Math.round(selectedEl.opacity * 100)}%</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={selectedEl.opacity}
                      onChange={(e) => updateElement({ opacity: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  {selectedEl.type === 'star' && (
                    <div>
                      <label className="text-white/70 text-sm">Color</label>
                      <input
                        type="color"
                        value={selectedEl.color || '#FFD700'}
                        onChange={(e) => updateElement({ color: e.target.value })}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                    </div>
                  )}
                  <button
                    onClick={deleteElement}
                    className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-all"
                  >
                    Delete Element
                  </button>
                </div>
              </div>
            )}

            {/* Save/Clear */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={saveTemplate}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                >
                  Save Template
                </button>
                <button
                  onClick={() => { setElements([]); setSelectedElement(null); }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Saved Templates */}
            {savedTemplates.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <h3 className="text-white font-semibold mb-3">Saved Templates</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedTemplates.map((template) => (
                    <div 
                      key={template.id}
                      className="flex items-center justify-between bg-white/10 rounded-lg p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm truncate block">{template.name}</span>
                        <span className="text-white/50 text-xs">{template.layoutType === '4' ? '4 Photos' : '1 Photo'}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => loadTemplate(template)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setActiveTemplate(template)}
                          className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
