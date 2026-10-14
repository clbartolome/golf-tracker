import { useEffect, useState, useRef } from "react";
import {
  dataError,
  watchData,
  type repository,
} from "../persistence/repository";
export function useGolfData() {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof repository.snapshot>>
  >({ courses: [], clubs: [], rounds: [], playedHoles: [], shots: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(
    () =>
      watchData(
        (value) => {
          setData(value);
          setLoading(false);
          setError("");
        },
        (err) => {
          setError(dataError(err));
          setLoading(false);
        },
      ),
    [attempt],
  );
  return {
    ...data,
    loading,
    error,
    retry: () => {
      setLoading(true);
      setError("");
      setAttempt((n) => n + 1);
    },
  };
}
export function useWrite() {
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(
    action: () => Promise<unknown>,
    success = "Cambios guardados en este navegador.",
  ) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (mounted.current) setMessage(success);
      return mounted.current;
    } catch (err) {
      if (mounted.current) setError(dataError(err));
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, message, run };
}
