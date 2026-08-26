import { useCallback } from 'react';
import { SubtitleFile, Modification, SubtitleBlock } from '../types';

type SetFiles = React.Dispatch<React.SetStateAction<SubtitleFile[]>>;

export interface UseUndoRedoOptions {
  activeFileId: string | null;
  setFiles: SetFiles;
  onUndo?: () => void;
  onRedo?: () => void;
}

/**
 * Encapsulates undo/redo history for the active subtitle file.
 * History is stored per-file on SubtitleFile.modificationsMade + historyPointer.
 */
export function useUndoRedo({ activeFileId, setFiles, onUndo, onRedo }: UseUndoRedoOptions) {
  const pushModification = useCallback(
    (
      fileId: string,
      mods: Omit<Modification, 'timestamp'>[],
      applyBlocks: (blocks: SubtitleBlock[]) => SubtitleBlock[]
    ) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          const newHistory = (f.modificationsMade || []).slice(0, f.historyPointer + 1);
          const timestamp = new Date().toISOString();
          for (const mod of mods) {
            newHistory.push({ ...mod, timestamp });
          }
          return {
            ...f,
            blocks: applyBlocks(f.blocks),
            modificationsMade: newHistory,
            historyPointer: newHistory.length - 1,
          };
        })
      );
    },
    [setFiles]
  );

  const handleUndo = useCallback(() => {
    if (!activeFileId) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === activeFileId && f.historyPointer > -1) {
          let currentPtr = f.historyPointer;
          let currentMod = f.modificationsMade[currentPtr];
          const groupId = currentMod.groupId;
          let newBlocks = [...f.blocks];

          do {
            currentMod = f.modificationsMade[currentPtr];
            newBlocks = newBlocks.map((b) => {
              if (b.id === currentMod.blockId) {
                return { ...b, ...currentMod.oldState };
              }
              return b;
            });
            currentPtr--;
          } while (
            groupId &&
            currentPtr > -1 &&
            f.modificationsMade[currentPtr].groupId === groupId
          );

          return { ...f, blocks: newBlocks, historyPointer: currentPtr };
        }
        return f;
      })
    );
    onUndo?.();
  }, [activeFileId, setFiles, onUndo]);

  const handleRedo = useCallback(() => {
    if (!activeFileId) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (
          f.id === activeFileId &&
          f.modificationsMade &&
          f.historyPointer < f.modificationsMade.length - 1
        ) {
          let currentPtr = f.historyPointer + 1;
          let currentMod = f.modificationsMade[currentPtr];
          const groupId = currentMod.groupId;
          let newBlocks = [...f.blocks];

          do {
            currentMod = f.modificationsMade[currentPtr];
            newBlocks = newBlocks.map((b) => {
              if (b.id === currentMod.blockId) {
                return { ...b, ...currentMod.newState };
              }
              return b;
            });
            currentPtr++;
          } while (
            groupId &&
            currentPtr < f.modificationsMade.length &&
            f.modificationsMade[currentPtr].groupId === groupId
          );

          return { ...f, blocks: newBlocks, historyPointer: currentPtr - 1 };
        }
        return f;
      })
    );
    onRedo?.();
  }, [activeFileId, setFiles, onRedo]);

  const canUndo = useCallback(
    (files: SubtitleFile[]) => {
      const file = files.find((f) => f.id === activeFileId);
      return !!file && file.historyPointer > -1;
    },
    [activeFileId]
  );

  const canRedo = useCallback(
    (files: SubtitleFile[]) => {
      const file = files.find((f) => f.id === activeFileId);
      return (
        !!file &&
        !!file.modificationsMade &&
        file.historyPointer < file.modificationsMade.length - 1
      );
    },
    [activeFileId]
  );

  return {
    handleUndo,
    handleRedo,
    pushModification,
    canUndo,
    canRedo,
  };
}
