const fs = require('fs');
const path = require('path');
const { getArchAndPlatform } = require('./utils');
const { readVersionMetadata } = require('./versionMetadata.cjs');

const rootDir = path.join(__dirname, '..');
const versionFilePath = path.join(rootDir, 'Version');
const buildDir = path.join(rootDir, 'build');

let version = '';
try {
    version = readVersionMetadata({ versionFilePath }).sourceVersion;
    // if (!version.includes('T')) {
    //     // Remove dots only from Stable version
    //     version = version.replaceAll('.', '');
    // }
} catch (err) {
    console.error('Error reading Version file:', err);
    process.exit(1);
}

function renameBuild(arch, platform) {
    if (platform === 'linux') {
        const oldAppImage = path.join(buildDir, `VRCX-Luo_Version.AppImage`);
        const newAppImage = path.join(
            buildDir,
            `VRCX-Luo_${version}_${arch}.AppImage`
        );
        try {
            if (fs.existsSync(oldAppImage)) {
                fs.renameSync(oldAppImage, newAppImage);
                console.log(`Renamed: ${oldAppImage} -> ${newAppImage}`);
            } else {
                console.log(`File not found: ${oldAppImage}`);
            }
        } catch (err) {
            console.error('Error renaming files:', err);
            process.exit(1);
        }
    } else if (platform === 'darwin') {
        const oldDmg = path.join(buildDir, `VRCX-Luo_Version.dmg`);
        const newDmg = path.join(buildDir, `VRCX-Luo_${version}_${arch}.dmg`);
        try {
            if (fs.existsSync(oldDmg)) {
                fs.renameSync(oldDmg, newDmg);
                console.log(`Renamed: ${oldDmg} -> ${newDmg}`);
            } else {
                console.log(`File not found: ${oldDmg}`);
            }
        } catch (err) {
            console.error('Error renaming files:', err);
            process.exit(1);
        }
    } else {
        console.log('No renaming needed for this platform.');
    }
}

const { arch, platform } = getArchAndPlatform();
renameBuild(arch, platform);
