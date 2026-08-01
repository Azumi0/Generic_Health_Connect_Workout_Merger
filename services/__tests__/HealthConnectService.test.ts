import { HealthConnectService } from '../HealthConnectService';
import * as HealthConnect from 'react-native-health-connect';

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  getGrantedPermissions: jest.fn(),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
  insertRecords: jest.fn(),
  deleteRecordsByUuids: jest.fn(),
}));

describe('HealthConnectService', () => {
  let service: HealthConnectService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = HealthConnectService.getInstance();
  });

  describe('initializeSDK', () => {
    it('returns true when initialization succeeds', async () => {
      (HealthConnect.initialize as jest.Mock).mockResolvedValue(true);
      const result = await service.initializeSDK();
      expect(result).toBe(true);
      expect(HealthConnect.initialize).toHaveBeenCalledTimes(1);
    });

    it('returns false and logs when initialization fails', async () => {
      (HealthConnect.initialize as jest.Mock).mockRejectedValue(new Error('SDK init failed'));
      const result = await service.initializeSDK();
      expect(result).toBe(false);
    });
  });

  describe('checkPermissions', () => {
    it('returns true when all required permissions are granted', async () => {
      (HealthConnect.getGrantedPermissions as jest.Mock).mockResolvedValue([
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
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'write', recordType: 'Steps' },
        { accessType: 'read', recordType: 'StepsCadence' },
        { accessType: 'write', recordType: 'StepsCadence' },
        { accessType: 'read', recordType: 'ElevationGained' },
        { accessType: 'write', recordType: 'ElevationGained' },
        { accessType: 'read', recordType: 'FloorsClimbed' },
        { accessType: 'write', recordType: 'FloorsClimbed' },
        { accessType: 'read', recordType: 'Power' },
        { accessType: 'write', recordType: 'Power' },
        { accessType: 'read', recordType: 'CyclingPedalingCadence' },
        { accessType: 'write', recordType: 'CyclingPedalingCadence' },
        { accessType: 'read', recordType: 'WheelchairPushes' },
        { accessType: 'write', recordType: 'WheelchairPushes' },
        { accessType: 'read', recordType: 'Vo2Max' },
        { accessType: 'write', recordType: 'Vo2Max' },
        { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
        { accessType: 'write', recordType: 'HeartRateVariabilityRmssd' },
        { accessType: 'read', recordType: 'RestingHeartRate' },
        { accessType: 'write', recordType: 'RestingHeartRate' },
      ]);

      const result = await service.checkPermissions();
      expect(result).toBe(true);
    });

    it('throws when getGrantedPermissions rejects', async () => {
      (HealthConnect.getGrantedPermissions as jest.Mock).mockRejectedValue(new Error('Permission check error'));
      await expect(service.checkPermissions()).rejects.toThrow('Permission check error');
    });
  });

  describe('executeMerge atomic operation and rollback', () => {
    const mockPayload: any = {
      sessionToInsert: {
        recordType: 'ExerciseSession',
        startTime: '2026-07-29T10:00:00.000Z',
        endTime: '2026-07-29T10:45:00.000Z',
        exerciseType: 57,
        title: 'Merged Workout',
      },
      heartRateToInsert: [{ time: '2026-07-29T10:05:00.000Z', samples: [{ beatsPerMinute: 140 }] }],
      distanceToInsert: [{ startTime: '2026-07-29T10:00:00.000Z', endTime: '2026-07-29T10:45:00.000Z', distance: { inMeters: 5000 } }],
      speedToInsert: [],
      totalCaloriesToInsert: [],
      activeCaloriesToInsert: [],
      stepsToInsert: [],
      stepsCadenceToInsert: [],
      elevationGainedToInsert: [],
      floorsClimbedToInsert: [],
      powerToInsert: [],
      cyclingPedalingCadenceToInsert: [],
      wheelchairPushesToInsert: [],
      vo2MaxToInsert: [],
      heartRateVariabilityToInsert: [],
      restingHeartRateToInsert: [],
      originalSessionIdsToDelete: ['session_orig_1', 'session_orig_2'],
      originalSubRecordIdsToDelete: [
        { recordType: 'HeartRate', uuids: ['hr_sub_1', 'hr_sub_2'] },
        { recordType: 'Distance', uuids: ['dist_sub_1'] },
      ],
    };

    it('performs insert of session and sub-records, deletes original sub-records, and deletes original sessions on success', async () => {
      (HealthConnect.insertRecords as jest.Mock)
        .mockResolvedValueOnce(['inserted_session_uuid'])
        .mockResolvedValueOnce(['inserted_hr_uuid'])
        .mockResolvedValueOnce(['inserted_dist_uuid']);
      (HealthConnect.deleteRecordsByUuids as jest.Mock).mockResolvedValue(undefined);

      const success = await service.executeMerge(mockPayload);
      expect(success).toBe(true);

      expect(HealthConnect.insertRecords).toHaveBeenCalledTimes(3);

      // Verify deletion of original sub-records and original sessions
      expect(HealthConnect.deleteRecordsByUuids).toHaveBeenCalledWith('HeartRate', ['hr_sub_1', 'hr_sub_2'], []);
      expect(HealthConnect.deleteRecordsByUuids).toHaveBeenCalledWith('Distance', ['dist_sub_1'], []);
      expect(HealthConnect.deleteRecordsByUuids).toHaveBeenCalledWith('ExerciseSession', ['session_orig_1', 'session_orig_2'], []);
    });

    it('rolls back inserted records if a sub-record insertion fails midway', async () => {
      (HealthConnect.insertRecords as jest.Mock)
        .mockResolvedValueOnce(['inserted_session_uuid'])
        .mockResolvedValueOnce(['inserted_hr_uuid'])
        .mockRejectedValueOnce(new Error('Distance insertion rejected by SDK'));
      (HealthConnect.deleteRecordsByUuids as jest.Mock).mockResolvedValue(undefined);

      await expect(service.executeMerge(mockPayload)).rejects.toThrow('Distance insertion rejected by SDK');

      // Verify rollback calls in reverse order for inserted records
      expect(HealthConnect.deleteRecordsByUuids).toHaveBeenCalledWith('HeartRate', ['inserted_hr_uuid'], []);
      expect(HealthConnect.deleteRecordsByUuids).toHaveBeenCalledWith('ExerciseSession', ['inserted_session_uuid'], []);
    });
  });
});
