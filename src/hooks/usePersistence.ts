import { useCallback, useEffect, useState } from 'react';
import { SubtitleFile } from '../types';
import ProjectStateManager, {
  ProjectState,
  buildProjectStateFromFile,
} from '../services/projectStateManager';
import { ensureTranslationMemoryReady } from '../services/translationMemory';

/**
 * Handles project persistence and settings storage keys.
 * API keys are never written into project payloads.
 *
 * NOTE: Full IndexedDB migration lands in a follow-up commit once
 * src/db/indexedDb.ts and the async ProjectStateManager are on the branch.
 */
export function usePersistence(files: SubtitleFile[]) {
  const [savedProjects, setSavedProjects] = useState<string[]>([]);
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureTranslationMemoryReady();
        const ensureMigrated = (ProjectStateManager as any).ensureMigrated;
        if (typeof ensureMigrated === 'function') {
          await ensureMigrated.call(ProjectStateManager);
        }
        const list = ProjectStateManager.listSavedProjects();
        const projects = typeof (list as any)?.then === 'function' ? await list : list;
        if (!cancelled) {
          setSavedProjects(projects as string[]);
          setMigrationDone(true);
        }
      } catch (e) {
        console.warn('[usePersistence] init failed', e);
        if (!cancelled) setMigrationDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCurrentProjectState = useCallback(async () => {
    if (files.length === 0) return;
    await Promise.all(
      files.map(async (file) => {
        const result = ProjectStateManager.saveProjectState(
          file.id,
          buildProjectStateFromFile(file)
        );
        if (result && typeof (result as any).then === 'function') await result;
      })
    );
    const list = ProjectStateManager.listSavedProjects();
    const projects = typeof (list as any)?.then === 'function' ? await list : list;
    setSavedProjects(projects as string[]);
  }, [files]);

  useEffect(() => {
    if (!migrationDone) return;
    void saveCurrentProjectState();
  }, [files, saveCurrentProjectState, migrationDone]);

  const loadProject = useCallback(async (projectId: string): Promise<ProjectState | null> => {
    const result = ProjectStateManager.loadProjectState(projectId);
    if (result && typeof (result as any).then === 'function') return await result;
    return result as ProjectState | null;
  }, []);

  const deleteAllSaved = useCallback(async () => {
    const list = ProjectStateManager.listSavedProjects();
    const projects = (typeof (list as any)?.then === 'function' ? await list : list) as string[];
    await Promise.all(
      projects.map(async (id) => {
        const result = ProjectStateManager.deleteProjectState(id);
        if (result && typeof (result as any).then === 'function') await result;
      })
    );
    setSavedProjects([]);
  }, []);

  const refreshSavedList = useCallback(async () => {
    const list = ProjectStateManager.listSavedProjects();
    const projects = typeof (list as any)?.then === 'function' ? await list : list;
    setSavedProjects(projects as string[]);
  }, []);

  return {
    savedProjects,
    setSavedProjects,
    migrationDone,
    saveCurrentProjectState,
    loadProject,
    deleteAllSaved,
    refreshSavedList,
  };
}
