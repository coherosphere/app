
import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  format, addDays, startOfDay, isSameDay, differenceInDays, subDays, startOfWeek,
  eachWeekOfInterval, getISOWeek, differenceInHours, addHours, isSameHour, addWeeks, subWeeks
} from 'date-fns';

import CoherosphereNetworkSpinner from '@/components/spinners/CoherosphereNetworkSpinner';
import { useAllIconConfigs } from '@/components/hooks/useIconConfig';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

// Mock Data Generator - generates for a specific range
const generateMockEventsForRange = (rangeStart, rangeEnd) => {
  const events = [];
  const totalDaysInRange = differenceInDays(rangeEnd, rangeStart) + 1;

  // Helper to create random date-times within a given window (inclusive)
  const randomDateTimeInWindow = (minDate, maxDate) => {
    if (minDate > maxDate) return minDate;
    const start = minDate.getTime();
    const end = maxDate.getTime();
    return new Date(start + Math.random() * (end - start));
  };

  // Helper to create events, ensuring they are generated and clamped within the specified range [rangeStart, rangeEnd]
  const createEvent = (type, titleOptions, description, getStartDateFunc, getEndDateFunc, extraProps) => {
    let candidateStartDateTime = getStartDateFunc(rangeStart, rangeEnd);
    let candidateEndDateTime = getEndDateFunc(candidateStartDateTime);

    if (candidateEndDateTime < candidateStartDateTime) {
      candidateEndDateTime = addHours(candidateStartDateTime, 1);
    }
    
    const clampedStartDateTime = new Date(Math.max(rangeStart.getTime(), candidateStartDateTime.getTime()));
    const clampedEndDateTime = new Date(Math.min(rangeEnd.getTime(), candidateEndDateTime.getTime()));

    if (clampedEndDateTime <= clampedStartDateTime) {
        return null;
    }

    return {
      id: `${type}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: titleOptions[Math.floor(Math.random() * titleOptions.length)],
      description,
      startDateTime: clampedStartDateTime,
      endDateTime: clampedEndDateTime,
      startDate: startOfDay(clampedStartDateTime),
      endDate: startOfDay(clampedEndDateTime),
      ...extraProps
    };
  };

  const baseDaysForDensity = 60 * 7; 
  const eventDensityFactor = totalDaysInRange / baseDaysForDensity; 
  const eventsCount = Math.floor(80 * eventDensityFactor);
  const learningCirclesCount = Math.floor(45 * eventDensityFactor);
  const projectDeadlinesCount = Math.floor(60 * eventDensityFactor);
  const governanceDecisionsCount = Math.floor(35 * eventDensityFactor);

  // Events (Orange) - now 1 to 4 hours long
  for (let i = 0; i < eventsCount; i++) {
    const event = createEvent(
      'events',
      ['Local Hub Meetup', 'Community Workshop', 'Tech Talk', 'Networking Session', 'Knowledge Share', 'Open House', 'Coffee & Code', 'Design Thinking Session', 'Book Club', 'Hackathon', 'Panel Discussion', 'Movie Night'],
      'Join our community for this engaging event focused on building connections and sharing knowledge.',
      (rS, rE) => randomDateTimeInWindow(rS, rE),
      (sd) => addHours(sd, Math.floor(Math.random() * 3) + 1),
      {
        location: ['Tokyo Hub', 'Berlin Hub', 'Online', 'San Francisco Hub', 'London Hub', 'Amsterdam Hub', 'Barcelona Hub'][Math.floor(Math.random() * 7)],
        link: '/HostEvent'
      }
    );
    if (event) events.push(event);
  }

  // Learning Circles (Blue) - still multi-day, but with time precision
  for (let i = 0; i < learningCirclesCount; i++) {
    const event = createEvent(
      'learning-circles',
      ['Decentralized Governance', 'Holistic Health Practices', 'Sustainable Technology', 'Community Building', 'Mindfulness & Meditation', 'Permaculture Design', 'Web3 Fundamentals', 'Climate Action', 'Digital Wellness', 'Systems Thinking'],
      'Weekly learning circle exploring cutting-edge topics in a collaborative environment.',
      (rS, rE) => randomDateTimeInWindow(rS, subDays(rE, 56)),
      (sd) => addDays(sd, 56),
      {
        frequency: 'Weekly',
        location: Math.random() > 0.5 ? 'Online' : 'Physical',
        link: '/StartCircle'
      }
    );
    if (event) events.push(event);
  }

  // Project Deadlines (Neutral with orange caps) - end of day on the due date
  for (let i = 0; i < projectDeadlinesCount; i++) {
    const dueDate = randomDateTimeInWindow(rangeStart, rangeEnd);

    const event = createEvent(
      'project-deadlines',
      ['Solar-Powered Hub', 'Community Garden', 'Decentralized App', 'Educational Platform', 'Repair Café', 'Food Forest', 'Mesh Network', 'Tool Library', 'Co-working Space', 'Maker Lab'].map(t => t + ' — Phase ' + ['I', 'II', 'III', 'IV'][Math.floor(Math.random() * 4)]),
      'Critical milestone in our community project development.',
      (rS, rE) => randomDateTimeInWindow(new Date(Math.max(rS.getTime(), subDays(dueDate, Math.floor(Math.random() * 60) + 10).getTime())), dueDate),
      (sd) => dueDate,
      {
        phase: ['Planning', 'Development', 'Review', 'Launch', 'Testing', 'Deployment'][Math.floor(Math.random() * 6)],
        link: '/Projects'
      }
    );
    if (event) events.push(event);
  }

  // Governance Decisions (Blue bars with status chips) - multi-day with time
  for (let i = 0; i < governanceDecisionsCount; i++) {
    const event = createEvent(
      'governance-decisions',
      ['Treasury Allocation 2025', 'Governance Model Update', 'Community Guidelines', 'Resource Distribution', 'Code of Conduct', 'Budget Proposal', 'Hub Expansion', 'Partnership Agreement', 'Policy Update', 'Strategic Planning'],
      'Important governance decision requiring community participation and voting.',
      (rS, rE) => randomDateTimeInWindow(rS, subDays(rE, 3)),
      (sd) => addDays(sd, Math.floor(Math.random() * 14) + 3),
      {
        status: ['Draft', 'Voting', 'Passed', 'Implemented', 'Rejected', 'Under Review'][Math.floor(Math.random() * 6)],
        link: '/Voting'
      }
    );
    if (event) events.push(event);
  }

  return events.filter(Boolean).sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
};

// Lane Configuration
const LANES = [
  { id: 'events', label: 'Events', color: 'bg-orange-500/20', baseHeight: 60 },
  { id: 'learning-circles', label: 'Learning', color: 'bg-blue-500/10', baseHeight: 60 },
  { id: 'project-deadlines', label: 'Projects', color: 'bg-slate-500/10', baseHeight: 60 },
  { id: 'governance-decisions', label: 'Governance', color: 'bg-indigo-500/10', baseHeight: 60 }
];

const HOUR_WIDTH = 60;
const DAY_WIDTH = 60;
const WEEK_DAY_WIDTH = 60 / 7;
const ITEM_HEIGHT = 32;
const ITEM_GAP = 4;

export default function Calendar() {
  const [today] = useState(() => new Date());
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
  const previousViewModeRef = useRef(null);

  const { iconConfigs } = useAllIconConfigs();

  // Load data for +/- 30 weeks initially
  const [loadedMinDate, setLoadedMinDate] = useState(() => startOfDay(subWeeks(today, 30)));
  const [loadedMaxDate, setLoadedMaxDate] = useState(() => startOfDay(addWeeks(today, 30)));
  
  // Progressive Loading States
  const [sectionsReady, setSectionsReady] = useState({
    banner: false,
    controls: false,
    timeline: false
  });

  // Generate all events once on initialization
  const [allMockEvents, setAllMockEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Populate allMockEvents
  useEffect(() => {
    const fetchInitialEvents = () => {
      const initialMinDate = startOfDay(subWeeks(today, 30));
      const initialMaxDate = startOfDay(addWeeks(today, 30));
      const events = generateMockEventsForRange(initialMinDate, initialMaxDate);
      setAllMockEvents(events);
      setDataLoading(false);
    };
    fetchInitialEvents();
  }, [today]);
  
  // UI States
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleLanes, setVisibleLanes] = useState(['events', 'learning-circles', 'project-deadlines', 'governance-decisions']);
  const [viewMode, setViewMode] = useState('day');
  const [visibleLaneCounts, setVisibleLaneCounts] = useState({});
  const [eventTextAlignments, setEventTextAlignments] = useState({});
  const [headerTextVisibility, setHeaderTextVisibility] = useState({});
  const [statusBarTextVisibility, setStatusBarTextVisibility] = useState({}); 
  
  // Responsive label states
  const [compactLevel, setCompactLevel] = useState(0); 
  
  // Custom tooltip state
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Loading state for dynamic loading
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const timelineViewportRef = useRef(null);
  const timelineContentRef = useRef(null); 
  const todayRef = useRef(null);

  // Ref to store the old scroll width before prepending data
  const oldScrollWidthRef = useRef(null);

  // Track when sections are ready (parallel loading)
  useEffect(() => {
    // Banner always ready (static content)
    setSectionsReady(prev => ({ ...prev, banner: true }));
  }, []);

  useEffect(() => {
    // Controls ready when data loaded
    if (!dataLoading) {
      setSectionsReady(prev => ({ ...prev, controls: true }));
    }
  }, [dataLoading]);

  useEffect(() => {
    // Timeline ready when data loaded
    if (!dataLoading && allMockEvents.length > 0) {
      setSectionsReady(prev => ({ ...prev, timeline: true }));
    }
  }, [dataLoading, allMockEvents]);

  // Function to load more data in a specific direction
  const loadMoreData = useCallback(async (direction) => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      // Add 8 weeks (2 months) in the specified direction
      const additionalWeeks = 8;
      let newMinDate = loadedMinDate;
      let newMaxDate = loadedMaxDate;
      
      if (direction === 'past') {
        newMinDate = startOfDay(subWeeks(loadedMinDate, additionalWeeks));
        // Store current scrollWidth if we're prepending, for compensation later
        if (timelineViewportRef.current) {
          oldScrollWidthRef.current = timelineViewportRef.current.scrollWidth;
        }
      } else if (direction === 'future') {
        newMaxDate = startOfDay(addWeeks(loadedMaxDate, additionalWeeks));
      }
      
      // Generate events for the new *entire* range, not just the added chunk
      const newEvents = generateMockEventsForRange(newMinDate, newMaxDate);
      
      console.log(`Loaded more data for ${direction}: ${format(newMinDate, 'MMM d, yyyy')} to ${format(newMaxDate, 'MMM d, yyyy')}`);
      
      // Update state
      setLoadedMinDate(newMinDate);
      setLoadedMaxDate(newMaxDate);
      setAllMockEvents(newEvents);
      
    } catch (error) {
      console.error('Error loading more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadedMinDate, loadedMaxDate, isLoadingMore]);

  // Effect to adjust scroll position after prepending content (loading 'past' data)
  useEffect(() => {
    if (timelineViewportRef.current && oldScrollWidthRef.current !== null) {
      const newScrollWidth = timelineViewportRef.current.scrollWidth;
      const widthDifference = newScrollWidth - oldScrollWidthRef.current;
      
      if (widthDifference > 0) { 
        timelineViewportRef.current.scrollLeft += widthDifference;
      }
      oldScrollWidthRef.current = null; 
    }
  }, [allMockEvents]); 

  // Check if we need to load more data based on scroll position
  const checkForDataLoading = useCallback(() => {
    if (!isLoadingMore && timelineViewportRef.current) {
      const viewport = timelineViewportRef.current;
      const { scrollLeft, scrollWidth, clientWidth } = viewport;
      
      const loadThresholdPixels = 0.1 * clientWidth; 
      
      if (scrollLeft < loadThresholdPixels) {
        console.log('Near left edge, loading past data...');
        loadMoreData('past');
      } else if ((scrollWidth - (scrollLeft + clientWidth)) < loadThresholdPixels) {
        console.log('Near right edge, loading future data...');
        loadMoreData('future');
      }
    }
  }, [loadMoreData, isLoadingMore]);

  // Create an effective date range based on the view mode
  const effectiveDateRange = useMemo(() => {
    if (viewMode === 'hour') {
      const hourViewWindowDays = 14; 
      return {
        minDate: startOfDay(subDays(today, hourViewWindowDays)),
        maxDate: startOfDay(addDays(today, hourViewWindowDays)),
      };
    }
    return {
      minDate: loadedMinDate,
      maxDate: loadedMaxDate,
    };
  }, [viewMode, today, loadedMinDate, loadedMaxDate]);

  // Calculate current date range and days based on the effective range
  const totalDays = useMemo(() => {
    return differenceInDays(effectiveDateRange.maxDate, effectiveDateRange.minDate) + 1;
  }, [effectiveDateRange]);
  
  const allDays = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(effectiveDateRange.minDate, i));
  }, [effectiveDateRange, totalDays]);

  // Generate week data for week view header
  const weekData = useMemo(() => {
    if (viewMode !== 'week') return [];

    const weeks = [];
    const startOfEffectiveMinWeek = startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 });

    let currentWeekStart = startOfEffectiveMinWeek;
    while (currentWeekStart <= effectiveDateRange.maxDate) {
      const weekNumber = getISOWeek(currentWeekStart);
      const year = currentWeekStart.getFullYear();
      const isCurrentWeek = isSameDay(startOfWeek(today, { weekStartsOn: 1 }), currentWeekStart);

      const weekEnd = addDays(currentWeekStart, 6);
      const intersectionStart = currentWeekStart < effectiveDateRange.minDate ? effectiveDateRange.minDate : currentWeekStart;
      const intersectionEnd = weekEnd > effectiveDateRange.maxDate ? effectiveDateRange.maxDate : weekEnd;

      let daysInRange = 0;
      if (intersectionEnd >= intersectionStart) {
        daysInRange = differenceInDays(intersectionEnd, intersectionStart) + 1;
      }

      if (daysInRange > 0) {
        weeks.push({
          startDate: currentWeekStart,
          weekNumber,
          year,
          isCurrentWeek,
          daysInRange
        });
      }

      currentWeekStart = addDays(currentWeekStart, 7);
    }

    return weeks;
  }, [effectiveDateRange, today, viewMode]);

  // MODIFIED: Scroll to today on viewMode change (but not initial load)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!timelineViewportRef.current) {
        if (previousViewModeRef.current === null) {
          previousViewModeRef.current = viewMode;
        }
        return;
      }

      const isViewModeChange = previousViewModeRef.current !== null && viewMode !== previousViewModeRef.current;

      if (isViewModeChange) {
        let scrollTargetOffset = 0;

        if (viewMode === 'hour') {
          scrollTargetOffset = differenceInHours(today, effectiveDateRange.minDate) * HOUR_WIDTH;
        } else if (viewMode === 'day') {
          scrollTargetOffset = differenceInDays(startOfDay(today), effectiveDateRange.minDate) * DAY_WIDTH;
        } else {
          const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
          const firstEffectiveWeekStart = startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 });
          const weekIndex = differenceInDays(currentWeekStart, firstEffectiveWeekStart) / 7;

          if (weekIndex >= 0 && weekIndex < weekData.length) {
            let offsetDays = 0;
            for (let i = 0; i < weekIndex; i++) {
              offsetDays += weekData[i].daysInRange;
            }
            scrollTargetOffset = offsetDays * WEEK_DAY_WIDTH;
          } else {
            scrollTargetOffset = differenceInDays(startOfDay(today), effectiveDateRange.minDate) * WEEK_DAY_WIDTH;
          }
        }

        const viewportWidth = timelineViewportRef.current.offsetWidth;
        const scrollLeft = scrollTargetOffset - viewportWidth / 2;
        timelineViewportRef.current.scrollLeft = Math.max(0, scrollLeft);
      }

      previousViewModeRef.current = viewMode;

    }, 100);
    return () => clearTimeout(timer);
  }, [viewMode, today, effectiveDateRange, weekData]);

  const scrollToToday = useCallback(() => {
    if (timelineViewportRef.current) {
      let scrollTargetOffset = 0;

      if (viewMode === 'hour') {
        scrollTargetOffset = differenceInHours(today, effectiveDateRange.minDate) * HOUR_WIDTH;
      } else if (viewMode === 'day') {
        scrollTargetOffset = differenceInDays(startOfDay(today), effectiveDateRange.minDate) * DAY_WIDTH;
      } else {
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        const firstEffectiveWeekStart = startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 });
        const weekIndex = differenceInDays(currentWeekStart, firstEffectiveWeekStart) / 7;

        if (weekIndex >= 0 && weekIndex < weekData.length) {
          let offsetDays = 0;
          for (let i = 0; i < weekIndex; i++) {
            offsetDays += weekData[i].daysInRange;
          }
          scrollTargetOffset = offsetDays * WEEK_DAY_WIDTH;
        } else {
          scrollTargetOffset = differenceInDays(startOfDay(today), effectiveDateRange.minDate) * WEEK_DAY_WIDTH;
        }
      }

      const viewportWidth = timelineViewportRef.current.offsetWidth;
      const scrollLeft = scrollTargetOffset - viewportWidth / 2;
      timelineViewportRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' }); 
    }
  }, [today, effectiveDateRange, viewMode, weekData]);

  const scrollBy = useCallback((unit, amount) => {
    if (timelineViewportRef.current) {
      let scrollAmount = 0;
      if (unit === 'day') {
        if (viewMode === 'hour') scrollAmount = amount * 24 * HOUR_WIDTH;
        else if (viewMode === 'day') scrollAmount = amount * DAY_WIDTH;
        else scrollAmount = amount * WEEK_DAY_WIDTH;
      } else if (unit === 'hour') {
        if (viewMode === 'hour') scrollAmount = amount * HOUR_WIDTH;
      }
      if (scrollAmount !== 0) {
        timelineViewportRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  }, [viewMode]);

  const handleNavClick = useCallback((direction) => {
    let daysToScroll = 0;
    switch (viewMode) {
      case 'hour':
        daysToScroll = 1;
        break;
      case 'day':
        daysToScroll = 7;
        break;
      case 'week':
        daysToScroll = 30;
        break;
      default:
        daysToScroll = 7;
    }
    scrollBy('day', daysToScroll * direction);
  }, [viewMode, scrollBy]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
          e.preventDefault();
          if (e.shiftKey) {
            scrollBy('day', -7);
          } else {
            scrollBy(viewMode === 'hour' ? 'hour' : 'day', -1);
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (e.shiftKey) {
            scrollBy('day', 7);
          } else {
            scrollBy(viewMode === 'hour' ? 'hour' : 'day', 1);
          }
          break;
        case 't':
          e.preventDefault();
          scrollToToday();
          break;
        case 'h':
          e.preventDefault();
          setViewMode('hour');
          break;
        case 'd':
          e.preventDefault();
          setViewMode('day');
          break;
        case 'w':
          e.preventDefault();
          setViewMode('week');
          break;
        case 'b': 
          e.preventDefault();
          handleNavClick(-1);
          break;
        case 'f': 
          e.preventDefault();
          handleNavClick(1);
          break;
        case 'e': 
          e.preventDefault();
          setVisibleLanes(prev =>
            prev.includes('events')
              ? prev.filter(id => id !== 'events')
              : [...prev, 'events']
          );
          break;
        case 'l': 
          e.preventDefault();
          setVisibleLanes(prev =>
            prev.includes('learning-circles')
              ? prev.filter(id => id !== 'learning-circles')
              : [...prev, 'learning-circles']
          );
          break;
        case 'p': 
          e.preventDefault();
          setVisibleLanes(prev =>
            prev.includes('project-deadlines')
              ? prev.filter(id => id !== 'project-deadlines')
              : [...prev, 'project-deadlines']
          );
          break;
        case 'g': 
          e.preventDefault();
          setVisibleLanes(prev =>
            prev.includes('governance-decisions')
              ? prev.filter(id => id !== 'governance-decisions')
              : [...prev, 'governance-decisions']
          );
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollBy, scrollToToday, viewMode, handleNavClick, setViewMode, setVisibleLanes]);

  // Calculate item positions for each lane WITH collision detection
  const laneItems = useMemo(() => {
    const items = {};
    const laneHeights = {};

    LANES.forEach(lane => {
      items[lane.id] = [];
      laneHeights[lane.id] = lane.baseHeight;
    });

    if (viewMode === 'hour') {
      allMockEvents.forEach(item => {
        if (visibleLanes.includes(item.type)) {
          const startHourIndex = differenceInHours(item.startDateTime, effectiveDateRange.minDate);
          const endHourIndex = differenceInHours(item.endDateTime, effectiveDateRange.minDate);
          const hourSpan = Math.max(1, endHourIndex - startHourIndex);

          const itemData = {
            ...item,
            startHourIndex,
            endHourIndex,
            left: startHourIndex * HOUR_WIDTH,
            width: hourSpan * HOUR_WIDTH - 4
          };
          items[item.type].push(itemData);
        }
      });
    } else {
      const dayWidth = viewMode === 'day' ? DAY_WIDTH : WEEK_DAY_WIDTH;
      allMockEvents.forEach(item => {
        if (visibleLanes.includes(item.type)) {
          const startIndex = differenceInDays(item.startDate, effectiveDateRange.minDate);
          const endIndex = differenceInDays(item.endDate, effectiveDateRange.minDate);
          const span = Math.max(1, endIndex - startIndex + 1);

          const itemData = {
            ...item,
            startIndex,
            endIndex,
            span,
            left: startIndex * dayWidth,
            width: span * dayWidth - (viewMode === 'day' ? 4 : 2)
          };

          items[item.type].push(itemData);
        }
      });
    }

    // Handle collisions for each lane
    LANES.forEach(lane => {
      const currentLaneItems = items[lane.id];
      const rows = [];

      currentLaneItems.sort((a, b) => (a.left || 0) - (b.left || 0));

      currentLaneItems.forEach(item => {
        let assignedToRow = false;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          let canFitInRow = true;

          for (const existingItem of row) {
            const itemStart = item.left;
            const itemEnd = item.left + item.width;
            const existingItemStart = existingItem.left;
            const existingItemEnd = existingItem.left + existingItem.width;

            if (!(itemEnd <= existingItemStart || itemStart >= existingItemEnd)) {
              canFitInRow = false;
              break;
            }
          }

          if (canFitInRow) {
            row.push(item);
            item.row = rowIndex;
            assignedToRow = true;
            break;
          }
        }

        if (!assignedToRow) {
          const newRowIndex = rows.length;
          rows.push([item]);
          item.row = newRowIndex;
        }
      });

      const rowCount = rows.length;
      if (rowCount > 0) {
        laneHeights[lane.id] = 35 + (rowCount * (ITEM_HEIGHT + ITEM_GAP)) + 8;
      } else {
        laneHeights[lane.id] = lane.baseHeight;
      }
      
      currentLaneItems.forEach(item => {
        item.top = 32 + (item.row * (ITEM_HEIGHT + ITEM_GAP));
      });
    });

    return { items, heights: laneHeights };
  }, [allMockEvents, visibleLanes, effectiveDateRange, viewMode]);

  // Calculate positions for separator lines
  const separatorLines = useMemo(() => {
    const lines = [];
    if (!allDays.length) return lines;

    switch (viewMode) {
      case 'hour':
        allDays.forEach((day, dayIndex) => {
          for (let hourIndex = 0; hourIndex < 24; hourIndex++) {
            if (dayIndex === 0 && hourIndex === 0) continue;
            const left = (differenceInHours(addHours(day, hourIndex), effectiveDateRange.minDate)) * HOUR_WIDTH;
            const isMajor = hourIndex === 0;
            lines.push({ left, isMajor });
          }
        });
        break;
      case 'day':
        allDays.forEach((day, index) => {
          if (index > 0) {
            const left = index * DAY_WIDTH;
            const isMajor = day.getDay() === 1; 
            lines.push({ left, isMajor });
          }
        });
        break;
      case 'week':
        allDays.forEach((day, index) => {
          if (index > 0 && day.getDay() === 1) { 
            const left = index * WEEK_DAY_WIDTH;
            lines.push({ left, isMajor: false }); 
          }
        });
        break;
      default:
        break;
    }
    return lines;
  }, [allDays, viewMode, effectiveDateRange]);

  const getTimelineWidth = useCallback(() => {
    const totalHours = totalDays * 24;
    switch (viewMode) {
      case 'hour': return totalHours * HOUR_WIDTH;
      case 'day': return totalDays * DAY_WIDTH;
      case 'week': return totalDays * WEEK_DAY_WIDTH;
      default: return totalDays * DAY_WIDTH;
    }
  }, [totalDays, viewMode]);

  // Calculate event counts per time slot for status bar
  const timeSlotCounts = useMemo(() => {
    const counts = [];
    
    const uniqueSeparatorPixels = new Set([0, getTimelineWidth()]);
    separatorLines.forEach(line => uniqueSeparatorPixels.add(line.left));
    
    const boundaries = Array.from(uniqueSeparatorPixels).sort((a, b) => a - b);

    if (!boundaries.length || boundaries.length < 2) {
      return []; 
    }

    for (let i = 0; i < boundaries.length - 1; i++) {
      const columnStartPixel = boundaries[i];
      const columnEndPixel = boundaries[i + 1];
      const columnWidth = columnEndPixel - columnStartPixel;

      if (columnWidth <= 0) continue; 
      
      let slotStartDateTime;
      let slotEndDateTime;

      if (viewMode === 'hour') {
        const startHourOffset = columnStartPixel / HOUR_WIDTH;
        const endHourOffset = columnEndPixel / HOUR_WIDTH;
        slotStartDateTime = addHours(effectiveDateRange.minDate, startHourOffset);
        slotEndDateTime = addHours(effectiveDateRange.minDate, endHourOffset);
      } else if (viewMode === 'day') {
        const startDayOffset = columnStartPixel / DAY_WIDTH;
        const endDayOffset = columnEndPixel / DAY_WIDTH;
        slotStartDateTime = addDays(effectiveDateRange.minDate, startDayOffset);
        slotEndDateTime = addDays(effectiveDateRange.minDate, endDayOffset);
      } else { 
        const startDayOffset = columnStartPixel / WEEK_DAY_WIDTH;
        const endDayOffset = columnEndPixel / WEEK_DAY_WIDTH;
        slotStartDateTime = addDays(effectiveDateRange.minDate, startDayOffset);
        slotEndDateTime = addDays(effectiveDateRange.minDate, endDayOffset);
      }
      
      const eventsInSlot = allMockEvents.filter(event => 
        visibleLanes.includes(event.type) &&
        event.startDateTime < slotEndDateTime && 
        event.endDateTime > slotStartDateTime
      ).length;
      
      counts.push({
        left: columnStartPixel,
        width: columnWidth,
        count: eventsInSlot
      });
    }
    
    return counts;
  }, [allMockEvents, viewMode, effectiveDateRange, visibleLanes, separatorLines, getTimelineWidth]);

  // Calculate counts for each lane
  const laneCounts = useMemo(() => {
    const counts = {};
    LANES.forEach(lane => {
      counts[lane.id] = allMockEvents.filter(item => item.type === lane.id).length;
    });
    return counts;
  }, [allMockEvents]);
  
  // Debounced function to update VISIBLE counts AND text alignments
  const updateDynamicStyles = useCallback(() => {
    if (!timelineViewportRef.current) return;

    const viewport = timelineViewportRef.current;
    const { scrollLeft, clientWidth } = viewport;

    checkForDataLoading();

    let visibleStartDate, visibleEndDate;
    if (viewMode === 'hour') {
      const startHourOffset = Math.floor(scrollLeft / HOUR_WIDTH);
      const endHourOffset = Math.ceil((scrollLeft + clientWidth) / HOUR_WIDTH);
      visibleStartDate = addHours(effectiveDateRange.minDate, startHourOffset);
      visibleEndDate = addHours(effectiveDateRange.minDate, endHourOffset);
    } else if (viewMode === 'day') {
      const startDayOffset = Math.floor(scrollLeft / DAY_WIDTH);
      const endDayOffset = Math.ceil((scrollLeft + clientWidth) / DAY_WIDTH);
      visibleStartDate = addDays(effectiveDateRange.minDate, startDayOffset);
      visibleEndDate = addDays(effectiveDateRange.minDate, endDayOffset);
    } else {
      const startDayOffset = Math.floor(scrollLeft / WEEK_DAY_WIDTH);
      const endDayOffset = Math.ceil((scrollLeft + clientWidth) / WEEK_DAY_WIDTH);
      visibleStartDate = addDays(effectiveDateRange.minDate, startDayOffset);
      visibleEndDate = addDays(effectiveDateRange.minDate, endDayOffset);
    }

    const visibleEvents = allMockEvents.filter(event =>
      event.startDateTime <= visibleEndDate && event.endDateTime >= visibleStartDate
    );

    const newCounts = {};
    LANES.forEach(lane => {
      newCounts[lane.id] = visibleEvents.filter(e => e.type === lane.id).length;
    });
    setVisibleLaneCounts(newCounts);

    const newAlignments = {};
    const newTextVisibility = {};
    const viewStart = scrollLeft;
    const viewEnd = scrollLeft + clientWidth;
    
    Object.values(laneItems.items).flat().forEach(item => {
      const eventStart = item.left;
      const eventEnd = item.left + item.width;
      
      const intersectionStart = Math.max(eventStart, viewStart);
      const intersectionEnd = Math.min(eventEnd, viewEnd);
      const intersectionWidth = Math.max(0, intersectionEnd - intersectionStart);
      
      const MIN_TEXT_WIDTH = 80; 
      const shouldShowText = intersectionWidth >= MIN_TEXT_WIDTH;
      newTextVisibility[item.id] = shouldShowText;
      
      if (shouldShowText) {
        const textContainerLeft = intersectionStart - eventStart;
        const textContainerWidth = intersectionWidth;

        newAlignments[item.id] = {
            left: `${textContainerLeft}px`,
            width: `${textContainerWidth}px`,
        };
      } else {
        newAlignments[item.id] = { left: '0px', width: '0px' }; 
      }
    });

    setEventTextAlignments(newAlignments);
    
    window._eventTextVisibility = newTextVisibility;

    const newHeaderVisibility = {};
    const newStatusVisibility = {}; 

    if (viewMode === 'hour') {
      allDays.forEach((dayDate) => {
        for (let hourIndex = 0; hourIndex < 24; hourIndex++) {
          const hourDate = addHours(dayDate, hourIndex);
          const elementLeft = differenceInHours(hourDate, effectiveDateRange.minDate) * HOUR_WIDTH;
          const elementRight = elementLeft + HOUR_WIDTH;
          
          const textPadding = 20; 
          const isFullyVisible = (elementLeft + textPadding) >= viewStart && (elementRight - textPadding) <= viewEnd;
          
          newHeaderVisibility[hourDate.toString()] = isFullyVisible;
        }
      });
    } else if (viewMode === 'day') {
      allDays.forEach((dayDate, index) => {
        const elementLeft = index * DAY_WIDTH;
        const elementRight = elementLeft + DAY_WIDTH;
        
        const textPadding = 15; 
        const isFullyVisible = (elementLeft + textPadding) >= viewStart && (elementRight - textPadding) <= viewEnd;
        
        newHeaderVisibility[dayDate.toString()] = isFullyVisible;
      });
    } else { 
      weekData.forEach((week) => {
        const firstEffectiveWeekStart = startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 });
        const weekStartIndexInDays = differenceInDays(week.startDate, firstEffectiveWeekStart);
        let elementLeft = weekStartIndexInDays * WEEK_DAY_WIDTH;
        
        if (weekStartIndexInDays < 0 && week.startDate.getTime() === startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 }).getTime()) {
           elementLeft = differenceInDays(startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 }), effectiveDateRange.minDate) * WEEK_DAY_WIDTH;
        } else if (weekStartIndexInDays >= 0) {
          elementLeft = weekStartIndexInDays * WEEK_DAY_WIDTH;
        } else {
          elementLeft = Math.max(0, differenceInDays(week.startDate, effectiveDateRange.minDate)) * WEEK_DAY_WIDTH;
        }


        const weekWidth = week.daysInRange * WEEK_DAY_WIDTH;
        const elementRight = elementLeft + weekWidth;
        
        const textPadding = 20; 
        const isFullyVisible = (elementLeft + textPadding) >= viewStart && (elementRight - textPadding) <= viewEnd;
        
        newHeaderVisibility[week.startDate.toString()] = isFullyVisible;
      });
    }

    timeSlotCounts.forEach((slot, index) => {
      const elementLeft = slot.left;
      const elementRight = elementLeft + slot.width;
      
      const textPadding = 10; 
      const isFullyVisible = (elementLeft + textPadding) >= viewStart && (elementRight - textPadding) <= viewEnd;
      
      newStatusVisibility[index] = isFullyVisible;
    });

    setHeaderTextVisibility(newHeaderVisibility);
    setStatusBarTextVisibility(newStatusVisibility);

  }, [allMockEvents, allDays, viewMode, effectiveDateRange, laneItems.items, checkForDataLoading, weekData, timeSlotCounts]);

  // Trigger updateDynamicStyles when items change
  useEffect(() => {
    if (timelineViewportRef.current && Object.keys(laneItems.items).length > 0) {
      const timer = setTimeout(() => {
        updateDynamicStyles();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [laneItems, updateDynamicStyles]);

  // ResizeObserver to detect when timeline viewport has its final size
  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    let resizeTimer = null;
    
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver is not supported in this environment.');
      const initialFallbackTimer = setTimeout(() => {
        updateDynamicStyles();
      }, 100);
      return () => clearTimeout(initialFallbackTimer);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      
      resizeTimer = setTimeout(() => {
        updateDynamicStyles();
      }, 50);
    });

    resizeObserver.observe(viewport);

    const initialTimer = setTimeout(() => {
      updateDynamicStyles();
    }, 100);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      clearTimeout(initialTimer);
      resizeObserver.disconnect();
    };
  }, [updateDynamicStyles]);

  // Effect for throttling the dynamic style updates on scroll
  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (viewport) {
      let throttleTimer = null;
      const scrollHandler = () => {
        if (throttleTimer) return;

        throttleTimer = setTimeout(() => {
          updateDynamicStyles();
          throttleTimer = null;
        }, 150);
      };
      
      viewport.addEventListener('scroll', scrollHandler, { passive: true });
      
      return () => {
        viewport.removeEventListener('scroll', scrollHandler);
        if (throttleTimer) {
          clearTimeout(throttleTimer);
        }
      };
    }
  }, [updateDynamicStyles]);

  // Separate useEffect for resize handling without causing infinite loops
  useEffect(() => {
    const handleResize = () => {
      const containerWidth = window.innerWidth;
      
      if (containerWidth < 768) { 
        setCompactLevel(3); 
      } else if (containerWidth < 1024) { 
        setCompactLevel(2); 
      } else if (containerWidth < 1400) { 
        setCompactLevel(1); 
      } else {
        setCompactLevel(0); 
      }
    };

    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // MODIFIED: Trigger updateDynamicStyles AND initial scroll after sections are ready
  useEffect(() => {
    if (sectionsReady.timeline && timelineViewportRef.current && timelineContentRef.current && !hasInitiallyScrolled) {
      console.log('Timeline section ready, scheduling forced updateDynamicStyles and scroll...');
      
      const initialLayoutStableTimer = setTimeout(() => {
        console.log('Forcing updateDynamicStyles and initial scroll after initial layout stabilization.');
        
        const viewport = timelineViewportRef.current;
        if (viewport) {
          let scrollTargetOffset = 0;

          if (viewMode === 'hour') {
            scrollTargetOffset = differenceInHours(today, effectiveDateRange.minDate) * HOUR_WIDTH;
          } else if (viewMode === 'day') {
            scrollTargetOffset = differenceInDays(startOfDay(today), effectiveDateRange.minDate) * DAY_WIDTH;
          } else {
            const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
            const firstEffectiveWeekStart = startOfWeek(effectiveDateRange.minDate, { weekStartsOn: 1 });
            const weekIndex = differenceInDays(currentWeekStart, firstEffectiveWeekStart) / 7;

            if (weekIndex >= 0 && weekIndex < weekData.length) {
              let offsetDays = 0;
              for (let i = 0; i < weekIndex; i++) {
                offsetDays += weekData[i].daysInRange;
              }
              scrollTargetOffset = offsetDays * WEEK_DAY_WIDTH;
            } else {
              scrollTargetOffset = differenceInDays(startOfDay(today), effectiveDateRange.minDate) * WEEK_DAY_WIDTH;
            }
          }

          const viewportWidth = viewport.offsetWidth;
          const scrollLeft = scrollTargetOffset - viewportWidth / 2;
          
          console.log('Initial scroll:', {
            viewMode,
            scrollTargetOffset,
            viewportWidth,
            scrollLeft: Math.max(0, scrollLeft)
          });
          
          viewport.scrollLeft = Math.max(0, scrollLeft);
          setHasInitiallyScrolled(true);
        }
        
        updateDynamicStyles();
      }, 300); 

      return () => clearTimeout(initialLayoutStableTimer);
    }
  }, [sectionsReady.timeline, updateDynamicStyles, hasInitiallyScrolled, viewMode, today, effectiveDateRange, weekData]);

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };


  // Labels for the navigation buttons based on viewMode
  const navLabels = {
    hour: '1D',
    day: '1W',
    week: '1M'
  };
  
  // Dynamic label for the "scroll to current" button
  const todayButtonLabels = {
    hour: 'This Hour',
    day: 'Today',
    week: 'This Week'
  };

  // Dynamic labels based on compact level
  const getLaneLabel = (lane) => {
    if (compactLevel >= 1) {
      const shortLabels = {
        'events': 'E',
        'learning-circles': 'L', 
        'project-deadlines': 'P',
        'governance-decisions': 'G'
      };
      return shortLabels[lane.id] || lane.label;
    }
    return lane.label;
  };

  const getViewModeLabel = (mode) => {
    if (compactLevel >= 2) {
      return mode.charAt(0).toUpperCase(); 
    }
    return mode === 'hour' ? 'Hrs' : mode === 'day' ? 'Day' : 'Week';
  };

  const getTodayButtonLabel = (mode) => {
    if (compactLevel >= 3) {
      return 'T'; 
    }
    return todayButtonLabels[mode];
  };

  // Smarter tooltip positioning logic
  const tooltipWidth = 175;
  let tooltipLeft = tooltipPosition.x;
  let tooltipTransform = 'translateX(-50%)';

  if (typeof window !== 'undefined') {
    const windowWidth = window.innerWidth;
    const padding = 16; 
    const mouseOffset = 20; 

    if (tooltipPosition.x + (tooltipWidth / 2) > windowWidth - padding) {
      tooltipLeft = tooltipPosition.x - mouseOffset;
      tooltipTransform = 'translateX(-100%)';
    } else if (tooltipPosition.x - (tooltipWidth / 2) < padding) {
      tooltipLeft = tooltipPosition.x + mouseOffset;
      tooltipTransform = 'translateX(0%)';
    }
  }

  // Skeleton Components
  const BannerSkeleton = () => (
    <div className="bg-orange-500/10 border-b border-orange-500/30 px-6 py-3 flex-shrink-0">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <div className="w-5 h-5 bg-orange-500/30 animate-pulse rounded flex-shrink-0" />
        <div className="h-4 w-96 bg-orange-500/20 animate-pulse rounded" />
      </div>
    </div>
  );

  const ControlsSkeleton = () => (
    <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
      <div className="w-full lg:w-auto lg:flex-1 flex justify-start">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 w-20 bg-slate-700/30 animate-pulse rounded-full" />
          ))}
        </div>
      </div>
      
      <div className="flex-shrink-0 order-first lg:order-none">
        <div className="flex items-center gap-2">
          <div className="h-10 w-14 bg-slate-700/30 animate-pulse rounded-lg" />
          <div className="h-10 w-24 bg-slate-700/30 animate-pulse rounded-lg" />
          <div className="h-10 w-14 bg-slate-700/30 animate-pulse rounded-lg" />
        </div>
      </div>

      <div className="w-full lg:w-auto lg:flex-1 flex justify-end">
        <div className="flex flex-nowrap gap-2 justify-end">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 w-36 bg-slate-700/30 animate-pulse rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );

  const TimelineSkeleton = () => (
    <div className="relative min-w-0 bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-500 z-20 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-orange-500 z-20 pointer-events-none" />
      
      <div className="p-8">
        <div className="h-[60px] bg-slate-700/20 animate-pulse rounded-lg mb-4" />
        
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-[80px] bg-slate-700/10 animate-pulse rounded-lg mb-2" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-w-0">
      {/* Feature Flag Warning Banner - Progressive Loading */}
      {sectionsReady.banner ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-orange-500/10 border-b border-orange-500/30 px-6 py-3 flex-shrink-0"
        >
          <div className="flex items-center gap-3 max-w-7xl mx-auto">
            <ConfiguredIcon 
              iconName="AlertTriangle"
              iconConfig={iconConfigs['AlertTriangle']}
              size="w-5 h-5"
              className="flex-shrink-0 text-orange-400"
            />
            <p className="text-sm text-orange-200">
              <strong>Test Mode (Mock Events):</strong> The data currently consists of automatically generated mock values.
            </p>
          </div>
        </motion.div>
      ) : (
        <BannerSkeleton />
      )}

      <div className="p-4 lg:p-8"> 
        {/* Header - ALWAYS VISIBLE immediately */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <ConfiguredIcon 
                iconName="ChartNoAxesGantt" 
                iconConfig={iconConfigs['ChartNoAxesGantt']}
                size="w-12 h-12"
                className="flex-shrink-0 text-orange-500"
              />
              <div>
                <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">
                  Collective Timeline
                </h1>
                <div className="w-16 h-1 bg-orange-500 mt-2 rounded-full"></div>
              </div>
            </div>
          </div>

          <p className="text-lg text-slate-400 leading-relaxed max-w-3xl mt-3">
            A comprehensive timeline view of all community activities, project milestones, and governance decisions.
          </p>
        </div>

        {/* CONTROLS UND TIMELINE */}
        <div className="mt-16">
          {/* Controls - Progressive Loading */}
          {sectionsReady.controls ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
                {/* Left Group: View Mode Switcher */}
                <div className="w-full lg:w-auto lg:flex-1 flex justify-start">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('hour')}
                      className={`filter-chip h-auto ${compactLevel >= 2 ? 'w-12' : 'w-20'} ${viewMode === 'hour' ? 'active' : ''}`}
                    >
                      {getViewModeLabel('hour')}
                    </button>
                    <button
                      onClick={() => setViewMode('day')}
                      className={`filter-chip h-auto ${compactLevel >= 2 ? 'w-12' : 'w-20'} ${viewMode === 'day' ? 'active' : ''}`}
                    >
                      {getViewModeLabel('day')}
                    </button>
                    <button
                      onClick={() => setViewMode('week')}
                      className={`filter-chip h-auto ${compactLevel >= 2 ? 'w-12' : 'w-20'} ${viewMode === 'week' ? 'active' : ''}`}
                    >
                      {getViewModeLabel('week')}
                    </button>
                  </div>
                </div>
                
                {/* Center Group: Navigation Controls */}
                <div className="flex-shrink-0 order-first lg:order-none">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleNavClick(-1)}
                      variant="outline"
                      size="sm"
                      className="btn-secondary-coherosphere w-14"
                    >
                      <ConfiguredIcon 
                        iconName="ChevronLeft"
                        iconConfig={iconConfigs['ChevronLeft']}
                        size="w-4 h-4"
                      />
                      {navLabels[viewMode]}
                    </Button>
                    <Button
                      onClick={scrollToToday}
                      variant="outline"
                      size="sm"
                      className={`btn-secondary-coherosphere ${compactLevel >= 3 ? 'w-10' : 'w-24'}`}
                    >
                      {getTodayButtonLabel(viewMode)}
                    </Button>
                    <Button
                      onClick={() => handleNavClick(1)}
                      variant="outline"
                      size="sm"
                      className="btn-secondary-coherosphere w-14"
                    >
                      {navLabels[viewMode]}
                      <ConfiguredIcon 
                        iconName="ChevronRight"
                        iconConfig={iconConfigs['ChevronRight']}
                        size="w-4 h-4"
                      />
                    </Button>
                  </div>
                </div>

                {/* Right Group: Lane Filter Chips */}
                <div className="w-full lg:w-auto lg:flex-1 flex justify-end overflow-hidden">
                  <div className="flex flex-nowrap gap-2 justify-end">
                    {LANES.map(lane => (
                      <button
                        key={lane.id}
                        onClick={() => {
                          setVisibleLanes(prev =>
                            prev.includes(lane.id)
                              ? prev.filter(id => id !== lane.id)
                              : [...prev, lane.id]
                          );
                        }}
                        className={`filter-chip h-auto justify-between ${compactLevel >= 1 ? 'w-16' : 'w-36'} ${visibleLanes.includes(lane.id) ? 'active' : ''}`}
                      >
                        <span className="flex-shrink-0 truncate">{getLaneLabel(lane)}</span>
                        <Badge
                          variant="secondary"
                          className={`ml-[3px] transition-colors duration-200 flex-shrink-0 ${compactLevel >= 1 ? 'text-xs px-1' : ''}
                            ${visibleLanes.includes(lane.id)
                              ? 'bg-black/20 text-white'
                              : 'bg-slate-700/50 text-slate-300'
                            }
                          `}
                        >
                          {Object.keys(visibleLaneCounts).length > 0 ? visibleLaneCounts[lane.id] : laneCounts[lane.id] || 0}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <ControlsSkeleton />
          )}

          {/* TIMELINE VIEWPORT - Progressive Loading */}
          {sectionsReady.timeline ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.1 }}
            >
              <div className="relative min-w-0 bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
                {/* Loading indicator for dynamic loading */}
                {isLoadingMore && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-full px-4 py-2 text-sm text-slate-300 flex items-center gap-2 z-30"
                  >
                    <ConfiguredIcon 
                      iconName="Loader2"
                      iconConfig={iconConfigs['Loader2']}
                      size="w-4 h-4"
                      className="animate-spin"
                    />
                    Loading more events...
                  </motion.div>
                )}
                
                {/* Orange Viewport Borders */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-orange-500 z-20 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-orange-500 z-20 pointer-events-none" />
                
                <div
                  ref={timelineViewportRef}
                  className="overflow-x-auto overflow-y-hidden scrollbar-none"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div ref={timelineContentRef} className="relative" style={{
                    width: `${getTimelineWidth()}px`
                  }}>
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 h-[60px]">
                      {viewMode === 'hour' ? (
                        <div className="flex absolute top-0 left-0 h-[60px]">
                          {allDays.map((dayDate) => (
                            <React.Fragment key={`day-hours-fragment-${dayDate.toString()}`}>
                              {Array.from({ length: 24 }).map((_, hourIndex) => {
                                const hourDate = addHours(dayDate, hourIndex);
                                const isCurrentHour = isSameHour(hourDate, today);
                                const isStartOfDay = hourIndex === 0;
                                const isTextVisible = headerTextVisibility[hourDate.toString()];

                                return (
                                  <div
                                    key={hourDate.toString()}
                                    ref={isCurrentHour ? todayRef : null}
                                    className={`inline-flex flex-col items-center justify-center h-[60px] relative
                                      ${isCurrentHour ? 'bg-orange-500/10' : ''}`}
                                    style={{ width: `${HOUR_WIDTH}px` }}
                                  >
                                    {isStartOfDay && isTextVisible && (
                                      <div className={`text-xs font-bold absolute -top-0.5 left-1 translate-y-[-100%] ${isSameDay(dayDate, today) ? 'text-orange-400' : 'text-slate-400'}`}>
                                        {format(dayDate, 'MMM d')}
                                      </div>
                                    )}
                                    {isTextVisible && (
                                      <>
                                        <div className={`text-xs font-medium ${isCurrentHour ? 'text-orange-400' : 'text-slate-400'}`}>
                                          {format(hourDate, 'HH:mm')}
                                        </div>
                                        <div className={`text-xs ${isCurrentHour ? 'text-orange-400' : 'text-slate-500'}`}>
                                          hrs
                                        </div>
                                        <div className={`text-xs ${isCurrentHour ? 'text-orange-400' : 'text-slate-500'}`}>
                                          {format(hourDate, 'EEE')}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </div>
                      ) : viewMode === 'day' ? (
                        <div className="flex absolute top-0 left-0 h-[60px]">
                          {allDays.map((dayDate) => {
                            const isTodayDay = isSameDay(dayDate, today);
                            const isTextVisible = headerTextVisibility[dayDate.toString()];

                            return (
                              <div
                                key={dayDate.toString()}
                                ref={isTodayDay ? todayRef : null}
                                className={`flex-shrink-0 flex flex-col items-center justify-center h-[60px] ${
                                  isTodayDay ? 'bg-orange-500/10' : ''
                                }`}
                                style={{ width: `${DAY_WIDTH}px` }}
                              >
                                {isTextVisible && (
                                  <>
                                    <div className={`text-xs font-medium ${isTodayDay ? 'text-orange-400' : 'text-slate-400'}`}>
                                      {format(dayDate, 'EEE')}
                                    </div>
                                    <div className={`text-sm font-bold ${isTodayDay ? 'text-orange-400' : 'text-white'}`}>
                                      {format(dayDate, 'd')}
                                    </div>
                                    <div className={`text-xs ${isTodayDay ? 'text-orange-400' : 'text-slate-500'}`}>
                                      {format(dayDate, 'MMM')}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex absolute top-0 left-0 h-[60px]">
                          {weekData.map((week) => {
                            const weekWidth = week.daysInRange * WEEK_DAY_WIDTH;
                            const isTextVisible = headerTextVisibility[week.startDate.toString()];

                            return (
                              <div
                                key={week.startDate.toString()}
                                ref={week.isCurrentWeek ? todayRef : null}
                                className={`flex-shrink-0 flex flex-col items-center justify-center h-[60px] ${
                                  week.isCurrentWeek ? 'bg-orange-500/10' : ''
                                }`}
                                style={{ width: `${weekWidth}px` }}
                              >
                                {isTextVisible && (
                                  <>
                                    <div className={`text-xs font-medium ${week.isCurrentWeek ? 'text-orange-400' : 'text-slate-400'}`}>
                                      Week
                                    </div>
                                    <div className={`text-sm font-bold ${week.isCurrentWeek ? 'text-orange-400' : 'text-white'}`}>
                                      {week.weekNumber}
                                    </div>
                                    <div className={`text-xs ${week.isCurrentWeek ? 'text-orange-400' : 'text-slate-500'}`}>
                                      {week.year}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Today line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-orange-500/50 pointer-events-none z-10"
                      style={{
                        left: `${
                          viewMode === 'hour'
                            ? differenceInHours(today, effectiveDateRange.minDate) * HOUR_WIDTH
                            : differenceInDays(startOfDay(today), effectiveDateRange.minDate) * (viewMode === 'day' ? DAY_WIDTH : WEEK_DAY_WIDTH)
                        }px`
                      }}
                    />

                    {/* Swimlanes */}
                    <div className="relative pt-2 pb-4">
                      {separatorLines.map((line, index) => (
                        <div
                          key={`separator-${index}`}
                          className={`absolute top-0 bottom-0 w-px pointer-events-none z-[1] ${
                            line.isMajor ? 'bg-slate-600/70' : 'bg-slate-600/30'
                          }`}
                          style={{ left: `${line.left}px` }}
                        />
                      ))}

                      {LANES.map(lane => {
                        if (!visibleLanes.includes(lane.id)) return null;

                        const laneHeightValue = laneItems.heights[lane.id];

                        return (
                          <div key={lane.id} className="relative mb-2">
                            <div
                              className={`relative ${lane.color} rounded-lg`}
                              style={{ height: `${laneHeightValue}px` }}
                            >
                              <div className="sticky left-8 top-2 z-10 pointer-events-none inline-block">
                                <span className="text-xs font-bold text-white tracking-wider uppercase">
                                  {lane.label}
                                </span>
                              </div>

                              <div className="absolute inset-0 overflow-hidden">
                                <div className="relative h-full">
                                  {(laneItems.items[lane.id] || []).map((item) => {
                                    const shouldShowText = window._eventTextVisibility?.[item.id] ?? true; 
                                    const textStyle = eventTextAlignments[item.id] || { left: '0px', width: '0px' };
                                    
                                    return (
                                      <motion.div
                                        key={item.id}
                                        className="absolute cursor-pointer z-[2]"
                                        style={{
                                          left: `${item.left}px`,
                                          width: `${Math.max(2, item.width)}px`,
                                          top: `${item.top}px`,
                                          height: `${ITEM_HEIGHT}px`
                                        }}
                                        onClick={() => handleItemClick(item)}
                                        onMouseEnter={(e) => {
                                          setHoveredItem(item);
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setTooltipPosition({ 
                                            x: e.clientX, 
                                            y: rect.bottom + 8 
                                          });
                                        }}
                                        onMouseMove={(e) => {
                                          if (hoveredItem && hoveredItem.id === item.id) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setTooltipPosition({ 
                                              x: e.clientX, 
                                              y: rect.bottom + 8 
                                            });
                                          }
                                        }}
                                        onMouseLeave={() => {
                                          setHoveredItem(null);
                                        }}
                                      >
                                        <div className={`relative h-full rounded py-1 text-xs font-medium text-white transition-all duration-200 ${
                                          lane.id === 'events'
                                            ? 'bg-orange-500/80 hover:bg-orange-500/95'
                                            : lane.id === 'learning-circles'
                                            ? 'bg-blue-500/70 hover:bg-blue-500/85'
                                            : lane.id === 'project-deadlines'
                                            ? 'bg-slate-600/70 hover:bg-slate-600/85'
                                            : 'bg-indigo-500/70 hover:bg-indigo-500/85'
                                        }`}>
                                          {shouldShowText && (
                                            <span 
                                              className="absolute inset-0 px-2 flex items-center justify-center"
                                              style={{
                                                left: textStyle.left, 
                                                width: textStyle.width, 
                                              }}
                                            >
                                              <span className="truncate">{item.title}</span>
                                            </span>
                                          )}
                                          
                                          {item.status && shouldShowText && viewMode !== 'week' && viewMode !== 'hour' && (
                                            <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1 py-0 h-4 whitespace-nowrap bg-black/20 text-white z-10">
                                              {item.status}
                                            </Badge>
                                          )}
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Status Bar */}
                      <div className="relative mt-2">
                        <div className="bg-slate-800 rounded-lg h-[32px] relative">
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="relative h-full">
                              {timeSlotCounts.map((slot, index) => (
                                <div
                                  key={`status-${index}`}
                                  className="absolute flex items-center justify-center text-xs font-medium text-white"
                                  style={{
                                    left: `${slot.left}px`,
                                    width: `${slot.width}px`,
                                    height: '32px',
                                    top: '0px'
                                  }}
                                >
                                  {statusBarTextVisibility[index] && slot.count > 0 && slot.count}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <TimelineSkeleton />
          )}

          {/* Keyboard Shortcuts Legend */}
          <motion.div 
              className="mt-4 flex justify-center flex-wrap gap-x-6 gap-y-2 text-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
          >
              <div className="flex items-center gap-2">
                  <span className="bg-slate-700/80 text-white font-mono rounded px-1.5 py-0.5 border border-slate-600/80">H / D / W</span>
                  <span className="text-white">View</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="bg-slate-700/80 text-white font-mono rounded px-1.5 py-0.5 border border-slate-600/80">T</span>
                  <span className="text-white">Today</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="bg-slate-700/80 text-white font-mono rounded px-1.5 py-0.5 border border-slate-600/80">B / F</span>
                  <span className="text-white">Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="bg-slate-700/80 text-white font-mono rounded px-1.5 py-0.5 border border-slate-600/80">← / →</span>
                  <span className="text-white">Scroll</span>
              </div>
              <div className="flex items-center gap-2">
                  <span className="bg-slate-700/80 text-white font-mono rounded px-1.5 py-0.5 border border-slate-600/80">E / L / P / G</span>
                  <span className="text-white">Toggle Lanes</span>
              </div>
          </motion.div>
        </div>
      </div>

      {/* Custom Tooltip */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${tooltipLeft}px`,
              top: `${tooltipPosition.y}px`,
              transform: tooltipTransform
            }}
          >
            <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-lg p-3 shadow-xl">
              <div className="space-y-2" style={{ maxWidth: `${tooltipWidth}px` }}>
                <h4 className="font-bold text-white text-base leading-tight">{hoveredItem.title}</h4>
                
                {hoveredItem.description && (
                  <p className="text-slate-300 text-sm line-clamp-3">{hoveredItem.description}</p>
                )}

                <div className="pt-2 border-t border-slate-700 space-y-2">
                  <div>
                    <span className="text-slate-400 text-xs font-medium uppercase">From:</span>
                    <p className="text-white text-sm">
                      {format(hoveredItem.startDateTime, 'd MMMM yyyy, HH:mm')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs font-medium uppercase">To:</span>
                    <p className="text-white text-sm">
                      {format(hoveredItem.endDateTime, 'd MMMM yyyy, HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[450px] bg-slate-800/95 backdrop-blur-sm border-slate-700 text-slate-300">
          <SheetHeader>
            <SheetTitle className="text-white">
              {selectedItem?.title}
            </SheetTitle>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-4 mt-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-1">Description</h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-1">Start</h4>
                  <p className="text-white text-sm">{format(selectedItem.startDateTime, 'd MMMM yyyy, HH:mm')}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-1">End</h4>
                  <p className="text-white text-sm">{format(selectedItem.endDateTime, 'd MMMM yyyy, HH:mm')}</p>
                </div>
              </div>

              {selectedItem.location && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-1">Location</h4>
                  <div className="flex items-center gap-2">
                    <ConfiguredIcon 
                      iconName="MapPin"
                      iconConfig={iconConfigs['MapPin']}
                      size="w-4 h-4"
                      className="text-slate-400"
                    />
                    <p className="text-white text-sm">{selectedItem.location}</p>
                  </div>
                </div>
              )}

              {selectedItem.status && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-1">Status</h4>
                  <Badge variant="secondary">{selectedItem.status}</Badge>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700">
                <Button
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  disabled
                >
                  Open Details (Coming Soon)
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
