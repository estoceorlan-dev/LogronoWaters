import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

export function useResource(path, { keepPreviousData = false } = {}) {
  const [state, setState] = useState({
    key: "",
    path: "",
    data: null,
    error: "",
    loading: true,
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${path}:${version}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api(path, { signal: controller.signal })
      .then((data) => {
        if (active) setState({ key, path, data, error: "", loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            key,
            path,
            data: null,
            error: error.message,
            loading: false,
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, key]);
  return state.key === key
    ? { ...state, reload }
    : {
        data: keepPreviousData && state.path === path ? state.data : null,
        error: "",
        loading: true,
        reload,
      };
}
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
