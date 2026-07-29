import {
  DetailedWorkoutSession,
  WorkoutConflictGroup,
  MergedWorkoutPayload,
  ToleranceParams,
} from '../types';
import {
  HeartRateRecord,
  DistanceRecord,
  SpeedRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
} from 'react-native-health-connect';

export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance

/**
 * Pure function to detect overlapping workout sessions within a given tolerance.
 *
 * @param sessions Array of detailed workout sessions fetched from Health Connect.
 * @param params Object containing toleranceMs (defaults to 5 minutes).
 * @returns List of WorkoutConflictGroups (containing both conflict groups with >=2 sessions and single sessions).
 */
export function groupOverlappingSessions(
  sessions: DetailedWorkoutSession[],
  params: ToleranceParams = { toleranceMs: DEFAULT_TOLERANCE_MS }
): WorkoutConflictGroup[] {
  if (!sessions || sessions.length === 0) {
    return [];
  }

  // 1. Sort sessions chronologically by start time
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime()
  );

  const groups: WorkoutConflictGroup[] = [];
  let currentGroup: DetailedWorkoutSession[] = [sorted[0]];

  let currentEarliest = new Date(sorted[0].session.startTime).getTime();
  let currentLatest = new Date(sorted[0].session.endTime).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const nextSession = sorted[i];
    const nextStart = new Date(nextSession.session.startTime).getTime();
    const nextEnd = new Date(nextSession.session.endTime).getTime();

    // Check if next session overlaps or falls within tolerance window of current group
    if (nextStart <= currentLatest + params.toleranceMs) {
      // Add to current group and expand end boundary
      currentGroup.push(nextSession);
      if (nextEnd > currentLatest) {
        currentLatest = nextEnd;
      }
      if (nextStart < currentEarliest) {
        currentEarliest = nextStart;
      }
    } else {
      // Close out existing group
      groups.push(buildConflictGroup(currentGroup, currentEarliest, currentLatest));

      // Start new group
      currentGroup = [nextSession];
      currentEarliest = nextStart;
      currentLatest = nextEnd;
    }
  }

  // Push final group
  if (currentGroup.length > 0) {
    groups.push(buildConflictGroup(currentGroup, currentEarliest, currentLatest));
  }

  return groups;
}

/**
 * Constructs a WorkoutConflictGroup structure from a list of clustered sessions.
 */
function buildConflictGroup(
  sessions: DetailedWorkoutSession[],
  earliestTimeMs: number,
  latestTimeMs: number
): WorkoutConflictGroup {
  const firstSession = sessions[0].session;
  const exerciseTypes = new Set(sessions.map((s) => s.session.exerciseType));
  const hasMultipleExerciseTypes = exerciseTypes.size > 1;

  return {
    id: `group_${earliestTimeMs}_${latestTimeMs}_${sessions.length}`,
    sessions,
    earliestStartTime: new Date(earliestTimeMs).toISOString(),
    latestEndTime: new Date(latestTimeMs).toISOString(),
    exerciseType: firstSession.exerciseType,
    hasMultipleExerciseTypes,
    status: sessions.length > 1 ? 'conflict_detected' : 'ignored',
  };
}

/**
 * Pure function that generates the payload for inserting a merged master workout session
 * and its aggregated sub-records, as well as the list of original session IDs to delete.
 *
 * @param group The conflict group containing overlapping sessions.
 * @param selectedSessionIds Optional list of session IDs selected by user for merging.
 */
export function generateMergedWorkoutPayload(
  group: WorkoutConflictGroup,
  selectedSessionIds?: string[]
): MergedWorkoutPayload {
  const sessionsToMerge = selectedSessionIds
    ? group.sessions.filter((s, index) => {
        const id = s.session.metadata?.id || `sess_${index}`;
        return selectedSessionIds.includes(id);
      })
    : group.sessions;

  if (sessionsToMerge.length === 0) {
    throw new Error('Cannot merge an empty selection of workouts');
  }

  // Calculate overall start and end time based on selected sessions
  const startTimes = sessionsToMerge.map((s) => new Date(s.session.startTime).getTime());
  const endTimes = sessionsToMerge.map((s) => new Date(s.session.endTime).getTime());
  const earliestStartTime = new Date(Math.min(...startTimes)).toISOString();
  const latestEndTime = new Date(Math.max(...endTimes)).toISOString();
  const exerciseType = sessionsToMerge[0].session.exerciseType;

  // Pick title: take first non-empty title or generate fallback
  const existingTitle = sessionsToMerge.find((s) => s.session.title?.trim())?.session.title;
  const title = existingTitle || `Merged Workout (${sessionsToMerge.length} sessions)`;

  // Combine notes/descriptions if present
  const notes = sessionsToMerge
    .map((s) => s.session.notes)
    .filter((n): n is string => Boolean(n && n.trim()))
    .join(' | ');

  // 1. Build Master Exercise Session Payload
  const sessionToInsert = {
    recordType: 'ExerciseSession' as const,
    startTime: earliestStartTime,
    endTime: latestEndTime,
    exerciseType,
    title,
    notes: notes || undefined,
  };

  // 2. Aggregate and clean sub-records across selected sessions
  const rawHeartRate: HeartRateRecord[] = [];
  const rawDistance: DistanceRecord[] = [];
  const rawSpeed: SpeedRecord[] = [];
  const rawTotalCalories: TotalCaloriesBurnedRecord[] = [];
  const rawActiveCalories: ActiveCaloriesBurnedRecord[] = [];

  for (const item of sessionsToMerge) {
    rawHeartRate.push(...item.subRecords.heartRateRecords);
    rawDistance.push(...item.subRecords.distanceRecords);
    rawSpeed.push(...item.subRecords.speedRecords);
    rawTotalCalories.push(...item.subRecords.totalCaloriesRecords);
    rawActiveCalories.push(...item.subRecords.activeCaloriesRecords);
  }

  // Strip metadata and deduplicate samples
  const heartRateToInsert = deduplicateHeartRateRecords(rawHeartRate);
  const distanceToInsert = deduplicateTimeRangeRecords(rawDistance);
  const speedToInsert = deduplicateTimeRangeRecords(rawSpeed);
  const totalCaloriesToInsert = deduplicateTimeRangeRecords(rawTotalCalories);
  const activeCaloriesToInsert = deduplicateTimeRangeRecords(rawActiveCalories);

  // 3. Collect IDs of selected original duplicate sessions to delete
  const originalSessionIdsToDelete = sessionsToMerge
    .map((s) => s.session.metadata?.id)
    .filter((id): id is string => Boolean(id));

  return {
    sessionToInsert,
    heartRateToInsert,
    distanceToInsert,
    speedToInsert,
    totalCaloriesToInsert,
    activeCaloriesToInsert,
    originalSessionIdsToDelete,
  };
}

/**
 * Deduplicates HeartRate records by startTime.
 */
function deduplicateHeartRateRecords(
  records: HeartRateRecord[]
): Omit<HeartRateRecord, 'metadata'>[] {
  const seenTimes = new Set<string>();
  const result: Omit<HeartRateRecord, 'metadata'>[] = [];

  for (const rec of records) {
    const key = `${rec.startTime}_${rec.endTime}`;
    if (!seenTimes.has(key)) {
      seenTimes.add(key);
      const { metadata, ...cleanRecord } = rec;
      result.push({ ...cleanRecord, recordType: 'HeartRate' as const });
    }
  }

  return result;
}

/**
 * Deduplicates generic time-range records (Distance, Speed, Calories) by startTime and endTime.
 */
function deduplicateTimeRangeRecords<T extends { startTime: string; endTime: string; metadata?: any; recordType: any }>(
  records: T[]
): Omit<T, 'metadata'>[] {
  const seenRanges = new Set<string>();
  const result: Omit<T, 'metadata'>[] = [];

  for (const rec of records) {
    const key = `${rec.startTime}_${rec.endTime}`;
    if (!seenRanges.has(key)) {
      seenRanges.add(key);
      const { metadata, ...cleanRecord } = rec;
      result.push(cleanRecord as Omit<T, 'metadata'>);
    }
  }

  return result;
}
