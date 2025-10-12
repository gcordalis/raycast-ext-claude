import { LocalStorage, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Model, ModelHook, AvailableModel } from "../type";
import { fetchAvailableModels, getCachedModels } from "../api/models";

// Fallback models to ensure dropdown is never empty
const FALLBACK_MODELS: AvailableModel[] = [
  { id: "claude-sonnet-4-5-20250929", display_name: "Claude Sonnet 4.5", created_at: "2025-09-29T00:00:00Z" },
  { id: "claude-opus-4-1-20250805", display_name: "Claude Opus 4.1", created_at: "2025-08-05T00:00:00Z" },
  { id: "claude-opus-4-20250514", display_name: "Claude Opus 4", created_at: "2025-05-22T00:00:00Z" },
  { id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4", created_at: "2025-05-22T00:00:00Z" },
  { id: "claude-3-7-sonnet-20250219", display_name: "Claude Sonnet 3.7", created_at: "2025-02-24T00:00:00Z" },
  { id: "claude-3-5-sonnet-20241022", display_name: "Claude Sonnet 3.5 (New)", created_at: "2024-10-22T00:00:00Z" },
  { id: "claude-3-5-haiku-20241022", display_name: "Claude Haiku 3.5", created_at: "2024-10-22T00:00:00Z" },
  { id: "claude-3-5-sonnet-20240620", display_name: "Claude Sonnet 3.5 (Old)", created_at: "2024-06-20T00:00:00Z" },
  { id: "claude-3-haiku-20240307", display_name: "Claude Haiku 3", created_at: "2024-03-07T00:00:00Z" },
  { id: "claude-3-opus-20240229", display_name: "Claude Opus 3", created_at: "2024-02-29T00:00:00Z" },
];

export const DEFAULT_MODEL: Model = {
  id: "default",
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  name: "Haiku 3.5",
  prompt: "You are a helpful assistant.",
  option: "claude-3-5-haiku-latest",
  temperature: "1",
  max_tokens: "4096",
  pinned: false,
};

async function getStoredModels(): Promise<Model[]> {
  const storedModels = await LocalStorage.getItem<string>("models");
  if (!storedModels) {
    return [DEFAULT_MODEL];
  }

  return JSON.parse(storedModels) satisfies Model[];
}

export function useModel(): ModelHook {
  const [data, setData] = useState<Model[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>(FALLBACK_MODELS);

  // Load cached models on mount
  useEffect(() => {
    getCachedModels().then((cached) => {
      if (cached && cached.length > 0) {
        setAvailableModels(cached);
      }
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getStoredModels()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Validate stored models against available models
  useEffect(() => {
    if (availableModels.length === 0 || data.length === 0) return;

    const availableModelIds = new Set(availableModels.map((m: AvailableModel) => m.id));
    const deprecatedModels = data.filter((model: Model) => !availableModelIds.has(model.option));

    if (deprecatedModels.length > 0) {
      const modelNames = deprecatedModels.map((m: Model) => m.name).join(", ");
      showToast({
        title: "Warning: Deprecated Models Detected",
        message: `The following custom models use deprecated model IDs: ${modelNames}. Please update them.`,
        style: Toast.Style.Failure,
      });
    }
  }, [availableModels, data]);

  const refreshAvailableModels = useCallback(async () => {
    try {
      const models = await fetchAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      // Error already handled in fetchAvailableModels
    }
  }, []);

  const add = useCallback(
    async (model: Model) => {
      const toast = await showToast({
        title: "Saving your model...",
        style: Toast.Style.Animated,
      });
      const newModel: Model = { ...model, created_at: new Date().toISOString() };
      setData((prevData: Model[]) => {
        const newData = [...prevData, newModel];
        LocalStorage.setItem("models", JSON.stringify(newData));
        return newData;
      });
      toast.title = "Model saved!";
      toast.style = Toast.Style.Success;
    },
    [setData]
  );

  const update = useCallback(
    async (model: Model) => {
      setData((prevData: Model[]) => {
        const newModels = prevData.map((x: Model) => {
          if (x.id === model.id) {
            return model;
          }
          return x;
        });
        LocalStorage.setItem("models", JSON.stringify(newModels));
        return newModels;
      });
    },
    [setData]
  );

  const remove = useCallback(
    async (model: Model) => {
      const toast = await showToast({
        title: "Removing your model...",
        style: Toast.Style.Animated,
      });
      setData((prevData: Model[]) => {
        const newModels = prevData.filter((oldModel: Model) => oldModel.id !== model.id);
        LocalStorage.setItem("models", JSON.stringify(newModels));
        return newModels;
      });
      toast.title = "Model removed!";
      toast.style = Toast.Style.Success;
    },
    [setData]
  );

  const clear = useCallback(async () => {
    const toast = await showToast({
      title: "Clearing your models...",
      style: Toast.Style.Animated,
    });
    setData((prevData: Model[]) => {
      const newModels: Model[] = prevData.filter((oldModel: Model) => oldModel.id === DEFAULT_MODEL.id);
      LocalStorage.setItem("models", JSON.stringify(newModels));
      return newModels;
    });
    toast.title = "Models cleared!";
    toast.style = Toast.Style.Success;
  }, [setData]);

  return useMemo(
    () => ({ data, isLoading, availableModels, refreshAvailableModels, add, update, remove, clear }),
    [data, isLoading, availableModels, refreshAvailableModels, add, update, remove, clear]
  );
}
