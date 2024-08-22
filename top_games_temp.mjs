import gplay from 'google-play-scraper';
import { writeFile } from 'fs/promises';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation(operation, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function scrapeTopGames(startRank, endRank) {
  const games = [];
  const collections = [gplay.collection.TOP_FREE_GAMES, gplay.collection.TOP_PAID_GAMES];

  for (const collection of collections) {
    try {
      const results = await retryOperation(() => gplay.list({
        category: gplay.category.GAME,
        collection: collection,
        num: endRank,
        fullDetail: true,
      }));

      const filteredResults = results.slice(startRank - 1, endRank);

      for (const [index, app] of filteredResults.entries()) {
        games.push({
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
        });
      }
    } catch (error) {
      console.error(`Error scraping ${collection}: ${error.message}`);
    }
  }

  return games;
}

async function main() {
  const startRank = 200; // Change this to your desired start rank
  const endRank = 500;  // Change this to your desired end rank

  try {
    const games = await scrapeTopGames(startRank, endRank);
    const outputFile = `top_games_${startRank}_${endRank}.json`;

    await writeFile(outputFile, JSON.stringify(games, null, 2));
    console.log(`Scraped data for ${games.length} games and saved to ${outputFile}`);
  } catch (error) {
    console.error(`Error in main function: ${error.message}`);
  }
}

main();