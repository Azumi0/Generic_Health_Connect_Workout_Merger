 ### Before you push, you need the one-time keystore setup:

  1. Generate the keystore locally:

    keytool -genkey -v -keystore keystore.p12 -storetype pkcs12 \
      -alias fdroid-repo -keyalg RSA -keysize 4096 -validity 10000 \
      -dname "CN=F-Droid Repo, OU=F-Droid"

  2. Add 3 GitHub Secrets (Settings → Secrets → Actions):

   Secret                                                                                    │ Value
  ───────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────
   FDROID_KEYSTORE_BASE64                                                                    │ base64 -w 0 keystore.p12 output
   FDROID_KEYSTORE_PASS                                                                      │ Password you chose
   FDROID_KEY_PASS                                                                           │ Same password (unless you set a different one)

  3. Commit & push:

    git add .github/workflows/fdroid.yml
    git commit -m "ci: add F-Droid repository workflow for GitHub Pages"
    git push origin main

  4. Enable GitHub Pages (one-time, after first workflow run):

  • Repository Settings → Pages → Source: Deploy from a branch → gh-pages / / (root)
