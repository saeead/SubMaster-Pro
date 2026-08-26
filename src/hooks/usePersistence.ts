import { useCallback, useEffect, useState } from 'react';
import { SubtitleFile } from '../types';
import ProjectStateManager, {
  ProjectState,
  buildProjectStateFromFile,
} from '../services/projectStateManager';
import { ensureTranslationMemoryReady } from '../services/translationMemory';

/**
 * Handles project persistence (IndexedDB), migration, and settings storage keys.
 * API keys are never written into project payloads.
 */
export function usePersistence(files: SubtitleFile[]) {
  const [savedProjects, setSavedProjects] = useState<string[]>([]);
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ProjectStateManager.ensureMigrated();
        await ensureTranslationMemoryReady();
        const projects = await ProjectStateManager.listSavedProjects();
        if (!cancelled) {
          setSavedProjects(projects);
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
      files.map((file) =>
        ProjectStateManager.saveProjectState(file.id, buildProjectStateFromFile(file))
      )
    );
    const projects = await ProjectStateManager.listSavedProjects();
    setSavedProjects(projects);
  }, [files]);

  // Auto-save on file changes (after migration)
  useEffect(() => {
    if (!migrationDone) return;
    void saveCurrentProjectState();
  }, [files, saveCurrentProjectState, migrationDone]);

  const loadProject = useCallback(async (projectId: string): Promise<ProjectState | null> => {
    return ProjectStateManager.loadProjectState(projectId);
  }, []);

  const deleteAllSaved = useCallback(async () => {
    const projects = await ProjectStateManager.listSavedProjects();
    await Promise.all(projects.map((id) => ProjectStateManager.deleteProjectState(id)));
    setSavedProjects([]);
  }, []);

  const refreshSavedList = useCallback(async () => {
    const projects = await ProjectStateManager.listSavedProjects();
    setSavedProjects(projects);
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
