async function fetchAllPages({
  fetchPage,
  getItems,
  hasMore,
  maxPages = 1000,
}) {
  const allItems = [];
  const seenIds = new Set();

  let pageNumber = 1;
  let currentCount = 0;
  let nextPageUrl = null;

  while (pageNumber <= maxPages) {
    const response = await fetchPage({
      pageNumber,
      currentCount,
      nextPageUrl,
    });

    const items = getItems(response) || [];

    console.log(
      `Pagination page ${pageNumber}: ${items.length} records`
    );

    for (const item of items) {
      const id =
        item?._id ||
        item?.id ||
        item?.transactionId ||
        null;

      if (id) {
        if (seenIds.has(id)) {
          continue;
        }

        seenIds.add(id);
      }

      allItems.push(item);
    }

    const previousNextPageUrl = nextPageUrl;

    nextPageUrl =
      response?.meta?.nextPageUrl ||
      response?.nextPageUrl ||
      null;

    const more =
      typeof hasMore === "function"
        ? hasMore({
            response,
            items,
            total: allItems.length,
            pageNumber,
            currentCount,
            nextPageUrl,
            previousNextPageUrl,
          })
        : Boolean(nextPageUrl) || items.length > 0;

    if (!more) {
      break;
    }

    pageNumber += 1;
    currentCount = allItems.length;
  }

  if (pageNumber > maxPages) {
    throw new Error(
      `Pagination stopped after maxPages=${maxPages}`
    );
  }

  return allItems;
}

module.exports = {
  fetchAllPages,
};
