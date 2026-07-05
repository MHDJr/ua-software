"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageCropperModalProps {
    isOpen: boolean;
    imageSrc: string | null;
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => void;
}

const CROP_SIZE = 256; // 256x256px final crop size

export function ImageCropperModal({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete,
}: ImageCropperModalProps) {
    const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
    const [fitScale, setFitScale] = useState(1);
    const [zoom, setZoom] = useState(1); // 1x to 3x additional zoom
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset settings when a new image is loaded
    useEffect(() => {
        if (isOpen && imageSrc) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setImageLoaded(false);
        }
    }, [isOpen, imageSrc]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        setImgDimensions({ width: naturalWidth, height: naturalHeight });
        
        // Calculate fit scale so the image fully covers the CROP_SIZE circle area
        const scale = Math.max(CROP_SIZE / naturalWidth, CROP_SIZE / naturalHeight);
        setFitScale(scale);
        setImageLoaded(true);
    };

    const scale = fitScale * zoom;
    const displayedWidth = imgDimensions.width * scale;
    const displayedHeight = imgDimensions.height * scale;

    // Boundary constraints: ensure the image always covers the entire 256px circular box
    const maxPanX = Math.max(0, (displayedWidth - CROP_SIZE) / 2);
    const maxPanY = Math.max(0, (displayedHeight - CROP_SIZE) / 2);

    const constrainedX = Math.max(-maxPanX, Math.min(maxPanX, pan.x));
    const constrainedY = Math.max(-maxPanY, Math.min(maxPanY, pan.y));

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const x = e.clientX - dragStart.x;
        const y = e.clientY - dragStart.y;
        setPan({ x, y });
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    const handleConfirm = () => {
        if (!imgRef.current || !imageLoaded) return;

        const canvas = document.createElement("canvas");
        canvas.width = CROP_SIZE;
        canvas.height = CROP_SIZE;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) return;

        // Draw image onto canvas based on our calculated position and size
        const dx = (CROP_SIZE - displayedWidth) / 2 + constrainedX;
        const dy = (CROP_SIZE - displayedHeight) / 2 + constrainedY;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
        
        ctx.drawImage(
            imgRef.current,
            0,
            0,
            imgDimensions.width,
            imgDimensions.height,
            dx,
            dy,
            displayedWidth,
            displayedHeight
        );

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    onCropComplete(blob);
                }
            },
            "image/webp",
            0.9
        );
    };

    return (
        <AnimatePresence>
            {isOpen && imageSrc && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Modal Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ type: "spring", duration: 0.4 }}
                        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-200">
                                Crop Profile Photo
                            </h3>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body - Crop Workspace */}
                        <div className="p-6 flex flex-col items-center gap-6">
                            {/* Circular Preview Mask Box */}
                            <div className="relative w-[260px] h-[260px] rounded-full border-2 border-indigo-500 shadow-2xl overflow-hidden bg-slate-950 flex items-center justify-center select-none">
                                {/* The drag area */}
                                <div
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerUp}
                                    className="absolute inset-0 flex items-center justify-center touch-none overflow-hidden"
                                >
                                    <img
                                        ref={imgRef}
                                        src={imageSrc}
                                        alt="To Crop"
                                        onLoad={handleImageLoad}
                                        className="max-w-none origin-center pointer-events-none select-none transition-shadow duration-300"
                                        style={{
                                            transform: `translate(${constrainedX}px, ${constrainedY}px) scale(${scale})`,
                                            cursor: isDragging ? "grabbing" : "grab",
                                        }}
                                    />
                                </div>

                                {/* Circular Grid Overlay to help center face */}
                                <div className="absolute inset-0 border border-white/10 rounded-full pointer-events-none flex items-center justify-center">
                                    <div className="w-2/3 h-2/3 border border-dashed border-white/20 rounded-full" />
                                </div>
                            </div>

                            {/* Help tooltip */}
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none">
                                👈 Drag to position • Slide to zoom 👇
                            </p>

                            {/* Zoom Slider Panel */}
                            <div className="w-full flex items-center gap-3 bg-slate-800/40 border border-slate-800 p-3 rounded-2xl">
                                <ZoomOut className="w-4 h-4 text-slate-500" />
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.01"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="flex-1 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <ZoomIn className="w-4 h-4 text-slate-500" />
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between gap-4">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/55 transition-all text-center"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all text-center"
                            >
                                <Check className="w-4 h-4" />
                                Save Photo
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
