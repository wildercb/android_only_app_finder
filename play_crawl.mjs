import gplay from 'google-play-scraper';
import fs from 'fs';
import { parse } from 'json2csv';
import readline from 'readline';

const MAX_ENTRIES = 500; // Adjust this to set the desired number of entries

const visited = new Set();
const seenDevelopers = new Set();
const queue = [];
const results = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getUserInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function crawl(initialAppId, name='app_results.csv') {
    try {
        // Get initial app details
        const initialApp = await gplay.app({ appId: initialAppId });
        queue.push(initialApp);

        while (queue.length > 0 && results.length < MAX_ENTRIES) {
            const app = queue.shift();
            if (visited.has(app.appId)) continue;

            try {
                // Get full app details
                const fullDetails = await gplay.app({ appId: app.appId });
                
                // Check if we've already seen this developer
                if (!seenDevelopers.has(fullDetails.developer)) {
                    results.push(fullDetails);
                    seenDevelopers.add(fullDetails.developer);
                    visited.add(app.appId);

                    console.log(`Processed ${results.length} apps. Current: ${fullDetails.title} (Developer: ${fullDetails.developer})`);

                    // Get similar apps
                    const similarApps = await gplay.similar({ appId: app.appId });
                    queue.push(...similarApps.filter(a => !visited.has(a.appId)));
                } else {
                    console.log(`Skipping app: ${fullDetails.title} (Developer already processed: ${fullDetails.developer})`);
                }

                // Add a small delay to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error processing ${app.appId}: ${error.message}`);
            }
        }

        // Write results to CSV
        const csv = parse(results);
        fs.writeFileSync(`data/${name}`, csv);
        console.log(`Crawling complete. ${results.length} entries from unique developers saved to app_results.csv`);
    } catch (error) {
        console.error(`Error starting crawl with app ID ${initialAppId}: ${error.message}`);
    } finally {
        rl.close();
    }
}

async function main() {
    const appId = await getUserInput("Enter the app ID to start crawling: ");
    const name = appId + 'play_store_crawl.csv';
    await crawl(appId, name);
}

main().catch(console.error);