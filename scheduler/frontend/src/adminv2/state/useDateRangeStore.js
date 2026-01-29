/**
 * Zustand store for managing date ranges for different admin pages.
 * Allows setting and retrieving date ranges by page key.
 */
import { create } from 'zustand';

const useDateRangeStore = create((set, get) => ({
  ranges: {},
  setRange: (pageKey, range) =>
    set((state) => ({
      ranges: {
        ...state.ranges,
        [pageKey]: range,
      },
    })),
  getRange: (pageKey) => get().ranges[pageKey] || { start: null, end: null, preset: 'This Week' },
}));

export default useDateRangeStore;

