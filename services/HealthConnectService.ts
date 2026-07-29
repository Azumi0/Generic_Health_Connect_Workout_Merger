import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  insertRecords,
  deleteRecordsByUuids,
  Permission,
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
      return false;
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
      return granted as unknown as Permission[];
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

      // Fetch sub-records for each session in parallel, filtered by session dataOrigin
      const detailedSessions: DetailedWorkoutSession[] = await Promise.all(
        sessions.map(async (session) => {
          const subRecords = await this.fetchSubRecordsForTimeRange(
            session.startTime,
            session.endTime,
            session.metadata?.dataOrigin
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
   * Helper to fetch child metric records for a session duration,
   * filtered specifically by the session's dataOrigin package.
   */
  private async fetchSubRecordsForTimeRange(
    startTime: string,
    endTime: string,
    dataOrigin?: string
  ): Promise<WorkoutSubRecords> {
    const timeFilter = {
      operator: 'between' as const,
      startTime,
      endTime,
    };

    const options = {
      timeRangeFilter: timeFilter,
      ...(dataOrigin ? { dataOriginFilter: [dataOrigin] } : {}),
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

    const filterByOrigin = <T extends { metadata?: { dataOrigin?: string } }>(records: T[]): T[] => {
      if (!dataOrigin) return records;
      return records.filter((r) => !r.metadata?.dataOrigin || r.metadata?.dataOrigin === dataOrigin);
    };

    const getFulfilled = <T extends { metadata?: { dataOrigin?: string } }>(
      res: PromiseSettledResult<{ records: any[] }>
    ): T[] => {
      return res.status === 'fulfilled' ? filterByOrigin(res.value.records as unknown as T[]) : [];
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
   * and deletes the original duplicated exercise sessions.
   *
   * @param payload The merged workout payload generated by the merge algorithm.
   */
  public async executeMerge(payload: MergedWorkoutPayload): Promise<boolean> {
    try {
      // 1. Insert master exercise session
      await insertRecords([payload.sessionToInsert as ExerciseSessionRecord]);

      // 2. Insert sub-records (if non-empty)
      const subRecordBatches: Array<{ name: string; records: any[] }> = [
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
          await insertRecords(batch.records);
        }
      }

      // 3. Delete original duplicate sessions by record ID
      if (payload.originalSessionIdsToDelete.length > 0) {
        await deleteRecordsByUuids('ExerciseSession', payload.originalSessionIdsToDelete, []);
      }

      return true;
    } catch (error) {
      console.error('[HealthConnectService] Error persisting merged workout:', error);
      throw error;
    }
  }
}

export const healthConnectService = HealthConnectService.getInstance();
