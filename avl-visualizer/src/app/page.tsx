'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TreeCanvas } from '@/components/TreeCanvas';
import type { AVLNode, OperationLogEntry, TraversalType } from '@/lib/avl';
import { cloneTree, getTraversal, insert, remove, search } from '@/lib/avl';

type InputError = string | null;

const traversalOptions: { label: string; value: TraversalType; description: string }[] = [
  { label: 'In-order', value: 'in-order', description: 'Left → Root → Right' },
  { label: 'Pre-order', value: 'pre-order', description: 'Root → Left → Right' },
  { label: 'Post-order', value: 'post-order', description: 'Left → Right → Root' },
  { label: 'Level-order', value: 'level-order', description: 'Breadth-first by level' },
];

const operationAccent: Record<OperationLogEntry['operation'], string> = {
  insert: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/40',
  delete: 'bg-rose-500/10 text-rose-600 ring-1 ring-inset ring-rose-500/40',
  search: 'bg-sky-500/10 text-sky-600 ring-1 ring-inset ring-sky-500/40',
};

const OPERATION_LIMIT = 100;

export default function Home() {
  const [tree, setTree] = useState<AVLNode | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [inputError, setInputError] = useState<InputError>(null);
  const [logs, setLogs] = useState<OperationLogEntry[]>([]);

  const [operationHighlight, setOperationHighlight] = useState<Set<number>>(new Set());
  const [operationActiveNode, setOperationActiveNode] = useState<number | null>(null);

  const [traversalType, setTraversalType] = useState<TraversalType>('in-order');
  const [traversalIndex, setTraversalIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const traversalSequence = useMemo(() => getTraversal(tree, traversalType), [tree, traversalType]);
  const sequenceLength = traversalSequence.length;
  const traversalHighlight = useMemo(() => {
    if (sequenceLength === 0) return new Set<number>();
    if (traversalIndex < 0) return new Set<number>();
    const boundedIndex = Math.min(traversalIndex, sequenceLength - 1);
    return new Set(traversalSequence.slice(0, boundedIndex + 1));
  }, [traversalSequence, traversalIndex, sequenceLength]);
  const traversalActiveNode =
    traversalIndex >= 0 && sequenceLength > 0
      ? traversalSequence[Math.min(traversalIndex, sequenceLength - 1)]
      : null;
  const playbackTimer = useRef<number | null>(null);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const clearPlaybackTimer = useCallback(() => {
    if (playbackTimer.current !== null) {
      window.clearTimeout(playbackTimer.current);
      playbackTimer.current = null;
    }
  }, []);
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    clearPlaybackTimer();
  }, [clearPlaybackTimer]);
  const scheduleNextTick = useCallback(() => {
    clearPlaybackTimer();
    if (!isPlaying || sequenceLength === 0) return;
    const delay = Math.max(180, 1000 / playSpeed);
    playbackTimer.current = window.setTimeout(() => {
      setTraversalIndex((prev) => {
        const nextIndex = prev < 0 ? 0 : Math.min(prev + 1, sequenceLength - 1);
        if (nextIndex >= sequenceLength - 1) {
          stopPlayback();
        }
        return nextIndex;
      });
    }, delay);
  }, [clearPlaybackTimer, isPlaying, sequenceLength, playSpeed, stopPlayback]);

  const highlightSet = useMemo(() => {
    const merged = new Set<number>();
    operationHighlight.forEach((value) => merged.add(value));
    traversalHighlight.forEach((value) => merged.add(value));
    return merged;
  }, [operationHighlight, traversalHighlight]);

  const activeNode = traversalActiveNode ?? operationActiveNode;

  useEffect(() => {
    if (!isPlaying) {
      clearPlaybackTimer();
      return;
    }
    if (sequenceLength === 0) {
      clearPlaybackTimer();
      return;
    }
    if (traversalIndex >= sequenceLength - 1) {
      clearPlaybackTimer();
      return;
    }
    scheduleNextTick();
    return () => clearPlaybackTimer();
  }, [isPlaying, traversalIndex, sequenceLength, scheduleNextTick, clearPlaybackTimer]);

  const sanitizedValue = (raw: string): number | null => {
    if (!raw.trim()) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed);
  };

  const recordLog = (entry: OperationLogEntry) => {
    setLogs((prev) => {
      const next = [entry, ...prev];
      if (next.length > OPERATION_LIMIT) next.length = OPERATION_LIMIT;
      return next;
    });
  };

  const handleInsert = () => {
    const value = sanitizedValue(inputValue);
    if (value === null) {
      setInputError('Provide an integer to insert');
      return;
    }
    setInputError(null);
    const result = insert(tree ? cloneTree(tree) : null, value);
    setTree(result.root ? cloneTree(result.root) : null);
    setOperationHighlight(new Set(result.highlightPath));
    setOperationActiveNode(value);
    recordLog(result.log);
    stopPlayback();
    setTraversalIndex(-1);
    setInputValue('');
  };

  const handleDelete = () => {
    const value = sanitizedValue(inputValue);
    if (value === null) {
      setInputError('Provide an integer to delete');
      return;
    }
    setInputError(null);
    const result = remove(tree ? cloneTree(tree) : null, value);
    setTree(result.root ? cloneTree(result.root) : null);
    setOperationHighlight(new Set(result.highlightPath));
    setOperationActiveNode(result.highlightPath.at(-1) ?? null);
    recordLog(result.log);
    stopPlayback();
    setTraversalIndex(-1);
    setInputValue('');
  };

  const handleSearch = () => {
    const value = sanitizedValue(inputValue);
    if (value === null) {
      setInputError('Provide an integer to search');
      return;
    }
    setInputError(null);
    const result = search(tree ? cloneTree(tree) : null, value);
    setOperationHighlight(new Set(result.highlightPath));
    setOperationActiveNode(result.highlightPath.at(-1) ?? null);
    recordLog(result.log);
    stopPlayback();
  };

  const handleClear = () => {
    setTree(null);
    setLogs([]);
    setOperationHighlight(new Set());
    setOperationActiveNode(null);
    setTraversalIndex(-1);
    stopPlayback();
  };

  const handlePlay = () => {
    if (traversalSequence.length === 0) return;
    if (traversalIndex >= traversalSequence.length - 1 || traversalIndex < 0) {
      setTraversalIndex(0);
    }
    clearPlaybackTimer();
    setIsPlaying(true);
  };

  const handlePause = () => {
    stopPlayback();
  };

  const handleStep = () => {
    stopPlayback();
    if (traversalSequence.length === 0) return;
    if (traversalIndex >= traversalSequence.length - 1) {
      setTraversalIndex(0);
      return;
    }
    setTraversalIndex((prev) => prev + 1);
  };

  const handleResetTraversal = () => {
    stopPlayback();
    setTraversalIndex(-1);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Enhanced AVL Tree Visualizer
          </h1>
          <p className="max-w-3xl text-sm text-slate-500 sm:text-base">
            Explore self-balancing binary search trees with responsive controls, algorithm-aware logging, and guided traversals.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <TreeCanvas root={tree} highlighted={highlightSet} activeNode={activeNode} />
          </section>

          <section className="flex flex-col gap-6 lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-800">Tree Operations</h2>
              <p className="mt-1 text-xs text-slate-500">
                Insert, delete, or search nodes. Each action generates contextual logs with rotation insights.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <label className="text-xs font-medium text-slate-500" htmlFor="value-input">
                  Node value
                </label>
                <input
                  id="value-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 42"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner outline-none ring-2 ring-transparent transition focus:border-sky-400 focus:ring-sky-100"
                />
                {inputError && <span className="text-xs text-rose-500">{inputError}</span>}
                <div className="grid grid-cols-3 gap-2 pt-1 text-sm">
                  <button
                    type="button"
                    onClick={handleInsert}
                    className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white shadow-sm transition hover:bg-emerald-600 active:scale-95"
                  >
                    Insert
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg bg-rose-500 px-3 py-2 font-medium text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="rounded-lg bg-sky-500 px-3 py-2 font-medium text-white shadow-sm transition hover:bg-sky-600 active:scale-95"
                  >
                    Search
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 active:scale-95"
                >
                  Clear tree & history
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Traversal Playback</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  Complexity O(n)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Choose an order, then play animated traversals with adjustable speed and stepping controls.
              </p>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {traversalOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTraversalType(option.value);
                      }}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        traversalType === option.value
                          ? 'border-sky-400 bg-sky-50 text-sky-600'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="text-[11px] text-slate-400">{option.description}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePlay}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={traversalSequence.length === 0}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={handlePause}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300"
                      disabled={!isPlaying}
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={handleStep}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300"
                      disabled={traversalSequence.length === 0}
                    >
                      Step
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetTraversal}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300"
                    disabled={traversalSequence.length === 0}
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500" htmlFor="speed-range">
                    Playback speed ({playSpeed.toFixed(1)}x)
                  </label>
                  <input
                    id="speed-range"
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={playSpeed}
                    onChange={(event) => setPlaySpeed(Number(event.target.value))}
                    className="w-full accent-sky-500"
                  />
                </div>

                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">
                  {traversalSequence.length === 0 ? (
                    <p>No traversal available — build the tree first.</p>
                  ) : traversalIndex < 0 ? (
                    <p>
                      Ready. Sequence contains{' '}
                      <span className="font-semibold text-slate-700">{traversalSequence.length}</span> nodes.
                      Press play or step to begin.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1 text-slate-600">
                      {traversalSequence.map((value, index) => {
                        const visited = index <= traversalIndex;
                        return (
                          <span
                            key={`${value}-${index}`}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                              visited ? 'bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/30' : 'bg-white'
                            }`}
                          >
                            {value}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-3">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-800">Algorithm Activity Log</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Each operation provides a step-by-step trace with balance checks, rotation analysis, and time complexity context.
              </p>
              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">
                {logs.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center text-sm text-slate-400">
                    Activity log is empty. Execute an operation to see algorithm insights.
                  </div>
                ) : (
                  logs.map((log) => (
                    <article
                      key={log.id}
                      className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                    >
                      <header className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${operationAccent[log.operation]}`}
                        >
                          {log.operation}
                        </span>
                        <time className="text-[11px] uppercase tracking-wider text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </time>
                      </header>
                      <h3 className="mt-2 text-sm font-semibold text-slate-800">{log.headline}</h3>
                      {log.context?.path && log.context.path.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          Path traversed:{' '}
                          <span className="font-medium text-slate-700">
                            {log.context.path.join(' → ')}
                          </span>
                        </p>
                      )}
                      {log.context?.rotation && (
                        <p className="mt-1 text-xs text-slate-500">
                          Rotation insight:{' '}
                          <span className="font-medium text-slate-700">{log.context.rotation}</span>
                        </p>
                      )}
                      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                        {log.steps.map((step, index) => (
                          <li
                            key={`${log.id}-${index}`}
                            className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2"
                          >
                            <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
