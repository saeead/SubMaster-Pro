import { useState, useCallback, useRef, useEffect } from 'react';
import { SubtitleFile, SubtitleBlock, AppStatus } from '../types';
import type { ProjectState as PSMProjectState } from '../services/projectStateManager';

/**
 * Manages the multi-file workspace: load, import, active selection, status updates.
 */
export function useProjectFiles() {
  const [files, setFiles] = useState<SubtitleFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const getActiveFile = useCallback((): SubtitleFile | undefined => {
    return filesRef.current.find((f) => f.id === activeFileId);
  }, [activeFileId]);

  const handleFilesLoaded = useCallback(
    (
      loadedFiles: {
        blocks: SubtitleBlock[];
        filename: string;
        type: 'SRT' | 'VTT' | 'ASS';
        size: number;
      }[]
    ) => {
      const newFiles: SubtitleFile[] = loadedFiles.map((f) => ({
        id: crypto.randomUUID(),
        name: f.filename,
        size: f.size,
        type: f.type,
        originalType: f.type,
        blocks: f.blocks,
        status: AppStatus.READY,
        progress: 0,
        diagnostic: null,
        processedCount: 0,
        netflixErrors: [],
        modificationsMade: [],
        historyPointer: -1,
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      setActiveFileId((prev) => (prev === null && newFiles.length > 0 ? newFiles[0].id : prev));
    },
    []
  );

  const handleProjectImport = useCallback((projectState: PSMProjectState) => {
    const restoredFile: SubtitleFile = {
      id: projectState.id || crypto.randomUUID(),
      name: projectState.name,
      size: 0,
      type: projectState.type,
      originalType: projectState.type,
      blocks: projectState.allBlocks,
      status: projectState.status as AppStatus,
      progress: projectState.progress,
      processedCount: projectState.completedChunks,
      netflixErrors: [],
      modificationsMade: projectState.modificationsMade || [],
      historyPointer: projectState.modificationsMade
        ? projectState.modificationsMade.length - 1
        : -1,
    };

    if (restoredFile.progress >= 100) {
      restoredFile.status = AppStatus.COMPLETED;
    } else if (restoredFile.status === AppStatus.TRANSLATING) {
      restoredFile.status = AppStatus.PAUSED;
    }

    setFiles([restoredFile]);
    setActiveFileId(restoredFile.id);
    return restoredFile;
  }, []);

  const updateFileStatus = useCallback(
    (fileId: string, updates: Partial<SubtitleFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const removeFile = useCallback(
    (fileId: string) => {
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== fileId);
        return next;
      });
      setActiveFileId((prev) => (prev === fileId ? null : prev));
    },
    []
  );

  return {
    files,
    setFiles,
    activeFileId,
    setActiveFileId,
    filesRef,
    getActiveFile,
    handleFilesLoaded,
    handleProjectImport,
    updateFileStatus,
    removeFile,
  };
}
