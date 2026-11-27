import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

export interface EvidenceItem {
  uri: string;
  name: string;
  mimeType: string;
}

export type EvidenceUploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number; name: string }
  | { status: 'done'; uploadedCount: number }
  | { status: 'error'; message: string };

/** Maximum number of evidence items processed concurrently. */
const CONCURRENCY = 1;

/**
 * Bounded evidence upload pipeline (issue #66).
 *
 * Processes items one-at-a-time (CONCURRENCY = 1) to cap memory at a known
 * ceiling — holding one file's data in memory at a time rather than loading all
 * selected files simultaneously.  URIs are released from state once processed.
 * Cancellation via `cancel()` aborts the in-flight request and clears the queue.
 */
export function useEvidenceUploadQueue(tradeId: string, authToken: string | null) {
  const [queue, setQueue] = useState<EvidenceItem[]>([]);
  const [uploadState, setUploadState] = useState<EvidenceUploadState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);

  const enqueue = useCallback((items: EvidenceItem[]) => {
    if (items.length === 0) return;
    setQueue((prev) => [...prev, ...items]);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    processingRef.current = false;
    setQueue([]);
    setUploadState({ status: 'idle' });
  }, []);

  // Process the queue one item at a time.
  useEffect(() => {
    if (processingRef.current || queue.length === 0) return;

    const processNext = async () => {
      processingRef.current = true;
      let uploadedCount = 0;

      while (queue.length > 0) {
        // Snapshot the head of the queue.
        const item = queue[0];
        const controller = new AbortController();
        abortRef.current = controller;

        setUploadState({ status: 'uploading', progress: 0, name: item.name });

        try {
          const formData = new FormData();
          formData.append('file', {
            uri: item.uri,
            name: item.name,
            type: item.mimeType,
          } as unknown as Blob);
          formData.append('tradeId', tradeId);

          await apiClient.post('/evidence', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            signal: controller.signal,
            onUploadProgress: (evt) => {
              if (evt.total) {
                setUploadState({
                  status: 'uploading',
                  progress: Math.round((evt.loaded / evt.total) * 100),
                  name: item.name,
                });
              }
            },
          });

          uploadedCount += 1;
          // Release this item from the queue once uploaded.
          setQueue((prev) => prev.slice(CONCURRENCY));
        } catch (err: unknown) {
          if ((err as { name?: string })?.name === 'AbortError' || (err as Error)?.message === 'canceled') {
            // Cancelled — state already reset by cancel().
            processingRef.current = false;
            return;
          }
          setUploadState({ status: 'error', message: (err as Error)?.message ?? 'Upload failed' });
          processingRef.current = false;
          return;
        }

        // Re-read queue length after update — React batches the setState, so
        // we break and let the next useEffect run rather than looping infinitely.
        break;
      }

      if (queue.length <= CONCURRENCY) {
        setUploadState({ status: 'done', uploadedCount });
      }
      processingRef.current = false;
    };

    processNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  // Cleanup: abort any in-flight upload when the component unmounts.
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return { uploadState, enqueue, cancel };
}
