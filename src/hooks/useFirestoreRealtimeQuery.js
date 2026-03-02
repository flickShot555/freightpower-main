import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

/**
 * Subscribe to a Firestore query (or collection ref) in realtime.
 *
 * @param {import('firebase/firestore').Query|import('firebase/firestore').CollectionReference|null|undefined} q
 * @returns {{ data: Array<{id: string, [key: string]: any}>, loading: boolean, error: any }}
 */
export default function useFirestoreRealtimeQuery(q) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(Boolean(q));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = [];
        snap.forEach((doc) => next.push({ id: doc.id, ...(doc.data() || {}) }));
        setData(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch (_) {
        // ignore
      }
    };
  }, [q]);

  return { data, loading, error };
}
