#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const daemonMakefile = fs.readFileSync(path.join(root, 'net/lanspeedd/Makefile'), 'utf8');
const luciMakefile = fs.readFileSync(path.join(root, 'applications/luci-app-lanspeed/Makefile'), 'utf8');
const versionJs = fs.readFileSync(path.join(root, 'applications/luci-app-lanspeed/htdocs/luci-static/resources/lanspeed/version.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/build-sdk.yml'), 'utf8');
const releaseScriptPath = path.join(root, 'scripts/release-version.sh');
const releaseScript = fs.readFileSync(releaseScriptPath, 'utf8');
const rustRoot = path.join(root, 'net/lanspeedd/rust');
const cargoToml = fs.readFileSync(path.join(rustRoot, 'Cargo.toml'), 'utf8');
const buildCargoToml = fs.readFileSync(path.join(rustRoot, 'crates/lanspeed-build/Cargo.toml'), 'utf8');
const projectCrates = new Map([
  ['lanspeedd', path.join(rustRoot, 'crates/lanspeedd/Cargo.toml')],
  ['lanspeed-common', path.join(rustRoot, 'crates/lanspeed-common/Cargo.toml')],
  ['lanspeed-ebpf', path.join(rustRoot, 'crates/lanspeed-ebpf/Cargo.toml')],
  ['lanspeed-openwrt-sys', path.join(rustRoot, 'crates/lanspeed-openwrt-sys/Cargo.toml')],
  ['lanspeed-build', path.join(rustRoot, 'crates/lanspeed-build/Cargo.toml')]
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readMakeVar(source, name, fileLabel) {
  const match = source.match(new RegExp(`^${name}:=(.+)$`, 'm'));
  assert(match, `${fileLabel} must define ${name}`);
  return match[1].trim();
}

function assertBefore(source, left, right, message) {
  const leftIndex = source.indexOf(left);
  const rightIndex = source.indexOf(right);
  assert(leftIndex !== -1, `${message}: missing left marker`);
  assert(rightIndex !== -1, `${message}: missing right marker`);
  assert(leftIndex < rightIndex, message);
}

function validateWorkspacePackages(metadata, expectedVersion) {
  const packagesById = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const members = metadata.workspace_members.map((id) => packagesById.get(id));
  assert(members.every(Boolean), 'every cargo workspace member must resolve to a package');
  const memberNames = members.map((pkg) => pkg.name);
  assert(new Set(memberNames).size === memberNames.length, 'cargo workspace member names must be unique');
  assert(memberNames.length === projectCrates.size &&
    memberNames.every((name) => projectCrates.has(name)),
  'cargo workspace member names must exactly match project crates');
  members.forEach((pkg) => {
    assert(pkg.source === null, `${pkg.name} workspace member must be a local package`);
    assert(pkg.manifest_path === projectCrates.get(pkg.name), `${pkg.name} workspace member manifest_path must match the project crate`);
    assert(pkg.version === expectedVersion, `${pkg.name} cargo metadata version must match daemon PKG_VERSION`);
  });
}

function runWorkspaceMetadataSelfTest(expectedVersion) {
  const packages = [...projectCrates].map(([name, manifestPath], index) => ({
    id: `local-${index}`,
    name,
    version: expectedVersion,
    source: null,
    manifest_path: manifestPath
  }));
  const valid = { packages, workspace_members: packages.map((pkg) => pkg.id) };
  validateWorkspacePackages(valid, expectedVersion);

  const imposter = { ...packages[0], id: 'registry-imposter', source: 'registry+https://example.invalid' };
  const missingMember = {
    packages: [...packages, imposter],
    workspace_members: [imposter.id, ...valid.workspace_members.slice(1)]
  };
  assertThrows(() => validateWorkspacePackages(missingMember, expectedVersion),
    'a same-name non-workspace/local imposter must not replace a workspace member');

  const wrongManifestPackages = packages.map((pkg, index) => index === 0 ?
    { ...pkg, manifest_path: path.join(rustRoot, 'wrong/Cargo.toml') } : pkg);
  assertThrows(() => validateWorkspacePackages({
    packages: wrongManifestPackages,
    workspace_members: valid.workspace_members
  }, expectedVersion), 'a workspace member with the wrong manifest must be rejected');
}

function assertThrows(callback, message) {
  let threw = false;
  try {
    callback();
  } catch (_error) {
    threw = true;
  }
  assert(threw, message);
}

try {
  const daemonVersion = readMakeVar(daemonMakefile, 'PKG_VERSION', 'net/lanspeedd/Makefile');
  const daemonRelease = readMakeVar(daemonMakefile, 'PKG_RELEASE', 'net/lanspeedd/Makefile');
  const luciVersion = readMakeVar(luciMakefile, 'PKG_VERSION', 'applications/luci-app-lanspeed/Makefile');
  const luciRelease = readMakeVar(luciMakefile, 'PKG_RELEASE', 'applications/luci-app-lanspeed/Makefile');
  const fullVersion = `${daemonVersion}-r${daemonRelease}`;
  const workspaceVersion = cargoToml.match(/^version = "([^"]+)"$/m);
  const buildVersion = buildCargoToml.match(/^version = "([^"]+)"$/m);
  const immortalwrtRoot = process.env.IMMORTALWRT_ROOT || '/openwrt/immortalwrt';
  const sdkCargo = path.join(immortalwrtRoot, 'staging_dir/target-x86_64_musl/host/bin/cargo');
  let sdkCargoExecutable = false;
  try {
    fs.accessSync(sdkCargo, fs.constants.X_OK);
    sdkCargoExecutable = true;
  } catch (_error) {
    // Fall back to cargo on PATH when the SDK cargo is absent or not executable.
  }
  const cargo = process.env.RUST_CARGO || (sdkCargoExecutable ? sdkCargo : 'cargo');
  const metadata = JSON.parse(childProcess.execFileSync(cargo, [
    'metadata', '--format-version=1', '--locked', '--offline'
  ], { cwd: rustRoot, encoding: 'utf8' }));
  runWorkspaceMetadataSelfTest(daemonVersion);

  assert(daemonVersion === luciVersion, 'daemon and LuCI PKG_VERSION must match for releases');
  assert(daemonRelease === luciRelease, 'daemon and LuCI PKG_RELEASE must match for releases');
  assert(workspaceVersion, 'Cargo workspace must define package.version');
  assert(workspaceVersion[1] === daemonVersion, 'Cargo workspace package.version must match daemon PKG_VERSION');
  assert(buildVersion, 'lanspeed-build must define an independent package.version');
  assert(buildVersion[1] === daemonVersion, 'lanspeed-build package.version must match daemon PKG_VERSION');
  validateWorkspacePackages(metadata, daemonVersion);
  assert(versionJs.includes(`PACKAGE_VERSION: '${daemonVersion}'`), 'version.js PACKAGE_VERSION must match daemon PKG_VERSION');
  assert(versionJs.includes(`PACKAGE_RELEASE: '${daemonRelease}'`), 'version.js PACKAGE_RELEASE must match daemon PKG_RELEASE');
  assert(versionJs.includes(`FULL_VERSION: '${fullVersion}'`), 'version.js FULL_VERSION must match package version and release');
  assert(daemonMakefile.includes('LANSPEED_VERSION="$(PKG_VERSION)"'), 'daemon package must pass PKG_VERSION into Rust status.version');
  assert(daemonMakefile.includes('LANSPEED_RELEASE="$(PKG_RELEASE)"'), 'daemon package must pass PKG_RELEASE into Rust status.version');
  assert(!luciMakefile.includes('./htdocs/luci-static/resources/lanspeed/*.js'), 'LuCI package must not install stale static version.js via wildcard');
  assert(luciMakefile.includes("PACKAGE_VERSION: '$(PKG_VERSION)'"), 'LuCI package must generate version.js from PKG_VERSION during install');
  assert(luciMakefile.includes("PACKAGE_RELEASE: '$(PKG_RELEASE)'"), 'LuCI package must generate version.js from PKG_RELEASE during install');
  assert(luciMakefile.includes("FULL_VERSION: '$(PKG_VERSION)-r$(PKG_RELEASE)'"), 'LuCI package must generate full version.js from package metadata');
  [
    'configForm.js',
    'configStyle.js',
    'configStyleArgon.js',
    'configStyleAurora.js',
    'configStyleBase.js',
    'configStyleBootstrap.js',
    'configStyleResponsive.js',
    'configStyleShared.js',
    'format.js',
    'ifaceConfig.js',
    'nssPanel.js',
    'rpc.js',
    'statusCollector.js',
    'statusIp.js',
    'statusRefresh.js',
    'statusShell.js',
    'statusStyle.js',
    'statusStyleArgon.js',
    'statusStyleAurora.js',
    'statusStyleBase.js',
    'statusStyleBootstrap.js',
    'statusStyleCompat.js',
    'statusStyleCompatLive.js',
    'statusStyleCompatLive2.js',
    'statusStyleCompatLive3.js',
    'statusStyleResponsive.js',
    'theme.js',
    'vocab.js'
  ].forEach((name) => {
    assert(luciMakefile.includes(`./htdocs/luci-static/resources/lanspeed/${name}`),
           `LuCI package must install resources/lanspeed/${name}`);
  });
  assert(releaseScript.includes('printf \'%s\\n\' "${daemon_version}-r${daemon_release}"'), 'scripts/release-version.sh must print the full code version');
  assert(releaseScript.includes('[ "$daemon_version" = "$luci_version" ]'), 'scripts/release-version.sh must verify daemon and LuCI PKG_VERSION match');
  assert(releaseScript.includes('[ "$daemon_release" = "$luci_release" ]'), 'scripts/release-version.sh must verify daemon and LuCI PKG_RELEASE match');
  const releaseVersion = childProcess.execFileSync('sh', [releaseScriptPath], {
    cwd: root,
    encoding: 'utf8'
  }).trim();
  assert(releaseVersion === fullVersion, 'scripts/release-version.sh output must match daemon package version and release');
  const jobsIndex = workflow.indexOf('jobs:\n');
  assert(jobsIndex !== -1, 'workflow must define jobs');
  const jobsBody = workflow.slice(jobsIndex + 'jobs:\n'.length);
  const jobNames = [...jobsBody.matchAll(/^  ([A-Za-z0-9_-]+):\n/gm)].map((match) => match[1]);
  assert(jobNames.join(',') === 'detect,release', 'workflow must define exactly the detect and release jobs');
  const detectMatch = jobsBody.match(/^  detect:\n[\s\S]*?(?=^  release:\n)/m);
  const releaseMatch = jobsBody.match(/^  release:\n[\s\S]*$/m);
  assert(detectMatch, 'workflow must define the detect job before release');
  assert(releaseMatch, 'workflow must define the release job');
  const detectJob = detectMatch[0];
  const releaseJob = releaseMatch[0];

  assert(/on:\n  push:\n    branches:\n      - main\n    paths:\n      - 'net\/lanspeedd\/Makefile'\n      - 'applications\/luci-app-lanspeed\/Makefile'\n\npermissions:/.test(workflow), 'workflow push trigger must target main and only the two package Makefiles');
  assert(!/\n\s+tags:/.test(workflow), 'workflow must not run from tag pushes');
  assert(!/\npull_request:|\n  pull_request:/.test(workflow), 'workflow must not run from pull requests');
  assert(!/\nworkflow_dispatch:|\n  workflow_dispatch:/.test(workflow), 'workflow must not expose a manual build trigger');
  assert(!/inputs\./.test(workflow), 'workflow must not depend on manual workflow inputs');
  assert(!/^concurrency:/m.test(workflow), 'workflow must not use GitHub concurrency because it cancels older pending version releases');

  assert(detectJob.includes('changed: ${{ steps.version.outputs.changed }}'), 'detect job must expose whether package versions changed');
  assert(detectJob.includes('code_version: ${{ steps.version.outputs.code_version }}'), 'detect job must expose the code version');
  assert(/uses: actions\/checkout@v4\n        with:\n          fetch-depth: 0/.test(detectJob), 'detect checkout must fetch complete history');
  assert(detectJob.includes('id: version'), 'detect version step must have the version id');
  assert(detectJob.includes('set -euo pipefail'), 'detect job must fail when version history extraction fails');
  assert(detectJob.includes('code_version="$(sh ./scripts/release-version.sh)"'), 'detect job must read the code version through sh scripts/release-version.sh');
  assert(detectJob.includes('before="${{ github.event.before }}"'), 'detect job must read the push before commit');
  assert(detectJob.includes('0000000000000000000000000000000000000000'), 'detect job must treat an all-zero before commit as changed');
  assert(detectJob.includes('before_dir="$(mktemp -d)"'), 'detect job must extract the previous version into a temporary directory');
  assert(detectJob.includes('git archive "$before" -- scripts/release-version.sh net/lanspeedd/Makefile applications/luci-app-lanspeed/Makefile | tar -x -C "$before_dir"'), 'detect job must archive the prior release script and both package Makefiles');
  assert(detectJob.includes('before_version="$(sh "$before_dir/scripts/release-version.sh")"'), 'detect job must run the same release version script against the prior commit');
  assert(detectJob.includes('if [ "$before_version" != "$code_version" ]; then'), 'detect job must compare complete before and after code versions');
  assert(!detectJob.includes('git diff'), 'detect job must compare complete versions instead of diffing assignment lines');
  assert(!detectJob.includes('git archive "$before" -- scripts/release-version.sh net/lanspeedd/Makefile applications/luci-app-lanspeed/Makefile | tar -x -C "$before_dir" || true'), 'detect job must not hide version archive failures');
  assert(detectJob.includes("if ! printf '%s\\n' \"$code_version\" | grep -Eq '^[0-9]+\\.[0-9]+\\.[0-9]+-r[0-9]+$'; then"), 'detect job must reject code versions outside the numeric version-release format');
  assertBefore(detectJob, "grep -Eq '^[0-9]+\\.[0-9]+\\.[0-9]+-r[0-9]+$'", "printf 'changed=%s\\n'", 'detect job must validate code_version before publishing outputs');
  assert(detectJob.includes("printf 'changed=%s\\n' \"$changed\" >> \"$GITHUB_OUTPUT\""), 'detect job must write the changed output');
  assert(detectJob.includes("printf 'code_version=%s\\n' \"$code_version\" >> \"$GITHUB_OUTPUT\""), 'detect job must write the code_version output');

  assert(releaseJob.includes('needs: detect'), 'release job must depend on detect');
  assert(releaseJob.includes("if: needs.detect.outputs.changed == 'true'"), 'release job must run only when package versions changed');
  assert(/uses: actions\/checkout@v4\n        with:\n          fetch-depth: 0/.test(releaseJob), 'release checkout must fetch tags and complete history');
  assert(releaseJob.includes('uses: actions/setup-node@v4'), 'release job must set up Node.js');
  assert(releaseJob.includes('node-version: 20'), 'release job must use Node.js 20');
  assert(releaseJob.includes('Install build prerequisites'), 'release job must install build prerequisites');
  assert(releaseJob.includes('sudo apt-get update'), 'release job must refresh apt metadata before unit validations');
  assert(releaseJob.includes('sudo apt-get install -y build-essential clang flex g++ gawk gcc-multilib gettext git libncurses5-dev libssl-dev python3 rsync unzip wget xz-utils zlib1g-dev zstd'), 'release job must install the complete SDK build prerequisites before unit validations');
  assert(releaseJob.includes('rustup toolchain install 1.96.0 --profile minimal --component rust-src'), 'release job must install the verified Rust 1.96.0 toolchain with rust-src');
  assert(releaseJob.includes('rustup default 1.96.0'), 'release job must select the verified Rust 1.96.0 toolchain');
  assert(!releaseJob.includes('rustup update stable'), 'release job must not use an unpinned stable Rust toolchain with the offline vendor tree');
  assert(releaseJob.includes('bpf-linker-0.10.3-x86_64-unknown-linux-musl.tar.gz'), 'release job must use a versioned local bpf-linker 0.10.3 archive');
  assert(releaseJob.includes('https://github.com/aya-rs/bpf-linker/releases/download/v0.10.3/bpf-linker-x86_64-unknown-linux-musl.tar.gz'), 'release job must download bpf-linker 0.10.3 from the official URL');
  assert(releaseJob.includes('0fa4645d2dfbb5cafe6231b0aa9fad4f1430bd0871e3bd7319e82d827bf6262c'), 'release job must pin the bpf-linker 0.10.3 archive SHA256');
  assert(releaseJob.includes("printf '%s  %s\\n' \"0fa4645d2dfbb5cafe6231b0aa9fad4f1430bd0871e3bd7319e82d827bf6262c\" \"$archive\" | sha256sum -c -"), 'release job must verify the exact bpf-linker archive checksum before extraction');
  assert(releaseJob.includes('tar -xzf "$archive" -C "$tool_dir"'), 'release job must extract the verified bpf-linker archive');
  assertBefore(releaseJob, "printf '%s  %s\\n' \"0fa4645d2dfbb5cafe6231b0aa9fad4f1430bd0871e3bd7319e82d827bf6262c\" \"$archive\" | sha256sum -c -", 'tar -xzf "$archive" -C "$tool_dir"', 'bpf-linker checksum verification must run before extraction');
  assert(releaseJob.includes('find "$tool_dir" -type f -name bpf-linker -perm -u+x -print -quit'), 'release job must locate the extracted executable bpf-linker');
  assert(releaseJob.includes('$(dirname "$bpf_linker")') && releaseJob.includes('>> "$GITHUB_PATH"'), 'release job must add the bpf-linker executable directory to GITHUB_PATH');
  assert(releaseJob.includes('run: ./tests/run.sh unit'), 'release job must run unit validations before publishing');
  assert(releaseJob.includes('CODE_VERSION: ${{ needs.detect.outputs.code_version }}'), 'asset collection must pass the detected version through the step environment');
  assert(releaseJob.includes('code_version="$CODE_VERSION"'), 'asset collection must read the detected version from its environment');
  assert(!releaseJob.includes('code_version="${{ needs.detect.outputs.code_version }}"'), 'asset collection must not interpolate the detected version into shell source');
  assert(releaseJob.includes('RELEASE_TAG: v${{ needs.detect.outputs.code_version }}'), 'tag creation must pass the detected version through the step environment');
  assert(!releaseJob.includes('release_tag="v${{ needs.detect.outputs.code_version }}"'), 'release job must not interpolate the detected version into shell source');
  assert(releaseJob.includes('if git rev-parse --verify --quiet "refs/tags/${RELEASE_TAG}" >/dev/null; then\n            printf \'%s\\n\' "error: release tag ${RELEASE_TAG} already exists" >&2\n            exit 1\n          fi'), 'release job must fail when the local release tag already exists');
  assert(releaseJob.includes('git tag "$RELEASE_TAG" "$GITHUB_SHA"'), 'release job must create a lightweight tag at the pushed commit');
  assert(releaseJob.includes('git push origin "refs/tags/$RELEASE_TAG"'), 'release job must push the new release tag without force');
  assert(!releaseJob.includes('git tag -a') && !releaseJob.includes('git tag -s'), 'release job must create a lightweight tag');
  assert(!releaseJob.includes('git push --force'), 'release job must never force-push a release tag');
  assertBefore(releaseJob, 'uses: actions/checkout@v4', 'uses: actions/setup-node@v4', 'release checkout must run before Node.js setup');
  assertBefore(releaseJob, 'uses: actions/setup-node@v4', 'Install build prerequisites', 'Node.js setup must run before prerequisite installation');
  assertBefore(releaseJob, 'Install build prerequisites', 'rustup toolchain install 1.96.0 --profile minimal --component rust-src', 'build prerequisites must be installed before preparing Rust');
  assertBefore(releaseJob, 'rustup default 1.96.0', 'bpf-linker-0.10.3-x86_64-unknown-linux-musl.tar.gz', 'Rust 1.96.0 and rust-src must be ready before installing bpf-linker');
  assertBefore(releaseJob, '>> "$GITHUB_PATH"', 'run: ./tests/run.sh unit', 'bpf-linker must be on PATH before unit validations');
  const completeCheckoutCount = (workflow.match(/uses: actions\/checkout@v4\n        with:\n          fetch-depth: 0/g) || []).length;
  assert(completeCheckoutCount === 2, 'both workflow jobs must use checkout with fetch-depth 0');
  assert(!workflow.includes('ipk_version='), 'Rust release workflow must not prepare unsupported IPK version names');
  assert(workflow.includes('name: ${{ needs.detect.outputs.code_version }}'), 'GitHub Release name must match the detected code version');
  assert(workflow.includes('tag_name: v${{ needs.detect.outputs.code_version }}'), 'GitHub Release tag must match the detected code version');
  assert(workflow.includes('target_commitish: ${{ github.sha }}'), 'GitHub Release tag must target the pushed commit');
  assert(workflow.includes('generate_release_notes: true'), 'GitHub Release must generate release notes');
  assert(workflow.includes('fail_on_unmatched_files: true'), 'GitHub Release must fail when an asset path is unmatched');
  assert(workflow.includes('overwrite_files: false'), 'GitHub Release must not overwrite existing assets');
  assert(!workflow.includes('overwrite_files: true'), 'GitHub Release must never overwrite existing assets');
  assert(!workflow.includes('Remove previous release assets'), 'workflow must not remove assets from an existing release');
  assert(!workflow.includes('gh release delete-asset'), 'workflow must not delete assets from an existing release');
  assert(!/^      [A-Z_]+:\s*\$\{\{\s*env\./m.test(workflow), 'workflow job env must not reference the env context');
  assert(workflow.includes('$APK_SDK_URL'), 'workflow APK SDK download must read the SDK URL as a runner environment variable');
  assert(workflow.includes('$APK_AARCH64_SDK_URL'), 'workflow APK aarch64 SDK download must read the SDK URL as a runner environment variable');
  assert(!/actions\/upload-artifact/.test(workflow), 'workflow must not upload Actions artifacts');
  assert(!/actions\/download-artifact/.test(workflow), 'workflow must not download Actions artifacts');
  assert(workflow.includes('uses: softprops/action-gh-release@v2.6.2'), 'workflow must publish package files through GitHub Releases');
  assert(workflow.includes('APK_SDK_URL:'), 'workflow must define a dedicated APK SDK URL');
  assert(workflow.includes('APK_AARCH64_SDK_URL:'), 'workflow must define a dedicated APK aarch64 SDK URL');
  assert(workflow.includes('https://downloads.immortalwrt.org/releases/25.12.0-rc2/targets/x86/64/immortalwrt-sdk-25.12.0-rc2-x86-64_gcc-14.3.0_musl.Linux-x86_64.tar.zst'), 'workflow must use the official APK x86_64 SDK URL');
  assert(workflow.includes('fb665aabb627d3b3a7d98cd426ee90febdb84ceffa6ce4c18fbda934c46053d5'), 'workflow must pin the official APK x86_64 SDK checksum');
  assert(!workflow.includes('IPK_SDK_URL:'), 'workflow must not advertise an unsupported OpenWrt 23.05 SDK');
  assert(!workflow.includes('IPK_AARCH64_SDK_URL:'), 'workflow must not advertise unsupported aarch64 IPK builds');
  assert(workflow.includes('https://downloads.immortalwrt.org/releases/25.12.0-rc2/targets/armsr/armv8/immortalwrt-sdk-25.12.0-rc2-armsr-armv8_gcc-14.3.0_musl.Linux-x86_64.tar.zst'), 'workflow must use the official APK aarch64 SDK URL');
  assert(workflow.includes('8fd6e4177ad99b567035cbc2825dd060773556249831fad5560cb1ef9eb1e290'), 'workflow must pin the official APK aarch64 SDK checksum');
  assert(!workflow.includes('23.05.6'), 'workflow must not schedule the unsupported 23.05 release line');
  assert(!workflow.includes('IPK_BASE_FEED_REF:'), 'workflow must not retain an unused IPK feed pin');
  assert(workflow.includes('Download public SDKs'), 'workflow must download the supported APK SDKs');
  assert(workflow.includes('"$APK_SDK_SHA256" "$RUNNER_TEMP/sdk-apk-base/sdk.tar.zst" | sha256sum -c -'), 'workflow must verify the APK x86_64 SDK checksum');
  assert(workflow.includes('"$APK_AARCH64_SDK_SHA256" "$RUNNER_TEMP/sdk-apk-aarch64-base/sdk.tar.zst" | sha256sum -c -'), 'workflow must verify the APK aarch64 SDK checksum');
  assert(workflow.includes('sdk-apk-base'), 'workflow must keep a separate APK SDK for base builds');
  assert(workflow.includes('sdk-apk-bpf'), 'workflow must keep a separate APK SDK for BPF builds');
  assert(workflow.includes('sdk-apk-aarch64-base'), 'workflow must keep a separate APK aarch64 SDK for base builds');
  assert(workflow.includes('sdk-apk-aarch64-bpf'), 'workflow must keep a separate APK aarch64 SDK for BPF builds');
  assert(!workflow.includes('sdk-ipk-'), 'workflow must not create unsupported IPK SDK copies');
  assert(workflow.includes('run_build apk-base'), 'workflow must build APK base packages');
  assert(workflow.includes('run_build apk-bpf'), 'workflow must build APK BPF packages');
  assert(workflow.includes('run_build apk-aarch64-base'), 'workflow must build APK aarch64 base packages');
  assert(workflow.includes('run_build apk-aarch64-bpf'), 'workflow must build APK aarch64 BPF packages');
  assert(workflow.includes(') > "$log_file" 2>&1 &'), 'workflow must launch SDK builds in parallel');
  assert(workflow.includes('if wait "$pid"; then'), 'workflow must wait for every parallel SDK build');
  assert(!workflow.includes('run_build ipk-'), 'workflow must not run unsupported IPK builds');
  assert(workflow.includes('run_build apk-base "$RUNNER_TEMP/sdk-apk-base" 0 25.12 lanspeedd'), 'APK base builds must use the 25.12 SDK release guard and daemon-only target');
  assert(workflow.includes('run_build apk-bpf "$RUNNER_TEMP/sdk-apk-bpf" 1 25.12 all'), 'APK BPF builds must use the 25.12 SDK release guard and full target');
  assert(workflow.includes('run_build apk-aarch64-base "$RUNNER_TEMP/sdk-apk-aarch64-base" 0 25.12 lanspeedd'), 'APK aarch64 base builds must use the 25.12 SDK release guard and daemon-only target');
  assert(workflow.includes('run_build apk-aarch64-bpf "$RUNNER_TEMP/sdk-apk-aarch64-bpf" 1 25.12 all'), 'APK aarch64 BPF builds must use the 25.12 SDK release guard and full target');
  assert(!/-name '\*\.apk'/.test(workflow), 'workflow must not collect every APK from the SDK output');
  assert(!/-name '\*\.ipk'/.test(workflow), 'workflow must not collect every IPK from the SDK output');
  const exactAssetCommands = [
    'collect_one "$RUNNER_TEMP/sdk-apk-base" "lanspeedd-${code_version}.apk"',
    'collect_one "$RUNNER_TEMP/sdk-apk-bpf" "lanspeedd-bpf-${code_version}.apk"',
    'collect_one "$RUNNER_TEMP/sdk-apk-bpf" "luci-app-lanspeed-${code_version}.apk"',
    'collect_one "$RUNNER_TEMP/sdk-apk-aarch64-base" "lanspeedd-${code_version}.apk" "lanspeedd-${code_version}-aarch64.apk"',
    'collect_one "$RUNNER_TEMP/sdk-apk-aarch64-bpf" "lanspeedd-bpf-${code_version}.apk" "lanspeedd-bpf-${code_version}-aarch64.apk"',
    'collect_one "$RUNNER_TEMP/sdk-apk-aarch64-bpf" "luci-app-lanspeed-${code_version}.apk" "luci-app-lanspeed-${code_version}-aarch64.apk"'
  ];
  exactAssetCommands.forEach((command) => {
    assert(releaseJob.includes(command), `workflow must retain exact release asset command: ${command}`);
  });
  assert(releaseJob.includes('match_count=0'), 'each release asset collection must count matching source files');
  assert(releaseJob.includes('match_count=$((match_count + 1))'), 'each matching source file must increment the match count');
  assert(releaseJob.includes('if [ "$match_count" -ne 1 ]; then'), 'release asset collection must reject zero or multiple source matches');
  assert(releaseJob.includes('if [ -e "$release_dir/$output_name" ]; then'), 'release asset collection must reject duplicate destination names');
  assert(releaseJob.includes('asset_count=$(wc -l < "$file_list")'), 'release asset collection must count the final file list');
  assert(releaseJob.includes("unique_asset_count=$(sed 's#.*/##' \"$file_list\" | sort -u | wc -l)"), 'release asset collection must count unique basenames');
  assert(releaseJob.includes('if [ "$asset_count" -ne 6 ] || [ "$unique_asset_count" -ne 6 ]; then'), 'release asset collection must require exactly six unique APK basenames');
  assert(!workflow.includes('.ipk"'), 'workflow must not collect unsupported IPK assets');
  assert(workflow.includes('"lanspeedd-${code_version}-aarch64.apk"'), 'workflow must add an aarch64 suffix to APK daemon release assets');
  assert(workflow.includes('"lanspeedd-bpf-${code_version}-aarch64.apk"'), 'workflow must add an aarch64 suffix to APK BPF release assets');
  assert(workflow.includes('"luci-app-lanspeed-${code_version}-aarch64.apk"'), 'workflow must add an aarch64 suffix to APK LuCI release assets');
  assert(!workflow.includes('ramips'), 'workflow must not add non-aarch64 ramips SDK targets');
  assert(!workflow.includes('ath79'), 'workflow must not add non-aarch64 ath79 SDK targets');
  assert(!workflow.includes('ipq40xx'), 'workflow must not add non-aarch64 ipq40xx SDK targets');
  assert(!workflow.includes('qualcommax'), 'workflow must not split aarch64 into Qualcomm SDK targets');
  assert(!workflow.includes('mediatek'), 'workflow must not split aarch64 into MediaTek SDK targets');
  assert(!workflow.includes('rockchip'), 'workflow must not split aarch64 into Rockchip SDK targets');
  assertBefore(workflow, 'file_list="$RUNNER_TEMP/release/files.txt"', 'collect_one "$RUNNER_TEMP/sdk-apk-base" "lanspeedd-${code_version}.apk"', 'workflow must create the release file list before collecting files');
  assertBefore(workflow, 'collect_one "$RUNNER_TEMP/sdk-apk-base" "lanspeedd-${code_version}.apk"', 'collect_one "$RUNNER_TEMP/sdk-apk-bpf" "lanspeedd-bpf-${code_version}.apk"', 'APK base package must be listed before APK BPF package');
  assertBefore(workflow, 'collect_one "$RUNNER_TEMP/sdk-apk-bpf" "lanspeedd-bpf-${code_version}.apk"', 'collect_one "$RUNNER_TEMP/sdk-apk-bpf" "luci-app-lanspeed-${code_version}.apk"', 'APK BPF package must be listed before its mandatory-BPF LuCI package');
  const collectedAssets = releaseJob.match(/^\s+collect_one /gm) || [];
  assert(collectedAssets.length === 6, 'workflow must collect exactly six release APK assets');
  assert(!workflow.includes('find "$release_dir" -type f | sort > "$file_list"'), 'workflow must not reorder release files by temporary paths');
  assertBefore(releaseJob, 'if [ "$asset_count" -ne 6 ] || [ "$unique_asset_count" -ne 6 ]; then', 'RELEASE_TAG: v${{ needs.detect.outputs.code_version }}', 'release tag creation must wait until six unique assets are validated');
  assertBefore(releaseJob, 'if git rev-parse --verify --quiet "refs/tags/${RELEASE_TAG}" >/dev/null; then', 'git tag "$RELEASE_TAG" "$GITHUB_SHA"', 'local tag existence must be checked before creating the release tag');
  assertBefore(releaseJob, 'git tag "$RELEASE_TAG" "$GITHUB_SHA"', 'git push origin "refs/tags/$RELEASE_TAG"', 'release tag must be created locally before it is pushed');
  assertBefore(releaseJob, 'git push origin "refs/tags/$RELEASE_TAG"', 'Publish GitHub Release', 'release tag push must complete before publishing the GitHub Release');

  console.log('validate-release-version: PASS');
} catch (error) {
  console.error('validate-release-version: FAIL');
  console.error(`  ${error.message}`);
  process.exit(1);
}
