let page = null;
const pagePromise = (link, browser) =>
  new Promise(async (resolve, reject) => {
    let dataObj = {};
    let newPage = await browser.newPage();
    await newPage.goto(link);
    dataObj["bookTitle"] = await newPage.$eval(
      ".product_main > h1",
      (text) => text.textContent
    );
    dataObj["bookPrice"] = await newPage.$eval(
      ".price_color",
      (text) => text.textContent
    );
    dataObj["noAvailable"] = await newPage.$eval(
      ".instock.availability",
      (text) => {
        // Strip new line and tab spaces
        text = text.textContent.replace(/(\r\n\t|\n|\r|\t)/gm, "");
        // Get the number of stock available
        let regexp = /^.*\((.*)\).*$/i;
        let stockAvailable = regexp.exec(text)[1].split(" ")[0];
        return stockAvailable;
      }
    );
    dataObj["imageUrl"] = await newPage.$eval(
      "#product_gallery img",
      (img) => img.src
    );
    dataObj["bookDescription"] = await newPage.$eval(
      "#product_description",
      (div) => div.nextSibling.nextSibling.textContent
    );
    dataObj["upc"] = await newPage.$eval(
      ".table.table-striped > tbody > tr > td",
      (table) => table.textContent
    );
    resolve(dataObj);
    await newPage.close();
  });

const scrapeCurrentPage = async (browser) => {
  let scrapedData = [];
  try {
    await page.waitForSelector(".page_inner");
    // Get the link to all the required books
    let urls = await page.$$eval("section ol > li", (links) => {
      // Make sure the book to be scraped is in stock
      links = links.filter(
        (link) =>
          link.querySelector(".instock.availability > i").textContent !==
          "In stock"
      );
      // Extract the links from the data
      links = links.map((el) => el.querySelector("h3 > a").href);
      return links;
    });

    // Loop through each of those links, open a new page instance and get the relevant data from them

    for (link in urls) {
      let currentPageData = await pagePromise(urls[link], browser);
      scrapedData.push(currentPageData);
      // console.log(currentPageData);
    }
  } catch (err) {
    console.log("Could not resolve the selector => ", err);
    return scrapedData;
  }

  // When all the data on this page is done, click the next button and start the scraping of the next page
  // You are going to check if this button exist first, so you know if there really is a next page.
  let nextButtonExist = false;
  try {
    await page.$eval(".next > a", (a) => a.textContent);
    nextButtonExist = true;
  } catch (err) {
    nextButtonExist = false;
  }
  if (nextButtonExist) {
    await page.click(".next > a");
    scrapeCurrentPage(browser).then((data) => scrapedData.concat(data)); // Call this function recursively
  }
  return scrapedData;
};

const scrapeObject = {
  url: "http://books.toscrape.com",
  async scraper(browser, category) {
    page = await browser.newPage({ timeout: 60000 });
    console.log(`navigating to ${this.url}...`);
    await page.goto(this.url);

    // Select the category of book to be displayed
    let selectedCategory = await page.$$eval(
      ".side_categories > ul > li > ul > li > a",
      (links, _category) => {
        // Search for the element that has the matching text
        links = links.map((a) =>
          a.textContent.replace(/(\r\n\t|\n|\r|\t|^\s|\s$|\B\s|\s\B)/gm, "") ===
          _category
            ? a
            : null
        );
        let link = links.filter((tx) => tx !== null)[0];
        return link.href;
      },
      category
    );

    // Navigate to the selected category
    await page.goto(selectedCategory);

    console.time();
    // Wait for the required DOM to be rendered
    let data = await scrapeCurrentPage(browser);
    console.log(data);
    console.timeEnd();
    await page.close();
    return data;
  },
};

module.exports = scrapeObject;
