import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface SignaturePadProps {
  /** Called with signature data URL (PNG) when user signs */
  onSignatureChange?: (dataUrl: string | null) => void;
  /** Width of the canvas. Default: 600 */
  width?: number;
  /** Height of the canvas. Default: 250 */
  height?: number;
  /** Pen color. Default: '#1a1a2e' */
  penColor?: string;
  /** Pen width. Default: 2.5 */
  penWidth?: number;
  /** Whether the pad is disabled */
  disabled?: boolean;
}

/**
 * SignaturePad — HTML5 canvas with touch support for digital signatures.
 * Exports signature as data URL (PNG).
 * Validates: Requirement 7.2, 7.3
 */
export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  width = 600,
  height = 250,
  penColor = '#1a1a2e',
  penWidth = 2.5,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }, [penColor, penWidth]);

  const getPoint = useCallback(
    (e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return null;
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
        y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const emitSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSignatureChange?.(dataUrl);
    setHasSignature(true);
  }, [onSignatureChange]);

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      isDrawingRef.current = true;
      const point = getPoint(e);
      lastPointRef.current = point;

      const ctx = getContext();
      if (ctx && point) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      }
    },
    [disabled, getPoint, getContext]
  );

  const handleMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled || !isDrawingRef.current) return;
      e.preventDefault();
      const point = getPoint(e);
      const ctx = getContext();
      if (ctx && point && lastPointRef.current) {
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPointRef.current = point;
      }
    },
    [disabled, getPoint, getContext]
  );

  const handleEnd = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      emitSignature();
    }
  }, [emitSignature]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
    onSignatureChange?.(null);
  }, [onSignatureChange]);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [width, height]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-white touch-none cursor-crosshair"
          style={{ maxWidth: `${width}px` }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          aria-label="Área de firma digital"
          role="img"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 dark:text-gray-500 text-lg">
              Firme aquí con su dedo o stylus
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={disabled || !hasSignature}
        className="px-6 py-3 min-h-[48px] text-base font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Limpiar firma"
      >
        Limpiar firma
      </button>
    </div>
  );
};
