import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  insertRecords,
  deleteRecordsByUuids,
  Permission,
  RecordType,
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
} from 'react-native-health-connect';

import {
  REQUIRED_HEALTH_PERMISSIONS,
  DetailedWorkoutSession,
  WorkoutSubRecords,
  MergedWorkoutPayload,
} from '../types';

/**
 * Service class encapsulating all interactions with the Google Health Connect API.
 */
export class HealthConnectService {
  private static instance: HealthConnectService;
  private initialized: boolean = false;

  private constructor() {}

  /**
   * Singleton instance accessor.
   */
  public static getInstance(): HealthConnectService {
    if (!HealthConnectService.instance) {
      HealthConnectService.instance = new HealthConnectService();
    }
    return HealthConnectService.instance;
  }

  /**
   * Initializes Health Connect SDK on the device.
   */
  public async initializeSDK(): Promise<boolean> {
    try {
      const isInitialized = await initialize();
      this.initialized = isInitialized;
      return isInitialized;
    } catch (error) {
      console.error('[HealthConnectService] Failed to initialize Health Connect SDK:', error);
      return false;
    }
  }

  /**
   * Checks if all required permissions are granted.
   */
  public async checkPermissions(): Promise<boolean> {
    try {
      const grantedPermissions = await getGrantedPermissions();
      const hasAllPermissions = REQUIRED_HEALTH_PERMISSIONS.every((req) =>
        grantedPermissions.some(
          (granted: any) =>
            granted.accessType === req.accessType && granted.recordType === req.recordType
        )
      );
      return hasAllPermissions;
    } catch (error) {
      console.error('[HealthConnectService] Failed to check permissions:', error);
      throw error;
    }
  }

  /**
   * Requests READ & WRITE permissions from the user for exercise sessions and metrics.
   */
  public async requestPermissions(): Promise<Permission[]> {
    try {
      if (!this.initialized) {
        await this.initializeSDK();
      }
      const granted = await requestPermission(REQUIRED_HEALTH_PERMISSIONS);
      return (granted || []) as Permission[];
    } catch (error) {
      console.error('[HealthConnectService] Failed to request permissions:', error);
      throw error;
    }
  }

  /**
   * Fetches exercise sessions and all associated sub-records within a given time range.
   *
   * @param startTimeISO ISO 8601 start date string.
   * @param endTimeISO ISO 8601 end date string.
   */
  public async fetchSessionsWithSubRecords(
    startTimeISO: string,
    endTimeISO: string
  ): Promise<DetailedWorkoutSession[]> {
    try {
      const sessionsResult = await readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTimeISO,
          endTime: endTimeISO,
        },
      });

      const sessions = (sessionsResult.records as unknown as ExerciseSessionRecord[]) || [];

      // Fetch sub-records for each session in parallel for its exact duration
      const detailedSessions: DetailedWorkoutSession[] = await Promise.all(
        sessions.map(async (session) => {
          const subRecords = await this.fetchSubRecordsForTimeRange(
            session.startTime,
            session.endTime
          );
          return {
            session,
            subRecords,
          };
        })
      );

      return detailedSessions;
    } catch (error) {
      console.error('[HealthConnectService] Error fetching exercise sessions:', error);
      throw error;
    }
  }

  /**
   * Helper to fetch child metric records for a session duration.
   */
  private async fetchSubRecordsForTimeRange(
    startTime: string,
    endTime: string
  ): Promise<WorkoutSubRecords> {
    const options = {
      timeRangeFilter: {
        operator: 'between' as const,
        startTime,
        endTime,
      },
    };

    const [
      heartRateRes,
      distanceRes,
      speedRes,
      totalCaloriesRes,
      activeCaloriesRes,
      stepsRes,
      stepsCadenceRes,
      elevationGainedRes,
      floorsClimbedRes,
      powerRes,
      cyclingPedalingCadenceRes,
      wheelchairPushesRes,
      vo2MaxRes,
      heartRateVariabilityRes,
      restingHeartRateRes,
    ] = await Promise.allSettled([
      readRecords('HeartRate', options),
      readRecords('Distance', options),
      readRecords('Speed', options),
      readRecords('TotalCaloriesBurned', options),
      readRecords('ActiveCaloriesBurned', options),
      readRecords('Steps', options),
      readRecords('StepsCadence', options),
      readRecords('ElevationGained', options),
      readRecords('FloorsClimbed', options),
      readRecords('Power', options),
      readRecords('CyclingPedalingCadence', options),
      readRecords('WheelchairPushes', options),
      readRecords('Vo2Max', options),
      readRecords('HeartRateVariabilityRmssd', options),
      readRecords('RestingHeartRate', options),
    ]);

    const getFulfilled = <T>(res: PromiseSettledResult<{ records: any[] }>): T[] => {
      return res.status === 'fulfilled' ? (res.value.records as unknown as T[]) : [];
    };

    return {
      heartRateRecords: getFulfilled<HeartRateRecord>(heartRateRes),
      distanceRecords: getFulfilled<DistanceRecord>(distanceRes),
      speedRecords: getFulfilled<SpeedRecord>(speedRes),
      totalCaloriesRecords: getFulfilled<TotalCaloriesBurnedRecord>(totalCaloriesRes),
      activeCaloriesRecords: getFulfilled<ActiveCaloriesBurnedRecord>(activeCaloriesRes),
      stepsRecords: getFulfilled<StepsRecord>(stepsRes),
      stepsCadenceRecords: getFulfilled<StepsCadenceRecord>(stepsCadenceRes),
      elevationGainedRecords: getFulfilled<ElevationGainedRecord>(elevationGainedRes),
      floorsClimbedRecords: getFulfilled<FloorsClimbedRecord>(floorsClimbedRes),
      powerRecords: getFulfilled<PowerRecord>(powerRes),
      cyclingPedalingCadenceRecords: getFulfilled<CyclingPedalingCadenceRecord>(cyclingPedalingCadenceRes),
      wheelchairPushesRecords: getFulfilled<WheelchairPushesRecord>(wheelchairPushesRes),
      vo2MaxRecords: getFulfilled<Vo2MaxRecord>(vo2MaxRes),
      heartRateVariabilityRecords: getFulfilled<HeartRateVariabilityRmssdRecord>(heartRateVariabilityRes),
      restingHeartRateRecords: getFulfilled<RestingHeartRateRecord>(restingHeartRateRes),
    };
  }

  /**
   * Persists a merged master workout session along with all re-associated sub-records,
   * and deletes the original duplicated exercise sessions and sub-records.
   *
   * Implements an atomic rollback strategy: if insertion of master session or any sub-record batch fails,
   * all previously inserted records in this transaction are rolled back (deleted).
   *
   * @param payload The merged workout payload generated by the merge algorithm.
   */
  public async executeMerge(payload: MergedWorkoutPayload): Promise<boolean> {
    const insertedRecordsToRollback: Array<{ recordType: RecordType; uuids: string[] }> = [];

    try {
      // 1. Insert master exercise session
      const insertedSessionIds = await insertRecords([payload.sessionToInsert as ExerciseSessionRecord]);
      if (insertedSessionIds && insertedSessionIds.length > 0) {
        insertedRecordsToRollback.push({ recordType: 'ExerciseSession', uuids: insertedSessionIds });
      }

      // 2. Insert sub-records (if non-empty)
      const subRecordBatches: Array<{ name: RecordType; records: any[] }> = [
        { name: 'HeartRate', records: payload.heartRateToInsert },
        { name: 'Distance', records: payload.distanceToInsert },
        { name: 'Speed', records: payload.speedToInsert },
        { name: 'TotalCaloriesBurned', records: payload.totalCaloriesToInsert },
        { name: 'ActiveCaloriesBurned', records: payload.activeCaloriesToInsert },
        { name: 'Steps', records: payload.stepsToInsert },
        { name: 'StepsCadence', records: payload.stepsCadenceToInsert },
        { name: 'ElevationGained', records: payload.elevationGainedToInsert },
        { name: 'FloorsClimbed', records: payload.floorsClimbedToInsert },
        { name: 'Power', records: payload.powerToInsert },
        { name: 'CyclingPedalingCadence', records: payload.cyclingPedalingCadenceToInsert },
        { name: 'WheelchairPushes', records: payload.wheelchairPushesToInsert },
        { name: 'Vo2Max', records: payload.vo2MaxToInsert },
        { name: 'HeartRateVariabilityRmssd', records: payload.heartRateVariabilityToInsert },
        { name: 'RestingHeartRate', records: payload.restingHeartRateToInsert },
      ];

      for (const batch of subRecordBatches) {
        if (batch.records && batch.records.length > 0) {
          const recordsWithType = batch.records.map((record: any) => ({
            ...record,
            recordType: batch.name,
          }));
          const insertedSubIds = await insertRecords(recordsWithType);
          if (insertedSubIds && insertedSubIds.length > 0) {
            insertedRecordsToRollback.push({ recordType: batch.name, uuids: insertedSubIds });
          }
        }
      }

      // 3. Delete original sub-records (Heart Rate, Distance, Calories, etc.) of deleted sessions
      if (payload.originalSubRecordIdsToDelete && payload.originalSubRecordIdsToDelete.length > 0) {
        for (const item of payload.originalSubRecordIdsToDelete) {
          if (item.uuids && item.uuids.length > 0) {
            await deleteRecordsByUuids(item.recordType, item.uuids, []);
          }
        }
      }

      // 4. Delete original duplicate ExerciseSessions by record ID
      if (payload.originalSessionIdsToDelete.length > 0) {
        await deleteRecordsByUuids('ExerciseSession', payload.originalSessionIdsToDelete, []);
      }

      return true;
    } catch (error) {
      console.error('[HealthConnectService] Error persisting merged workout. Attempting rollback of inserted records...', error);

      // Rollback inserted records in reverse order
      for (const item of insertedRecordsToRollback.reverse()) {
        try {
          await deleteRecordsByUuids(item.recordType, item.uuids, []);
        } catch (rollbackError) {
          console.error(`[HealthConnectService] Failed to rollback ${item.recordType}:`, rollbackError);
        }
      }

      throw error;
    }
  }
}

export const healthConnectService = HealthConnectService.getInstance();
