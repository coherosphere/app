import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowRight } from 'lucide-react';
import { useCachedData } from '@/components/caching/useCachedData';
import ConfiguredIcon from '@/components/learning/ConfiguredIcon';

const moods = [
  { iconName: 'Frown', label: 'Struggling' },
  { iconName: 'Meh', label: 'Okay' },
  { iconName: 'Smile', label: 'Good' },
  { iconName: 'Laugh', label: 'Great' },
  { iconName: 'Sparkles', label: 'Vibrant' },
];

export default function MindfulnessCheckIn({ iconConfigs }) {
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectionTimestamp, setSelectionTimestamp] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isBreathing, setIsBreathing] = useState(false);

  // Use cached data for current user
  const { data: user } = useCachedData(
    ['mindfulness', 'currentUser'],
    async () => {
      try {
        return await base44.auth.me();
      } catch (error) {
        console.log('User not logged in, using localStorage');
        return null;
      }
    },
    'learning'
  );

  const updateTimeRemaining = useCallback((timestamp = selectionTimestamp) => {
    if (!timestamp) return;
    
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const timeLeft = TWENTY_FOUR_HOURS - (now - timestamp);
    
    if (timeLeft <= 0) {
      setIsLocked(false);
      setSelectedMood(null);
      setSelectionTimestamp(null);
      setTimeRemaining(null);
      
      if (user) {
        base44.auth.updateMe({
          daily_mood_selection: null,
          daily_mood_timestamp: null
        });
      } else {
        localStorage.removeItem('coherosphere_daily_mood');
      }
    } else {
      setTimeRemaining(timeLeft);
    }
  }, [selectionTimestamp, user]);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedData = localStorage.getItem('coherosphere_daily_mood');
      if (savedData) {
        const { mood, timestamp } = JSON.parse(savedData);
        const now = Date.now();
        const timeDiff = now - timestamp;
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        
        if (timeDiff < TWENTY_FOUR_HOURS) {
          setSelectedMood(mood);
          setSelectionTimestamp(timestamp);
          setIsLocked(true);
          updateTimeRemaining(timestamp);
        } else {
          localStorage.removeItem('coherosphere_daily_mood');
        }
      }
    } catch (error) {
      console.error('Error loading mood from localStorage:', error);
    }
  }, [updateTimeRemaining]);

  const loadMoodSelection = useCallback(async () => {
    if (user && user.daily_mood_selection !== null && user.daily_mood_timestamp) {
      const savedTimestamp = new Date(user.daily_mood_timestamp).getTime();
      const now = Date.now();
      const timeDiff = now - savedTimestamp;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      
      if (timeDiff < TWENTY_FOUR_HOURS) {
        setSelectedMood(user.daily_mood_selection);
        setSelectionTimestamp(savedTimestamp);
        setIsLocked(true);
        updateTimeRemaining(savedTimestamp);
      } else {
        await base44.auth.updateMe({
          daily_mood_selection: null,
          daily_mood_timestamp: null
        });
      }
    } else if (user === null) {
      loadFromLocalStorage();
    }
  }, [user, updateTimeRemaining, loadFromLocalStorage]);

  useEffect(() => {
    if (user !== undefined) {
      loadMoodSelection();
    }
  }, [user, loadMoodSelection]);

  useEffect(() => {
    let interval;
    if (isLocked && selectionTimestamp) {
      interval = setInterval(() => {
        updateTimeRemaining();
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocked, selectionTimestamp, updateTimeRemaining]);

  const calculateAlignmentScore = (moodIndex) => {
    if (moodIndex <= 1) return 0.9;
    if (moodIndex === 2) return 1.0;
    return 1.1;
  };

  const calculateStreak = async (userId) => {
    try {
      const checkIns = await base44.entities.DailyCheckIn.filter(
        { user_id: userId },
        '-timestamp',
        30
      );

      if (checkIns.length === 0) return 0;

      const checkedInDays = new Set();
      checkIns.forEach(checkIn => {
        const d = new Date(checkIn.timestamp);
        checkedInDays.add(d.toISOString().split('T')[0]); 
      });

      let streak = 0;
      let currentDay = new Date();
      
      for (let i = 0; i < 30; i++) {
        const dayString = currentDay.toISOString().split('T')[0];
        
        if (checkedInDays.has(dayString)) {
          streak++;
        } else {
          break;
        }
        currentDay.setDate(currentDay.getDate() - 1);
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  };

  const handleMoodSelection = async (moodIndex) => {
    if (isLocked) return;
    
    const now = Date.now();
    const selectedMoodData = moods[moodIndex];
    
    setSelectedMood(moodIndex);
    setSelectionTimestamp(now);
    setIsLocked(true);
    updateTimeRemaining(now);
    
    try {
      if (user) {
        await base44.auth.updateMe({
          daily_mood_selection: moodIndex,
          daily_mood_timestamp: new Date(now).toISOString()
        });

        await base44.entities.DailyCheckIn.create({
          user_id: user.id,
          mood_selection: moodIndex,
          mood_label: selectedMoodData.label,
          timestamp: new Date(now).toISOString()
        });

        const currentStreak = await calculateStreak(user.id);
        const isStreakBonus = currentStreak >= 5;

        const alignmentScore = calculateAlignmentScore(moodIndex);

        await base44.functions.invoke('recordResonanceEvent', {
          entity_type: 'user',
          entity_id: user.id,
          action_type: 'DAILY_CHECKIN_COMPLETED',
          magnitude: 1.0,
          alignment_score: alignmentScore,
          metadata: {
            mood_index: moodIndex,
            mood_label: selectedMoodData.label,
            streak: currentStreak,
            streak_bonus_applied: isStreakBonus
          },
          source: 'ui'
        });

        if (isStreakBonus) {
          await base44.functions.invoke('recordResonanceEvent', {
            entity_type: 'user',
            entity_id: user.id,
            action_type: 'DAILY_CHECKIN_STREAK_BONUS',
            magnitude: 2.0,
            alignment_score: 1.1,
            metadata: {
              streak: currentStreak,
              bonus_type: 'streak_5_days'
            },
            source: 'system'
          });
        }

        console.log(`Check-in recorded: ${selectedMoodData.label} for user ${user.id}${isStreakBonus ? ' (Streak bonus!)' : ''}`);
      } else {
        localStorage.setItem('coherosphere_daily_mood', JSON.stringify({
          mood: moodIndex,
          timestamp: now
        }));
      }
    } catch (error) {
      console.error('Error saving mood selection:', error);
    }
  };

  const formatTimeRemaining = (milliseconds) => {
    if (!milliseconds) return '';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const startBreathing = () => {
    setIsBreathing(true);
    setTimeout(() => setIsBreathing(false), 8000);
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }}>
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-white">Daily Resonance Mood</CardTitle>
              <Link to={createPageUrl('ResonanceCheck')} className="text-orange-400 hover:text-orange-300 transition-colors">
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 mb-6">Take a moment to sense where you are in the field.</p>
            <div className="flex justify-around">
              {moods.map((mood, index) => (
                <motion.button
                  key={mood.label}
                  onClick={() => handleMoodSelection(index)}
                  disabled={isLocked && selectedMood !== index}
                  className={`flex flex-col items-center gap-2 text-center group relative ${
                    isLocked && selectedMood !== index ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  whileHover={!isLocked || selectedMood === index ? { scale: 1.1 } : {}}
                  whileTap={!isLocked || selectedMood === index ? { scale: 0.95 } : {}}
                  title={
                    isLocked && selectedMood !== index 
                      ? "You can update your resonance after 24h"
                      : mood.label
                  }
                >
                  <motion.div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200
                      ${selectedMood === index
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30'
                        : isLocked
                        ? 'bg-slate-900/50 opacity-50'
                        : 'bg-slate-900/50 group-hover:bg-slate-800'
                      }`
                    }
                    animate={selectedMood === index && isLocked ? { scale: [1, 1.05, 1] } : {}}
                    transition={selectedMood === index && isLocked ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                  >
                    <ConfiguredIcon 
                      iconName={mood.iconName}
                      iconConfig={iconConfigs?.[mood.iconName]}
                      size="w-8 h-8"
                      className={`transition-colors duration-200 ${
                        selectedMood === index ? '' : isLocked ? '' : 'group-hover:text-white'
                      }`}
                      fallbackColor={selectedMood === index ? 'text-white' : isLocked ? 'text-slate-500' : 'text-slate-400'}
                    />
                  </motion.div>
                  <span className={`text-xs font-medium transition-colors duration-200
                    ${selectedMood === index && isLocked 
                      ? 'text-orange-400' 
                      : isLocked 
                      ? 'text-slate-500'
                      : 'text-slate-400 group-hover:text-white'
                    }`
                  }>
                    {mood.label}
                  </span>
                </motion.button>
              ))}
            </div>
            
            {isLocked && timeRemaining && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700"
              >
                <div className="flex items-center justify-center gap-2 text-sm">
                  <ConfiguredIcon 
                    iconName="Clock"
                    iconConfig={iconConfigs?.['Clock']}
                    size="w-4 h-4"
                  />
                  <span className="text-slate-300">
                    Next Check-In in {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.6 }}>
        <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700 text-center">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Mindful Moment</CardTitle>
          </CardHeader>
          <CardContent>
            {isBreathing ? (
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  className="w-24 h-24 rounded-full bg-gradient-to-r from-turquoise-500 to-cyan-500 flex items-center justify-center"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ConfiguredIcon 
                    iconName="Wind"
                    iconConfig={iconConfigs?.['Wind']}
                    size="w-10 h-10"
                    fallbackColor="text-white"
                  />
                </motion.div>
                <motion.p
                  className="text-lg font-semibold text-white"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  Breathe deeply...
                </motion.p>
              </div>
            ) : (
              <>
                <p className="text-slate-400 mb-4">Take one minute to center yourself with a calming breath.</p>
                <Button onClick={startBreathing} className="bg-gradient-to-r from-turquoise-500 to-cyan-500 text-white">
                  Start Breathing Exercise
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}