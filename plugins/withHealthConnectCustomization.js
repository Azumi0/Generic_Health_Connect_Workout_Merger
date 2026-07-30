const { withMainActivity, withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');
const pkg = require('../package.json');

/**
 * Modifies MainActivity.kt to register the HealthConnectPermissionDelegate on onCreate
 */
const withHealthConnectMainActivity = (config) => {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Add import if missing
    if (!contents.includes('dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate')) {
      contents = contents.replace(
        /import expo\.modules\.ReactActivityDelegateWrapper/,
        'import expo.modules.ReactActivityDelegateWrapper\n\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate'
      );
    }

    // Add setPermissionDelegate call inside onCreate if missing
    if (!contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate(this)')) {
      contents = contents.replace(
        /super\.onCreate\(null\)/,
        'super.onCreate(null)\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)'
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

/**
 * Modifies AndroidManifest.xml to add the ViewPermissionUsageActivity activity-alias required for Android 14+
 */
const withHealthConnectAndroidManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const application = androidManifest.application?.[0];

    if (!application) {
      return config;
    }

    if (!application['activity-alias']) {
      application['activity-alias'] = [];
    }

    const hasAlias = application['activity-alias'].some(
      (alias) => alias.$ && alias.$['android:name'] === 'ViewPermissionUsageActivity'
    );

    if (!hasAlias) {
      application['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.HEALTH_PERMISSIONS',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

/**
 * Expo Config Plugin to automate Health Connect native Android customizations.
 */
const withHealthConnectCustomization = (config) => {
  config = withHealthConnectMainActivity(config);
  config = withHealthConnectAndroidManifest(config);
  return config;
};

module.exports = createRunOncePlugin(
  withHealthConnectCustomization,
  'with-health-connect-customization',
  pkg.version
);
