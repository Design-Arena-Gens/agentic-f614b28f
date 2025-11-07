'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { AVLNode } from '@/lib/avl';

type PositionedNode = {
  key: number;
  x: number;
  y: number;
  depth: number;
  nodeHeight: number;
  parentKey?: number;
};

export interface TreeCanvasProps {
  root: AVLNode | null;
  highlighted: Set<number>;
  activeNode?: number | null;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

const HORIZONTAL_SPACING = 120;
const VERTICAL_SPACING = 100;

const computeLayout = (root: AVLNode | null): PositionedNode[] => {
  if (!root) return [];
  const positioned: PositionedNode[] = [];
  let xIndex = 0;
  const inOrder = (node: AVLNode | null, depth: number, parentKey?: number) => {
    if (!node) return;
    inOrder(node.left, depth + 1, node.key);
    positioned.push({
      key: node.key,
      depth,
      x: xIndex * HORIZONTAL_SPACING,
      y: depth * VERTICAL_SPACING,
      nodeHeight: node.height,
      parentKey,
    });
    xIndex += 1;
    inOrder(node.right, depth + 1, node.key);
  };
  inOrder(root, 0, undefined);

  if (!positioned.length) return positioned;

  const minX = Math.min(...positioned.map((node) => node.x));
  const shiftX = minX + (positioned.length > 1 ? HORIZONTAL_SPACING / 2 : 0);

  return positioned.map((node) => ({
    ...node,
    x: node.x - shiftX,
  }));
};

export const TreeCanvas = ({ root, highlighted, activeNode }: TreeCanvasProps) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panState = useRef<{ isPanning: boolean; startX: number; startY: number; initialX: number; initialY: number }>({
    isPanning: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const positioned = useMemo(() => computeLayout(root), [root]);
  const nodeLookup = useMemo(() => {
    const map = new Map<number, PositionedNode>();
    positioned.forEach((node) => map.set(node.key, node));
    return map;
  }, [positioned]);

  const clampScale = useCallback((next: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)), []);

  const handleZoom = useCallback((delta: number) => {
    setScale((prev) => clampScale(prev * delta));
  }, [clampScale]);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const zoomFactor = direction > 0 ? 1.1 : 0.9;
      setScale((prev) => clampScale(prev * zoomFactor));
    },
    [clampScale]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      panState.current = {
        isPanning: true,
        startX: event.clientX,
        startY: event.clientY,
        initialX: offset.x,
        initialY: offset.y,
      };
    },
    [offset]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!panState.current.isPanning) return;
      const deltaX = event.clientX - panState.current.startX;
      const deltaY = event.clientY - panState.current.startY;
      setOffset({
        x: panState.current.initialX + deltaX,
        y: panState.current.initialY + deltaY,
      });
    },
    []
  );

  const handlePointerUp = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    panState.current.isPanning = false;
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm font-medium">
        <span className="text-slate-700">Tree View</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleZoom(1 / 1.1)}
            className="rounded-lg border border-slate-200 px-2 py-1 transition hover:bg-slate-100 active:scale-95"
          >
            −
          </button>
          <span className="w-12 text-center text-xs text-slate-500">{scale.toFixed(2)}x</span>
          <button
            type="button"
            onClick={() => handleZoom(1.1)}
            className="rounded-lg border border-slate-200 px-2 py-1 transition hover:bg-slate-100 active:scale-95"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs transition hover:bg-slate-100 active:scale-95"
          >
            Reset
          </button>
        </div>
      </div>
      <div
        className="relative h-full flex-1 overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
        role="presentation"
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
            transformOrigin: 'center',
          }}
        >
          {positioned.length ? (
            <svg
              className="h-[700px] w-[1200px] max-w-none"
              viewBox="-600 0 1200 700"
            >
              <defs>
                <radialGradient id="nodeHighlight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </radialGradient>
              </defs>
              {positioned.map((node) => {
                const parent = node.parentKey ? nodeLookup.get(node.parentKey) : undefined;
                if (!parent) return null;
                return (
                  <line
                    key={`${node.key}-edge`}
                    x1={parent.x}
                    y1={parent.y}
                    x2={node.x}
                    y2={node.y}
                    stroke="#cbd5f5"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
              {positioned.map((node) => {
                const isHighlighted = highlighted.has(node.key);
                const isActive = activeNode === node.key;
                return (
                  <g key={node.key}>
                    {isHighlighted && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={32}
                        fill="url(#nodeHighlight)"
                        opacity={0.8}
                      />
                    )}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={28}
                      fill={isActive ? '#2563eb' : '#0f172a'}
                      stroke={isActive ? '#1d4ed8' : '#475569'}
                      strokeWidth={isActive ? 5 : 2}
                    />
                    <text
                      x={node.x}
                      y={node.y + 4}
                      textAnchor="middle"
                      fontSize="16"
                      fontWeight={600}
                      fill="#f8fafc"
                    >
                      {node.key}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 44}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#1e293b"
                    >
                      h={node.nodeHeight}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="flex h-[420px] w-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 backdrop-blur">
              <span className="text-sm font-medium text-slate-500">AVL tree is empty</span>
              <span className="text-xs text-slate-400">Insert values to visualize structure</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
