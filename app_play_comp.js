import fs from 'fs';
import csv from 'csv-parser';
import { parse } from 'json2csv';
import playStore from 'google-play-scraper';
import appStore from 'app-store-scraper';

const outputFile = 'android_only_apps.csv';
const unverifiedFile = 'unverified_apps.csv';
const logFile = 'app_search_log.txt';

const results = [];
const seenDevelopers = new Set();

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message);
}

async function searchAppStore(app, rowNumber, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const searchResults = await appStore.search({ term: app.title, num: 1 });
            if (searchResults.length > 0) {
                const appStoreApp = searchResults[0];
                if (appStoreApp.title.toLowerCase() === app.title.toLowerCase() ||
                    appStoreApp.appId.toLowerCase() === app.appId.toLowerCase()) {
                    return { found: true, error: false };
                }
            }
            return { found: false, error: false };
        } catch (error) {
            log(`Row ${rowNumber}: Error searching App Store for "${app.title}" (Attempt ${i + 1}/${retries}): ${error.message}`);
            if (i === retries - 1) {
                log(`Row ${rowNumber}: Max retries reached for "${app.title}". Unable to verify.`);
                return { found: false, error: true };
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

function processCSV(inputFile) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(inputFile)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve())
            .on('error', (error) => reject(error));
    });
}

function appendToCSV(app, file) {
    const csvString = parse([app]);
    fs.appendFileSync(file, csvString);
}

async function findAndroidOnlyApps() {
    let androidOnlyAppsCount = 0;
    let unverifiedAppsCount = 0;

    // Write CSV headers
    const headers = Object.keys(results[0]).join(',') + '\n';
    fs.writeFileSync(outputFile, headers);
    fs.writeFileSync(unverifiedFile, headers);

    for (let i = 0; i < results.length; i++) {
        const app = results[i];
        const rowNumber = i + 2;

        if (seenDevelopers.has(app.developer)) {
            log(`Row ${rowNumber}: Skipping app: "${app.title}" (Developer already processed: ${app.developer})`);
            continue;
        }

        const searchResult = await searchAppStore(app, rowNumber);
        if (!searchResult.found && !searchResult.error) {
            appendToCSV(app, outputFile);
            androidOnlyAppsCount++;
            seenDevelopers.add(app.developer);
            log(`Row ${rowNumber}: Confirmed Android-only app: "${app.title}" (Developer: ${app.developer}). Total: ${androidOnlyAppsCount}`);
        } else if (searchResult.error) {
            appendToCSV(app, unverifiedFile);
            unverifiedAppsCount++;
            log(`Row ${rowNumber}: Unable to verify app: "${app.title}" (Developer: ${app.developer}). Total unverified: ${unverifiedAppsCount}`);
        } else {
            //log(`Row ${rowNumber}: App found in both stores: "${app.title}"`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return { androidOnlyAppsCount, unverifiedAppsCount };
}

async function main() {
    try {
        const inputFile = await getUserInput("Enter the app ID from crawl: ");
        log('Reading CSV file...');
        await processCSV(`data/${inputFile}_play_store_crawl.csv`);

        log('Searching for Android-only apps...');
        const { androidOnlyAppsCount, unverifiedAppsCount } = await findAndroidOnlyApps();

        log(`Process complete. Found ${androidOnlyAppsCount} confirmed Android-only apps from unique developers. Results saved to ${outputFile}`);
        log(`${unverifiedAppsCount} apps could not be verified due to API errors. These are saved to ${unverifiedFile}`);
    } catch (error) {
        log(`An error occurred: ${error}`);
    }
}

main();