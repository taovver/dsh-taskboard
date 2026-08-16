// 看板数据 hook：拉取项目/任务，订阅 SSE 实时刷新。
import { useCallback, useEffect, useRef, useState } from "react";
import { listProjects, listTasks } from "./api.js";

export function useBoard() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projectId, setProjectId] = useState("local");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const reload = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        listProjects(),
        listTasks(projectIdRef.current, "false"),
      ]);
      setProjects(p.projects ?? []);
      setTasks(t.tasks ?? []);
      // 当前项目不存在时切到第一个
      setProjectId((cur) => {
        const exists = (p.projects ?? []).some((x) => x.id === cur);
        return exists || !p.projects?.length ? cur : p.projects[0].id;
      });
      setError(null);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, projectId]);

  // SSE 实时刷新：任意看板事件 → 防抖重拉。
  useEffect(() => {
    let timer = null;
    const source = new EventSource("/taskboard/api/events");
    source.onmessage = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reload();
      }, 300);
    };
    source.onerror = () => {
      // EventSource 会自动重连
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [reload]);

  return { projects, tasks, projectId, setProjectId, loading, error, reload };
}
