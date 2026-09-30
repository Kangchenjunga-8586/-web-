import { useEffect, useState } from 'react';
import { todayInTokyo } from '../../domain/dates';
import type { ISODate } from '../../domain/types';

/** Current Asia/Tokyo calendar date; updates across midnight and when the app is resumed. */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayInTokyo());
  useEffect(() => {
    const update = () => setToday(todayInTokyo());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
    };
  }, []);
  return today;
}
