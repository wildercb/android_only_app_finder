// Not currently functional 

import gplay from 'google-play-scraper';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Configuration
const config = {
  startRank: 200,
  endRank: 700,
  chunkSize: 100,  // Increased to 100 as per documentation max
  maxRetries: 10,
  initialRetryDelay: 5000,
  chunkDelay: 10000,
  collectionDelay: 30000,
  timeout: 30000,
  progressFile: 'scrape_progress.json'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation(operation, retries = config.maxRetries, initialDelay = config.initialRetryDelay) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delayTime = initialDelay * Math.pow(2, i);
      console.log(`Attempt ${i + 1} failed. Retrying in ${delayTime}ms...`);
      await delay(delayTime);
    }
  }
  throw lastError;
}

async function scrapeTopGamesChunk(collection, startRank, endRank, progress, country='us') {
  const start = startRank - 1;  // gplay.list uses 0-based index
  const num = Math.min(config.chunkSize, endRank - startRank + 1);

  console.log(`Scraping ${collection.name} from rank ${startRank} to ${startRank + num - 1}`);

  try {
    const results = await retryOperation(() => 
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Request timed out'));
        }, config.timeout);

        gplay.list({
          category: gplay.category.GAME,
          collection: collection.value,
          start: start,
          num: num,
          fullDetail: true,
          country: country,
        }).then(resolve).catch(reject).finally(() => clearTimeout(timeout));
      })
    );

    for (const [index, app] of results.entries()) {
      const game = {
        rank: startRank + index,
        appId: app.appId,
        title: app.title,
        developer: app.developer,
        score: app.score,
        ratings: app.ratings,
        installs: app.installs,
        price: app.price,
        free: app.free,
        genre: app.genre,
        lastUpdated: app.updated,
      };
      progress.games.push(game);
    }

    console.log(`Successfully scraped ${results.length} games from ${collection.name}`);

    // Update progress
    progress.lastScrapedRank[collection.name] = startRank + results.length - 1;
    await saveProgress(progress);

  } catch (error) {
    console.error(`Error scraping ${collection.name} from rank ${startRank}: ${error.message}`);
  }
}

async function scrapeTopGames(startRank, endRank) {
  const collections = [
    //{ name: 'TOP_FREE_GAMES', value: gplay.collection.TOP_FREE },
    { name: 'TOP_PAID_GAMES', value: gplay.collection.TOP_PAID }
  ];

  let progress = await loadProgress();

  for (const collection of collections) {
    console.log(`Starting to scrape ${collection.name}`);
    let currentRank = progress.lastScrapedRank[collection.name] + 1 || startRank;

    while (currentRank <= endRank) {
      await scrapeTopGamesChunk(collection, currentRank, endRank, progress);
      currentRank = progress.lastScrapedRank[collection.name] + 1;
      await delay(config.chunkDelay);
    }

    console.log(`Finished scraping ${collection.name}. Total games scraped: ${progress.games.length}`);
    await delay(config.collectionDelay);
  }

  return progress.games;
}

async function saveProgress(progress) {
  await writeFile(config.progressFile, JSON.stringify(progress, null, 2));
}

async function loadProgress() {
  if (existsSync(config.progressFile)) {
    try {
      const data = await readFile(config.progressFile, 'utf8');
      const progress = JSON.parse(data);
      progress.lastScrapedRank = progress.lastScrapedRank || {};
      progress.games = progress.games || [];
      return progress;
    } catch (error) {
      console.error(`Error loading progress file: ${error.message}`);
      console.log('Starting with empty progress');
    }
  }
  return { lastScrapedRank: {}, games: [] };
}

async function main() {
  try {
    console.log(`Starting scraping process for ranks ${config.startRank} to ${config.endRank}`);
    const games = await scrapeTopGames(config.startRank, config.endRank);

    // Remove duplicates based on appId
    const uniqueGames = Array.from(new Map(games.map(game => [game.appId, game])).values());

    // Sort games by rank
    uniqueGames.sort((a, b) => a.rank - b.rank);

    await saveProgress({ lastScrapedRank: {}, games: uniqueGames });

    console.log(`Scraped data for ${uniqueGames.length} unique games and saved to ${config.progressFile}`);
  } catch (error) {
    console.error(`Error in main function: ${error.message}`);
  }
}

main();