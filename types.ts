import type {
  ExerciseSessionRecord,
  HeartRateRecord,
  DistanceRecord,
  SpeedRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
  Permission,
} from 'react-native-health-connect';

/**
 * Health Connect permissions required by the application.
 */
export const REQUIRED_HEALTH_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Speed' },
  { accessType: 'write', recordType: 'Speed' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'write', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
];

/**
 * Detailed sub-records associated with an ExerciseSession.
 */
export interface WorkoutSubRecords {
  heartRateRecords: HeartRateRecord[];
  distanceRecords: DistanceRecord[];
  speedRecords: SpeedRecord[];
  totalCaloriesRecords: TotalCaloriesBurnedRecord[];
  activeCaloriesRecords: ActiveCaloriesBurnedRecord[];
}

/**
 * Complete workout session with its associated child metric records.
 */
export interface DetailedWorkoutSession {
  session: ExerciseSessionRecord;
  subRecords: WorkoutSubRecords;
}

/**
 * Parameters controlling overlap detection tolerance.
 */
export interface ToleranceParams {
  /**
   * Maximum allowed gap (in milliseconds) between session end and start to consider them overlapping.
   * Default: 300,000 ms (5 minutes).
   */
  toleranceMs: number;
}

/**
 * A detected group of overlapping or adjacent workout sessions.
 */
export interface WorkoutConflictGroup {
  id: string;
  sessions: DetailedWorkoutSession[];
  earliestStartTime: string;
  latestEndTime: string;
  exerciseType: number;
  hasMultipleExerciseTypes: boolean;
  status: 'conflict_detected' | 'merged' | 'ignored';
}

/**
 * Result structure produced by the merge algorithm, ready for persistence.
 */
export interface MergedWorkoutPayload {
  sessionToInsert: Omit<ExerciseSessionRecord, 'metadata'>;
  heartRateToInsert: Omit<HeartRateRecord, 'metadata'>[];
  distanceToInsert: Omit<DistanceRecord, 'metadata'>[];
  speedToInsert: Omit<SpeedRecord, 'metadata'>[];
  totalCaloriesToInsert: Omit<TotalCaloriesBurnedRecord, 'metadata'>[];
  activeCaloriesToInsert: Omit<ActiveCaloriesBurnedRecord, 'metadata'>[];
  originalSessionIdsToDelete: string[];
}
