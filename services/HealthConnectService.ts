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

      // Fetch sub-records for each session in parallel
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
   * Helper to fetch child metric records (HeartRate, Distance, Speed, Calories) for a session duration.
   */
  private async fetchSubRecordsForTimeRange(
    startTime: string,
    endTime: string
  ): Promise<WorkoutSubRecords> {
    const timeFilter = {
      operator: 'between' as const,
      startTime,
      endTime,
    };

    const [
      heartRateRes,
      distanceRes,
      speedRes,
      totalCaloriesRes,
      activeCaloriesRes,
    ] = await Promise.allSettled([
      readRecords('HeartRate', { timeRangeFilter: timeFilter }),
      readRecords('Distance', { timeRangeFilter: timeFilter }),
      readRecords('Speed', { timeRangeFilter: timeFilter }),
      readRecords('TotalCaloriesBurned', { timeRangeFilter: timeFilter }),
      readRecords('ActiveCaloriesBurned', { timeRangeFilter: timeFilter }),
    ]);

    return {
      heartRateRecords:
        heartRateRes.status === 'fulfilled'
          ? (heartRateRes.value.records as unknown as HeartRateRecord[])
          : [],
      distanceRecords:
        distanceRes.status === 'fulfilled'
          ? (distanceRes.value.records as unknown as DistanceRecord[])
          : [],
      speedRecords:
        speedRes.status === 'fulfilled'
          ? (speedRes.value.records as unknown as SpeedRecord[])
          : [],
      totalCaloriesRecords:
        totalCaloriesRes.status === 'fulfilled'
          ? (totalCaloriesRes.value.records as unknown as TotalCaloriesBurnedRecord[])
          : [],
      activeCaloriesRecords:
        activeCaloriesRes.status === 'fulfilled'
          ? (activeCaloriesRes.value.records as unknown as ActiveCaloriesBurnedRecord[])
          : [],
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
      if (payload.heartRateToInsert.length > 0) {
        await insertRecords(payload.heartRateToInsert as HeartRateRecord[]);
      }

      if (payload.distanceToInsert.length > 0) {
        await insertRecords(payload.distanceToInsert as DistanceRecord[]);
      }

      if (payload.speedToInsert.length > 0) {
        await insertRecords(payload.speedToInsert as SpeedRecord[]);
      }

      if (payload.totalCaloriesToInsert.length > 0) {
        await insertRecords(payload.totalCaloriesToInsert as TotalCaloriesBurnedRecord[]);
      }

      if (payload.activeCaloriesToInsert.length > 0) {
        await insertRecords(payload.activeCaloriesToInsert as ActiveCaloriesBurnedRecord[]);
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
