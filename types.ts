import type {
  ExerciseSessionRecord,
  HeartRateRecord,
  DistanceRecord,
  SpeedRecord,
  TotalCaloriesBurnedRecord,
  ActiveCaloriesBurnedRecord,
  StepsRecord,
  StepsCadenceRecord,
  ElevationGainedRecord,
  FloorsClimbedRecord,
  PowerRecord,
  CyclingPedalingCadenceRecord,
  WheelchairPushesRecord,
  Vo2MaxRecord,
  HeartRateVariabilityRmssdRecord,
  RestingHeartRateRecord,
  Permission,
  RecordType,
} from 'react-native-health-connect';

/**
 * List of all Health Connect record types supported by react-native-health-connect.
 */
const ALL_HEALTH_RECORD_TYPES: RecordType[] = [
  'ActiveCaloriesBurned',
  'BasalBodyTemperature',
  'BasalMetabolicRate',
  'BloodGlucose',
  'BloodPressure',
  'BodyFat',
  'BodyTemperature',
  'BodyWaterMass',
  'BoneMass',
  'CervicalMucus',
  'CyclingPedalingCadence',
  'Distance',
  'ElevationGained',
  'ExerciseSession',
  'FloorsClimbed',
  'HeartRate',
  'HeartRateVariabilityRmssd',
  'Height',
  'Hydration',
  'IntermenstrualBleeding',
  'LeanBodyMass',
  'MenstruationFlow',
  'MenstruationPeriod',
  'Nutrition',
  'OvulationTest',
  'OxygenSaturation',
  'Power',
  'RespiratoryRate',
  'RestingHeartRate',
  'SexualActivity',
  'SleepSession',
  'Speed',
  'Steps',
  'StepsCadence',
  'TotalCaloriesBurned',
  'Vo2Max',
  'Weight',
  'WheelchairPushes',
];

/**
 * Comprehensive Health Connect permissions required by the application.
 */
export const REQUIRED_HEALTH_PERMISSIONS: Permission[] = ALL_HEALTH_RECORD_TYPES.flatMap(
  (recordType) => [
    { accessType: 'read', recordType },
    { accessType: 'write', recordType },
  ]
);

/**
 * Detailed sub-records associated with an ExerciseSession.
 */
export interface WorkoutSubRecords {
  heartRateRecords: HeartRateRecord[];
  distanceRecords: DistanceRecord[];
  speedRecords: SpeedRecord[];
  totalCaloriesRecords: TotalCaloriesBurnedRecord[];
  activeCaloriesRecords: ActiveCaloriesBurnedRecord[];
  stepsRecords: StepsRecord[];
  stepsCadenceRecords: StepsCadenceRecord[];
  elevationGainedRecords: ElevationGainedRecord[];
  floorsClimbedRecords: FloorsClimbedRecord[];
  powerRecords: PowerRecord[];
  cyclingPedalingCadenceRecords: CyclingPedalingCadenceRecord[];
  wheelchairPushesRecords: WheelchairPushesRecord[];
  vo2MaxRecords: Vo2MaxRecord[];
  heartRateVariabilityRecords: HeartRateVariabilityRmssdRecord[];
  restingHeartRateRecords: RestingHeartRateRecord[];
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
  stepsToInsert: Omit<StepsRecord, 'metadata'>[];
  stepsCadenceToInsert: Omit<StepsCadenceRecord, 'metadata'>[];
  elevationGainedToInsert: Omit<ElevationGainedRecord, 'metadata'>[];
  floorsClimbedToInsert: Omit<FloorsClimbedRecord, 'metadata'>[];
  powerToInsert: Omit<PowerRecord, 'metadata'>[];
  cyclingPedalingCadenceToInsert: Omit<CyclingPedalingCadenceRecord, 'metadata'>[];
  wheelchairPushesToInsert: Omit<WheelchairPushesRecord, 'metadata'>[];
  vo2MaxToInsert: Omit<Vo2MaxRecord, 'metadata'>[];
  heartRateVariabilityToInsert: Omit<HeartRateVariabilityRmssdRecord, 'metadata'>[];
  restingHeartRateToInsert: Omit<RestingHeartRateRecord, 'metadata'>[];
  originalSessionIdsToDelete: string[];
}
