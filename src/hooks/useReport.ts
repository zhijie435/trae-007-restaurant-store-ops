import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

export function useReportDate() {
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  return { date, setDate };
}

export function useReportData<T>(fetcher: (date: string) => Promise<T>, date: dayjs.Dayjs) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(dateStr);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '数据加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetcher, dateStr]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run };
}
