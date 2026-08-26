import { useRef, useCallback } from 'react';
import { TranslationJobRunner } from '../services/translationJobRunner';
import { AppStatus } from '../types';

/**
 * Thin wrapper around TranslationJobRunner for pause/cancel/abort control.
 * The actual batch translation loop remains orchestrated by the caller (App)
 * so behavior stays identical while gaining a clear abort boundary.
 */
export function useTranslationRunner() {
  const isTranslatingRef = useRef(false);
  const isPausedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runnerRef = useRef<TranslationJobRunner | null>(null);

  const createAbortSignal = useCallback((): AbortSignal => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller.signal;
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    isTranslatingRef.current = false;
    abortControllerRef.current?.abort();
    runnerRef.current?.pauseActive();
  }, []);

  const cancel = useCallback(() => {
    isPausedRef.current = false;
    isTranslatingRef.current = false;
    abortControllerRef.current?.abort();
    runnerRef.current?.cancelAll();
  }, []);

  const markRunning = useCallback(() => {
    isTranslatingRef.current = true;
    isPausedRef.current = false;
  }, []);

  const markIdle = useCallback(() => {
    isTranslatingRef.current = false;
  }, []);

  return {
    isTranslatingRef,
    isPausedRef,
    abortControllerRef,
    runnerRef,
    createAbortSignal,
    pause,
    cancel,
    markRunning,
    markIdle,
    /** Helper status transitions */
    statusPaused: AppStatus.PAUSED,
    statusCancelled: AppStatus.CANCELLED,
    statusTranslating: AppStatus.TRANSLATING,
  };
}
