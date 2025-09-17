import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

import { updateDataFile, DATAFILE } from ".";

(async () => {
    if(process.env.THIS_IS_A_GITHUB_AUTOUPDATE !== "1") {
        console.error("This script is intended to be run only by GitHub Actions.");
        process.exit(1);
    }
    console.log("Updating data file...");
    const hashBefore = execSync(`sha256sum ${DATAFILE} | cut -d' ' -f1`, {encoding: "utf8"}).toString().trim();    
    await updateDataFile();
    const hashAfter = execSync(`sha256sum ${DATAFILE} | cut -d' ' -f1`, {encoding: "utf8"}).toString().trim();    
    if (hashBefore === hashAfter) {
        console.log("Data file is up to date, no changes.");
        process.exit(0);
    }
    console.log("Data file has been updated.");
    console.log("Running tests...");
    execSync("npm run test");
    console.log("Tests passed.");
    console.log("Updating version in package.json and README.md...");
    const packageJson = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' })) as { version: string };
    const readme = readFileSync('./README.md', { encoding: 'utf8' });
    const currentVersion = `v${packageJson.version}`; // v1.0.0
    const newVersion = execSync("npm version patch --no-git-tag-version", { encoding: "utf8" }).replace("\n", ""); // v1.0.1
    writeFileSync('./README.md', readme.replaceAll(currentVersion, newVersion), { encoding: 'utf8' });
    console.log(`Version updated from ${currentVersion} to ${newVersion}`);
    console.log("Committing and pushing changes...");
    execSync(`git add .`);
    execSync(`git commit -m "Release ${newVersion}"`);
    execSync(`git tag ${newVersion}`);
    execSync(`git push --tags origin main`);
    console.log("All done!");
})();
